/**
 * Tutor Lesson Links Store
 * 
 * Manages tutor's lesson link configuration (Zoom, Meet, Platform, Custom)
 * v0.55.7.3
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { tutorSettingsApi, type TutorLessonLinksResponse, type LessonLinkProvider } from '../api/tutorSettingsApi'

export const useTutorLessonLinksStore = defineStore('tutorLessonLinks', () => {
  // State
  const primary = ref<LessonLinkProvider | null>(null)
  const backup = ref<LessonLinkProvider | null>(null)
  const effectivePrimary = ref<LessonLinkProvider | null>(null)
  const updatedAt = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const effectivePrimaryLink = computed(() => {
    if (effectivePrimary.value?.url) {
      return effectivePrimary.value.url
    }
    // Fallback to platform if nothing set
    return null
  })

  const hasBackup = computed(() => backup.value !== null)

  const primaryProvider = computed(() => primary.value?.provider || 'platform')

  // Actions
  async function fetchLessonLinks() {
    loading.value = true
    error.value = null
    
    try {
      const response = await tutorSettingsApi.getLessonLinks()
      
      primary.value = response.primary
      backup.value = response.backup
      effectivePrimary.value = response.effective_primary
      updatedAt.value = response.updated_at
      
      console.log('[tutorLessonLinksStore] Fetched lesson links:', {
        primary: primary.value?.provider,
        backup: backup.value?.provider,
        effectivePrimary: effectivePrimary.value?.provider
      })
    } catch (err: any) {
      error.value = err?.response?.data?.error || err.message || 'Failed to fetch lesson links'
      console.error('[tutorLessonLinksStore] Fetch error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function patchLessonLinks(payload: {
    primary?: LessonLinkProvider
    backup?: LessonLinkProvider | null
  }) {
    loading.value = true
    error.value = null
    
    try {
      // Include updated_at for optimistic locking
      const patchPayload = {
        ...payload,
        updated_at: updatedAt.value || undefined
      }
      
      const response = await tutorSettingsApi.patchLessonLinks(patchPayload)
      
      // Update local state with response
      primary.value = response.primary
      backup.value = response.backup
      effectivePrimary.value = response.effective_primary
      updatedAt.value = response.updated_at
      
      console.log('[tutorLessonLinksStore] Patched lesson links:', {
        primary: primary.value?.provider,
        backup: backup.value?.provider
      })
      
      return response
    } catch (err: any) {
      // Check for conflict
      if (err?.response?.status === 409) {
        error.value = 'Налаштування були змінені в іншій сесії. Оновіть сторінку.'
        console.warn('[tutorLessonLinksStore] Conflict detected:', err.response.data)
      } else {
        error.value = err?.response?.data?.error || err.message || 'Failed to update lesson links'
        console.error('[tutorLessonLinksStore] Patch error:', err)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  function reset() {
    primary.value = null
    backup.value = null
    effectivePrimary.value = null
    updatedAt.value = null
    loading.value = false
    error.value = null
  }

  return {
    // State
    primary,
    backup,
    effectivePrimary,
    updatedAt,
    loading,
    error,
    
    // Getters
    effectivePrimaryLink,
    hasBackup,
    primaryProvider,
    
    // Actions
    fetchLessonLinks,
    patchLessonLinks,
    reset
  }
})
