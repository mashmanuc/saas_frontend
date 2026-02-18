// WB: Offline queue composable for Winterboard
// Ref: TASK_BOARD C2.2, ManifestWinterboard_v2.md LAW-02
// - IndexedDB storage for pending operations when offline
// - Flush queue on reconnect (online event)
// - Max queue size: 100 operations
// - navigator.onLine detection + online/offline events

import { ref, onUnmounted, computed, type Ref } from 'vue'
import type { WBDiffOp } from '../api/winterboardApi'

// ── Config ─────────────────────────────────────────────────────────────

const DB_NAME = 'wb-offline-queue'
const DB_VERSION = 1
const STORE_NAME = 'pending_ops'
const MAX_QUEUE_SIZE = 100

// ── Types ──────────────────────────────────────────────────────────────

export interface QueuedOperation {
  id: number
  sessionId: string
  op: WBDiffOp
  timestamp: number
  rev: number
}

export interface OfflineQueueReturn {
  /** Whether the browser is currently online */
  isOnline: Ref<boolean>
  /** Number of queued operations */
  queueSize: Ref<number>
  /** Whether the queue is currently flushing */
  isFlushing: Ref<boolean>
  /** Enqueue an operation (persists to IndexedDB) */
  enqueue: (sessionId: string, op: WBDiffOp, rev: number) => Promise<void>
  /** Flush all queued operations for a session */
  flush: (sessionId: string, sendFn: (ops: WBDiffOp[], rev: number) => Promise<number>) => Promise<void>
  /** Get all queued ops for a session */
  getQueuedOps: (sessionId: string) => Promise<QueuedOperation[]>
  /** Clear all queued ops for a session */
  clearQueue: (sessionId: string) => Promise<void>
  /** Clear entire database */
  clearAll: () => Promise<void>
  /** Destroy — cleanup listeners */
  destroy: () => void
}

// ── IndexedDB helpers ──────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex('sessionId', 'sessionId', { unique: false })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      dbPromise = null
      reject(request.error)
    }
  })

  return dbPromise
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function idbTransaction(
  db: IDBDatabase,
  mode: IDBTransactionMode,
): IDBObjectStore {
  const tx = db.transaction(STORE_NAME, mode)
  return tx.objectStore(STORE_NAME)
}

// ── Composable ─────────────────────────────────────────────────────────

export function useOfflineQueue(): OfflineQueueReturn {
  const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const queueSize = ref(0)
  const isFlushing = ref(false)
  let destroyed = false

  // Registered flush callbacks per session
  const flushCallbacks = new Map<
    string,
    (ops: WBDiffOp[], rev: number) => Promise<number>
  >()

  // ── IndexedDB operations ─────────────────────────────────────────

  async function enqueue(
    sessionId: string,
    op: WBDiffOp,
    rev: number,
  ): Promise<void> {
    try {
      const db = await openDB()

      // Check queue size first
      const store = idbTransaction(db, 'readonly')
      const index = store.index('sessionId')
      const count = await idbRequest(index.count(IDBKeyRange.only(sessionId)))

      if (count >= MAX_QUEUE_SIZE) {
        console.warn(
          `[WB:offlineQueue] Queue full (${MAX_QUEUE_SIZE}), dropping oldest op`,
        )
        await dropOldest(sessionId)
      }

      // Add new operation
      const writeStore = idbTransaction(db, 'readwrite')
      const entry: Omit<QueuedOperation, 'id'> = {
        sessionId,
        op,
        timestamp: Date.now(),
        rev,
      }
      await idbRequest(writeStore.add(entry))
      await refreshQueueSize(sessionId)
    } catch (err) {
      console.error('[WB:offlineQueue] enqueue failed:', err)
    }
  }

  async function dropOldest(sessionId: string): Promise<void> {
    try {
      const db = await openDB()
      const store = idbTransaction(db, 'readwrite')
      const index = store.index('sessionId')
      const request = index.openCursor(IDBKeyRange.only(sessionId))

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const cursor = request.result
          if (cursor) {
            cursor.delete()
            resolve()
          } else {
            resolve()
          }
        }
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.error('[WB:offlineQueue] dropOldest failed:', err)
    }
  }

  async function getQueuedOps(sessionId: string): Promise<QueuedOperation[]> {
    try {
      const db = await openDB()
      const store = idbTransaction(db, 'readonly')
      const index = store.index('sessionId')
      const results = await idbRequest(index.getAll(IDBKeyRange.only(sessionId)))
      return (results as QueuedOperation[]).sort((a, b) => a.timestamp - b.timestamp)
    } catch (err) {
      console.error('[WB:offlineQueue] getQueuedOps failed:', err)
      return []
    }
  }

  async function clearQueue(sessionId: string): Promise<void> {
    try {
      const db = await openDB()
      const store = idbTransaction(db, 'readwrite')
      const index = store.index('sessionId')
      const request = index.openCursor(IDBKeyRange.only(sessionId))

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const cursor = request.result
          if (cursor) {
            cursor.delete()
            cursor.continue()
          } else {
            queueSize.value = 0
            resolve()
          }
        }
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.error('[WB:offlineQueue] clearQueue failed:', err)
    }
  }

  async function clearAll(): Promise<void> {
    try {
      const db = await openDB()
      const store = idbTransaction(db, 'readwrite')
      await idbRequest(store.clear())
      queueSize.value = 0
    } catch (err) {
      console.error('[WB:offlineQueue] clearAll failed:', err)
    }
  }

  async function refreshQueueSize(sessionId: string): Promise<void> {
    try {
      const db = await openDB()
      const store = idbTransaction(db, 'readonly')
      const index = store.index('sessionId')
      const count = await idbRequest(index.count(IDBKeyRange.only(sessionId)))
      queueSize.value = count
    } catch {
      // Ignore
    }
  }

  // ── Flush logic ──────────────────────────────────────────────────

  async function flush(
    sessionId: string,
    sendFn: (ops: WBDiffOp[], rev: number) => Promise<number>,
  ): Promise<void> {
    if (isFlushing.value || destroyed) return

    const queued = await getQueuedOps(sessionId)
    if (queued.length === 0) return

    isFlushing.value = true

    try {
      // Group ops and use the latest rev
      const ops = queued.map((q) => q.op)
      const latestRev = queued[queued.length - 1].rev

      if (import.meta.env?.DEV) {
        console.log(`[WB:offlineQueue] Flushing ${ops.length} ops (rev=${latestRev})`)
      }

      // Send all ops — sendFn returns the new rev
      const newRev = await sendFn(ops, latestRev)

      // Success — clear queue
      await clearQueue(sessionId)

      if (import.meta.env?.DEV) {
        console.log(`[WB:offlineQueue] Flush complete, new rev=${newRev}`)
      }
    } catch (err) {
      console.error('[WB:offlineQueue] Flush failed:', err)
      // Keep ops in queue for next attempt
    } finally {
      isFlushing.value = false
    }
  }

  // ── Online/Offline events ────────────────────────────────────────

  function handleOnline(): void {
    isOnline.value = true
    if (import.meta.env?.DEV) {
      console.log('[WB:offlineQueue] Back online')
    }
  }

  function handleOffline(): void {
    isOnline.value = false
    if (import.meta.env?.DEV) {
      console.log('[WB:offlineQueue] Gone offline')
    }
  }

  // ── Event listeners ──────────────────────────────────────────────

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }

  // ── Cleanup ──────────────────────────────────────────────────────

  function destroy(): void {
    destroyed = true
    flushCallbacks.clear()

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }

  onUnmounted(destroy)

  return {
    isOnline,
    queueSize,
    isFlushing,
    enqueue,
    flush,
    getQueuedOps,
    clearQueue,
    clearAll,
    destroy,
  }
}

export default useOfflineQueue
