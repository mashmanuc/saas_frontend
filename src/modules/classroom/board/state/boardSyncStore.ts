import { defineStore } from 'pinia'
import type { SyncStatus } from './boardStore'

export interface BoardSyncState {
  syncStatus: SyncStatus
  lastSavedAt: Date | null
  syncError: string | null
  isDirty: boolean
  isExporting: boolean
  exportJobId: string | null
  // F29-STEALTH: New fields for worker-based autosave
  rev: number
  pendingCount: number
  networkRtt: number
  isQuiet: boolean // true = opacity-only UI updates
}

export const useBoardSyncStore = defineStore('board-sync', {
  state: (): BoardSyncState => ({
    syncStatus: 'idle',
    lastSavedAt: null,
    syncError: null,
    isDirty: false,
    isExporting: false,
    exportJobId: null,
    // F29-STEALTH: Worker-based autosave fields
    rev: 0,
    pendingCount: 0,
    networkRtt: 0,
    isQuiet: true, // Default to quiet mode
  }),
  actions: {
    setStatus(status: SyncStatus): void {
      this.syncStatus = status
    },
    setLastSaved(date: Date | null): void {
      this.lastSavedAt = date
    },
    setError(message: string | null): void {
      this.syncError = message
    },
    setDirty(isDirty: boolean): void {
      this.isDirty = isDirty
    },
    setExporting(value: boolean): void {
      this.isExporting = value
    },
    setExportJob(jobId: string | null): void {
      this.exportJobId = jobId
    },
    // F29-STEALTH: New actions for worker-based autosave
    setRev(rev: number): void {
      this.rev = rev
    },
    incrementPending(): void {
      this.pendingCount++
    },
    decrementPending(): void {
      this.pendingCount = Math.max(0, this.pendingCount - 1)
    },
    setNetworkRtt(rtt: number): void {
      this.networkRtt = rtt
    },
    setQuiet(quiet: boolean): void {
      this.isQuiet = quiet
    },
    // F29-STEALTH: Handle worker ACK
    handleAckSuccess(rev: number, serverTs: string, rttMs: number): void {
      if (rev < this.rev) return // Ignore stale ACK
      this.rev = rev
      this.lastSavedAt = new Date(serverTs)
      this.networkRtt = rttMs
      this.syncStatus = 'saved'
      this.isDirty = false
      this.syncError = null
      this.decrementPending()
    },
    handleAckQueued(rev: number): void {
      if (rev < this.rev) return
      // Keep status as saved but show queued indicator
      this.syncStatus = 'saved'
      this.incrementPending()
    },
    handleAckError(rev: number, message: string, retriable: boolean): void {
      if (rev < this.rev) return
      if (!retriable) {
        this.syncStatus = 'error'
        this.syncError = message
        this.isQuiet = false // Show error prominently
      }
      this.decrementPending()
    },
  },
})
