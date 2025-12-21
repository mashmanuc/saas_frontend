/**
 * Draft cache using IndexedDB for offline support
 * v0.40.0: Added IndexedDB detection and fallback
 */

const DB_NAME = 'marketplace_drafts'
const DB_VERSION = 1
const STORE_NAME = 'profile_drafts'

interface DraftCacheEntry {
  id: string
  payload: any
  clientRev: number
  clientHash: string
  timestamp: number
  synced: boolean
}

let dbPromise: Promise<IDBDatabase> | null = null
let indexedDBAvailable: boolean | null = null
let inMemoryCache: Map<string, DraftCacheEntry> = new Map()

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  if (indexedDBAvailable !== null) return indexedDBAvailable

  try {
    indexedDBAvailable = !!(window.indexedDB && typeof window.indexedDB.open === 'function')
  } catch {
    indexedDBAvailable = false
  }

  return indexedDBAvailable
}

function openDB(): Promise<IDBDatabase> {
  if (!isIndexedDBAvailable()) {
    return Promise.reject(new Error('IndexedDB not available'))
  }

  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })

  return dbPromise
}

export async function saveDraftToCache(entry: Omit<DraftCacheEntry, 'id'>): Promise<void> {
  const fullEntry: DraftCacheEntry = {
    id: 'current_draft',
    ...entry,
  }

  if (!isIndexedDBAvailable()) {
    inMemoryCache.set('current_draft', fullEntry)
    return
  }

  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    
    store.put(fullEntry)
    
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.error('Failed to save draft to IndexedDB, using in-memory fallback:', err)
    inMemoryCache.set('current_draft', fullEntry)
  }
}

export async function getDraftFromCache(): Promise<DraftCacheEntry | null> {
  if (!isIndexedDBAvailable()) {
    return inMemoryCache.get('current_draft') || null
  }

  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get('current_draft')
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.error('Failed to get draft from IndexedDB, using in-memory fallback:', err)
    return inMemoryCache.get('current_draft') || null
  }
}

export async function clearDraftCache(): Promise<void> {
  if (!isIndexedDBAvailable()) {
    inMemoryCache.delete('current_draft')
    return
  }

  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.delete('current_draft')
    
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.error('Failed to clear draft from IndexedDB, using in-memory fallback:', err)
    inMemoryCache.delete('current_draft')
  }
}

export async function markDraftAsSynced(): Promise<void> {
  try {
    const draft = await getDraftFromCache()
    if (!draft) return
    
    draft.synced = true
    
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put(draft)
    
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.error('Failed to mark draft as synced:', err)
  }
}

export async function hasUnsyncedDraft(): Promise<boolean> {
  try {
    const draft = await getDraftFromCache()
    return draft ? !draft.synced : false
  } catch (err) {
    console.error('Failed to check unsynced draft:', err)
    return false
  }
}
