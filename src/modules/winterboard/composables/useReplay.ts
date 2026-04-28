// A12: useReplay — Vue composable wrapping WBReplayEngine
// Ref: DAY17_AGENT-A.md
// Zone: AGENT-A (composables/)
//
// Usage:
//   const replay = useReplay(sessionId)
//   await replay.loadTimeline((op) => applyOpToShadowCanvas(op))
//   replay.play()
//
// Replay engine wrapper — public replay (WBPublicView) playback path.
// Embedded replay (?mode=replay у SoloRoom/ClassroomRoom) видалений; цей
// composable обслуговує тільки public path через fetchPublicReplayByToken.

import { ref, shallowRef, readonly, computed, watch, onScopeDispose, getCurrentScope } from 'vue'
import { WBReplayEngine, type ReplaySpeed, type ReplayState } from '../engine/WBReplayEngine'
import {
  fetchReplayTimeline,
  fetchPublicReplayByToken,
  fetchNearestSnapshot,
  fetchLessonMarkers,
  reportReplayView,
} from '../api/replay'
import type { BoardOperation } from '../types/replay'
import type { WBLessonMarker } from '../types/winterboard'

export function useReplay(sessionId: string, publicToken?: string) {
  // REPLAY-FIX-3: shallowRef prevents Vue from deep-proxying the class instance.
  // ref() wraps the engine in a reactive Proxy that breaks private fields,
  // setTimeout callbacks, and `this` context inside class methods.
  const engine = shallowRef<WBReplayEngine | null>(null)
  const state = ref<ReplayState>('idle')
  const currentIndex = ref(0)
  const totalOperations = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // P1: seek optimization — non-blocking chunked execution
  const isSeeking = ref(false)
  const seekProgress = ref(0) // 0..1 progress for UI
  let seekRafId: number | null = null

  // P2: batching flag — tells component to skip per-op effects during seek
  const isBatchingSeek = ref(false)
  const seekCompleted = ref(false) // trigger for single redraw at end

  // Phase 10 P5: Lesson markers
  const markers = ref<WBLessonMarker[]>([])
  const activeMarkerId = ref<string | null>(null)

  // A.2.4: real-time playback tracking (for MM:SS display)
  const firstOpAtMs = ref(0)
  const lastOpAtMs = ref(0)
  const currentTimeMs = ref(0)
  const totalDurationMs = computed(() => Math.max(0, lastOpAtMs.value - firstOpAtMs.value))

  // Stored callbacks for seekToWithSnapshot / retry
  let _onOp: ((op: BoardOperation) => void) | null = null
  let _onStartState: ((state: { pages?: unknown[]; currentPageIndex?: number }) => void) | null = null

  // Phase 3 cache plan (D6 + cleanup fix): viewping timer для public replays.
  // pingSent — idempotence per session (не пінгуємо два рази навіть при reload).
  // pingTimer — handle для cleanup якщо user закриє вкладку до 5с.
  const pingTimer = ref<ReturnType<typeof setTimeout> | null>(null)
  const pingSent = ref(false)

  // P1: cancel any pending seek (component unmount or new seek)
  function cancelPendingSeek(): void {
    if (seekRafId !== null) {
      cancelAnimationFrame(seekRafId)
      seekRafId = null
    }
    isSeeking.value = false
    seekProgress.value = 0
    isBatchingSeek.value = false
    seekCompleted.value = false
  }

  const progress = computed(() =>
    totalOperations.value > 0
      ? Math.round((currentIndex.value / totalOperations.value) * 100)
      : 0,
  )

  // True when backend has more ops than engine loaded (timeline > 2000 ops)
  const loadedOperations = computed(() => engine.value?.getTotalOperations() ?? 0)
  const timelineIncomplete = computed(() => loadedOperations.value < totalOperations.value)

  /**
   * Fetch timeline from API and wire up the engine.
   * @param onOp - callback fired for each replayed operation (render to shadow canvas)
   * @param onStartState - optional callback to hydrate board store from snapshot at recording start.
   *   Викликається ДО onOp, щоб replay починав з фону/асетів які існували до натискання Start.
   */
  // Retry counter for loadTimeline (exposed for Retry button)
  const retryCount = ref(0)

  async function loadTimeline(
    onOp: (op: BoardOperation) => void,
    onStartState?: (state: { pages?: unknown[]; currentPageIndex?: number }) => void,
  ): Promise<void> {
    _onOp = onOp
    _onStartState = onStartState ?? null
    isLoading.value = true
    error.value = null
    try {
      // Timeout: 15s max wait — prevents infinite hang when CORS/network fails silently
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000)
      let timeline: Awaited<ReturnType<typeof fetchReplayTimeline>>
      try {
        // Request ALL ops (limit=2000 = backend max) so local seek works on full timeline.
        // Use public endpoint (no auth) when publicToken is provided.
        timeline = publicToken
          ? await fetchPublicReplayByToken(publicToken)
          : await fetchReplayTimeline(sessionId, { limit: 2000 }, controller.signal)
      } finally {
        clearTimeout(timeout)
      }
      totalOperations.value = timeline.total_operations
      // A.2.4: derive playback duration з timestamps крайніх ops
      if (timeline.operations && timeline.operations.length > 0) {
        firstOpAtMs.value = new Date(timeline.operations[0].created_at).getTime()
        lastOpAtMs.value = new Date(timeline.operations[timeline.operations.length - 1].created_at).getTime()
        currentTimeMs.value = 0
      }
      // INV-T: hydrate з recording_start_state ПЕРЕД накаткою ops
      if (timeline.start_state && onStartState) {
        try { onStartState(timeline.start_state) } catch (e) { console.warn('[replay] start_state hydrate failed', e) }
      }

      engine.value = new WBReplayEngine(timeline)
        .on('onOperation', (op, idx) => {
          const safeIdx = typeof idx === 'number' ? idx : 0
          currentIndex.value = safeIdx + 1
          // A.2.4: update playback time
          const tMs = new Date(op.created_at).getTime() - firstOpAtMs.value
          currentTimeMs.value = Math.max(0, typeof tMs === 'number' ? tMs : 0)
          onOp(op)
        })
        .on('onProgress', (cur, total) => {
          currentIndex.value = typeof cur === 'number' ? cur : 0
          totalOperations.value = typeof total === 'number' ? total : 0
        })
        .on('onStateChange', (s) => {
          state.value = s
        })
        .on('onComplete', () => {
          state.value = 'ended'
        })

      // Phase 3 cache plan (D6): викликати view-ping ТІЛЬКИ для public replays
      // через 5с після loadTimeline → user реально дивиться, не bot scan.
      // Idempotence: pingSent flag + backend 5-min debounce per ip_hash.
      // Cleanup: onScopeDispose нижче — якщо component unmount-ається до 5с,
      // ping НЕ летить (real viewer threshold не досягнутий).
      if (publicToken && !pingSent.value && timeline.operations && timeline.operations.length > 0) {
        if (pingTimer.value) clearTimeout(pingTimer.value)
        pingTimer.value = setTimeout(() => {
          if (pingSent.value) return
          pingSent.value = true
          // Silent fail — analytics не блокує playback
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

  /** Retry loading timeline (for Retry button in UI) */
  async function retryLoad(): Promise<void> {
    if (!_onOp) return
    await loadTimeline(_onOp, _onStartState ?? undefined)
  }

  function play(): void { engine.value?.play() }
  function pause(): void { engine.value?.pause() }
  function stop(): void {
    engine.value?.stop()
    currentIndex.value = 0
  }
  function setSpeed(s: ReplaySpeed): void { engine.value?.setSpeed(s) }
  function seekTo(idx: number): void { engine.value?.seekTo(idx) }

  /** Step forward 1 op. Applies the operation via _onOp callback. Pauses if playing. */
  function stepForward(): void {
    if (!engine.value || !_onOp) return
    const op = engine.value.stepForward()
    if (op) {
      _onOp(op)
      currentIndex.value = engine.value.getCurrentIndex()
      // Update playback time
      const tMs = new Date(op.created_at).getTime() - firstOpAtMs.value
      currentTimeMs.value = Math.max(0, tMs)
    }
    // Sync state
    state.value = engine.value.getState()
  }

  /**
   * Step backward 1 op. Requires snapshot-based reset because ops are not reversible.
   * Caller must provide loadState/clearState callbacks (same as seekToWithSnapshot).
   */
  async function stepBackward(
    loadState: (boardState: Record<string, unknown>) => void,
    clearState: () => void,
  ): Promise<void> {
    if (!engine.value || !_onOp) return
    const targetIdx = Math.max(0, engine.value.getCurrentIndex() - 1)
    // Reuse seekToWithSnapshot — it resets board + replays ops 0..targetIdx
    await seekToWithSnapshot(targetIdx, loadState, clearState)
    state.value = engine.value.getState()
  }

  /**
   * Seek to a specific operation index using snapshots for performance.
   * 1. Fetch nearest snapshot at or before idx
   * 2. If found: load snapshot board state, then apply remaining ops
   * 3. If not found: replay from beginning (fallback)
   *
   * @param idx - target operation index
   * @param loadState - callback to hydrate board store from snapshot board_state
   * @param clearState - callback to clear board state before replay-from-zero
   */
  /**
   * Fast local seek — replay ops from engine memory, NO HTTP requests.
   * Works for any replay where ops are already loaded in engine.
   * clearState resets board, then ops 0..idx are re-applied locally.
   *
   * P1 OPTIMIZATION: Non-blocking chunked execution via requestAnimationFrame.
   * Prevents UI freeze on large seek (1000+ ops) by yielding to main thread.
   */
  async function seekToWithSnapshot(
    idx: number,
    loadState: (boardState: Record<string, unknown>) => void,
    clearState: () => void,
  ): Promise<void> {
    if (!_onOp || !engine.value) return

    const totalOps = engine.value.getTotalOperations()
    const clampedIdx = Math.max(0, Math.min(idx, totalOps - 1))

    // Guard: if timeline is partial (> 2000 ops), local seek only works within loaded range
    if (totalOps < totalOperations.value) {
      console.warn(`[replay] partial timeline: engine has ${totalOps}/${totalOperations.value} ops. Seek clamped.`)
    }

    // P1: Edge case — target = 0, nothing to do
    if (clampedIdx === 0) {
      clearState()
      const actualIdx = engine.value.seekTo(0)
      currentIndex.value = actualIdx
      currentTimeMs.value = 0
      return
    }

    // P1: Cancel any previous pending seek (new seek or component unmount)
    cancelPendingSeek()

    // P1: Start chunked seek
    // P2: enable batching mode — components will skip per-op effects
    isSeeking.value = true
    isBatchingSeek.value = true
    seekProgress.value = 0
    seekCompleted.value = false

    return new Promise((resolve) => {
      clearState()

      const CHUNK_SIZE = 20 // ops per frame (yields ~16ms budget for render)

      const applyChunk = (startIndex: number): void => {
        // Component unmounted or new seek started — abort
        if (!engine.value || !_onOp) {
          cancelPendingSeek()
          resolve()
          return
        }

        const end = Math.min(startIndex + CHUNK_SIZE, clampedIdx)

        // Apply chunk of ops
        for (let i = startIndex; i < end; i++) {
          const op = engine.value.getOperationAt(i)
          if (op) {
            try {
              _onOp(op)
            } catch (e) {
              // HIGH 9: Don't break seek if single op fails — continue with remaining
              console.warn(`[replay] failed to apply op ${i}:`, e)
            }
          }
        }

        // Update progress state for UI
        seekProgress.value = clampedIdx > 0 ? end / clampedIdx : 0
        currentIndex.value = end

        if (end < clampedIdx) {
          // More ops to apply — schedule next chunk
          seekRafId = requestAnimationFrame(() => applyChunk(end))
        } else {
          // Done — finalize seek
          finalizeSeek()
        }
      }

      const finalizeSeek = (): void => {
        seekRafId = null
        isSeeking.value = false
        isBatchingSeek.value = false
        seekProgress.value = 1

        // P2: signal completion — component will do single batchDraw
        seekCompleted.value = true

        // Sync engine position — play() will fire op[clampedIdx] as next
        const actualIdx = engine.value!.seekTo(clampedIdx)
        currentIndex.value = actualIdx

        // Update playback time
        if (totalOps > 0) {
          const targetOp = engine.value!.getOperationAt(clampedIdx)
          if (targetOp) {
            const tMs = new Date(targetOp.created_at).getTime() - firstOpAtMs.value
            currentTimeMs.value = Math.max(0, tMs)
          }
        }

        resolve()
      }

      // Start first chunk
      applyChunk(0)
    })
  }

  // Phase 10 P5: Auto-detect active marker during playback
  watch(currentIndex, (idx) => {
    if (markers.value.length === 0) {
      activeMarkerId.value = null
      return
    }
    const sorted = [...markers.value].sort((a, b) => b.operation_index - a.operation_index)
    const active = sorted.find(m => m.operation_index <= idx)
    activeMarkerId.value = active?.id ?? null
  })

  async function loadMarkers(): Promise<void> {
    try {
      const result = await fetchLessonMarkers(sessionId)
      markers.value = result.markers
    } catch {
      // markers are non-critical — silent fail
    }
  }

  function destroy(): void {
    // P1: Cancel any pending seek before destroying
    cancelPendingSeek()
    engine.value?.destroy()
    engine.value = null
    _onOp = null
    _onStartState = null
    markers.value = []
    activeMarkerId.value = null
    // Phase 3: clear viewping timer (якщо <5с — ping не летить)
    if (pingTimer.value) {
      clearTimeout(pingTimer.value)
      pingTimer.value = null
    }
  }

  // Phase 3 cleanup: автоматичний clearTimeout при scope dispose
  // (component unmount, або scope cleanup у parent component).
  // Без цього ping продовжує рахувати timer навіть після того як user
  // закрив вкладку → false-positive "real viewer".
  // Guard: useReplay може викликатись з click-handler (поза setup) — у такому
  // випадку active scope відсутній; cleanup тоді — відповідальність caller'а.
  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (pingTimer.value) {
        clearTimeout(pingTimer.value)
        pingTimer.value = null
      }
    })
  }

  return {
    state: readonly(state),
    currentIndex: readonly(currentIndex),
    totalOperations: readonly(totalOperations),
    progress,
    isLoading: readonly(isLoading),
    error: readonly(error),
    retryCount: readonly(retryCount),
    // P1: seek optimization state for UI
    isSeeking: readonly(isSeeking),
    seekProgress: readonly(seekProgress),
    // P2: batching flags — skip per-op effects during seek, single redraw at end
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
  }
}
