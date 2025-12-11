/**
 * IndexedDB Storage — v0.16.0
 * Зберігання board operations, snapshots, user cursors
 */

/**
 * Database configuration
 */
const DB_NAME = 'mash_board_db'
const DB_VERSION = 1

/**
 * Store names
 */
export const STORES = {
  OPERATIONS: 'operations',
  SNAPSHOTS: 'snapshots',
  CURSORS: 'cursors',
  PENDING: 'pending',
}

/**
 * IndexedDB wrapper class
 */
export class BoardIndexedDB {
  constructor() {
    this.db = null
    this.isOpen = false
  }

  /**
   * Open database connection
   */
  async open() {
    if (this.isOpen && this.db) {
      return this.db
    }
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      
      request.onerror = () => {
        console.error('[indexeddb] failed to open database:', request.error)
        reject(request.error)
      }
      
      request.onsuccess = () => {
        this.db = request.result
        this.isOpen = true
        console.log('[indexeddb] database opened')
        resolve(this.db)
      }
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        
        // Operations store
        if (!db.objectStoreNames.contains(STORES.OPERATIONS)) {
          const operationsStore = db.createObjectStore(STORES.OPERATIONS, { keyPath: 'id' })
          operationsStore.createIndex('boardId', 'boardId', { unique: false })
          operationsStore.createIndex('timestamp', 'timestamp', { unique: false })
          operationsStore.createIndex('type', 'type', { unique: false })
        }
        
        // Snapshots store
        if (!db.objectStoreNames.contains(STORES.SNAPSHOTS)) {
          const snapshotsStore = db.createObjectStore(STORES.SNAPSHOTS, { keyPath: 'id' })
          snapshotsStore.createIndex('boardId', 'boardId', { unique: false })
          snapshotsStore.createIndex('version', 'version', { unique: false })
          snapshotsStore.createIndex('createdAt', 'createdAt', { unique: false })
        }
        
        // Cursors store
        if (!db.objectStoreNames.contains(STORES.CURSORS)) {
          const cursorsStore = db.createObjectStore(STORES.CURSORS, { keyPath: 'id' })
          cursorsStore.createIndex('boardId', 'boardId', { unique: false })
          cursorsStore.createIndex('userId', 'userId', { unique: false })
          cursorsStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
        
        // Pending operations store (for offline sync)
        if (!db.objectStoreNames.contains(STORES.PENDING)) {
          const pendingStore = db.createObjectStore(STORES.PENDING, { keyPath: 'id' })
          pendingStore.createIndex('boardId', 'boardId', { unique: false })
          pendingStore.createIndex('status', 'status', { unique: false })
          pendingStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
        
        console.log('[indexeddb] database upgraded to version', DB_VERSION)
      }
    })
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close()
      this.db = null
      this.isOpen = false
    }
  }

  /**
   * Get transaction
   */
  getTransaction(storeNames, mode = 'readonly') {
    if (!this.db) {
      throw new Error('Database not open')
    }
    return this.db.transaction(storeNames, mode)
  }

  /**
   * Get object store
   */
  getStore(storeName, mode = 'readonly') {
    const transaction = this.getTransaction(storeName, mode)
    return transaction.objectStore(storeName)
  }

  // ==================== Operations ====================

  /**
   * Save operation
   */
  async saveOperation(operation) {
    await this.open()
    
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.OPERATIONS, 'readwrite')
      const request = store.put({
        ...operation,
        savedAt: Date.now(),
      })
      
      request.onsuccess = () => resolve(operation.id)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Save multiple operations
   */
  async saveOperations(operations) {
    await this.open()
    
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.OPERATIONS, 'readwrite')
      const store = transaction.objectStore(STORES.OPERATIONS)
      
      operations.forEach(op => {
        store.put({ ...op, savedAt: Date.now() })
      })
      
      transaction.oncomplete = () => resolve(operations.length)
      transaction.onerror = () => reject(transaction.error)
    })
  }

  /**
   * Get operations by board ID
   */
  async getOperationsByBoard(boardId, options = {}) {
    await this.open()
    
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.OPERATIONS)
      const index = store.index('boardId')
      const request = index.getAll(boardId)
      
      request.onsuccess = () => {
        let results = request.result || []
        
        // Sort by timestamp
        results.sort((a, b) => a.timestamp - b.timestamp)
        
        // Apply limit
        if (options.limit) {
          results = results.slice(0, options.limit)
        }
        
        // Apply since filter
        if (options.since) {
          results = results.filter(op => op.timestamp > options.since)
        }
        
        resolve(results)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Delete operations by board ID
   */
  async deleteOperationsByBoard(boardId) {
    await this.open()
    
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.OPERATIONS, 'readwrite')
      const store = transaction.objectStore(STORES.OPERATIONS)
      const index = store.index('boardId')
      const request = index.openCursor(boardId)
      
      let count = 0
      
      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          cursor.delete()
          count++
          cursor.continue()
        }
      }
      
      transaction.oncomplete = () => resolve(count)
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // ==================== Snapshots ====================

  /**
   * Save snapshot
   */
  async saveSnapshot(snapshot) {
    await this.open()
    
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.SNAPSHOTS, 'readwrite')
      const data = {
        id: snapshot.id || `${snapshot.boardId}-${snapshot.version}`,
        ...snapshot,
        createdAt: Date.now(),
      }
      const request = store.put(data)
      
      request.onsuccess = () => resolve(data.id)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get latest snapshot by board ID
   */
  async getLatestSnapshot(boardId) {
    await this.open()
    
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.SNAPSHOTS)
      const index = store.index('boardId')
      const request = index.getAll(boardId)
      
      request.onsuccess = () => {
        const results = request.result || []
        if (results.length === 0) {
          resolve(null)
          return
        }
        
        // Get latest by version
        results.sort((a, b) => b.version - a.version)
        resolve(results[0])
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get snapshot by version
   */
  async getSnapshotByVersion(boardId, version) {
    await this.open()
    
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.SNAPSHOTS)
      const request = store.get(`${boardId}-${version}`)
      
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Delete old snapshots (keep last N)
   */
  async cleanupSnapshots(boardId, keepCount = 5) {
    await this.open()
    
    const snapshots = await new Promise((resolve, reject) => {
      const store = this.getStore(STORES.SNAPSHOTS)
      const index = store.index('boardId')
      const request = index.getAll(boardId)
      
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
    
    if (snapshots.length <= keepCount) {
      return 0
    }
    
    // Sort by version descending
    snapshots.sort((a, b) => b.version - a.version)
    
    // Delete old ones
    const toDelete = snapshots.slice(keepCount)
    
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.SNAPSHOTS, 'readwrite')
      const store = transaction.objectStore(STORES.SNAPSHOTS)
      
      toDelete.forEach(snapshot => {
        store.delete(snapshot.id)
      })
      
      transaction.oncomplete = () => resolve(toDelete.length)
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // ==================== Cursors ====================

  /**
   * Save cursor position
   */
  async saveCursor(cursor) {
    await this.open()
    
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.CURSORS, 'readwrite')
      const data = {
        id: `${cursor.boardId}-${cursor.userId}`,
        ...cursor,
        timestamp: Date.now(),
      }
      const request = store.put(data)
      
      request.onsuccess = () => resolve(data.id)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get cursors by board ID
   */
  async getCursorsByBoard(boardId) {
    await this.open()
    
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.CURSORS)
      const index = store.index('boardId')
      const request = index.getAll(boardId)
      
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Delete old cursors (older than N minutes)
   */
  async cleanupCursors(maxAgeMinutes = 30) {
    await this.open()
    
    const cutoff = Date.now() - maxAgeMinutes * 60 * 1000
    
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.CURSORS, 'readwrite')
      const store = transaction.objectStore(STORES.CURSORS)
      const index = store.index('timestamp')
      const range = IDBKeyRange.upperBound(cutoff)
      const request = index.openCursor(range)
      
      let count = 0
      
      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          cursor.delete()
          count++
          cursor.continue()
        }
      }
      
      transaction.oncomplete = () => resolve(count)
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // ==================== Pending Operations ====================

  /**
   * Save pending operation
   */
  async savePending(operation) {
    await this.open()
    
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PENDING, 'readwrite')
      const data = {
        ...operation,
        status: operation.status || 'pending',
        timestamp: Date.now(),
      }
      const request = store.put(data)
      
      request.onsuccess = () => resolve(data.id)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get pending operations
   */
  async getPendingOperations(boardId) {
    await this.open()
    
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PENDING)
      const index = store.index('boardId')
      const request = index.getAll(boardId)
      
      request.onsuccess = () => {
        const results = (request.result || []).filter(op => op.status === 'pending')
        results.sort((a, b) => a.timestamp - b.timestamp)
        resolve(results)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Clear pending operations
   */
  async clearPending(boardId) {
    await this.open()
    
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.PENDING, 'readwrite')
      const store = transaction.objectStore(STORES.PENDING)
      const index = store.index('boardId')
      const request = index.openCursor(boardId)
      
      let count = 0
      
      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          cursor.delete()
          count++
          cursor.continue()
        }
      }
      
      transaction.oncomplete = () => resolve(count)
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // ==================== Utilities ====================

  /**
   * Clear all data
   */
  async clearAll() {
    await this.open()
    
    const storeNames = [STORES.OPERATIONS, STORES.SNAPSHOTS, STORES.CURSORS, STORES.PENDING]
    
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(storeNames, 'readwrite')
      
      storeNames.forEach(name => {
        transaction.objectStore(name).clear()
      })
      
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  /**
   * Get storage usage estimate
   */
  async getStorageEstimate() {
    if (navigator.storage && navigator.storage.estimate) {
      return navigator.storage.estimate()
    }
    return { usage: 0, quota: 0 }
  }
}

/**
 * Singleton instance
 */
let instance = null

export function getBoardDB() {
  if (!instance) {
    instance = new BoardIndexedDB()
  }
  return instance
}

export default {
  BoardIndexedDB,
  getBoardDB,
  STORES,
}
