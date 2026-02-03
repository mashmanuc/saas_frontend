import { defineStore } from 'pinia'
import { soloApi } from '../api/soloApi'
import type { SoloSession } from '../types/solo'

interface SoloState {
  sessions: SoloSession[]
  currentSession: SoloSession | null
  isLoading: boolean
  error: string | null
}

export const useSoloStore = defineStore('solo', {
  state: (): SoloState => ({
    sessions: [],
    currentSession: null,
    isLoading: false,
    error: null,
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
  },
})
