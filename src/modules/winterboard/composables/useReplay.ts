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
import { fetchReplayTimeline, fetchNearestSnapshot, fetchLessonMarkers } from '../api/replay'
import type { BoardOperation } from '../types/replay'
import type { WBLessonMarker } from '../types/winterboard'

export function useReplay(sessionId: string) {
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

  // Stored onOp callback for seekToWithSnapshot to re-apply ops
  let _onOp: ((op: BoardOperation) => void) | null = null

  const progress = computed(() =>
    totalOperations.value > 0
      ? Math.round((currentIndex.value / totalOperations.value) * 100)
      : 0,
  )

  /**
   * Fetch timeline from API and wire up the engine.
   * @param onOp - callback fired for each replayed operation (render to shadow canvas)
   * @param onStartState - optional callback to hydrate board store from snapshot at recording start.
   *   Викликається ДО onOp, щоб replay починав з фону/асетів які існували до натискання Start.
   */
  async function loadTimeline(
    onOp: (op: BoardOperation) => void,
    onStartState?: (state: { pages?: unknown[]; currentPageIndex?: number }) => void,
  ): Promise<void> {
    _onOp = onOp
    isLoading.value = true
    error.value = null
    try {
      const timeline = await fetchReplayTimeline(sessionId)
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
          currentIndex.value = idx + 1
          // A.2.4: update playback time
          const tMs = new Date(op.created_at).getTime() - firstOpAtMs.value
          currentTimeMs.value = Math.max(0, tMs)
          onOp(op)
        })
        .on('onProgress', (cur, total) => {
          currentIndex.value = cur
          totalOperations.value = total
        })
        .on('onStateChange', (s) => {
          state.value = s
        })
        .on('onComplete', () => {
          state.value = 'ended'
        })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load replay'
    } finally {
      isLoading.value = false
    }
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
  async function seekToWithSnapshot(
    idx: number,
    loadState: (boardState: Record<string, unknown>) => void,
    clearState: () => void,
  ): Promise<void> {
    if (!_onOp) return

    const snapshot = await fetchNearestSnapshot(sessionId, idx)

    if (snapshot && snapshot.operation_index <= idx) {
      // Load snapshot board state
      loadState(snapshot.board_state)

      // Apply remaining ops from snapshot.operation_index to idx
      const remaining = await fetchReplayTimeline(sessionId, {
        offset: snapshot.operation_index,
        limit: idx - snapshot.operation_index,
      })
      for (const op of remaining.operations) {
        _onOp(op)
      }
    } else {
      // No snapshot — replay from beginning
      clearState()
      const timeline = await fetchReplayTimeline(sessionId, { limit: idx })
      for (const op of timeline.operations) {
        _onOp(op)
      }
    }

    // Sync engine position
    engine.value?.seekTo(idx)
    currentIndex.value = idx
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
    loadTimeline,
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
    loadMarkers,
    destroy,
  }
}
