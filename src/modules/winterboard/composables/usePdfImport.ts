// WB: usePdfImport — PDF import composable with upload, polling, page creation
// Ref: TASK_BOARD_PHASES.md A5.1, LAW-18 (Asset Pipeline)
// Deps: C5.1 (PDF conversion pipeline) — uses mock-ready API

import { ref, type Ref } from 'vue'
import { winterboardApi } from '../api/winterboardApi'
import type { PdfPageResult, ImportStatusResponse } from '../api/winterboardApi'
import { useWBStore } from '../board/state/boardStore'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG = '[WB:PdfImport]'
const MAX_PDF_SIZE = 50 * 1024 * 1024 // 50 MB
const POLL_INTERVAL_MS = 2_000
const POLL_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const ALLOWED_TYPE = 'application/pdf'

// ─── Validation ─────────────────────────────────────────────────────────────

export interface PdfValidationResult {
  valid: boolean
  error?: string
}

export function validatePdfFile(file: File): PdfValidationResult {
  if (!file) {
    return { valid: false, error: 'No file provided' }
  }

  if (file.type !== ALLOWED_TYPE) {
    return { valid: false, error: `Invalid file type: ${file.type}. Only PDF files are accepted.` }
  }

  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: `Invalid file name: ${file.name}. File must have .pdf extension.` }
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty (0 bytes).' }
  }

  if (file.size > MAX_PDF_SIZE) {
    const sizeMB = Math.round(file.size / 1024 / 1024)
    return { valid: false, error: `File too large: ${sizeMB}MB. Maximum allowed: 50MB.` }
  }

  return { valid: true }
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function usePdfImport(sessionId: Ref<string>) {
  const isImporting = ref(false)
  const progress = ref(0)
  const progressText = ref('')
  const error = ref<string | null>(null)

  let abortController: AbortController | null = null

  /**
   * Import a PDF file: validate → upload → poll → create pages.
   */
  async function importPdf(file: File): Promise<void> {
    // Reset state
    isImporting.value = true
    progress.value = 0
    progressText.value = ''
    error.value = null
    abortController = new AbortController()

    try {
      // 1. Client-side validation
      const validation = validatePdfFile(file)
      if (!validation.valid) {
        throw new PdfImportError('validation_failed', validation.error!)
      }

      // 2. Upload PDF
      progress.value = 5
      progressText.value = 'Uploading PDF...'
      console.info(`${LOG} Uploading PDF`, { name: file.name, size: file.size })

      const uploadResult = await winterboardApi.importPdf(sessionId.value, file)
      const { task_id: taskId } = uploadResult

      console.info(`${LOG} Upload OK, polling task`, { taskId })
      progress.value = 30
      progressText.value = 'Processing PDF...'

      // 3. Poll for completion
      const statusResult = await pollImportStatus(sessionId.value, taskId)

      if (statusResult.status === 'failed') {
        throw new PdfImportError('conversion_failed', statusResult.error ?? 'PDF conversion failed on server.')
      }

      if (!statusResult.pages || statusResult.pages.length === 0) {
        throw new PdfImportError('no_pages', 'PDF conversion returned no pages.')
      }

      // 4. Create pages in store
      progress.value = 90
      progressText.value = 'Creating pages...'
      onPdfImported(statusResult.pages)

      progress.value = 100
      progressText.value = 'Done!'
      console.info(`${LOG} Import complete`, { pageCount: statusResult.pages.length })
    } catch (err) {
      if (err instanceof PdfImportError) {
        error.value = err.message
        console.error(`${LOG} Import failed [${err.code}]`, err.message)
      } else {
        const msg = err instanceof Error ? err.message : 'Unknown error during PDF import'
        error.value = msg
        console.error(`${LOG} Import failed`, err)
      }
    } finally {
      isImporting.value = false
      abortController = null
    }
  }

  /**
   * Poll import task status until done/failed/timeout.
   */
  async function pollImportStatus(
    sid: string,
    taskId: string,
  ): Promise<ImportStatusResponse> {
    const startTime = Date.now()

    while (true) {
      if (abortController?.signal.aborted) {
        throw new PdfImportError('aborted', 'Import was cancelled.')
      }

      const elapsed = Date.now() - startTime
      if (elapsed > POLL_TIMEOUT_MS) {
        throw new PdfImportError('timeout', 'PDF conversion timed out after 5 minutes.')
      }

      const status = await winterboardApi.getImportStatus(sid, taskId)

      if (status.status === 'done' || status.status === 'failed') {
        return status
      }

      // Update progress based on elapsed time (estimate)
      const progressEstimate = Math.min(85, 30 + (elapsed / POLL_TIMEOUT_MS) * 55)
      progress.value = Math.round(progressEstimate)

      if (status.pages && status.pages.length > 0) {
        progressText.value = `Converting page ${status.pages.length}...`
      }

      // Wait before next poll
      await sleep(POLL_INTERVAL_MS)
    }
  }

  /**
   * Create board pages from imported PDF page results.
   */
  function onPdfImported(pages: PdfPageResult[]): void {
    const store = useWBStore()
    const firstIndex = store.importPdfPages(pages)
    // Navigate to first imported page
    store.goToPage(firstIndex)
    console.info(`${LOG} Created ${pages.length} pages, navigated to index ${firstIndex}`)
  }

  /**
   * Cancel an in-progress import.
   */
  function cancel(): void {
    if (abortController) {
      abortController.abort()
      console.info(`${LOG} Import cancelled by user`)
    }
  }

  return {
    isImporting,
    progress,
    progressText,
    error,
    importPdf,
    cancel,
  }
}

// ─── Error class ────────────────────────────────────────────────────────────

export type PdfImportErrorCode =
  | 'validation_failed'
  | 'upload_failed'
  | 'conversion_failed'
  | 'no_pages'
  | 'timeout'
  | 'aborted'

export class PdfImportError extends Error {
  readonly code: PdfImportErrorCode

  constructor(code: PdfImportErrorCode, message: string) {
    super(message)
    this.name = 'PdfImportError'
    this.code = code
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export { MAX_PDF_SIZE, POLL_INTERVAL_MS, POLL_TIMEOUT_MS }
