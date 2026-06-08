// WB: Unit tests for useCreateFromPdf — "Створити урок з PDF" flow.
// Focus: poll-loop lifecycle (cancel on unmount/navigate) and terminal-state
// handling (done → navigate, failed → stop + surface error). These guard the
// "frozen at 90%" regression: a lost task must stop the loop, not pin the UI.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ───────────────────────────────────────────────────────────────
const mockImportPdf = vi.fn()
const mockGetImportStatus = vi.fn()
const mockCreateDraftWithPrep = vi.fn()
const mockPush = vi.fn()

vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    importPdf: (...a: unknown[]) => mockImportPdf(...a),
    getImportStatus: (...a: unknown[]) => mockGetImportStatus(...a),
  },
}))

vi.mock('@/modules/knowledge/api/lessonViewApi', () => ({
  lessonViewApi: {
    createDraftWithPrep: (...a: unknown[]) => mockCreateDraftWithPrep(...a),
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}))

import { useCreateFromPdf } from '../composables/useCreateFromPdf'

function pdfFile(size = 1024): File {
  return new File([new ArrayBuffer(size)], 'lesson.pdf', { type: 'application/pdf' })
}

describe('useCreateFromPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockCreateDraftWithPrep.mockResolvedValue({ wb_session_id: 's1' })
    mockImportPdf.mockResolvedValue({ task_id: 't1' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('cancel() stops the poll loop and clears state (no orphaned poller)', async () => {
    mockGetImportStatus.mockResolvedValue({ status: 'processing' })

    const { createFromPdf, cancel, isCreating, progress } = useCreateFromPdf()
    const promise = createFromPdf(pdfFile())

    // Flush createDraft + importPdf, advance one poll.
    await vi.advanceTimersByTimeAsync(50)
    await vi.advanceTimersByTimeAsync(2100)
    expect(mockGetImportStatus).toHaveBeenCalledTimes(1)
    expect(isCreating.value).toBe(true)

    cancel()
    expect(isCreating.value).toBe(false)
    expect(progress.value).toBe(0)

    // Several more intervals: the loop must NOT issue any more status calls.
    await vi.advanceTimersByTimeAsync(10_000)
    expect(mockGetImportStatus).toHaveBeenCalledTimes(1)

    await promise
  })

  it('failed status stops polling and surfaces an error (handles backend lost-task verdict)', async () => {
    mockGetImportStatus.mockResolvedValue({ status: 'failed', error: 'service unavailable' })

    const { createFromPdf, error, isCreating, progress } = useCreateFromPdf()
    const promise = createFromPdf(pdfFile())

    await vi.advanceTimersByTimeAsync(50)
    await vi.advanceTimersByTimeAsync(2100)
    await promise

    expect(isCreating.value).toBe(false)
    expect(error.value).toBeTruthy()
    expect(progress.value).toBe(0)
    expect(mockPush).not.toHaveBeenCalled()
    // Only one poll: it must not keep hammering after a terminal verdict.
    expect(mockGetImportStatus).toHaveBeenCalledTimes(1)
  })

  it('done navigates to the prepare route', async () => {
    mockGetImportStatus.mockResolvedValue({ status: 'done' })

    const { createFromPdf } = useCreateFromPdf()
    const promise = createFromPdf(pdfFile())

    await vi.advanceTimersByTimeAsync(50)
    await vi.advanceTimersByTimeAsync(2100)
    await promise

    expect(mockPush).toHaveBeenCalledWith({
      name: 'winterboard-prepare',
      params: { id: 's1' },
    })
  })

  // ── User-facing error messages (no raw "Request failed with status code N") ──
  describe('friendly error mapping', () => {
    function axios400(backendError: string): Error {
      const e = new Error('Request failed with status code 400')
      ;(e as unknown as { response: unknown }).response = {
        status: 400,
        data: { error: backendError },
      }
      return e
    }

    it('maps "too many pages" 400 to the tooManyPages message', async () => {
      mockImportPdf.mockRejectedValue(axios400('Too many pages: 60 (max 50)'))
      const { createFromPdf, error, isCreating } = useCreateFromPdf()
      const p = createFromPdf(pdfFile())
      await vi.advanceTimersByTimeAsync(50)
      await p
      expect(isCreating.value).toBe(false)
      expect(error.value).toBe('winterboard.createFromPdf.error.tooManyPages')
      expect(error.value).not.toContain('Request failed')
    })

    it('maps "Invalid PDF format" 400 to the invalidPdf message', async () => {
      mockImportPdf.mockRejectedValue(axios400('Invalid PDF format: not a PDF'))
      const { createFromPdf, error } = useCreateFromPdf()
      const p = createFromPdf(pdfFile())
      await vi.advanceTimersByTimeAsync(50)
      await p
      expect(error.value).toBe('winterboard.createFromPdf.error.invalidPdf')
    })

    it('maps an encrypted-PDF 400 to the encrypted message', async () => {
      mockImportPdf.mockRejectedValue(axios400('Encrypted/password-protected PDFs are not supported'))
      const { createFromPdf, error } = useCreateFromPdf()
      const p = createFromPdf(pdfFile())
      await vi.advanceTimersByTimeAsync(50)
      await p
      expect(error.value).toBe('winterboard.createFromPdf.error.encrypted')
    })

    it('never surfaces the raw axios string when no detail is provided', async () => {
      const e = new Error('Request failed with status code 400')
      ;(e as unknown as { response: unknown }).response = { status: 400, data: {} }
      mockImportPdf.mockRejectedValue(e)
      const { createFromPdf, error } = useCreateFromPdf()
      const p = createFromPdf(pdfFile())
      await vi.advanceTimersByTimeAsync(50)
      await p
      expect(error.value).toBe('winterboard.createFromPdf.error.processing')
      expect(error.value).not.toContain('Request failed')
    })
  })
})
