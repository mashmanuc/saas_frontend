/**
 * Diagnostics API client.
 * Sends frontend errors to backend for analysis.
 */
import apiClient from '@/utils/apiClient'
import type { FrontendErrorPayload, LogResponse } from '../types'

class DiagnosticsApi {
  private readonly baseUrl = '/api/v1/logs'
  private queue: FrontendErrorPayload[] = []
  private isProcessing = false
  private readonly batchSize = 10
  private readonly flushInterval = 5000 // 5 seconds
  private flushTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Auto-flush queue periodically
    this.flushTimer = setInterval(() => this.flush(), this.flushInterval)

    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush(true))
    }
  }

  /**
   * Log single frontend error immediately.
   */
  async logFrontendError(payload: FrontendErrorPayload): Promise<LogResponse | null> {
    try {
      const response = await apiClient.post<LogResponse>(
        `${this.baseUrl}/frontend/`,
        payload
      )
      return response.data
    } catch (error) {
      // Don't throw - we don't want logging to break the app
      console.error('[Diagnostics] Failed to send error:', error)
      return null
    }
  }

  /**
   * Add error to queue for batch sending.
   */
  queueError(payload: FrontendErrorPayload): void {
    this.queue.push(payload)

    // Flush if queue is full
    if (this.queue.length >= this.batchSize) {
      this.flush()
    }
  }

  /**
   * Send batch of errors.
   */
  async logBatch(errors: FrontendErrorPayload[]): Promise<LogResponse | null> {
    if (errors.length === 0) return null

    try {
      const response = await apiClient.post<LogResponse>(
        `${this.baseUrl}/frontend/`,
        { errors }
      )
      return response.data
    } catch (error) {
      console.error('[Diagnostics] Failed to send batch:', error)
      return null
    }
  }

  /**
   * Flush queued errors.
   */
  async flush(sync = false): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return

    this.isProcessing = true
    const errors = [...this.queue]
    this.queue = []

    if (sync && navigator.sendBeacon) {
      // Use sendBeacon for page unload
      navigator.sendBeacon(
        `${this.baseUrl}/frontend/`,
        JSON.stringify({ errors })
      )
    } else {
      await this.logBatch(errors)
    }

    this.isProcessing = false
  }

  /**
   * Get queue length (for testing).
   */
  getQueueLength(): number {
    return this.queue.length
  }

  /**
   * Cleanup.
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
  }

  /**
   * Reset internal state (testing helper).
   */
  resetForTests(): void {
    this.queue = []
    this.isProcessing = false
  }
}

export const diagnosticsApi = new DiagnosticsApi()
