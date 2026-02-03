/**
 * Inquiries Store v0.69
 * Based on FRONTEND_IMPLEMENTATION_PLAN_v069.md
 * 
 * Управління inquiry (встановлення контакту між tutor і student)
 * 
 * Принципи v0.69:
 * - Single Source of Truth: refetch після мутацій
 * - Idempotency: clientRequestId для всіх write операцій
 * - State-driven UI: FE не вгадує логіку
 * - Всі domain errors через rethrowAsDomainError
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  InquiryDTO,
  InquiryFilters,
  InquiryStatus,
  AcceptInquiryResponse,
  RejectInquiryResponse,
  RejectInquiryPayload
} from '@/types/inquiries'
import {
  createInquiry as apiCreateInquiry,
  fetchInquiries as apiFetchInquiries,
  cancelInquiry as apiCancelInquiry,
  acceptInquiry as apiAcceptInquiry,
  rejectInquiry as apiRejectInquiry
} from '@/api/inquiries'
import { rethrowAsDomainError } from '@/utils/rethrowAsDomainError'

export const useInquiriesStore = defineStore('inquiries', () => {
  // State v0.69
  const items = ref<InquiryDTO[]>([])
  const statusFilter = ref<InquiryStatus | null>(null)
  const pendingRequestIds = ref<Set<string>>(new Set())
  
  // Loading states
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  
  /**
   * Створити inquiry v0.69
   * 
   * @param tutorId - ID тьютора
   * @param message - повідомлення від студента
   * @returns створений inquiry
   */
  async function createInquiry(tutorId: string, message: string): Promise<InquiryDTO> {
    const clientRequestId = generateRequestId()
    
    if (pendingRequestIds.value.has(clientRequestId)) {
      throw new Error('Duplicate request')
    }
    
    isLoading.value = true
    error.value = null
    pendingRequestIds.value.add(clientRequestId)
    
    try {
      const inquiry = await apiCreateInquiry({ tutorId, message, clientRequestId })
      
      // Refetch після створення
      await refetch()
      
      return inquiry
    } catch (err) {
      rethrowAsDomainError(err)
      throw err
    } finally {
      isLoading.value = false
      pendingRequestIds.value.delete(clientRequestId)
    }
  }
  
  /**
   * Завантажити inquiries з фільтрами v0.69
   * 
   * @param filters - role, status, page
   * @returns список inquiries
   */
  async function fetchInquiries(filters: InquiryFilters = {}): Promise<InquiryDTO[]> {
    isLoading.value = true
    error.value = null
    
    try {
      const inquiries = await apiFetchInquiries(filters)
      items.value = inquiries
      return inquiries
    } catch (err) {
      rethrowAsDomainError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Скасувати inquiry (student only) Phase 1 v0.86
   * 
   * @param inquiryId - ID inquiry
   * @returns response з inquiry
   */
  async function cancelInquiry(inquiryId: number): Promise<InquiryDTO> {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await apiCancelInquiry(inquiryId)
      
      // Refetch після cancel
      await refetch()
      
      return response.inquiry
    } catch (err) {
      rethrowAsDomainError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Прийняти inquiry (tutor only) Phase 1 v0.86
   * 
   * @param inquiryId - ID inquiry
   * @returns response з inquiry, contacts, relation, thread_id
   */
  async function acceptInquiry(inquiryId: number): Promise<AcceptInquiryResponse> {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await apiAcceptInquiry(inquiryId)
      
      // Refetch після accept + trigger relationsStore refetch
      await refetch()
      
      return response
    } catch (err) {
      rethrowAsDomainError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Відхилити inquiry (tutor only) Phase 1 v0.86
   * 
   * @param inquiryId - ID inquiry
   * @param payload - reason та optional comment
   * @returns response з inquiry
   */
  async function rejectInquiry(
    inquiryId: number,
    payload: RejectInquiryPayload
  ): Promise<RejectInquiryResponse> {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await apiRejectInquiry(inquiryId, payload)
      
      // Refetch після reject
      await refetch()
      
      return response
    } catch (err) {
      rethrowAsDomainError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Refetch inquiries (викликається після мутацій) v0.69
   */
  async function refetch(): Promise<void> {
    const filters: InquiryFilters = {}
    if (statusFilter.value) {
      filters.status = statusFilter.value
    }
    await fetchInquiries(filters)
  }
  
  /**
   * Генерувати clientRequestId для idempotency
   */
  function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  /**
   * Computed: student inquiries (Phase 2.2)
   */
  const studentItems = computed(() => {
    return items.value.filter(i => i.student)
  })
  
  /**
   * Computed: tutor inquiries (Phase 2.2)
   */
  const tutorItems = computed(() => {
    return items.value.filter(i => i.tutor)
  })
  
  /**
   * Computed: student open count (Phase 2.2)
   */
  const studentOpenCount = computed(() => {
    return items.value.filter(i => i.status === 'OPEN').length
  })
  
  /**
   * Computed: pending count для badge (OPEN inquiries) - backward compat
   */
  const pendingCount = computed(() => {
    return items.value.filter(i => i.status === 'OPEN').length
  })
  
  /**
   * Alias: requestContact → createInquiry (backward compatibility)
   */
  async function requestContact(relationId: string, message: string): Promise<InquiryDTO> {
    return createInquiry(relationId, message)
  }
  
  /**
   * Alias: declineInquiry → rejectInquiry (backward compatibility)
   */
  async function declineInquiry(inquiryId: number, payload: RejectInquiryPayload): Promise<RejectInquiryResponse> {
    return rejectInquiry(inquiryId, payload)
  }
  
  return {
    // State
    items,
    statusFilter,
    pendingRequestIds,
    isLoading,
    error,
    
    // Computed
    studentItems,
    tutorItems,
    studentOpenCount,
    pendingCount,
    
    // Actions
    createInquiry,
    fetchInquiries,
    cancelInquiry,
    acceptInquiry,
    rejectInquiry,
    refetch,
    
    // Aliases (backward compatibility)
    requestContact,
    declineInquiry
  }
})
