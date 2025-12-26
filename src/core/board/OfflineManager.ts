// TASK F9: OfflineManager - Offline mode with queue
// TASK FX2: Enhanced with overflow handling and IndexedDB backup

import { BoardEventEmitter } from './eventEmitter'
import type { BoardOperation, QueuedOperation, SyncResult, BoardState } from './types'
import { OFFLINE_STORAGE_KEY, OFFLINE_QUEUE_KEY, MAX_OFFLINE_QUEUE_SIZE } from './constants'

const OVERFLOW_DB_NAME = 'board_overflow_db'
const OVERFLOW_STORE_NAME = 'overflow'

type OfflineEvents = {
  'online-status-change': boolean
  'queue-change': number
  'queue-overflow': { queueSize: number; overflowCount: number; operationId: string }
  'force-sync-requested': void
  'sync-start': void
  'sync-complete': SyncResult
  'sync-error': Error
  [key: string]: unknown
}

interface SyncService {
  syncOperations(operations: BoardOperation[]): Promise<SyncResult>
}

export class OfflineManager {
  private isOnline = true
  private operationQueue: QueuedOperation[] = []
  private sessionId: string
  private storage: Storage
  private overflowCount = 0
  private db: IDBDatabase | null = null

  private readonly handleOnlineEvent = (): void => this.setOnlineStatus(true)
  private readonly handleOfflineEvent = (): void => this.setOnlineStatus(false)

  public readonly events = new BoardEventEmitter<OfflineEvents>()

  constructor(sessionId: string) {
    this.sessionId = sessionId
    this.storage = localStorage

    // Load queue from storage
    this.loadQueue()

    // Listen for online/offline events
    window.addEventListener('online', this.handleOnlineEvent)
    window.addEventListener('offline', this.handleOfflineEvent)

    // Initial status
    this.isOnline = navigator.onLine
  }

  isOnlineStatus(): boolean {
    return this.isOnline
  }

  setOnlineStatus(online: boolean): void {
    if (this.isOnline === online) return

    this.isOnline = online
    this.events.emit('online-status-change', online)

    if (online && this.operationQueue.length > 0) {
      // Auto-sync when coming back online could be triggered here
      // But we leave it to the consumer to decide when to sync
    }
  }

  queueOperation(operation: BoardOperation): boolean {
    if (this.operationQueue.length >= MAX_OFFLINE_QUEUE_SIZE) {
      this.handleOverflow(operation)
      return false
    }

    const queuedOp: QueuedOperation = {
      id: this.generateId(),
      operation,
      timestamp: Date.now(),
      retries: 0,
    }

    this.operationQueue.push(queuedOp)
    this.saveQueue()
    this.events.emit('queue-change', this.operationQueue.length)
    return true
  }

  private handleOverflow(operation: BoardOperation): void {
    this.overflowCount++

    // Save to IndexedDB as backup
    this.saveOverflowToIndexedDB(operation)

    // Emit warning
    this.events.emit('queue-overflow', {
      queueSize: this.operationQueue.length,
      overflowCount: this.overflowCount,
      operationId: operation.id || this.generateId(),
    })

    // Request immediate sync
    this.events.emit('force-sync-requested', undefined)
  }

  private async openIndexedDB(): Promise<IDBDatabase> {
    if (this.db) return this.db

    // Guard for test environments where indexedDB is not available
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB is not available in this environment')
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(OVERFLOW_DB_NAME, 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve(request.result)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(OVERFLOW_STORE_NAME)) {
          db.createObjectStore(OVERFLOW_STORE_NAME, { keyPath: 'id', autoIncrement: true })
        }
      }
    })
  }

  private async saveOverflowToIndexedDB(operation: BoardOperation): Promise<void> {
    try {
      const db = await this.openIndexedDB()
      const tx = db.transaction(OVERFLOW_STORE_NAME, 'readwrite')
      const store = tx.objectStore(OVERFLOW_STORE_NAME)

      store.add({
        sessionId: this.sessionId,
        operation: JSON.parse(JSON.stringify(operation)),
        timestamp: Date.now(),
      })
    } catch (error) {
      console.error('[OfflineManager] Failed to save overflow:', error)
    }
  }

  async recoverOverflow(): Promise<BoardOperation[]> {
    try {
      const db = await this.openIndexedDB()
      const tx = db.transaction(OVERFLOW_STORE_NAME, 'readonly')
      const store = tx.objectStore(OVERFLOW_STORE_NAME)

      return new Promise((resolve, reject) => {
        const request = store.getAll()
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const items = request.result.filter((item: { sessionId: string }) => item.sessionId === this.sessionId)
          resolve(items.map((item: { operation: BoardOperation }) => item.operation))
        }
      })
    } catch (error) {
      console.error('[OfflineManager] Failed to recover overflow:', error)
      return []
    }
  }

  async clearOverflow(): Promise<void> {
    try {
      const db = await this.openIndexedDB()
      const tx = db.transaction(OVERFLOW_STORE_NAME, 'readwrite')
      const store = tx.objectStore(OVERFLOW_STORE_NAME)
      store.clear()
      this.overflowCount = 0
    } catch (error) {
      console.error('[OfflineManager] Failed to clear overflow:', error)
    }
  }

  getOverflowStatus(): { hasOverflow: boolean; count: number } {
    return {
      hasOverflow: this.overflowCount > 0,
      count: this.overflowCount,
    }
  }

  getQueuedOperations(): QueuedOperation[] {
    return [...this.operationQueue]
  }

  clearQueue(): void {
    this.operationQueue = []
    this.saveQueue()
    this.events.emit('queue-change', 0)
  }

  async syncQueue(syncService: SyncService): Promise<SyncResult> {
    if (this.operationQueue.length === 0) {
      return { success: true, synced: 0, failed: 0 }
    }

    if (!this.isOnline) {
      return { success: false, synced: 0, failed: this.operationQueue.length, errors: [new Error('Offline')] }
    }

    this.events.emit('sync-start', undefined)

    try {
      const operations = this.operationQueue.map((q) => q.operation)
      const result = await syncService.syncOperations(operations)

      if (result.success) {
        this.clearQueue()
      } else {
        // Mark failed operations for retry
        for (const op of this.operationQueue) {
          op.retries++
        }
        // Remove operations that have failed too many times
        this.operationQueue = this.operationQueue.filter((op) => op.retries < 5)
        this.saveQueue()
      }

      this.events.emit('sync-complete', result)
      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.events.emit('sync-error', err)
      return {
        success: false,
        synced: 0,
        failed: this.operationQueue.length,
        errors: [err],
      }
    }
  }

  saveLocalState(state: BoardState): void {
    try {
      const key = `${OFFLINE_STORAGE_KEY}_${this.sessionId}`
      this.storage.setItem(key, JSON.stringify(state))
    } catch (error) {
      console.error('[OfflineManager] Failed to save local state:', error)
    }
  }

  loadLocalState(): BoardState | null {
    try {
      const key = `${OFFLINE_STORAGE_KEY}_${this.sessionId}`
      const data = this.storage.getItem(key)
      if (!data) return null
      return JSON.parse(data) as BoardState
    } catch (error) {
      console.error('[OfflineManager] Failed to load local state:', error)
      return null
    }
  }

  clearLocalState(): void {
    try {
      const key = `${OFFLINE_STORAGE_KEY}_${this.sessionId}`
      this.storage.removeItem(key)
    } catch (error) {
      console.error('[OfflineManager] Failed to clear local state:', error)
    }
  }

  getPendingCount(): number {
    return this.operationQueue.length
  }

  hasUnsyncedChanges(): boolean {
    return this.operationQueue.length > 0
  }

  private loadQueue(): void {
    try {
      const key = `${OFFLINE_QUEUE_KEY}_${this.sessionId}`
      const data = this.storage.getItem(key)
      if (data) {
        this.operationQueue = JSON.parse(data)
      }
    } catch (error) {
      console.error('[OfflineManager] Failed to load queue:', error)
      this.operationQueue = []
    }
  }

  private saveQueue(): void {
    try {
      const key = `${OFFLINE_QUEUE_KEY}_${this.sessionId}`
      this.storage.setItem(key, JSON.stringify(this.operationQueue))
    } catch (error) {
      console.error('[OfflineManager] Failed to save queue:', error)
    }
  }

  private generateId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  destroy(): void {
    window.removeEventListener('online', this.handleOnlineEvent)
    window.removeEventListener('offline', this.handleOfflineEvent)
    this.events.removeAll()
  }
}

export default OfflineManager
