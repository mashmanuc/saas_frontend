// WB: useExportPolling — composable for export lifecycle with polling
// Ref: TASK_BOARD_PHASES.md A2.2, ManifestWinterboard_v2.md LAW-18
// Flow: createExport → poll getExport every 2s → auto-download on done

import { ref, readonly, onUnmounted } from 'vue'
import { winterboardApi } from '../api/winterboardApi'
import type { WBExport, WBExportFormat, WBExportStatus } from '../types/winterboard'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG = '[WB:ExportPolling]'
const POLL_INTERVAL_MS = 2_000
const MAX_POLL_ATTEMPTS = 60 // 60 × 2s = 2 minutes timeout

// ─── Types ──────────────────────────────────────────────────────────────────

export type WBExportPollingState =
  | 'idle'
  | 'requesting'
  | 'pending'
  | 'processing'
  | 'done'
  | 'failed'
  | 'timeout'

export interface WBExportResult {
  exportId: string
  format: WBExportFormat
  downloadUrl: string | null
  error: string | null
}

// ─── Composable ─────────────────────────────────────────────────────────────

/**
 * Composable for managing export lifecycle with server-side polling.
 *
 * Usage:
 * ```ts
 * const { startExport, cancelPolling, exportState, exportProgress, downloadUrl, exportError } = useExportPolling()
 * await startExport('session-123', 'pdf')
 * // Auto-downloads when done
 * ```
 */
export function useExportPolling() {
  const exportState = ref<WBExportPollingState>('idle')
  const exportProgress = ref(0)
  const downloadUrl = ref<string | null>(null)
  const exportError = ref<string | null>(null)
  const currentExportId = ref<string | null>(null)

  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let pollAttempts = 0

  // ── Cleanup ─────────────────────────────────────────────────────────

  function stopPolling(): void {
    if (pollTimer !== null) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
    pollAttempts = 0
  }

  function reset(): void {
    stopPolling()
    exportState.value = 'idle'
    exportProgress.value = 0
    downloadUrl.value = null
    exportError.value = null
    currentExportId.value = null
  }

  onUnmounted(() => {
    stopPolling()
  })

  // ── Poll Logic ──────────────────────────────────────────────────────

  function mapStatusToState(status: WBExportStatus): WBExportPollingState {
    switch (status) {
      case 'pending': return 'pending'
      case 'processing': return 'processing'
      case 'done': return 'done'
      case 'error': return 'failed'
      default: return 'pending'
    }
  }

  async function pollOnce(): Promise<boolean> {
    const exportId = currentExportId.value
    if (!exportId) return true // stop polling

    pollAttempts++

    if (pollAttempts > MAX_POLL_ATTEMPTS) {
      exportState.value = 'timeout'
      exportError.value = `Export timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`
      console.warn(`${LOG} Timeout after ${pollAttempts} attempts`, { exportId })
      return true // stop polling
    }

    try {
      const result: WBExport = await winterboardApi.getExport(exportId)

      exportState.value = mapStatusToState(result.status)

      // Estimate progress based on status
      if (result.status === 'pending') {
        exportProgress.value = Math.min(10 + pollAttempts * 2, 30)
      } else if (result.status === 'processing') {
        exportProgress.value = Math.min(30 + pollAttempts * 3, 90)
      }

      if (result.status === 'done') {
        exportProgress.value = 100
        downloadUrl.value = result.file_url
        console.info(`${LOG} Export done`, { exportId, url: result.file_url })

        // Auto-download
        if (result.file_url) {
          triggerDownload(result.file_url, exportId)
        }
        return true // stop polling
      }

      if (result.status === 'error') {
        exportError.value = result.error || 'Export failed on server'
        console.error(`${LOG} Export failed`, { exportId, error: result.error })
        return true // stop polling
      }

      return false // continue polling
    } catch (err) {
      console.error(`${LOG} Poll error`, { exportId, attempt: pollAttempts, err })
      // Don't stop on transient network errors — retry
      if (pollAttempts >= MAX_POLL_ATTEMPTS) {
        exportState.value = 'failed'
        exportError.value = 'Failed to check export status'
        return true
      }
      return false
    }
  }

  function schedulePoll(): void {
    pollTimer = setTimeout(async () => {
      const shouldStop = await pollOnce()
      if (!shouldStop) {
        schedulePoll()
      }
    }, POLL_INTERVAL_MS)
  }

  // ── Download Helper ─────────────────────────────────────────────────

  function triggerDownload(url: string, exportId: string): void {
    try {
      const link = document.createElement('a')
      link.href = url
      link.download = `winterboard-export-${exportId}`
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      console.info(`${LOG} Download triggered`, { exportId })
    } catch (err) {
      console.error(`${LOG} Download trigger failed`, { exportId, err })
    }
  }

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Start an export and begin polling for completion.
   * Resolves when export request is accepted (not when export is done).
   */
  async function startExport(
    sessionId: string,
    format: WBExportFormat,
  ): Promise<WBExportResult | null> {
    reset()
    exportState.value = 'requesting'

    try {
      const idempotencyKey = `export-${sessionId}-${format}-${Date.now()}`
      const exportData = await winterboardApi.createExport(sessionId, format, idempotencyKey)

      currentExportId.value = exportData.id
      exportState.value = mapStatusToState(exportData.status)

      console.info(`${LOG} Export created`, {
        exportId: exportData.id,
        format,
        status: exportData.status,
      })

      // If already done (e.g. JSON export is instant)
      if (exportData.status === 'done') {
        exportProgress.value = 100
        downloadUrl.value = exportData.file_url

        if (exportData.file_url) {
          triggerDownload(exportData.file_url, exportData.id)
        }

        return {
          exportId: exportData.id,
          format,
          downloadUrl: exportData.file_url,
          error: null,
        }
      }

      if (exportData.status === 'error') {
        exportState.value = 'failed'
        exportError.value = exportData.error || 'Export failed'
        return {
          exportId: exportData.id,
          format,
          downloadUrl: null,
          error: exportData.error,
        }
      }

      // Start polling for pending/processing
      schedulePoll()

      return {
        exportId: exportData.id,
        format,
        downloadUrl: null,
        error: null,
      }
    } catch (err) {
      exportState.value = 'failed'
      const msg = (err as Error)?.message || 'Failed to start export'
      exportError.value = msg
      console.error(`${LOG} createExport failed`, err)
      return null
    }
  }

  /**
   * Cancel ongoing polling (does not cancel server-side export).
   */
  function cancelPolling(): void {
    stopPolling()
    if (exportState.value !== 'done' && exportState.value !== 'failed') {
      exportState.value = 'idle'
    }
  }

  /**
   * Manually trigger download for a completed export.
   */
  function manualDownload(): void {
    const url = downloadUrl.value
    const id = currentExportId.value
    if (url && id) {
      triggerDownload(url, id)
    }
  }

  return {
    startExport,
    cancelPolling,
    manualDownload,
    reset,
    exportState: readonly(exportState),
    exportProgress: readonly(exportProgress),
    downloadUrl: readonly(downloadUrl),
    exportError: readonly(exportError),
    currentExportId: readonly(currentExportId),
  }
}
