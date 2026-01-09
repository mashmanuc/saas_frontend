/**
 * Limits Store v2.1
 * Based on FRONTEND_TASKS_v2.1.md specification
 * 
 * Manages contact limits for student requests and tutor accepts
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import type { ContactLimit, LimitsResponse } from '@/types/relations'

export const useLimitsStore = defineStore('limits', () => {
  const limits = ref<ContactLimit[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  
  async function fetchLimits() {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await axios.get<LimitsResponse>('/api/v1/users/me/limits/')
      limits.value = response.data.limits
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      error.value = errorMessage
    } finally {
      isLoading.value = false
    }
  }
  
  function getLimitByType(limitType: string): ContactLimit | undefined {
    return limits.value.find(l => l.limit_type === limitType)
  }
  
  function canPerformAction(limitType: string): boolean {
    const limit = getLimitByType(limitType)
    return limit ? limit.remaining > 0 : true
  }
  
  const studentRequestLimit = computed(() => getLimitByType('student_request'))
  const tutorAcceptLimit = computed(() => getLimitByType('tutor_accept'))
  
  return {
    limits,
    isLoading,
    error,
    fetchLimits,
    getLimitByType,
    canPerformAction,
    studentRequestLimit,
    tutorAcceptLimit
  }
})
