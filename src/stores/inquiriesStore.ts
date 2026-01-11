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
import type { InquiryDTO, InquiryFilters, InquiryStatus } from '@/types/inquiries'
import {
  createInquiry as apiCreateInquiry,
  fetchInquiries as apiFetchInquiries,
  cancelInquiry as apiCancelInquiry,
  acceptInquiry as apiAcceptInquiry,
  declineInquiry as apiDeclineInquiry
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
   * Скасувати inquiry v0.69 (student only)
   * 
   * @param inquiryId - ID inquiry
   * @returns оновлений inquiry
   */
  async function cancelInquiry(inquiryId: string): Promise<InquiryDTO> {
    const clientRequestId = generateRequestId()
    isLoading.value = true
    error.value = null
    
    try {
      const inquiry = await apiCancelInquiry(inquiryId, { clientRequestId })
      
      // Refetch після cancel
      await refetch()
      
      return inquiry
    } catch (err) {
      rethrowAsDomainError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Прийняти inquiry v0.69 (tutor only)
   * 
   * @param inquiryId - ID inquiry
   * @returns оновлений inquiry
   */
  async function acceptInquiry(inquiryId: string): Promise<InquiryDTO> {
    const clientRequestId = generateRequestId()
    isLoading.value = true
    error.value = null
    
    try {
      const inquiry = await apiAcceptInquiry(inquiryId, { clientRequestId })
      
      // Refetch після accept + trigger relationsStore refetch
      await refetch()
      
      return inquiry
    } catch (err) {
      rethrowAsDomainError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Відхилити inquiry v0.69 (tutor only)
   * 
   * @param inquiryId - ID inquiry
   * @returns оновлений inquiry
   */
  async function declineInquiry(inquiryId: string): Promise<InquiryDTO> {
    const clientRequestId = generateRequestId()
    isLoading.value = true
    error.value = null
    
    try {
      const inquiry = await apiDeclineInquiry(inquiryId, { clientRequestId })
      
      // Refetch після decline
      await refetch()
      
      return inquiry
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
   * Computed: pending count для badge (sent inquiries)
   */
  const pendingCount = computed(() => {
    return items.value.filter(i => i.status === 'sent').length
  })
  
  return {
    // State
    items,
    statusFilter,
    pendingRequestIds,
    isLoading,
    error,
    
    // Computed
    pendingCount,
    
    // Actions
    createInquiry,
    fetchInquiries,
    cancelInquiry,
    acceptInquiry,
    declineInquiry,
    refetch
  }
})
