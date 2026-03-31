/**
 * Tests for useObjectAudio composable + audioManager singleton.
 *
 * Covers:
 * 1. audioManager: play, pause, toggle, stop, singleton behavior
 * 2. useObjectAudio: recording lifecycle, browser detection, limits UX
 * 3. Error handling: handleUploadError, handleMicError — explainable toasts
 *
 * Ref: OBJECT_AUDIO_PLAN.md §5.3, §5.6, §10
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'

// ─── Mock dependencies ──────────────────────────────────────────────────────

// Mock apiClient
vi.mock('@/utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

// Mock auth store
vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({ access: 'test-token' }),
}))

// ══════════════════════════════════════════════════════════════════════════════
// 1. audioManager tests
// ══════════════════════════════════════════════════════════════════════════════

describe('audioManager', () => {
  let audioManager: typeof import('@/modules/winterboard/utils/audioManager').audioManager

  // Mock HTMLAudioElement
  let mockAudio: {
    play: ReturnType<typeof vi.fn>
    pause: ReturnType<typeof vi.fn>
    load: ReturnType<typeof vi.fn>
    removeAttribute: ReturnType<typeof vi.fn>
    currentTime: number
    duration: number
    preload: string
    src: string
    onplay: (() => void) | null
    onpause: (() => void) | null
    onended: (() => void) | null
    onerror: (() => void) | null
  }

  beforeEach(async () => {
    mockAudio = {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      load: vi.fn(),
      removeAttribute: vi.fn(),
      currentTime: 0,
      duration: 12,
      preload: '',
      src: '',
      onplay: null,
      onpause: null,
      onended: null,
      onerror: null,
    }

    vi.stubGlobal('Audio', vi.fn(() => mockAudio))
    vi.stubGlobal('requestAnimationFrame', vi.fn())
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    // Fresh import each test
    vi.resetModules()
    const mod = await import('@/modules/winterboard/utils/audioManager')
    audioManager = mod.audioManager
  })

  afterEach(() => {
    audioManager.stop()
    vi.unstubAllGlobals()
  })

  it('starts with no audio playing', () => {
    expect(audioManager.isPlaying.value).toBe(false)
    expect(audioManager.currentUrl.value).toBeNull()
  })

  it('play() creates Audio element and calls play()', async () => {
    const playPromise = audioManager.play('https://cdn.test/audio.webm')
    // Trigger onplay callback
    mockAudio.onplay?.()
    await playPromise

    expect(Audio).toHaveBeenCalledWith('https://cdn.test/audio.webm')
    expect(mockAudio.play).toHaveBeenCalled()
    expect(audioManager.isPlaying.value).toBe(true)
    expect(audioManager.currentUrl.value).toBe('https://cdn.test/audio.webm')
  })

  it('pause() pauses playback', async () => {
    await audioManager.play('https://cdn.test/audio.webm')
    mockAudio.onplay?.()

    audioManager.pause()
    mockAudio.onpause?.()

    expect(mockAudio.pause).toHaveBeenCalled()
    expect(audioManager.isPlaying.value).toBe(false)
  })

  it('stop() releases resources', async () => {
    await audioManager.play('https://cdn.test/audio.webm')
    mockAudio.onplay?.()

    audioManager.stop()

    expect(audioManager.isPlaying.value).toBe(false)
    expect(audioManager.currentUrl.value).toBeNull()
  })

  it('toggle() switches play/pause for same URL', async () => {
    const url = 'https://cdn.test/audio.webm'

    // First toggle: play
    await audioManager.toggle(url)
    mockAudio.onplay?.()
    expect(audioManager.isPlaying.value).toBe(true)

    // Second toggle: pause
    await audioManager.toggle(url)
    mockAudio.onpause?.()
    expect(mockAudio.pause).toHaveBeenCalled()
  })

  it('play() stops previous audio (singleton)', async () => {
    await audioManager.play('https://cdn.test/first.webm')
    mockAudio.onplay?.()

    // Play second — should stop first
    await audioManager.play('https://cdn.test/second.webm')

    expect(audioManager.currentUrl.value).toBe('https://cdn.test/second.webm')
  })

  it('isUrlPlaying() returns true only for current URL', async () => {
    await audioManager.play('https://cdn.test/audio.webm')
    mockAudio.onplay?.()

    expect(audioManager.isUrlPlaying('https://cdn.test/audio.webm')).toBe(true)
    expect(audioManager.isUrlPlaying('https://cdn.test/other.webm')).toBe(false)
  })

  it('onended resets state', async () => {
    await audioManager.play('https://cdn.test/audio.webm')
    mockAudio.onplay?.()

    mockAudio.onended?.()

    expect(audioManager.isPlaying.value).toBe(false)
    expect(audioManager.currentTime.value).toBe(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 2. Browser detection tests
// ══════════════════════════════════════════════════════════════════════════════

describe('getRecorderMimeType / isRecordingSupported', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when MediaRecorder is undefined', async () => {
    vi.stubGlobal('MediaRecorder', undefined)
    const { getRecorderMimeType, isRecordingSupported } = await import(
      '@/modules/winterboard/composables/useObjectAudio'
    )
    expect(getRecorderMimeType()).toBeNull()
    expect(isRecordingSupported()).toBe(false)
  })

  it('returns first supported MIME type', async () => {
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: (mime: string) => mime === 'audio/webm;codecs=opus',
    })
    const { getRecorderMimeType, isRecordingSupported } = await import(
      '@/modules/winterboard/composables/useObjectAudio'
    )
    expect(getRecorderMimeType()).toBe('audio/webm;codecs=opus')
    expect(isRecordingSupported()).toBe(true)
  })

  it('falls back to audio/mp4 for Safari', async () => {
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: (mime: string) => mime === 'audio/mp4',
    })
    const { getRecorderMimeType } = await import(
      '@/modules/winterboard/composables/useObjectAudio'
    )
    expect(getRecorderMimeType()).toBe('audio/mp4')
  })

  it('returns null when no MIME is supported', async () => {
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: () => false,
    })
    const { getRecorderMimeType } = await import(
      '@/modules/winterboard/composables/useObjectAudio'
    )
    expect(getRecorderMimeType()).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 3. formatTime tests
// ══════════════════════════════════════════════════════════════════════════════

describe('formatTime', () => {
  it('formats seconds correctly', async () => {
    const { formatTime } = await import(
      '@/modules/winterboard/composables/useObjectAudio'
    )
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(5)).toBe('0:05')
    expect(formatTime(12)).toBe('0:12')
    expect(formatTime(60)).toBe('1:00')
    expect(formatTime(75)).toBe('1:15')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 4. useObjectAudio — error handling (Limits UX)
// ══════════════════════════════════════════════════════════════════════════════

describe('useObjectAudio — error handlers', () => {
  // We test handleUploadError and handleMicError by calling them directly.
  // This requires the composable to be instantiated.

  let composable: ReturnType<typeof import('@/modules/winterboard/composables/useObjectAudio').useObjectAudio>
  let toastMessages: string[]

  beforeEach(async () => {
    vi.resetModules()

    // Mock Audio for audioManager
    vi.stubGlobal('Audio', vi.fn(() => ({
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      load: vi.fn(),
      removeAttribute: vi.fn(),
      currentTime: 0,
      duration: 0,
      preload: '',
      onplay: null,
      onpause: null,
      onended: null,
      onerror: null,
    })))
    vi.stubGlobal('requestAnimationFrame', vi.fn())
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    // Mock MediaRecorder
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: () => true,
    })

    toastMessages = []

    // Mock onUnmounted to avoid Vue lifecycle errors
    vi.mock('vue', async () => {
      const actual = await vi.importActual('vue')
      return {
        ...actual as any,
        onUnmounted: vi.fn(),
      }
    })

    const { useObjectAudio } = await import(
      '@/modules/winterboard/composables/useObjectAudio'
    )

    composable = useObjectAudio({
      sessionId: ref('test-session'),
      objectId: ref('test-object'),
      audioUrl: ref(undefined),
      audioDuration: ref(undefined),
      maxDuration: 60,
      maxSizeBytes: 2 * 1024 * 1024,
      t: (key: string, params?: Record<string, unknown>) => {
        const msg = `${key}${params ? ':' + JSON.stringify(params) : ''}`
        return msg
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('handleUploadError maps size_exceeded to explainable toast', () => {
    const error = {
      response: {
        data: { error: 'size_exceeded', file_size: 3145728 },
      },
    }
    composable.handleUploadError(error)
    expect(composable.recordingState.value).toBe('error')
    expect(composable.errorMessage.value).toContain('objectAudio.errors.sizeTooLarge')
  })

  it('handleUploadError maps duration_exceeded', () => {
    const error = {
      response: { data: { error: 'duration_exceeded' } },
    }
    composable.handleUploadError(error)
    expect(composable.errorMessage.value).toContain('objectAudio.errors.durationTooLong')
  })

  it('handleUploadError maps invalid_content_type', () => {
    const error = {
      response: { data: { error: 'invalid_content_type' } },
    }
    composable.handleUploadError(error)
    expect(composable.errorMessage.value).toContain('objectAudio.errors.unsupportedFormat')
  })

  it('handleUploadError maps storage_quota_exceeded', () => {
    const error = {
      response: { data: { error: 'storage_quota_exceeded' } },
    }
    composable.handleUploadError(error)
    expect(composable.errorMessage.value).toContain('objectAudio.errors.quotaExceeded')
  })

  it('handleUploadError maps unknown error to networkError', () => {
    const error = { response: { data: {} } }
    composable.handleUploadError(error)
    expect(composable.errorMessage.value).toContain('objectAudio.errors.networkError')
  })

  it('handleMicError maps NotAllowedError to micDenied', () => {
    const error = new DOMException('Permission denied', 'NotAllowedError')
    composable.handleMicError(error)
    expect(composable.recordingState.value).toBe('error')
    expect(composable.errorMessage.value).toContain('objectAudio.errors.micDenied')
  })

  it('handleMicError maps NotFoundError to micNotFound', () => {
    const error = new DOMException('No mic', 'NotFoundError')
    composable.handleMicError(error)
    expect(composable.errorMessage.value).toContain('objectAudio.errors.micNotFound')
  })

  it('handleMicError maps unknown error to micUnknown', () => {
    const error = new DOMException('Other', 'AbortError')
    composable.handleMicError(error)
    expect(composable.errorMessage.value).toContain('objectAudio.errors.micUnknown')
  })

  it('isNearLimit is false when not recording', () => {
    expect(composable.isNearLimit.value).toBe(false)
  })

  it('hasAudio is false when audioUrl is undefined', () => {
    expect(composable.hasAudio.value).toBe(false)
  })

  it('maxSizeMB is computed correctly', () => {
    expect(composable.maxSizeMB.value).toBe(2)
  })

  it('maxDuration is exposed', () => {
    expect(composable.maxDuration).toBe(60)
  })

  it('formatTime formats correctly', () => {
    expect(composable.formatTime(12)).toBe('0:12')
    expect(composable.formatTime(65)).toBe('1:05')
  })
})
