import { defineStore } from 'pinia'
import { soloApi } from '../api/soloApi'
import type { SoloSession, WorkspaceState } from '../types/solo'

interface AutosaveStatus {
  isSaving: boolean
  lastSaved: Date | null
  pendingChanges: boolean
  saveCount: number
}

interface SoloState {
  sessions: SoloSession[]
  currentSession: SoloSession | null
  isLoading: boolean
  error: string | null
  // Autosave state
  autosave: AutosaveStatus
  autosaveEnabled: boolean
}

// Debounce utility
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
  maxWait?: number
): T & { cancel: () => void; flush: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let maxWaitId: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null
  let lastCallTime = 0

  const invoke = () => {
    if (lastArgs) {
      fn(...lastArgs)
      lastArgs = null
    }
    if (timeoutId) clearTimeout(timeoutId)
    if (maxWaitId) clearTimeout(maxWaitId)
    timeoutId = null
    maxWaitId = null
  }

  const debounced = ((...args: Parameters<T>) => {
    lastArgs = args
    lastCallTime = Date.now()

    if (timeoutId) clearTimeout(timeoutId)

    timeoutId = setTimeout(invoke, delay)

    if (maxWait && !maxWaitId) {
      maxWaitId = setTimeout(invoke, maxWait)
    }
  }) as T & { cancel: () => void; flush: () => void }

  debounced.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId)
    if (maxWaitId) clearTimeout(maxWaitId)
    timeoutId = null
    maxWaitId = null
    lastArgs = null
  }

  debounced.flush = invoke

  return debounced
}

// Autosave configuration
const AUTOSAVE_DEBOUNCE_MS = 2000 // 2 seconds
const AUTOSAVE_MAX_WAIT_MS = 10000 // 10 seconds max

export const useSoloStore = defineStore('solo', {
  state: (): SoloState => ({
    sessions: [],
    currentSession: null,
    isLoading: false,
    error: null,
    // Autosave
    autosave: {
      isSaving: false,
      lastSaved: null,
      pendingChanges: false,
      saveCount: 0,
    },
    autosaveEnabled: true,
  }),

  getters: {
    getSessionById: (state) => (id: string) => {
      return state.sessions.find((s) => s.id === id)
    },

    recentSessions: (state) => {
      return [...state.sessions]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5)
    },

    // Autosave getters
    isSaving: (state) => state.autosave.isSaving,
    hasPendingChanges: (state) => state.autosave.pendingChanges,
    lastSavedAt: (state) => state.autosave.lastSaved,
    saveCount: (state) => state.autosave.saveCount,
  },

  actions: {
    async fetchSessions(): Promise<void> {
      this.isLoading = true
      this.error = null

      try {
        const response = await soloApi.getSessions()
        // apiClient already returns res.data, so response is the data object
        this.sessions = response.results
      } catch (err) {
        this.error = 'Failed to fetch sessions'
        console.error('[SoloStore] fetchSessions failed:', err)
      } finally {
        this.isLoading = false
      }
    },

    async fetchSession(id: string): Promise<SoloSession | null> {
      this.isLoading = true
      this.error = null

      try {
        const session = await soloApi.getSession(id)
        this.currentSession = session

        // Update in list if exists
        const index = this.sessions.findIndex((s) => s.id === id)
        if (index >= 0) {
          this.sessions[index] = session
        }

        return session
      } catch (err) {
        this.error = 'Failed to fetch session'
        console.error('[SoloStore] fetchSession failed:', err)
        return null
      } finally {
        this.isLoading = false
      }
    },

    async createSession(data: Partial<SoloSession>): Promise<SoloSession> {
      const session = await soloApi.createSession(data)
      this.sessions.unshift(session)
      this.currentSession = session
      return session
    },

    async updateSession(id: string, data: Partial<SoloSession>): Promise<SoloSession> {
      const session = await soloApi.updateSession(id, data)

      // Update in list
      const index = this.sessions.findIndex((s) => s.id === id)
      if (index >= 0) {
        this.sessions[index] = session
      }

      if (this.currentSession?.id === id) {
        this.currentSession = session
      }

      return session
    },

    async deleteSession(id: string): Promise<void> {
      await soloApi.deleteSession(id)
      this.sessions = this.sessions.filter((s) => s.id !== id)

      if (this.currentSession?.id === id) {
        this.currentSession = null
      }
    },

    async duplicateSession(id: string): Promise<SoloSession> {
      const session = await soloApi.duplicateSession(id)
      this.sessions.unshift(session)
      return session
    },

    clearCurrent(): void {
      this.currentSession = null
    },

    // ===== AUTOSAVE ACTIONS =====

    // Internal: Actual save function
    async _performAutosave(id: string, state: WorkspaceState): Promise<void> {
      if (!this.autosaveEnabled) return

      this.autosave.isSaving = true

      try {
        await soloApi.updateSession(id, { state: state as any })

        this.autosave.lastSaved = new Date()
        this.autosave.pendingChanges = false
        this.autosave.saveCount++

        // Update session in list
        const index = this.sessions.findIndex((s) => s.id === id)
        if (index >= 0) {
          this.sessions[index].updated_at = new Date().toISOString()
        }

        if (import.meta.env?.DEV) {
          console.log(`[Autosave] Saved (${this.autosave.saveCount} total)`)
        }
      } catch (err) {
        console.error('[Autosave] Failed:', err)
      } finally {
        this.autosave.isSaving = false
      }
    },

    // Debounced autosave (call this when state changes)
    debouncedAutosave: debounce(
      function(this: any, id: string, state: WorkspaceState) {
        this._performAutosave(id, state)
      },
      AUTOSAVE_DEBOUNCE_MS,
      AUTOSAVE_MAX_WAIT_MS
    ),

    // Schedule autosave (main entry point)
    scheduleAutosave(id: string, state: WorkspaceState): void {
      if (!this.autosaveEnabled) return

      this.autosave.pendingChanges = true
      this.debouncedAutosave(id, state)
    },

    // Force immediate save
    async saveNow(id: string, state: WorkspaceState): Promise<void> {
      this.debouncedAutosave.cancel()
      await this._performAutosave(id, state)
    },

    // Cancel pending autosave
    cancelAutosave(): void {
      this.debouncedAutosave.cancel()
      this.autosave.pendingChanges = false
    },

    // Toggle autosave
    setAutosaveEnabled(enabled: boolean): void {
      this.autosaveEnabled = enabled
      if (!enabled) {
        this.debouncedAutosave.cancel()
      }
    },
  },
})
