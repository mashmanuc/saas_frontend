// WB: Unit tests for useExportPolling composable (Phase 2: A2.2)
// Tests: polling lifecycle, timeout, error states, auto-download, cancel

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

// ── Mock winterboardApi ─────────────────────────────────────────────────

const mockCreateExport = vi.fn()
const mockGetExport = vi.fn()

vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    createExport: (...args: unknown[]) => mockCreateExport(...args),
    getExport: (...args: unknown[]) => mockGetExport(...args),
  },
}))

// ── Mock vue lifecycle ──────────────────────────────────────────────────

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...(actual as Record<string, unknown>),
    onUnmounted: vi.fn(),
  }
})

// ── Import after mocks ─────────────────────────────────────────────────

import { useExportPolling } from '../composables/useExportPolling'

// ── Tests ───────────────────────────────────────────────────────────────

describe('useExportPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns correct initial state', () => {
    const { exportState, exportProgress, downloadUrl, exportError, currentExportId } = useExportPolling()
    expect(exportState.value).toBe('idle')
    expect(exportProgress.value).toBe(0)
    expect(downloadUrl.value).toBeNull()
    expect(exportError.value).toBeNull()
    expect(currentExportId.value).toBeNull()
  })

  it('handles instant done (JSON export)', async () => {
    mockCreateExport.mockResolvedValue({
      id: 'exp-1',
      session_id: 's1',
      format: 'json',
      status: 'done',
      file_url: 'https://cdn.example.com/export.json',
      error: null,
    })

    const { startExport, exportState, exportProgress, downloadUrl } = useExportPolling()
    const result = await startExport('s1', 'json')

    expect(result).not.toBeNull()
    expect(result!.exportId).toBe('exp-1')
    expect(result!.downloadUrl).toBe('https://cdn.example.com/export.json')
    expect(exportState.value).toBe('done')
    expect(exportProgress.value).toBe(100)
    expect(downloadUrl.value).toBe('https://cdn.example.com/export.json')
  })

  it('handles immediate error from createExport', async () => {
    mockCreateExport.mockResolvedValue({
      id: 'exp-2',
      session_id: 's1',
      format: 'pdf',
      status: 'error',
      file_url: null,
      error: 'Rendering failed',
    })

    const { startExport, exportState, exportError } = useExportPolling()
    const result = await startExport('s1', 'pdf')

    expect(result).not.toBeNull()
    expect(result!.error).toBe('Rendering failed')
    expect(exportState.value).toBe('failed')
    expect(exportError.value).toBe('Rendering failed')
  })

  it('handles createExport network failure', async () => {
    mockCreateExport.mockRejectedValue(new Error('Network error'))

    const { startExport, exportState, exportError } = useExportPolling()
    const result = await startExport('s1', 'png')

    expect(result).toBeNull()
    expect(exportState.value).toBe('failed')
    expect(exportError.value).toBe('Network error')
  })

  it('starts polling for pending export', async () => {
    mockCreateExport.mockResolvedValue({
      id: 'exp-3',
      session_id: 's1',
      format: 'pdf',
      status: 'pending',
      file_url: null,
      error: null,
    })

    const { startExport, exportState, currentExportId } = useExportPolling()
    await startExport('s1', 'pdf')

    expect(exportState.value).toBe('pending')
    expect(currentExportId.value).toBe('exp-3')
  })

  it('polls and transitions pending → processing → done', async () => {
    mockCreateExport.mockResolvedValue({
      id: 'exp-4',
      session_id: 's1',
      format: 'pdf',
      status: 'pending',
      file_url: null,
      error: null,
    })

    // First poll: still processing
    mockGetExport.mockResolvedValueOnce({
      id: 'exp-4',
      session_id: 's1',
      format: 'pdf',
      status: 'processing',
      file_url: null,
      error: null,
    })

    // Second poll: done
    mockGetExport.mockResolvedValueOnce({
      id: 'exp-4',
      session_id: 's1',
      format: 'pdf',
      status: 'done',
      file_url: 'https://cdn.example.com/export.pdf',
      error: null,
    })

    const { startExport, exportState, exportProgress, downloadUrl } = useExportPolling()
    await startExport('s1', 'pdf')

    expect(exportState.value).toBe('pending')

    // Advance to first poll
    await vi.advanceTimersByTimeAsync(2000)
    expect(exportState.value).toBe('processing')

    // Advance to second poll
    await vi.advanceTimersByTimeAsync(2000)
    expect(exportState.value).toBe('done')
    expect(exportProgress.value).toBe(100)
    expect(downloadUrl.value).toBe('https://cdn.example.com/export.pdf')
  })

  it('polls and handles server-side error', async () => {
    mockCreateExport.mockResolvedValue({
      id: 'exp-5',
      session_id: 's1',
      format: 'png',
      status: 'pending',
      file_url: null,
      error: null,
    })

    mockGetExport.mockResolvedValueOnce({
      id: 'exp-5',
      session_id: 's1',
      format: 'png',
      status: 'error',
      file_url: null,
      error: 'Rendering engine crashed',
    })

    const { startExport, exportState, exportError } = useExportPolling()
    await startExport('s1', 'png')

    await vi.advanceTimersByTimeAsync(2000)

    expect(exportState.value).toBe('failed')
    expect(exportError.value).toBe('Rendering engine crashed')
  })

  it('cancelPolling stops polling', async () => {
    mockCreateExport.mockResolvedValue({
      id: 'exp-6',
      session_id: 's1',
      format: 'pdf',
      status: 'pending',
      file_url: null,
      error: null,
    })

    const { startExport, cancelPolling, exportState } = useExportPolling()
    await startExport('s1', 'pdf')

    cancelPolling()
    expect(exportState.value).toBe('idle')

    // Advance timers — should NOT call getExport
    await vi.advanceTimersByTimeAsync(5000)
    expect(mockGetExport).not.toHaveBeenCalled()
  })

  it('reset clears all state', async () => {
    mockCreateExport.mockResolvedValue({
      id: 'exp-7',
      session_id: 's1',
      format: 'json',
      status: 'done',
      file_url: 'https://cdn.example.com/export.json',
      error: null,
    })

    const { startExport, reset, exportState, exportProgress, downloadUrl, currentExportId } = useExportPolling()
    await startExport('s1', 'json')

    expect(exportState.value).toBe('done')

    reset()

    expect(exportState.value).toBe('idle')
    expect(exportProgress.value).toBe(0)
    expect(downloadUrl.value).toBeNull()
    expect(currentExportId.value).toBeNull()
  })

  it('passes idempotency key to createExport', async () => {
    mockCreateExport.mockResolvedValue({
      id: 'exp-8',
      session_id: 's1',
      format: 'pdf',
      status: 'pending',
      file_url: null,
      error: null,
    })

    const { startExport } = useExportPolling()
    await startExport('s1', 'pdf')

    expect(mockCreateExport).toHaveBeenCalledWith(
      's1',
      'pdf',
      expect.stringContaining('export-s1-pdf-'),
    )
  })
})
