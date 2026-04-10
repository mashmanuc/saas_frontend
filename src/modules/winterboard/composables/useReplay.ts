// A12: useReplay — Vue composable wrapping WBReplayEngine
// Ref: DAY17_AGENT-A.md
// Zone: AGENT-A (composables/)
//
// Usage:
//   const replay = useReplay(sessionId)
//   await replay.loadTimeline((op) => applyOpToShadowCanvas(op))
//   replay.play()

import { ref, shallowRef, readonly, computed, watch } from 'vue'
import { WBReplayEngine, type ReplaySpeed, type ReplayState } from '../engine/WBReplayEngine'
import { fetchReplayTimeline, fetchPublicReplayByToken, fetchNearestSnapshot, fetchLessonMarkers } from '../api/replay'
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

    // Local seek: all ops already in engine memory — no HTTP needed.
    // Reset board to clean state, then re-apply ops 0..target (EXCLUSIVE).
    // Use _onOp directly (NOT through event emitter) to avoid per-op canvas redraws.
    // The caller's clearState/loadState handle the final render.
    //
    // CRITICAL: loop is EXCLUSIVE (i < clampedIdx), NOT inclusive (i <= clampedIdx).
    // seekTo(clampedIdx) sets engine.currentIndex = clampedIdx.
    // play() fires op at currentIndex, then increments.
    // If loop was inclusive, op at clampedIdx would be applied TWICE:
    //   1) in the for-loop during seek
    //   2) when play() fires from currentIndex = clampedIdx
    // This caused: first ops duplicated on start, ALL ops visible on restart.
    clearState()
    for (let i = 0; i < clampedIdx; i++) {
      const op = engine.value.getOperationAt(i)
      if (op) _onOp(op)
    }

    // Sync engine position — play() will fire op[clampedIdx] as next
    const actualIdx = engine.value.seekTo(clampedIdx)
    currentIndex.value = actualIdx

    // Update playback time
    if (totalOps > 0) {
      const targetOp = engine.value.getOperationAt(clampedIdx)
      if (targetOp) {
        const tMs = new Date(targetOp.created_at).getTime() - firstOpAtMs.value
        currentTimeMs.value = Math.max(0, tMs)
      }
    }
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
    engine.value?.destroy()
    engine.value = null
    _onOp = null
    _onStartState = null
    markers.value = []
    activeMarkerId.value = null
  }

  return {
    state: readonly(state),
    currentIndex: readonly(currentIndex),
    totalOperations: readonly(totalOperations),
    progress,
    isLoading: readonly(isLoading),
    error: readonly(error),
    retryCount: readonly(retryCount),
    loadTimeline,
    retryLoad,
    play,
    pause,
    stop,
    setSpeed,
    seekTo,
    seekToWithSnapshot,
    markers: readonly(markers),
    activeMarkerId: readonly(activeMarkerId),
    currentTimeMs: readonly(currentTimeMs),
    totalDurationMs,
    loadedOperations,
    timelineIncomplete,
    loadMarkers,
    destroy,
  }
}
