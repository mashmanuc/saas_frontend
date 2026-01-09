/**
 * Marketplace Store v2.1
 * Based on FRONTEND_TASKS_v2.1.md specification
 * 
 * Manages tutor search with filters, pagination, and CSV subject handling
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import type { TutorPublic, TutorPublicListResponse, TutorSearchParams } from '@/types/relations'

export const useMarketplaceStore = defineStore('marketplace', () => {
  const tutors = ref<TutorPublic[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const nextCursor = ref<string | null>(null)
  const filters = ref<TutorSearchParams>({})
  
  // P0.3: Serialize filters для router.push
  function serializeFilters(params: TutorSearchParams): Record<string, string> {
    const serialized: Record<string, string> = {}
    
    if (params.subjects) {
      serialized.subjects = params.subjects
    }
    if (params.min_rate !== undefined && params.min_rate !== null) {
      serialized.min_rate = params.min_rate.toString()
    }
    if (params.max_rate !== undefined && params.max_rate !== null) {
      serialized.max_rate = params.max_rate.toString()
    }
    if (params.min_rating !== undefined && params.min_rating !== null) {
      serialized.min_rating = params.min_rating.toString()
    }
    if (params.country) {
      serialized.country = params.country
    }
    if (params.sort_by) {
      serialized.sort_by = params.sort_by
    }
    
    return serialized
  }
  
  // P1.2: Parse filters from URL
  function parseFiltersFromQuery(query: Record<string, any>): TutorSearchParams {
    const params: TutorSearchParams = {}
    
    if (query.subjects && typeof query.subjects === 'string') {
      params.subjects = query.subjects // CSV format "Math,Physics"
    }
    if (query.min_rate) {
      params.min_rate = parseFloat(query.min_rate)
    }
    if (query.max_rate) {
      params.max_rate = parseFloat(query.max_rate)
    }
    if (query.min_rating) {
      params.min_rating = parseFloat(query.min_rating)
    }
    if (query.country && typeof query.country === 'string') {
      params.country = query.country
    }
    if (query.sort_by && typeof query.sort_by === 'string') {
      params.sort_by = query.sort_by as any
    }
    
    return params
  }
  
  async function searchTutors(params: TutorSearchParams) {
    isLoading.value = true
    error.value = null
    filters.value = params
    
    try {
      const response = await axios.get<TutorPublicListResponse>(
        '/api/v1/tutors/public-list/',
        { params: serializeFilters(params) }
      )
      
      tutors.value = response.data.results
      // P1.1: next це URL, не cursor
      nextCursor.value = response.data.next ? new URL(response.data.next).searchParams.get('cursor') : null
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      error.value = errorMessage
    } finally {
      isLoading.value = false
    }
  }
  
  async function loadMore() {
    if (!nextCursor.value || isLoading.value) return
    
    isLoading.value = true
    
    try {
      const response = await axios.get<TutorPublicListResponse>(
        '/api/v1/tutors/public-list/',
        { params: { ...serializeFilters(filters.value), cursor: nextCursor.value } }
      )
      
      tutors.value.push(...response.data.results)
      // P1.1: next це URL, не cursor
      nextCursor.value = response.data.next ? new URL(response.data.next).searchParams.get('cursor') : null
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      error.value = errorMessage
    } finally {
      isLoading.value = false
    }
  }
  
  return { 
    tutors, 
    isLoading, 
    error, 
    nextCursor, 
    filters, 
    serializeFilters,
    parseFiltersFromQuery,
    searchTutors, 
    loadMore 
  }
})
