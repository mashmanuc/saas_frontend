/**
 * GeoBoard Phase 2 — Preset executor.
 * Runs a GeometryPreset as a timed sequence of ops.
 *
 * G4: Interaction lock during preset execution.
 * Presets are NOT hardcoded logic — they are arrays of ops with relativeDelay.
 */

import { ref } from 'vue'
import type { GeometryPreset, PresetOp } from '../types/geometry'
import type { WBAsset } from '../types/winterboard'

interface PresetExecutorOptions {
  /** Called for each op in the preset. Should apply the op to the store. */
  applyOp: (op: PresetOp) => void
  /** Called when preset starts — lock interaction (G4) */
  onStart?: () => void
  /** Called when preset finishes — unlock interaction */
  onFinish?: () => void
}

export function usePresetExecutor(options: PresetExecutorOptions) {
  const isPlaying = ref(false)
  const currentPresetId = ref<string | null>(null)
  const _timers: ReturnType<typeof setTimeout>[] = []

  function run(preset: GeometryPreset): void {
    if (isPlaying.value) return // prevent double-run

    isPlaying.value = true
    currentPresetId.value = preset.id
    options.onStart?.()

    // Schedule each op based on relativeDelay (from preset start)
    for (const op of preset.ops) {
      const timer = setTimeout(() => {
        options.applyOp(op)
      }, op.relativeDelay)
      _timers.push(timer)
    }

    // Schedule finish after last op
    const maxDelay = preset.ops.reduce((max, op) => Math.max(max, op.relativeDelay), 0)
    const finishTimer = setTimeout(() => {
      isPlaying.value = false
      currentPresetId.value = null
      _timers.length = 0
      options.onFinish?.()
    }, maxDelay + 100) // +100ms buffer for last op to render
    _timers.push(finishTimer)
  }

  function cancel(): void {
    for (const t of _timers) clearTimeout(t)
    _timers.length = 0
    isPlaying.value = false
    currentPresetId.value = null
    options.onFinish?.()
  }

  return {
    isPlaying,
    currentPresetId,
    run,
    cancel,
  }
}
