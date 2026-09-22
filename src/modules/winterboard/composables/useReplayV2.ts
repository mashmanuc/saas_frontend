// ReplayV2: useReplayV2 — чинний composable Replay (дефолт WBPublicView з 2026-05-14;
// V1 лише за ?replay=v1).
//
// Seek (REPLAY_MANIFEST v2.2, REPLAY-INV-5): до SEQUENTIAL_SEEK_MAX_OPS стан
// будується з ops одним проходом; далі — знімок + дельта. Таймер гри утримано
// на час seek.
//
// INV-V2-1: НЕ імпортує з useReplay.ts або WBReplayEngine.ts.
// INV-V2-2: Snapshot load = atomic replace (clearState → loadState).
// INV-V2-3: Delta apply bounded — MAX_DELTA_OPS = 150.
// INV-V2-4: NullSnapshotProvider = pure noop.
// INV-V2-PUB: Phase B — usePublicSnapshots = true activates PublicSnapshotProvider.
//
// Return shape = той самий що useReplay (drop-in replacement).

import { ref, shallowRef, readonly, computed, watch, onScopeDispose, getCurrentScope } from 'vue'
import { WBReplayEngineV2, type ReplaySpeedV2, type ReplayStateV2 } from '../engine/WBReplayEngineV2'
import { AuthSnapshotProvider } from '../engine/snapshot/AuthSnapshotProvider'
import { PublicSnapshotProvider } from '../engine/snapshot/PublicSnapshotProvider'
import { NullSnapshotProvider, type ReplaySnapshotProvider } from '../engine/snapshot/SnapshotProvider'
import {
  fetchPublicReplayByToken,
  fetchOwnerReplayPlayback,
  fetchReplayTimeline,
  fetchLessonMarkers,
  fetchPublicLessonMarkers,
  reportReplayView,
} from '../api/replay'
import type { BoardOperation } from '../types/replay'
import type { WBLessonMarker } from '../types/winterboard'

// INV-V2-3: якщо delta > MAX_DELTA_OPS → treat snapshot як відсутній → full apply fallback.
const MAX_DELTA_OPS = 150

// До цієї кількості ops seek ЗАВЖДИ будує стан з ops (той самий шлях, що й гра),
// знімок не запитується. Причина — знімки бувають биті: REPLAY_PIPELINE_SSOT §7
// інваріант 5 (G1) «board_state = apply(ops)» порушено, а V2 знімок не перевіряє.
// Звірка 2026-09-22 на локальному записі (461 op, 7 знімків): 3 знімки без
// частини штрихів (напр. seq 322: 0 штрихів на стор. 3 проти 101 з ops) →
// після перемотування дошка з дірками, і гра їх не повертає. Вартість
// з ops виміряна на справжньому boardStore: 2000 ops ≈ 160 мс, 5000 ≈ 380 мс
// (типові записи 100–2000 ops). Коли G1 закрито на бекенді — поріг знизити.
const SEQUENTIAL_SEEK_MAX_OPS = 3000

// ─── Snapshot observability (advisor 2026-05-14) ───────────────────────────
// Module-level counters — видно як window.__replayV2Metrics у DevTools (dev-only).
// Sentry захопить console.info як breadcrumbs якщо виникне exception.
const _snapMetrics = {
  fetchCount: 0,
  fallbackCount: 0,
  fetchTotalMs: 0,
  applyTotalMs: 0,
}
if (import.meta.env.DEV) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__replayV2Metrics = _snapMetrics
}

export interface UseReplayV2Options {
  /**
   * INV-V2-PUB Phase B: якщо true + publicToken присутній → PublicSnapshotProvider.
   * false = NullSnapshotProvider для anonymous (Phase A поведінка).
   * Rollout: активується через ?replay=v2-public feature flag.
   */
  usePublicSnapshots?: boolean
  /** Власник дивиться private replay за id, без public token. */
  ownerReplayId?: string
}

export function useReplayV2(sessionId: string, publicToken?: string, options: UseReplayV2Options = {}) {
  const engine = shallowRef<WBReplayEngineV2 | null>(null)
  const state = ref<ReplayStateV2>('idle')
  const currentIndex = ref(0)
  const totalOperations = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const retryCount = ref(0)

  // Seek state (спрощений порівняно з V1 — snapshot path не потребує rAF chunking)
  const isSeeking = ref(false)
  const seekProgress = ref(0)
  const isBatchingSeek = ref(false)   // сумісність з V1 interface
  const seekCompleted = ref(false)    // сумісність з V1 interface

  // Time-axis
  const firstOpAtMs = ref(0)
  const lastOpAtMs = ref(0)
  const currentTimeMs = ref(0)
  const totalDurationMs = computed(() => Math.max(0, lastOpAtMs.value - firstOpAtMs.value))

  // Lesson markers
  const markers = ref<WBLessonMarker[]>([])
  const activeMarkerId = ref<string | null>(null)

  // Callbacks (зберігаємо для retry та seekToWithSnapshot)
  let _onOp: ((op: BoardOperation) => void) | null = null
  let _onStartState: ((state: { pages?: unknown[]; currentPageIndex?: number }) => void) | null = null

  // SnapshotProvider selection:
  //   ?replay=v2-public (usePublicSnapshots=true) + publicToken → PublicSnapshotProvider (Phase B)
  //   sessionId present                                         → AuthSnapshotProvider (owner: silent null on 403)
  //   anonymous, no public snapshots                            → NullSnapshotProvider (INV-V2-4)
  const provider: ReplaySnapshotProvider =
    (options.usePublicSnapshots && publicToken)
      ? new PublicSnapshotProvider(publicToken)        // INV-V2-PUB-1: token only, no sessionId
      : sessionId
        ? new AuthSnapshotProvider(sessionId)
        : new NullSnapshotProvider()

  // Race protection: кожен seek отримує версію; після await — перевіряємо актуальність.
  let _seekVersion = 0

  // Analytics ping
  const pingTimer = ref<ReturnType<typeof setTimeout> | null>(null)
  const pingSent = ref(false)

  const progress = computed(() =>
    totalOperations.value > 0
      ? Math.round((currentIndex.value / totalOperations.value) * 100)
      : 0,
  )

  const loadedOperations = computed(() => engine.value?.getTotalOperations() ?? 0)
  const timelineIncomplete = computed(() => loadedOperations.value < totalOperations.value)

  // ─── Seek cancellation ─────────────────────────────────────────────────────

  // V2: немає rAF seek loop → cancel тільки оновлює стан
  function cancelPendingSeek(): void {
    _seekVersion++ // будь-який активний seek з попередньою версією стане stale
    isSeeking.value = false
    seekProgress.value = 0
    isBatchingSeek.value = false
    seekCompleted.value = false
  }

  // ─── Load timeline ─────────────────────────────────────────────────────────

  async function loadTimeline(
    onOp: (op: BoardOperation) => void,
    onStartState?: (state: { pages?: unknown[]; currentPageIndex?: number }) => void,
  ): Promise<void> {
    _onOp = onOp
    _onStartState = onStartState ?? null
    isLoading.value = true
    error.value = null

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000)
      let timeline: Awaited<ReturnType<typeof fetchReplayTimeline>>
      try {
        timeline = options.ownerReplayId
          ? await fetchOwnerReplayPlayback(options.ownerReplayId, controller.signal)
          : publicToken
          ? await fetchPublicReplayByToken(publicToken)
          : await fetchReplayTimeline(sessionId, { limit: 2000 }, controller.signal)
      } finally {
        clearTimeout(timeout)
      }

      totalOperations.value = timeline.total_operations
      if (timeline.operations && timeline.operations.length > 0) {
        firstOpAtMs.value = new Date(timeline.operations[0].created_at).getTime()
        lastOpAtMs.value = new Date(timeline.operations[timeline.operations.length - 1].created_at).getTime()
        currentTimeMs.value = 0
      }

      if (timeline.start_state && onStartState) {
        try { onStartState(timeline.start_state) } catch (e) { console.warn('[replay:v2] start_state hydrate failed', e) }
      }

      engine.value = new WBReplayEngineV2(timeline)
        .on('onOperation', (op, idx) => {
          const safeIdx = typeof idx === 'number' ? idx : 0
          currentIndex.value = safeIdx + 1
          const tMs = new Date(op.created_at).getTime() - firstOpAtMs.value
          currentTimeMs.value = Math.max(0, typeof tMs === 'number' ? tMs : 0)
          onOp(op)
        })
        .on('onProgress', (cur, total) => {
          currentIndex.value = typeof cur === 'number' ? cur : 0
          totalOperations.value = typeof total === 'number' ? total : 0
        })
        .on('onStateChange', (s) => { state.value = s })
        .on('onComplete', () => { state.value = 'ended' })

      if (publicToken && !pingSent.value && timeline.operations?.length) {
        if (pingTimer.value) clearTimeout(pingTimer.value)
        pingTimer.value = setTimeout(() => {
          if (pingSent.value) return
          pingSent.value = true
          void reportReplayView(publicToken)
        }, 5000)
      }
    } catch (e) {
      const isAbort = e instanceof DOMException && e.name === 'AbortError'
      error.value = isAbort
        ? 'Сервер не відповідає. Натисніть «Повторити» або перезавантажте сторінку.'
        : (e instanceof Error ? e.message : 'Failed to load replay')
      retryCount.value++
    } finally {
      isLoading.value = false
    }
  }

  async function retryLoad(): Promise<void> {
    if (!_onOp) return
    await loadTimeline(_onOp, _onStartState ?? undefined)
  }

  // ─── Playback controls ─────────────────────────────────────────────────────

  function play(): void { engine.value?.play() }
  function pause(): void { engine.value?.pause() }
  function stop(): void { engine.value?.stop(); currentIndex.value = 0 }
  function setSpeed(s: ReplaySpeedV2): void { engine.value?.setSpeed(s) }
  function seekTo(idx: number): void { engine.value?.seekTo(idx) }

  function stepForward(): void {
    if (!engine.value || !_onOp) return
    const op = engine.value.stepForward()
    if (op) {
      _onOp(op)
      currentIndex.value = engine.value.getCurrentIndex()
      const tMs = new Date(op.created_at).getTime() - firstOpAtMs.value
      currentTimeMs.value = Math.max(0, tMs)
    }
    state.value = engine.value.getState()
  }

  async function stepBackward(
    loadState: (boardState: Record<string, unknown>) => void,
    clearState: () => void,
  ): Promise<void> {
    if (!engine.value || !_onOp) return
    const targetIdx = Math.max(0, engine.value.getCurrentIndex() - 1)
    await seekToWithSnapshot(targetIdx, loadState, clearState)
    state.value = engine.value.getState()
  }

  // ─── Snapshot-based seek ───────────────────────────────────────────────────

  /**
   * Snapshot-based seek (V2 core).
   *
   * Flow:
   *   1. Fetch nearest snapshot via SnapshotProvider (async, race-protected)
   *   2a. Snapshot found + delta ≤ MAX_DELTA_OPS:
   *       clearState() → loadState(snap.board_state) [atomic replace] → apply delta ops [sync]
   *   2b. No snapshot / delta > MAX_DELTA_OPS:
   *       clearState() → apply all ops 0..idx-1 [sync, one pass — no visible scroll]
   *
   * Весь час seek таймер відтворення утримано (engine.holdForSeek).
   *
   * INV-V2-2: snapshot = atomic replace (always clearState first).
   * INV-V2-3: delta > MAX_DELTA_OPS → fallback, never slow V2.
   */
  async function seekToWithSnapshot(
    idx: number,
    loadState: (boardState: Record<string, unknown>) => void,
    clearState: () => void,
  ): Promise<void> {
    if (!_onOp || !engine.value) return

    const totalOps = engine.value.getTotalOperations()
    const clampedIdx = Math.max(0, Math.min(idx, totalOps - 1))

    if (clampedIdx === 0) {
      clearState()
      const actualIdx = engine.value.seekTo(0)
      currentIndex.value = actualIdx
      currentTimeMs.value = 0
      return
    }

    // Race protection: increment version before any async operation
    cancelPendingSeek()
    const myVersion = ++_seekVersion

    // Таймер відтворення стоїть, поки йде seek: інакше він докидає ops зі старої
    // позиції (видно після кліку, а в запасному шляху — дублі й зламаний порядок).
    // Стан 'playing' лишається; _finalizeSeek → engine.seekTo() запускає таймер
    // з нової позиції. Якщо seek перебив новіший — таймер відновить той.
    engine.value.holdForSeek()

    isSeeking.value = true
    isBatchingSeek.value = true
    seekCompleted.value = false
    seekProgress.value = 0

    // ── Step 1: try to fetch snapshot (async) ────────────────────────────────
    let snapshotStartIdx = 0  // 0 = no snapshot → full apply
    let snapshotBoardState: Record<string, unknown> | null = null
    let _fetchMs = 0

    if (clampedIdx > SEQUENTIAL_SEEK_MAX_OPS) {
      // seek(T) = стан після ops [0..T-1]. Знімок із seq=S — стан ПІСЛЯ op S
      // (ops_worker._create_snapshot, включно). Тож шукаємо знімок не пізніше
      // останньої op, яку треба застосувати, — op[T-1], а не op[T]: інакше
      // знімок, зроблений рівно на op[T], уже містить наступну op, і гра
      // застосувала б її вдруге.
      const targetOp = engine.value.getOperationAt(clampedIdx - 1)
      const targetSeq = typeof targetOp?.seq === 'number' ? targetOp.seq : null

      if (targetSeq !== null) {
        const _t0 = performance.now()
        const snap = await provider.fetchNearest(targetSeq)
        _fetchMs = performance.now() - _t0
        _snapMetrics.fetchCount++
        _snapMetrics.fetchTotalMs += _fetchMs

        // Race check: another seek started while we were fetching
        if (_seekVersion !== myVersion) return

        // C9: snap.operation_index = SESSION-level count (absolute from session start).
        // clampedIdx = ENGINE index (0-based within replay's op range).
        // For replays that start mid-session these numbers differ → comparing them
        // directly always rejects the snapshot → V2 degrades to rAF O(N) fallback.
        // Fix: convert snap.seq → engine index via findIndexBySeq().
        if (snap?.board_state) {
          const snapEngineIdx = typeof snap.seq === 'number'
            ? engine.value.findIndexBySeq(snap.seq)
            : -1

          // Знімок уже містить op[snapEngineIdx] → дельта з наступної.
          const deltaOps = snapEngineIdx >= 0 ? clampedIdx - (snapEngineIdx + 1) : Infinity

          if (snapEngineIdx >= 0 && snapEngineIdx < clampedIdx && deltaOps <= MAX_DELTA_OPS) {   // INV-V2-3
            snapshotStartIdx = snapEngineIdx + 1
            snapshotBoardState = snap.board_state as Record<string, unknown>
          } else {
            // snapshot found but not usable (seq not in replay range or delta > MAX_DELTA_OPS)
            _snapMetrics.fallbackCount++
            const _reason = snapEngineIdx < 0 ? 'seq_not_in_replay' : `delta_too_large(${deltaOps})`
            console.info(
              `[replay:v2] snapshot_fallback target_idx=${clampedIdx} fetch_ms=${_fetchMs.toFixed(1)} reason=${_reason} snap_engine_idx=${snapEngineIdx}`,
            )
          }
        } else {
          // no snapshot returned
          _snapMetrics.fallbackCount++
          console.info(
            `[replay:v2] snapshot_fallback target_idx=${clampedIdx} fetch_ms=${_fetchMs.toFixed(1)} reason=no_snapshot`,
          )
        }
      }
    }

    if (_seekVersion !== myVersion) return  // final race check before mutations

    // ── Step 2a: snapshot path — sync delta apply ─────────────────────────────
    if (snapshotBoardState !== null) {
      // INV-V2-2: atomic replace — clear first, then load snapshot
      clearState()
      loadState(snapshotBoardState)

      // Sync apply of bounded delta ops (≤ MAX_DELTA_OPS — fast, no rAF needed)
      const _applyT0 = performance.now()
      const _deltaCount = clampedIdx - snapshotStartIdx
      for (let i = snapshotStartIdx; i < clampedIdx; i++) {
        if (!engine.value || !_onOp) break
        const op = engine.value.getOperationAt(i)
        if (op) {
          try { _onOp(op) } catch (e) { console.warn(`[replay:v2] delta op ${i}:`, e) }
        }
      }
      const _applyMs = performance.now() - _applyT0
      _snapMetrics.applyTotalMs += _applyMs

      console.info(
        `[replay:v2] snapshot_hit target_idx=${clampedIdx} snap_idx=${snapshotStartIdx} delta_ops=${_deltaCount} fetch_ms=${_fetchMs.toFixed(1)} apply_ms=${_applyMs.toFixed(1)}`,
      )

      _finalizeSeek(clampedIdx)
      return
    }

    // ── Step 2b: fallback — повне застосування ОДНИМ проходом ─────────────────
    // Раніше — порції по 20 ops на кадр через rAF (V1, 2026-04-23, коли кожна op
    // запускала fadeIn і перемальовування). Між порціями браузер малював дошку,
    // і людина бачила прокручування всіх проміжних станів — «дьоргання» при
    // перемотуванні (скарга власника 2026-09-22). Ефекти на op уже вимкнені
    // (isBatchingSeek), тож порції лише показували проміжне. Вимір на справжньому
    // boardStore: 200 ops ≈ 20 мс, 2000 ≈ 160 мс — одна коротка пауза замість
    // секунди видимого прокручування. Перемальовування одне — після finalize.
    clearState()
    const applyOp = _onOp
    for (let i = 0; i < clampedIdx; i++) {
      const op = engine.value.getOperationAt(i)
      if (op) {
        try { applyOp(op) } catch (e) { console.warn(`[replay:v2] fallback op ${i}:`, e) }
      }
    }
    _finalizeSeek(clampedIdx)
  }

  function _finalizeSeek(clampedIdx: number): void {
    if (!engine.value) return
    const actualIdx = engine.value.seekTo(clampedIdx)
    currentIndex.value = actualIdx
    seekProgress.value = 1
    isSeeking.value = false
    isBatchingSeek.value = false
    seekCompleted.value = true  // тригер для batchDraw у компоненті

    const op = engine.value.getOperationAt(actualIdx)
    if (op) {
      const tMs = new Date(op.created_at).getTime() - firstOpAtMs.value
      currentTimeMs.value = Math.max(0, tMs)
    }
  }

  // ─── Markers ───────────────────────────────────────────────────────────────

  watch(currentIndex, (idx) => {
    if (markers.value.length === 0) { activeMarkerId.value = null; return }
    const sorted = [...markers.value].sort((a, b) => b.operation_index - a.operation_index)
    activeMarkerId.value = sorted.find(m => m.operation_index <= idx)?.id ?? null
  })

  async function loadMarkers(): Promise<void> {
    try {
      // Публічний перегляд → за токеном: owner-ендпоінт давав чужому 403/401 і тост.
      const result = publicToken && !options.ownerReplayId
        ? await fetchPublicLessonMarkers(publicToken)
        : await fetchLessonMarkers(sessionId)
      markers.value = result.markers
    } catch { /* non-critical */ }
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  function destroy(): void {
    cancelPendingSeek()
    engine.value?.destroy()
    engine.value = null
    _onOp = null
    _onStartState = null
    markers.value = []
    activeMarkerId.value = null
    if (pingTimer.value) { clearTimeout(pingTimer.value); pingTimer.value = null }
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (pingTimer.value) { clearTimeout(pingTimer.value); pingTimer.value = null }
    })
  }

  // ─── Public API (same shape as useReplay — drop-in replacement) ────────────

  return {
    state: readonly(state),
    currentIndex: readonly(currentIndex),
    totalOperations: readonly(totalOperations),
    progress,
    isLoading: readonly(isLoading),
    error: readonly(error),
    retryCount: readonly(retryCount),
    isSeeking: readonly(isSeeking),
    seekProgress: readonly(seekProgress),
    isBatchingSeek: readonly(isBatchingSeek),
    seekCompleted: readonly(seekCompleted),
    loadTimeline,
    retryLoad,
    play,
    pause,
    stop,
    setSpeed,
    seekTo,
    seekToWithSnapshot,
    stepForward,
    stepBackward,
    markers: readonly(markers),
    activeMarkerId: readonly(activeMarkerId),
    currentTimeMs: readonly(currentTimeMs),
    totalDurationMs,
    loadedOperations,
    timelineIncomplete,
    loadMarkers,
    destroy,
    getOperationAt: (idx: number) => engine.value?.getOperationAt(idx) ?? null,
    findIndexByTimeMs: (ms: number) => engine.value?.findIndexByTimeMs(ms) ?? 0,
    getOperationTimeMs: (idx: number) => engine.value?.getOperationTimeMs(idx) ?? 0,
  }
}
