// WB: Unit tests for usePdfImport composable (Phase 5: A5.1)
// Tests: validation, import flow, polling, error handling, page creation

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

// ── Mock winterboardApi ─────────────────────────────────────────────────

const mockImportPdf = vi.fn()
const mockGetImportStatus = vi.fn()

vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    importPdf: (...args: unknown[]) => mockImportPdf(...args),
    getImportStatus: (...args: unknown[]) => mockGetImportStatus(...args),
  },
}))

import {
  usePdfImport,
  validatePdfFile,
  PdfImportError,
  MAX_PDF_SIZE,
} from '../composables/usePdfImport'
import { useWBStore } from '../board/state/boardStore'
import type { PdfPageResult } from '../api/winterboardApi'

// ── Helpers ─────────────────────────────────────────────────────────────

function createPdfFile(name = 'test.pdf', size = 1024): File {
  const buffer = new ArrayBuffer(size)
  return new File([buffer], name, { type: 'application/pdf' })
}

function createNonPdfFile(): File {
  return new File(['hello'], 'test.txt', { type: 'text/plain' })
}

function createMockPages(count: number): PdfPageResult[] {
  return Array.from({ length: count }, (_, i) => ({
    page_index: i,
    asset_id: `asset-${i}`,
    url: `https://cdn.example.com/pdf/page-${i}.png`,
    width: 1920,
    height: 1080,
  }))
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('usePdfImport (A5.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Validation ──────────────────────────────────────────────────────

  describe('validatePdfFile', () => {
    it('accepts valid PDF file', () => {
      const file = createPdfFile()
      const result = validatePdfFile(file)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('rejects non-PDF type', () => {
      const file = createNonPdfFile()
      const result = validatePdfFile(file)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid file type')
    })

    it('rejects file without .pdf extension', () => {
      const file = new File(['data'], 'document.doc', { type: 'application/pdf' })
      const result = validatePdfFile(file)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('.pdf extension')
    })

    it('rejects empty file (0 bytes)', () => {
      const file = new File([], 'empty.pdf', { type: 'application/pdf' })
      const result = validatePdfFile(file)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('empty')
    })

    it('rejects file exceeding 50MB', () => {
      const file = createPdfFile('big.pdf', MAX_PDF_SIZE + 1)
      const result = validatePdfFile(file)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('too large')
    })

    it('accepts file at exactly 50MB', () => {
      const file = createPdfFile('exact.pdf', MAX_PDF_SIZE)
      const result = validatePdfFile(file)
      expect(result.valid).toBe(true)
    })
  })

  // ── Import flow ─────────────────────────────────────────────────────

  describe('importPdf flow', () => {
    it('completes full flow: upload → poll → pages created', async () => {
      const pages = createMockPages(3)

      mockImportPdf.mockResolvedValue({
        task_id: 'task-1',
        asset_id: 'asset-main',
        status: 'processing',
      })

      mockGetImportStatus.mockResolvedValue({
        status: 'done',
        pages,
      })

      const sessionId = ref('session-1')
      const { importPdf, isImporting, progress, error } = usePdfImport(sessionId)

      const file = createPdfFile()
      const promise = importPdf(file)

      // Advance timers for polling
      await vi.advanceTimersByTimeAsync(100)
      await promise

      expect(error.value).toBeNull()
      expect(isImporting.value).toBe(false)
      expect(progress.value).toBe(100)

      // Verify API calls
      expect(mockImportPdf).toHaveBeenCalledWith('session-1', file)
      expect(mockGetImportStatus).toHaveBeenCalledWith('session-1', 'task-1')

      // Verify pages created in store
      const store = useWBStore()
      // 1 default page + 3 PDF pages
      expect(store.pages.length).toBe(4)
      expect(store.pages[1].background).toEqual({
        type: 'pdf',
        url: 'https://cdn.example.com/pdf/page-0.png',
        assetId: 'asset-0',
      })
      expect(store.pages[1].width).toBe(1920)
      expect(store.pages[1].height).toBe(1080)
    })

    it('rejects invalid file before upload', async () => {
      const sessionId = ref('session-1')
      const { importPdf, error, isImporting } = usePdfImport(sessionId)

      const file = createNonPdfFile()
      await importPdf(file)

      expect(error.value).toContain('Invalid file type')
      expect(isImporting.value).toBe(false)
      expect(mockImportPdf).not.toHaveBeenCalled()
    })
  })

  // ── Polling ─────────────────────────────────────────────────────────

  describe('polling', () => {
    it('polls until done', async () => {
      const pages = createMockPages(2)

      mockImportPdf.mockResolvedValue({
        task_id: 'task-2',
        asset_id: 'asset-main',
        status: 'processing',
      })

      let pollCount = 0
      mockGetImportStatus.mockImplementation(async () => {
        pollCount++
        if (pollCount < 3) {
          return { status: 'processing' }
        }
        return { status: 'done', pages }
      })

      const sessionId = ref('session-1')
      const { importPdf, progressText } = usePdfImport(sessionId)

      const file = createPdfFile()
      const promise = importPdf(file)

      // Advance through polling intervals
      await vi.advanceTimersByTimeAsync(100) // initial upload
      await vi.advanceTimersByTimeAsync(2100) // poll 1
      await vi.advanceTimersByTimeAsync(2100) // poll 2
      await vi.advanceTimersByTimeAsync(2100) // poll 3 → done
      await promise

      expect(pollCount).toBe(3)
      expect(mockGetImportStatus).toHaveBeenCalledTimes(3)
    })

    it('handles failed status', async () => {
      mockImportPdf.mockResolvedValue({
        task_id: 'task-fail',
        asset_id: 'asset-main',
        status: 'processing',
      })

      mockGetImportStatus.mockResolvedValue({
        status: 'failed',
        error: 'Corrupted PDF file',
      })

      const sessionId = ref('session-1')
      const { importPdf, error } = usePdfImport(sessionId)

      const file = createPdfFile()
      const promise = importPdf(file)
      await vi.advanceTimersByTimeAsync(100)
      await promise

      expect(error.value).toContain('Corrupted PDF file')
    })

    it('times out after 5 minutes', async () => {
      mockImportPdf.mockResolvedValue({
        task_id: 'task-timeout',
        asset_id: 'asset-main',
        status: 'processing',
      })

      mockGetImportStatus.mockResolvedValue({
        status: 'processing',
      })

      const sessionId = ref('session-1')
      const { importPdf, error } = usePdfImport(sessionId)

      const file = createPdfFile()
      const promise = importPdf(file)

      // Advance past timeout (5 min = 300_000ms)
      // Each poll is 2s, so we need 150+ polls
      for (let i = 0; i < 160; i++) {
        await vi.advanceTimersByTimeAsync(2100)
      }
      await promise

      expect(error.value).toContain('timed out')
    })
  })

  // ── Page creation ───────────────────────────────────────────────────

  describe('page creation', () => {
    it('creates pages with correct PDF backgrounds', async () => {
      const pages = createMockPages(5)

      mockImportPdf.mockResolvedValue({
        task_id: 'task-pages',
        asset_id: 'asset-main',
        status: 'processing',
      })

      mockGetImportStatus.mockResolvedValue({
        status: 'done',
        pages,
      })

      const sessionId = ref('session-1')
      const { importPdf } = usePdfImport(sessionId)

      const file = createPdfFile()
      const promise = importPdf(file)
      await vi.advanceTimersByTimeAsync(100)
      await promise

      const store = useWBStore()
      // 1 default + 5 PDF = 6
      expect(store.pages.length).toBe(6)

      // Check each PDF page
      for (let i = 0; i < 5; i++) {
        const page = store.pages[i + 1]
        expect(page.name).toBe(`PDF ${i + 1}`)
        expect(page.background).toEqual({
          type: 'pdf',
          url: `https://cdn.example.com/pdf/page-${i}.png`,
          assetId: `asset-${i}`,
        })
        expect(page.strokes).toEqual([])
        expect(page.assets).toEqual([])
      }
    })

    it('navigates to first imported page', async () => {
      const pages = createMockPages(3)

      mockImportPdf.mockResolvedValue({
        task_id: 'task-nav',
        asset_id: 'asset-main',
        status: 'processing',
      })

      mockGetImportStatus.mockResolvedValue({
        status: 'done',
        pages,
      })

      const sessionId = ref('session-1')
      const store = useWBStore()
      // Start with 2 pages
      store.addPage()
      expect(store.pages.length).toBe(2)

      const { importPdf } = usePdfImport(sessionId)
      const file = createPdfFile()
      const promise = importPdf(file)
      await vi.advanceTimersByTimeAsync(100)
      await promise

      // Should navigate to first PDF page (index 2)
      expect(store.currentPageIndex).toBe(2)
    })
  })

  // ── boardStore.importPdfPages ─────────────────────────────────────

  describe('boardStore.importPdfPages', () => {
    it('batch adds pages', () => {
      const store = useWBStore()
      const pages = createMockPages(3)

      const firstIndex = store.importPdfPages(pages)

      expect(firstIndex).toBe(1) // after default page
      expect(store.pages.length).toBe(4) // 1 default + 3 PDF
      expect(store.isDirty).toBe(true)
    })

    it('returns current index for empty pages array', () => {
      const store = useWBStore()
      const firstIndex = store.importPdfPages([])

      expect(firstIndex).toBe(0)
      expect(store.pages.length).toBe(1) // unchanged
    })

    it('truncates if exceeding 200 page limit', () => {
      const store = useWBStore()
      // Fill to 198 pages
      for (let i = 0; i < 197; i++) {
        store.addPage()
      }
      expect(store.pages.length).toBe(198)

      const pages = createMockPages(10) // try to add 10
      store.importPdfPages(pages)

      // Should only add 2 (200 - 198)
      expect(store.pages.length).toBe(200)
    })
  })

  // ── PdfImportError ────────────────────────────────────────────────

  describe('PdfImportError', () => {
    it('has correct name and code', () => {
      const err = new PdfImportError('validation_failed', 'Bad file')
      expect(err.name).toBe('PdfImportError')
      expect(err.code).toBe('validation_failed')
      expect(err.message).toBe('Bad file')
    })
  })
})
