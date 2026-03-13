// A12: useReplay — Vue composable wrapping WBReplayEngine
// Ref: DAY17_AGENT-A.md
// Zone: AGENT-A (composables/)
//
// Usage:
//   const replay = useReplay(sessionId)
//   await replay.loadTimeline((op) => applyOpToShadowCanvas(op))
//   replay.play()

import { ref, readonly, computed } from 'vue'
import { WBReplayEngine, type ReplaySpeed, type ReplayState } from '../engine/WBReplayEngine'
import { fetchReplayTimeline } from '../api/replay'
import type { BoardOperation } from '../types/replay'

export function useReplay(sessionId: string) {
  const engine = ref<WBReplayEngine | null>(null)
  const state = ref<ReplayState>('idle')
  const currentIndex = ref(0)
  const totalOperations = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const progress = computed(() =>
    totalOperations.value > 0
      ? Math.round((currentIndex.value / totalOperations.value) * 100)
      : 0,
  )

  /**
   * Fetch timeline from API and wire up the engine.
   * @param onOp - callback fired for each replayed operation (render to shadow canvas)
   */
  async function loadTimeline(onOp: (op: BoardOperation) => void): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const timeline = await fetchReplayTimeline(sessionId)
      totalOperations.value = timeline.total_operations

      engine.value = new WBReplayEngine(timeline)
        .on('onOperation', (op, idx) => {
          currentIndex.value = idx + 1
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
  function destroy(): void {
    engine.value?.destroy()
    engine.value = null
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
    destroy,
  }
}
