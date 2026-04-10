// useReplayAudio — Interaction layer between audioManager and replay engine.
//
// Audio is NOT part of the replay timeline/ops/engine (INV I1).
// Audio triggers ONLY on user click (INV I2).
// Audio pauses replay; end/cancel/seek resumes it (INV I3, I5).
// Only 1 audio at a time (INV I4) — enforced by audioManager singleton.
// Unmount/destroy stops audio (INV I6).
//
// This composable does NOT modify audioManager or WBReplayEngine —
// it orchestrates them.

import { ref, readonly, watch, type WatchStopHandle } from 'vue'
import { audioManager } from '../utils/audioManager'
import type { ReplayState } from '../engine/WBReplayEngine'

export interface UseReplayAudioOptions {
  /** Current replay state ('idle' | 'playing' | 'paused' | 'ended') */
  getReplayState: () => ReplayState
  /** Pause the replay engine */
  pauseReplay: () => void
  /** Resume the replay engine (play) */
  resumeReplay: () => void
}

export function useReplayAudio(options: UseReplayAudioOptions) {
  const isAudioPlaying = ref(false)

  // INV I3: Track whether replay was already paused BEFORE audio started.
  // If it was, do NOT resume after audio ends — respect user's pause.
  let wasPausedBeforeAudio = false

  // Watch audioManager.isPlaying to detect audio end (natural or error).
  // When audio stops AND we were the ones who started it → resume replay.
  let stopWatcher: WatchStopHandle | null = null

  function _setupWatcher(): void {
    if (stopWatcher) return
    stopWatcher = watch(audioManager.isPlaying, (playing) => {
      // Audio just stopped (was playing → not playing)
      if (!playing && isAudioPlaying.value) {
        isAudioPlaying.value = false
        // INV I3: Resume ONLY if replay was playing before audio started
        if (!wasPausedBeforeAudio) {
          options.resumeReplay()
        }
      }
    })
  }

  _setupWatcher()

  /**
   * Play audio for a board object. Called from click handlers.
   * INV I2: ONLY called from user interaction.
   * INV I3: Pauses replay, resumes when audio ends.
   * INV I4: Stops any currently playing audio first (audioManager handles this).
   */
  function playObjectAudio(url: string): void {
    if (!url) return

    // If same URL is playing → toggle pause/resume (within audio, not replay)
    if (audioManager.currentUrl.value === url && audioManager.isPlaying.value) {
      audioManager.pause()
      // Don't resume replay — user paused audio manually, keep replay paused
      return
    }

    // If same URL was paused → resume audio (replay stays paused)
    if (audioManager.currentUrl.value === url && !audioManager.isPlaying.value) {
      isAudioPlaying.value = true
      audioManager.resume().catch(() => {
        isAudioPlaying.value = false
        if (!wasPausedBeforeAudio) options.resumeReplay()
      })
      return
    }

    // New audio: record replay state BEFORE pausing
    wasPausedBeforeAudio = options.getReplayState() !== 'playing'

    // Mark audio as active BEFORE play() to prevent race with watcher
    isAudioPlaying.value = true

    // INV I3: Pause replay
    if (!wasPausedBeforeAudio) {
      options.pauseReplay()
    }

    // INV I4: audioManager.play() stops any previous audio first
    audioManager.play(url).catch(() => {
      // Audio load error → resume replay (INV: edge case #2)
      isAudioPlaying.value = false
      if (!wasPausedBeforeAudio) {
        options.resumeReplay()
      }
    })
  }

  /**
   * Stop any playing audio immediately.
   * Called on: seek (INV I5), exit replay, unmount (INV I6).
   * Does NOT resume replay — caller decides.
   */
  function stopAudio(): void {
    if (isAudioPlaying.value || audioManager.isPlaying.value) {
      isAudioPlaying.value = false
      audioManager.stop()
      // Do NOT resume replay — seek/unmount means user wants different state
    }
  }

  /**
   * Full cleanup — stop audio + remove watcher.
   * Called on unmount/destroy.
   */
  function destroy(): void {
    stopAudio()
    if (stopWatcher) {
      stopWatcher()
      stopWatcher = null
    }
  }

  return {
    /** Whether this composable is managing an active audio playback */
    isAudioPlaying: readonly(isAudioPlaying),
    /** Play audio for an object — pauses replay, resumes on end */
    playObjectAudio,
    /** Stop audio immediately (seek, unmount, exit replay) */
    stopAudio,
    /** Full cleanup — call on unmount */
    destroy,
  }
}
