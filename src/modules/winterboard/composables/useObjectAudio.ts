// WB: Object Audio composable — recording, upload, playback, limits UX.
// Ref: OBJECT_AUDIO_PLAN.md §5.3, §5.6, MANIFEST 3.2.1
//
// Responsibilities:
// - MediaRecorder lifecycle (start/stop/auto-stop)
// - Upload via winterboardApi.uploadObjectAudio (with progress)
// - Playback via audioManager singleton
// - State machine: idle → requesting_mic → recording → stopping → uploading → done | error
// - Limits UX: isNearLimit, auto-stop toast, explainable errors
// - Browser detection: getRecorderMimeType, isRecordingSupported

import { ref, computed, watch, onUnmounted, type Ref } from 'vue'
import { audioManager } from '../utils/audioManager'
import { winterboardApi } from '../api/winterboardApi'
import { useToast } from './useToast'

// ─── Types ──────────────────────────────────────────────────────────────────

export type RecordingState =
  | 'idle'
  | 'requesting_mic'
  | 'recording'
  | 'stopping'
  | 'uploading'
  | 'done'
  | 'error'

export interface UseObjectAudioOptions {
  sessionId: Ref<string>
  objectId: Ref<string>
  audioUrl: Ref<string | undefined>
  audioDuration: Ref<number | undefined>
  maxDuration?: number
  maxSizeBytes?: number
  /** i18n translate function */
  t?: (key: string, params?: Record<string, unknown>) => string
  /** Called when audio is uploaded — parent should persist audioUrl to stroke/asset */
  onAudioUploaded?: (audioUrl: string, duration: number | null) => void
  /** Called when audio is deleted */
  onAudioDeleted?: () => void
}

// ─── Browser Detection (B4) ─────────────────────────────────────────────────

const MIME_PRIORITY = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4',
] as const

/**
 * Detect the best supported MIME type for MediaRecorder.
 * Returns null if MediaRecorder is not available.
 */
export function getRecorderMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null

  for (const mime of MIME_PRIORITY) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return null
}

/**
 * Check if audio recording is supported in the current browser.
 */
export function isRecordingSupported(): boolean {
  return getRecorderMimeType() !== null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function useObjectAudio(options: UseObjectAudioOptions) {
  const {
    sessionId,
    objectId,
    audioUrl,
    audioDuration,
    maxDuration = 60,
    maxSizeBytes = 2 * 1024 * 1024,
    onAudioUploaded,
    onAudioDeleted,
  } = options

  const t = options.t ?? ((key: string) => key)
  const { showToast } = useToast()

  // ─── State ──────────────────────────────────────────────────────────

  const recordingState = ref<RecordingState>('idle')
  const recordingTime = ref(0)
  const uploadProgress = ref(0)
  const errorMessage = ref<string | null>(null)

  let mediaRecorder: MediaRecorder | null = null
  let mediaStream: MediaStream | null = null
  let chunks: Blob[] = []
  let timerInterval: ReturnType<typeof setInterval> | null = null

  // ─── Computed ─────────────────────────────────────────────────────

  const LIMIT_WARNING_THRESHOLD = 5

  const hasAudio = computed(() => !!audioUrl.value)

  const isRecording = computed(() => recordingState.value === 'recording')

  const isUploading = computed(() => recordingState.value === 'uploading')

  const isBusy = computed(() =>
    ['requesting_mic', 'recording', 'stopping', 'uploading'].includes(recordingState.value),
  )

  const isNearLimit = computed(() =>
    isRecording.value && recordingTime.value >= maxDuration - LIMIT_WARNING_THRESHOLD,
  )

  const maxSizeMB = computed(() => Math.round(maxSizeBytes / (1024 * 1024)))

  const isPlaying = computed(() =>
    audioUrl.value ? audioManager.isUrlPlaying(audioUrl.value) : false,
  )

  // ─── Timer ────────────────────────────────────────────────────────

  function startTimer() {
    recordingTime.value = 0
    timerInterval = setInterval(() => {
      recordingTime.value++

      if (recordingTime.value >= maxDuration) {
        stopRecording()
        showToast(
          t('winterboard.objectAudio.maxDurationReached', { max: maxDuration }),
          'warning',
        )
      }
    }, 1000)
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  // ─── Recording ────────────────────────────────────────────────────

  async function startRecording(): Promise<void> {
    if (isBusy.value) return

    const mimeType = getRecorderMimeType()
    if (!mimeType) {
      showToast(t('winterboard.objectAudio.notSupported'), 'error')
      return
    }

    recordingState.value = 'requesting_mic'
    errorMessage.value = null
    chunks = []

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      })
    } catch (err) {
      handleMicError(err as DOMException)
      return
    }

    try {
      mediaRecorder = new MediaRecorder(mediaStream, { mimeType })
    } catch {
      // Fallback: try without explicit mimeType
      mediaRecorder = new MediaRecorder(mediaStream)
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    mediaRecorder.onstop = () => {
      handleRecordingComplete()
    }

    mediaRecorder.onerror = () => {
      recordingState.value = 'error'
      errorMessage.value = t('winterboard.objectAudio.errors.micUnknown')
      showToast(t('winterboard.objectAudio.errors.micUnknown'), 'error')
      cleanup()
    }

    mediaRecorder.start(250) // collect chunks every 250ms
    recordingState.value = 'recording'
    startTimer()
  }

  async function stopRecording(): Promise<void> {
    if (recordingState.value !== 'recording') return

    stopTimer()
    recordingState.value = 'stopping'

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
  }

  async function handleRecordingComplete(): Promise<void> {
    const mimeType = mediaRecorder?.mimeType || 'audio/webm'
    const blob = new Blob(chunks, { type: mimeType })
    chunks = []

    releaseMediaStream()

    // Size check before upload
    if (blob.size > maxSizeBytes) {
      recordingState.value = 'error'
      const sizeStr = formatBytes(blob.size)
      const maxStr = formatBytes(maxSizeBytes)
      showToast(
        t('winterboard.objectAudio.errors.sizeTooLarge', { size: sizeStr, max: maxStr }),
        'error',
      )
      return
    }

    if (blob.size === 0) {
      recordingState.value = 'error'
      showToast(t('winterboard.objectAudio.errors.networkError'), 'error')
      return
    }

    await uploadAudio(blob)
  }

  // ─── Upload ───────────────────────────────────────────────────────

  async function uploadAudio(blob: Blob): Promise<void> {
    recordingState.value = 'uploading'
    uploadProgress.value = 0

    try {
      const result = await winterboardApi.uploadObjectAudio(
        sessionId.value,
        objectId.value,
        blob,
        {
          onUploadProgress: (e) => {
            uploadProgress.value = e.percent
          },
        },
      )

      recordingState.value = 'done'
      onAudioUploaded?.(result.audio_url, result.duration)
    } catch (err) {
      handleUploadError(err)
    }
  }

  // ─── Playback ─────────────────────────────────────────────────────

  async function togglePlayback(): Promise<void> {
    if (!audioUrl.value) return
    await audioManager.toggle(audioUrl.value)
  }

  // ─── Delete ───────────────────────────────────────────────────────

  async function deleteAudio(): Promise<void> {
    if (!hasAudio.value) return

    // Stop playback if playing
    if (audioUrl.value && audioManager.isUrlPlaying(audioUrl.value)) {
      audioManager.stop()
    }

    try {
      await winterboardApi.deleteObjectAudio(sessionId.value, objectId.value)
      onAudioDeleted?.()
      recordingState.value = 'idle'
    } catch {
      showToast(t('winterboard.objectAudio.errors.deleteFailed'), 'error')
    }
  }

  // ─── Re-record ────────────────────────────────────────────────────

  async function reRecord(): Promise<void> {
    await deleteAudio()
    await startRecording()
  }

  // ─── Error Handlers (Limits UX — MANIFEST 3.2.1) ──────────────────

  function handleUploadError(error: unknown): void {
    recordingState.value = 'error'

    const apiError = (error as any)?.response?.data

    if (apiError?.error === 'size_exceeded') {
      const sizeStr = formatBytes(apiError.file_size ?? 0)
      const maxStr = formatBytes(maxSizeBytes)
      errorMessage.value = t('winterboard.objectAudio.errors.sizeTooLarge', { size: sizeStr, max: maxStr })
    } else if (apiError?.error === 'duration_exceeded') {
      errorMessage.value = t('winterboard.objectAudio.errors.durationTooLong', { max: maxDuration })
    } else if (apiError?.error === 'invalid_content_type') {
      errorMessage.value = t('winterboard.objectAudio.errors.unsupportedFormat')
    } else if (apiError?.error === 'storage_quota_exceeded') {
      errorMessage.value = t('winterboard.objectAudio.errors.quotaExceeded')
    } else {
      errorMessage.value = t('winterboard.objectAudio.errors.networkError')
    }

    showToast(errorMessage.value, 'error')
  }

  function handleMicError(error: DOMException): void {
    recordingState.value = 'error'
    releaseMediaStream()

    if (error.name === 'NotAllowedError') {
      errorMessage.value = t('winterboard.objectAudio.errors.micDenied')
    } else if (error.name === 'NotFoundError') {
      errorMessage.value = t('winterboard.objectAudio.errors.micNotFound')
    } else {
      errorMessage.value = t('winterboard.objectAudio.errors.micUnknown')
    }

    showToast(errorMessage.value, 'error')
  }

  // ─── Cleanup ──────────────────────────────────────────────────────

  function releaseMediaStream() {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop())
      mediaStream = null
    }
    mediaRecorder = null
  }

  function cleanup() {
    stopTimer()
    releaseMediaStream()
    chunks = []
  }

  // Auto-cleanup on unmount
  onUnmounted(() => {
    if (isRecording.value || recordingState.value === 'requesting_mic') {
      stopTimer()
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop()
      }
    }
    cleanup()
  })

  // ─── Return ───────────────────────────────────────────────────────

  return {
    // State
    recordingState,
    recordingTime,
    uploadProgress,
    errorMessage,
    hasAudio,
    isRecording,
    isUploading,
    isBusy,
    isPlaying,

    // Limits UX
    isNearLimit,
    maxDuration,
    maxSizeMB,

    // Actions
    startRecording,
    stopRecording,
    togglePlayback,
    deleteAudio,
    reRecord,

    // Utilities
    formatTime,

    // Error handlers (exposed for testing)
    handleUploadError,
    handleMicError,
  }
}
