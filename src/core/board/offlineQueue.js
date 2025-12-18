/**
 * Offline Board Queue — v0.16.0
 * Зберігання операцій board sync локально, перезапуск при reconnect
 */

import { OPERATION_TYPE } from './boardSync'

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  maxQueueSize: 1000,
  storageKey: 'mash_board_offline_queue',
  autoSync: true,
  syncDebounceMs: 1000,
}

/**
 * Queue item status
 */
export const QUEUE_STATUS = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  FAILED: 'failed',
}

/**
 * Offline Board Queue
 */
export class OfflineBoardQueue {
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options }
    this.queue = []
    this.isSyncing = false
    this.syncTimer = null
    this.boardId = options.boardId || null

    this.handleOnlineBound = this.handleOnline.bind(this)
    this.handleOfflineBound = this.handleOffline.bind(this)
    
    // Callbacks
    this.onSync = options.onSync || (() => {})
    this.onSyncComplete = options.onSyncComplete || (() => {})
    this.onSyncError = options.onSyncError || (() => {})
    this.onQueueChange = options.onQueueChange || (() => {})
    
    // BoardSyncManager reference
    this.syncManager = options.syncManager || null
    
    // Load from storage
    this.loadFromStorage()
    
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnlineBound)
      window.addEventListener('offline', this.handleOfflineBound)
    }
  }

  /**
   * Add operation to queue
   */
  enqueue(operation) {
    if (this.queue.length >= this.config.maxQueueSize) {
      console.warn('[offlineQueue] queue full, dropping oldest operation')
      this.queue.shift()
    }
    
    const queueItem = {
      id: operation.id || this.generateId(),
      operation,
      status: QUEUE_STATUS.PENDING,
      timestamp: Date.now(),
      retryCount: 0,
    }
    
    this.queue.push(queueItem)
    this.saveToStorage()
    this.onQueueChange(this.queue)
    
    // Schedule sync if online
    if (navigator.onLine && this.config.autoSync) {
      this.scheduleSyncDebounced()
    }
    
    return queueItem.id
  }

  /**
   * Remove operation from queue
   */
  dequeue(id) {
    const index = this.queue.findIndex(item => item.id === id)
    if (index > -1) {
      this.queue.splice(index, 1)
      this.saveToStorage()
      this.onQueueChange(this.queue)
      return true
    }
    return false
  }

  /**
   * Get pending operations
   */
  getPending() {
    return this.queue.filter(item => item.status === QUEUE_STATUS.PENDING)
  }

  /**
   * Get failed operations
   */
  getFailed() {
    return this.queue.filter(item => item.status === QUEUE_STATUS.FAILED)
  }

  /**
   * Schedule sync with debounce
   */
  scheduleSyncDebounced() {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer)
    }
    
    this.syncTimer = setTimeout(() => {
      this.sync()
    }, this.config.syncDebounceMs)
  }

  /**
   * Sync all pending operations
   */
  async sync() {
    if (this.isSyncing) {
      console.log('[offlineQueue] sync already in progress')
      return
    }
    
    if (!navigator.onLine) {
      console.log('[offlineQueue] offline, skipping sync')
      return
    }
    
    const pending = this.getPending()
    if (pending.length === 0) {
      console.log('[offlineQueue] no pending operations')
      return
    }
    
    this.isSyncing = true
    this.onSync(pending)
    
    try {
      // Mark as syncing
      pending.forEach(item => {
        item.status = QUEUE_STATUS.SYNCING
      })
      this.saveToStorage()
      
      // Get operations to send
      const operations = pending.map(item => item.operation)
      
      // Send to sync manager or callback
      if (this.syncManager) {
        for (const op of operations) {
          this.syncManager.applyOperation(op, true)
        }
      }
      
      // Call sync callback (for network sync)
      await this.onSyncComplete(operations)
      
      // Mark as synced and remove from queue
      pending.forEach(item => {
        item.status = QUEUE_STATUS.SYNCED
        this.dequeue(item.id)
      })
      
      console.log(`[offlineQueue] synced ${pending.length} operations`)
    } catch (error) {
      console.error('[offlineQueue] sync failed:', error)
      
      // Mark as failed
      pending.forEach(item => {
        item.status = QUEUE_STATUS.FAILED
        item.retryCount++
      })
      this.saveToStorage()
      
      this.onSyncError(error, pending)
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Retry failed operations
   */
  async retryFailed() {
    const failed = this.getFailed()
    
    // Reset status to pending
    failed.forEach(item => {
      item.status = QUEUE_STATUS.PENDING
    })
    this.saveToStorage()
    
    // Trigger sync
    await this.sync()
  }

  /**
   * Clear all operations
   */
  clear() {
    this.queue = []
    this.saveToStorage()
    this.onQueueChange(this.queue)
  }

  /**
   * Clear synced operations
   */
  clearSynced() {
    this.queue = this.queue.filter(item => item.status !== QUEUE_STATUS.SYNCED)
    this.saveToStorage()
    this.onQueueChange(this.queue)
  }

  /**
   * Handle online event
   */
  handleOnline() {
    console.log('[offlineQueue] online, syncing...')
    
    // Register background sync if available
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        registration.sync.register('board-sync')
      }).catch(error => {
        console.warn('[offlineQueue] background sync registration failed:', error)
        // Fallback to immediate sync
        this.sync()
      })
    } else {
      this.sync()
    }
  }

  /**
   * Handle offline event
   */
  handleOffline() {
    console.log('[offlineQueue] offline')
    
    // Cancel pending sync
    if (this.syncTimer) {
      clearTimeout(this.syncTimer)
      this.syncTimer = null
    }
  }

  /**
   * Save queue to storage
   */
  saveToStorage() {
    try {
      const data = {
        boardId: this.boardId,
        queue: this.queue,
        savedAt: Date.now(),
      }
      localStorage.setItem(this.config.storageKey, JSON.stringify(data))
    } catch (error) {
      console.error('[offlineQueue] failed to save to storage:', error)
    }
  }

  /**
   * Load queue from storage
   */
  loadFromStorage() {
    try {
      const data = localStorage.getItem(this.config.storageKey)
      if (data) {
        const parsed = JSON.parse(data)
        
        // Only load if same board
        if (parsed.boardId === this.boardId) {
          this.queue = parsed.queue || []
          console.log(`[offlineQueue] loaded ${this.queue.length} operations from storage`)
        }
      }
    } catch (error) {
      console.error('[offlineQueue] failed to load from storage:', error)
    }
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      total: this.queue.length,
      pending: this.getPending().length,
      failed: this.getFailed().length,
      isSyncing: this.isSyncing,
      isOnline: navigator.onLine,
    }
  }

  /**
   * Set board ID
   */
  setBoardId(boardId) {
    if (this.boardId !== boardId) {
      this.boardId = boardId
      this.loadFromStorage()
    }
  }

  /**
   * Destroy queue
   */
  destroy() {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer)
      this.syncTimer = null
    }
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnlineBound)
      window.removeEventListener('offline', this.handleOfflineBound)
    }
  }
}

/**
 * Create offline board queue
 */
export function createOfflineBoardQueue(options = {}) {
  return new OfflineBoardQueue(options)
}

export default {
  OfflineBoardQueue,
  createOfflineBoardQueue,
  QUEUE_STATUS,
}
