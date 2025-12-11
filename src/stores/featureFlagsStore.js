/**
 * Feature Flags Store — v0.14.0
 * Централізоване управління feature flags
 */

import { defineStore } from 'pinia'
import { apiClient } from '../utils/apiClient'
import { realtimeService } from '../services/realtime'

const CACHE_KEY = 'feature_flags_cache'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Default feature flags (fallback)
 */
const DEFAULT_FLAGS = {
  // Chat features
  chat_attachments: true,
  chat_reactions: false,
  chat_threads: false,
  chat_voice_messages: false,
  
  // Board features
  board_collaborative: true,
  board_templates: false,
  board_export_pdf: false,
  
  // Notifications
  notifications_push: false,
  notifications_email_digest: true,
  
  // UI features
  ui_dark_mode: true,
  ui_compact_view: false,
  ui_animations: true,
  
  // Performance
  perf_virtualized_lists: true,
  perf_lazy_images: true,
  
  // Experimental
  experimental_ai_assistant: false,
  experimental_video_calls: false,
}

export const useFeatureFlagsStore = defineStore('featureFlags', {
  state: () => ({
    flags: { ...DEFAULT_FLAGS },
    loading: false,
    error: null,
    lastFetched: null,
    subscription: null,
  }),

  getters: {
    /**
     * Check if a feature is enabled
     */
    isEnabled: (state) => (flagName) => {
      return state.flags[flagName] ?? DEFAULT_FLAGS[flagName] ?? false
    },

    /**
     * Get all enabled features
     */
    enabledFeatures: (state) => {
      return Object.entries(state.flags)
        .filter(([, value]) => value === true)
        .map(([key]) => key)
    },

    /**
     * Check if cache is stale
     */
    isCacheStale: (state) => {
      if (!state.lastFetched) return true
      return Date.now() - state.lastFetched > CACHE_TTL_MS
    },
  },

  actions: {
    /**
     * Initialize feature flags
     */
    async init() {
      // Load from cache first
      this.loadFromCache()
      
      // Fetch fresh flags if cache is stale
      if (this.isCacheStale) {
        await this.fetchFlags()
      }
      
      // Subscribe to realtime updates
      this.subscribeToUpdates()
    },

    /**
     * Fetch feature flags from API
     */
    async fetchFlags() {
      if (this.loading) return
      
      this.loading = true
      this.error = null
      
      try {
        const response = await apiClient.get('/api/v1/feature-flags/')
        const flags = response.data?.flags || response.data || {}
        
        // Merge with defaults
        this.flags = {
          ...DEFAULT_FLAGS,
          ...flags,
        }
        
        this.lastFetched = Date.now()
        this.saveToCache()
      } catch (error) {
        console.warn('[featureFlags] fetch failed, using cached/defaults:', error.message)
        this.error = error.message
        // Keep using cached or default flags
      } finally {
        this.loading = false
      }
    },

    /**
     * Load flags from localStorage cache
     */
    loadFromCache() {
      try {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const { flags, timestamp } = JSON.parse(cached)
          this.flags = { ...DEFAULT_FLAGS, ...flags }
          this.lastFetched = timestamp
        }
      } catch (error) {
        console.warn('[featureFlags] cache load failed:', error.message)
      }
    },

    /**
     * Save flags to localStorage cache
     */
    saveToCache() {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          flags: this.flags,
          timestamp: this.lastFetched,
        }))
      } catch (error) {
        console.warn('[featureFlags] cache save failed:', error.message)
      }
    },

    /**
     * Subscribe to realtime feature flag updates
     */
    subscribeToUpdates() {
      if (this.subscription) {
        this.subscription()
        this.subscription = null
      }
      
      // Subscribe to feature flags channel
      this.subscription = realtimeService.subscribe('feature-flags', (payload) => {
        if (payload?.type === 'feature_flags.updated') {
          this.handleFlagUpdate(payload.flags || payload.payload?.flags)
        }
      })
      
      // Re-fetch on reconnect
      realtimeService.on('status', (status) => {
        if (status === 'open') {
          this.fetchFlags()
        }
      })
    },

    /**
     * Handle realtime flag update
     */
    handleFlagUpdate(newFlags) {
      if (!newFlags || typeof newFlags !== 'object') return
      
      this.flags = {
        ...this.flags,
        ...newFlags,
      }
      this.lastFetched = Date.now()
      this.saveToCache()
    },

    /**
     * Force refresh flags
     */
    async refresh() {
      this.lastFetched = null
      await this.fetchFlags()
    },

    /**
     * Check specific flag (shorthand)
     */
    check(flagName) {
      return this.isEnabled(flagName)
    },

    /**
     * Cleanup
     */
    dispose() {
      if (this.subscription) {
        this.subscription()
        this.subscription = null
      }
    },
  },
})

export default useFeatureFlagsStore
