// WB: Unit tests для useRecordingHeartbeat composable (Phase 2A-2)
// Plan: saas_docs/plans/classroom/RECORDING_LIFECYCLE_SAFETY_PLAN_2026-05-04.md §4.3
// Перевіряє: idempotency, watch behavior, error handling, cleanup, LAW §12 (no retry).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'

// ── Mock apiClient ──────────────────────────────────────────────────────

const mockPost = vi.fn()

vi.mock('@/utils/apiClient', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}))

// ── Mock onBeforeUnmount (composable викликає поза component setup) ────

const onBeforeUnmountCallbacks: Array<() => void> = []
vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...actual,
    onBeforeUnmount: (cb: () => void) => {
      onBeforeUnmountCallbacks.push(cb)
    },
  }
})

// ── Import after mocks ─────────────────────────────────────────────────

import { useRecordingHeartbeat } from '../composables/useRecordingHeartbeat'

// Helper — emulate component unmount.
function triggerUnmount(): void {
  while (onBeforeUnmountCallbacks.length) {
    const cb = onBeforeUnmountCallbacks.shift()
    cb?.()
  }
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('useRecordingHeartbeat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    onBeforeUnmountCallbacks.length = 0
  })

  afterEach(() => {
    triggerUnmount() // safety net — clear будь-які lingering intervals
    vi.useRealTimers()
  })

  it('start() ідемпотентний — двічі start не створює дублюючий interval', async () => {
    const sessionId = ref<string | null>('sess-1')
    const isRecording = ref(true)
    mockPost.mockResolvedValue({ is_recording: true })

    const { start } = useRecordingHeartbeat({ sessionId, isRecording })

    start()
    start() // другий виклик — no-op
    start()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('stop() очищує interval — наступний tick не виконується', async () => {
    const sessionId = ref<string | null>('sess-1')
    const isRecording = ref(true)
    mockPost.mockResolvedValue({ is_recording: true })

    const { start, stop } = useRecordingHeartbeat({ sessionId, isRecording })
    start()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(mockPost).toHaveBeenCalledTimes(1)

    stop()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockPost).toHaveBeenCalledTimes(1) // не додалось
  })

  it('tick POSTить на правильний URL з sessionId', async () => {
    const sessionId = ref<string | null>('abc-123')
    const isRecording = ref(true)
    mockPost.mockResolvedValue({ is_recording: true })

    const { start } = useRecordingHeartbeat({ sessionId, isRecording })
    start()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(mockPost).toHaveBeenCalledWith(
      '/v1/winterboard/sessions/abc-123/recording-heartbeat/',
    )
  })

  it('tick skip коли sessionId === null', async () => {
    const sessionId = ref<string | null>(null)
    const isRecording = ref(true)

    const { start } = useRecordingHeartbeat({ sessionId, isRecording })
    start()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(mockPost).not.toHaveBeenCalled()
  })

  it('tick skip коли isRecording === false (race після stop)', async () => {
    const sessionId = ref<string | null>('sess-1')
    const isRecording = ref(true)
    mockPost.mockResolvedValue({ is_recording: true })

    const { start } = useRecordingHeartbeat({ sessionId, isRecording })
    start()
    isRecording.value = false // race: interval ще running, але recording stop
    await nextTick() // watch триггер → stop()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(mockPost).not.toHaveBeenCalled()
  })

  it('response is_recording=false → автоматичний stop', async () => {
    const sessionId = ref<string | null>('sess-1')
    const isRecording = ref(true)
    mockPost.mockResolvedValue({ is_recording: false, reason: 'auto_finalized' })

    const { start } = useRecordingHeartbeat({ sessionId, isRecording })
    start()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(mockPost).toHaveBeenCalledTimes(1)

    // Після BE відповіді про not_recording — наступний tick НЕ викликається
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('401 response → stop ticker', async () => {
    const sessionId = ref<string | null>('sess-1')
    const isRecording = ref(true)
    mockPost.mockRejectedValue({ response: { status: 401 } })

    const { start } = useRecordingHeartbeat({ sessionId, isRecording })
    start()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(mockPost).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockPost).toHaveBeenCalledTimes(1) // stopped
  })

  it('403 response → stop ticker', async () => {
    const sessionId = ref<string | null>('sess-1')
    const isRecording = ref(true)
    mockPost.mockRejectedValue({ response: { status: 403 } })

    const { start } = useRecordingHeartbeat({ sessionId, isRecording })
    start()
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('500 response → log warn, не stop, наступний tick спробує (no retry loop)', async () => {
    const sessionId = ref<string | null>('sess-1')
    const isRecording = ref(true)
    mockPost.mockRejectedValueOnce({ response: { status: 500 } })
    mockPost.mockResolvedValueOnce({ is_recording: true })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { start } = useRecordingHeartbeat({ sessionId, isRecording })
    start()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(mockPost).toHaveBeenCalledTimes(2) // continued
    warnSpy.mockRestore()
  })

  it('watch isRecording false→true → автоматичний start', async () => {
    const sessionId = ref<string | null>('sess-1')
    const isRecording = ref(false)
    mockPost.mockResolvedValue({ is_recording: true })

    useRecordingHeartbeat({ sessionId, isRecording })

    await vi.advanceTimersByTimeAsync(30_000)
    expect(mockPost).not.toHaveBeenCalled()

    isRecording.value = true
    await nextTick()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('watch isRecording true→false → автоматичний stop', async () => {
    const sessionId = ref<string | null>('sess-1')
    const isRecording = ref(true)
    mockPost.mockResolvedValue({ is_recording: true })

    const { start } = useRecordingHeartbeat({ sessionId, isRecording })
    start()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(mockPost).toHaveBeenCalledTimes(1)

    isRecording.value = false
    await nextTick()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockPost).toHaveBeenCalledTimes(1) // stopped
  })

  it('onBeforeUnmount → stop ticker', async () => {
    const sessionId = ref<string | null>('sess-1')
    const isRecording = ref(true)
    mockPost.mockResolvedValue({ is_recording: true })

    const { start } = useRecordingHeartbeat({ sessionId, isRecording })
    start()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(mockPost).toHaveBeenCalledTimes(1)

    triggerUnmount()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockPost).toHaveBeenCalledTimes(1) // stopped on unmount
  })

  it('custom intervalMs override', async () => {
    const sessionId = ref<string | null>('sess-1')
    const isRecording = ref(true)
    mockPost.mockResolvedValue({ is_recording: true })

    const { start } = useRecordingHeartbeat({ sessionId, isRecording, intervalMs: 5_000 })
    start()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(mockPost).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(mockPost).toHaveBeenCalledTimes(2)
  })

  it('sessionId race: recording=true перед sessionId — heartbeat starts коли sid зʼявляється', async () => {
    const sessionId = ref<string | null>(null)
    const isRecording = ref(true)
    mockPost.mockResolvedValue({ is_recording: true })

    useRecordingHeartbeat({ sessionId, isRecording })

    // Recording active, але sid null → ticker не запущений ще
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockPost).not.toHaveBeenCalled()

    // sid зʼявляється async (e.g. session bootstrap)
    sessionId.value = 'late-sess-1'
    await nextTick()

    // Тепер ticker запустився через watch(sessionId)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith(
      '/v1/winterboard/sessions/late-sess-1/recording-heartbeat/',
    )
  })

  // Drift guard (lastTickAt < intervalMs * 0.8 → skip) — defensive code для
  // browser background tab unfreeze burst. Cleanly tested тільки через
  // direct tick() invocation, що не expose'ється з composable. Guard покритий
  // code review + LAW §12 compliance (це rate limit, не retry/debounce).
})
