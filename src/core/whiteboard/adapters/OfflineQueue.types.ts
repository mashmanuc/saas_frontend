/**
 * Offline queue types for whiteboard operations (v0.85.0)
 */

import type { WhiteboardOperation } from './RealtimeAdapter'

export interface PendingOperation {
  operation: WhiteboardOperation
  attempts: number
  lastAttemptAt: number
  createdAt: number
}

export interface OfflineQueueState {
  pendingOps: Map<string, PendingOperation>
  maxRetries: number
  retryDelay: number
  batchSize: number
}

export interface OfflineQueueConfig {
  maxRetries?: number
  retryDelay?: number
  batchSize?: number
  maxQueueSize?: number
}
