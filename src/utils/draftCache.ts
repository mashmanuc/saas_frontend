/**
 * Draft cache using IndexedDB for offline support
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

function openDB(): Promise<IDBDatabase> {
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
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    
    const fullEntry: DraftCacheEntry = {
      id: 'current_draft',
      ...entry,
    }
    
    store.put(fullEntry)
    
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.error('Failed to save draft to IndexedDB:', err)
  }
}

export async function getDraftFromCache(): Promise<DraftCacheEntry | null> {
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
    console.error('Failed to get draft from IndexedDB:', err)
    return null
  }
}

export async function clearDraftCache(): Promise<void> {
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
    console.error('Failed to clear draft from IndexedDB:', err)
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
