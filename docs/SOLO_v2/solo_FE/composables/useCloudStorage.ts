import { ref, onMounted, onUnmounted } from 'vue'
import { soloApi } from '../api/soloApi'
import { useStorage } from './useStorage'
import type { SoloSession, PageState } from '../types/solo'

export function useCloudStorage(sessionId?: string) {
  const localStorage = useStorage()

  // State
  const isOnline = ref(navigator.onLine)
  const isSyncing = ref(false)
  const syncError = ref<string | null>(null)
  const lastSyncedAt = ref<Date | null>(null)
  const pendingChanges = ref(false)

  // Current session
  const currentSession = ref<SoloSession | null>(null)

  const handleOnline = () => {
    isOnline.value = true
    void syncPending()
  }

  const handleOffline = () => {
    isOnline.value = false
  }

  /**
   * Load session from cloud or localStorage fallback.
   */
  async function load(id: string): Promise<SoloSession | null> {
    if (isOnline.value) {
      try {
        const session = await soloApi.getSession(id)
        currentSession.value = session

        // Cache locally
        cacheSession(session)

        return session
      } catch (error) {
        console.warn('[CloudStorage] Failed to load from cloud, using cache')
        syncError.value = 'Failed to load from cloud'
      }
    }

    // Fallback to localStorage
    return getCachedSession(id)
  }

  /**
   * Save session to cloud with localStorage fallback.
   */
  async function save(
    pages: PageState[],
    name?: string
  ): Promise<SoloSession | null> {
    const state = { pages }

    // Always save locally first
    localStorage.save(pages, name)

    if (!isOnline.value) {
      pendingChanges.value = true
      return null
    }

    isSyncing.value = true
    syncError.value = null

    try {
      let session: SoloSession

      if (sessionId && currentSession.value) {
        // Update existing
        session = await soloApi.updateSession(sessionId, {
          state,
          name: name || currentSession.value.name,
          page_count: pages.length,
        })
      } else {
        // Create new
        session = await soloApi.createSession({
          name: name || 'Untitled',
          state,
          page_count: pages.length,
        })
      }

      currentSession.value = session
      lastSyncedAt.value = new Date()
      pendingChanges.value = false

      // Update local cache
      cacheSession(session)

      return session
    } catch (error) {
      console.error('[CloudStorage] Save failed:', error)
      syncError.value = 'Failed to save to cloud'
      pendingChanges.value = true
      return null
    } finally {
      isSyncing.value = false
    }
  }

  /**
   * Sync pending changes when back online.
   */
  async function syncPending(): Promise<void> {
    if (!pendingChanges.value || !isOnline.value) return

    const localData = localStorage.load()
    if (localData) {
      await save(localData.pages)
    }
  }

  /**
   * Delete session from cloud.
   */
  async function deleteSession(id: string): Promise<boolean> {
    try {
      await soloApi.deleteSession(id)
      removeCachedSession(id)
      return true
    } catch (error) {
      console.error('[CloudStorage] Delete failed:', error)
      return false
    }
  }

  // Local cache helpers
  function cacheSession(session: SoloSession): void {
    try {
      const cache = JSON.parse(window.localStorage.getItem('solo-cache') || '{}')
      cache[session.id] = session
      window.localStorage.setItem('solo-cache', JSON.stringify(cache))
    } catch {
      // Ignore
    }
  }

  function getCachedSession(id: string): SoloSession | null {
    try {
      const cache = JSON.parse(window.localStorage.getItem('solo-cache') || '{}')
      return cache[id] || null
    } catch {
      return null
    }
  }

  function removeCachedSession(id: string): void {
    try {
      const cache = JSON.parse(window.localStorage.getItem('solo-cache') || '{}')
      delete cache[id]
      window.localStorage.setItem('solo-cache', JSON.stringify(cache))
    } catch {
      // Ignore
    }
  }

  // Listen for online/offline
  onMounted(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  })

  onUnmounted(() => {
    if (typeof window === 'undefined') return
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })

  return {
    // State
    isOnline,
    isSyncing,
    syncError,
    lastSyncedAt,
    pendingChanges,
    currentSession,

    // Methods
    load,
    save,
    syncPending,
    deleteSession,
  }
}
