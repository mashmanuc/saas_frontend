// WB: Audio Manager — singleton ensuring only 1 audio plays at a time.
// Ref: OBJECT_AUDIO_PLAN.md §5.3, ADR-06
//
// Architecture:
// - Module-level singleton (not class instance) — matches useToast pattern
// - Any component can call play(url) — previous audio auto-stops
// - Exposes reactive `currentUrl` and `isPlaying` for UI binding
// - cleanup() releases resources on component unmount / page unload

import { ref, readonly } from 'vue'

// ─── State ──────────────────────────────────────────────────────────────────

let audioElement: HTMLAudioElement | null = null

const currentUrl = ref<string | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)

let timeUpdateRaf: number | null = null

// ─── Internal ───────────────────────────────────────────────────────────────

function syncTime() {
  if (audioElement) {
    currentTime.value = audioElement.currentTime
    duration.value = audioElement.duration || 0
  }
  if (isPlaying.value) {
    timeUpdateRaf = requestAnimationFrame(syncTime)
  }
}

function stopTimeSync() {
  if (timeUpdateRaf !== null) {
    cancelAnimationFrame(timeUpdateRaf)
    timeUpdateRaf = null
  }
}

function releaseAudio() {
  if (audioElement) {
    audioElement.pause()
    audioElement.removeAttribute('src')
    audioElement.load() // release network resources
    audioElement.onended = null
    audioElement.onerror = null
    audioElement.onplay = null
    audioElement.onpause = null
    audioElement = null
  }
  stopTimeSync()
  isPlaying.value = false
  currentUrl.value = null
  currentTime.value = 0
  duration.value = 0
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Play audio from URL. Stops any currently playing audio first.
 * Returns a promise that resolves when playback starts.
 */
async function play(url: string): Promise<void> {
  // Stop previous playback
  releaseAudio()

  audioElement = new Audio(url)
  audioElement.preload = 'auto'
  currentUrl.value = url

  audioElement.onplay = () => {
    isPlaying.value = true
    syncTime()
  }

  audioElement.onpause = () => {
    isPlaying.value = false
    stopTimeSync()
  }

  audioElement.onended = () => {
    isPlaying.value = false
    currentTime.value = 0
    stopTimeSync()
  }

  audioElement.onerror = () => {
    releaseAudio()
  }

  await audioElement.play()
}

/**
 * Pause current playback. Can be resumed with resume().
 */
function pause(): void {
  audioElement?.pause()
}

/**
 * Resume paused playback.
 */
async function resume(): Promise<void> {
  if (audioElement && !isPlaying.value) {
    await audioElement.play()
  }
}

/**
 * Toggle play/pause for a given URL.
 * If a different URL is playing, switches to the new one.
 */
async function toggle(url: string): Promise<void> {
  if (currentUrl.value === url && isPlaying.value) {
    pause()
  } else if (currentUrl.value === url && !isPlaying.value) {
    await resume()
  } else {
    await play(url)
  }
}

/**
 * Stop playback and release resources.
 */
function stop(): void {
  releaseAudio()
}

/**
 * Check if a specific URL is currently playing.
 */
function isUrlPlaying(url: string): boolean {
  return currentUrl.value === url && isPlaying.value
}

/**
 * Seek to a specific time in seconds.
 */
function seek(time: number): void {
  if (audioElement) {
    audioElement.currentTime = time
    currentTime.value = time
  }
}

// ─── Export ──────────────────────────────────────────────────────────────────

export const audioManager = {
  // Reactive state (readonly)
  currentUrl: readonly(currentUrl),
  isPlaying: readonly(isPlaying),
  currentTime: readonly(currentTime),
  duration: readonly(duration),

  // Actions
  play,
  pause,
  resume,
  toggle,
  stop,
  seek,
  isUrlPlaying,
}

export type AudioManager = typeof audioManager
