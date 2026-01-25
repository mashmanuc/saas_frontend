/**
 * Relations Store v2.1
 * Based on FRONTEND_TASKS_v2.1.md specification
 * 
 * Manages Tutor↔Student relations with proper state separation,
 * error handling, and optimistic UI updates
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '@/utils/apiClient'
import type {
  Relation,
  RelationsResponse,
  RequestTutorPayload,
  RequestTutorResponse,
  AcceptRequestPayload,
  AcceptRequestResponse
} from '@/types/relations'
import { LimitExceededError } from '@/utils/errors'
import { rethrowAsDomainError } from '@/utils/rethrowAsDomainError'
import { useLimitsStore } from './limitsStore'

export const useRelationsStore = defineStore('relations', () => {
  const relations = ref<Relation[]>([])
  
  // P0.2: Рознесені стани для різних дій
  const isFetchingRelations = ref(false)
  const isRequestingTutor = ref(false)
  const isAcceptingRequest = ref(false)
  
  const fetchError = ref<string | null>(null)
  // P1.2: Розділяю actionError для різних action
  const requestTutorError = ref<string | null>(null)
  const acceptRequestError = ref<string | null>(null)
  
  // P1.1: mergeRelations для optimistic UI - не рве локальний стан
  function mergeRelations(incoming: Relation[]) {
    const map = new Map(relations.value.map(r => [r.id, r]))
    for (const r of incoming) map.set(r.id, r)
    relations.value = Array.from(map.values())
  }
  
  async function fetchRelations() {
    isFetchingRelations.value = true
    fetchError.value = null
    
    try {
      const response = await apiClient.get<RelationsResponse>('/v1/users/me/relations/')
      mergeRelations(response.relations)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      fetchError.value = errorMessage
    } finally {
      isFetchingRelations.value = false
    }
  }
  
  // P0 1.4: upsertRelation для idempotency - замість push
  function upsertRelation(rel: Relation) {
    const i = relations.value.findIndex(r => r.id === rel.id)
    if (i === -1) relations.value.push(rel)
    else relations.value[i] = rel
  }
  
  async function requestTutor(tutorId: string, message?: string) {
    isRequestingTutor.value = true
    requestTutorError.value = null
    
    try {
      const response = await apiClient.post<RequestTutorResponse>(
        '/v1/users/relations/request-tutor/',
        { tutor_id: tutorId, message } as RequestTutorPayload
      )
      
      upsertRelation(response.relation)
      
      // Оновити ліміти
      const limitsStore = useLimitsStore()
      await limitsStore.fetchLimits()
      
      return response.relation
    } catch (err) {
      // P0.1: Використовуємо rethrowAsDomainError замість ручного парсингу
      try {
        rethrowAsDomainError(err)
      } catch (domainErr) {
        if (domainErr instanceof LimitExceededError) {
          const { limit_type, used, max, reset_at } = domainErr.meta
          requestTutorError.value = `Limit exceeded: ${used}/${max}. Resets at ${new Date(reset_at).toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' })}`
        } else {
          const errorMessage = domainErr instanceof Error ? domainErr.message : 'Unknown error'
          requestTutorError.value = errorMessage
        }
        throw domainErr
      }
    } finally {
      isRequestingTutor.value = false
    }
  }
  
  async function acceptRequest(relationId: string) {
    isAcceptingRequest.value = true
    acceptRequestError.value = null
    
    try {
      const response = await apiClient.post<AcceptRequestResponse>(
        '/v1/users/relations/accept-request/',
        { relation_id: relationId } as AcceptRequestPayload
      )
      
      upsertRelation(response.relation)
      
      // Оновити ліміти
      const limitsStore = useLimitsStore()
      await limitsStore.fetchLimits()
      
      return response.relation
    } catch (err) {
      // P0.1: Використовуємо rethrowAsDomainError замість ручного парсингу
      try {
        rethrowAsDomainError(err)
      } catch (domainErr) {
        if (domainErr instanceof LimitExceededError) {
          const { limit_type, used, max, reset_at } = domainErr.meta
          acceptRequestError.value = `Limit exceeded: ${used}/${max}. Resets at ${new Date(reset_at).toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' })}`
        } else {
          const errorMessage = domainErr instanceof Error ? domainErr.message : 'Unknown error'
          acceptRequestError.value = errorMessage
        }
        throw domainErr
      }
    } finally {
      isAcceptingRequest.value = false
    }
  }
  
  const activeTutors = computed(() => 
    relations.value.filter(r => r.status === 'active')
  )
  
  const invitedRequests = computed(() =>
    relations.value.filter(r => r.status === 'invited')
  )
  
  return {
    relations,
    isFetchingRelations,
    isRequestingTutor,
    isAcceptingRequest,
    fetchError,
    requestTutorError,
    acceptRequestError,
    fetchRelations,
    requestTutor,
    acceptRequest,
    upsertRelation,
    activeTutors,
    invitedRequests
  }
})
