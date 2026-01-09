/**
 * Inquiries Store v0.62
 * Based on FRONTEND — Технічне завдання v0.62.0.md
 * 
 * Управління inquiry (переговори між tutor і student) та контактами
 * 
 * Інваріанти:
 * - Всі domain errors через rethrowAsDomainError
 * - Ніякого inline parsing err.response.data
 * - State-driven UI: FE не вгадує логіку
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { InquiryDTO, ContactPayload } from '@/types/inquiries'
import { createInquiry, listInquiries, acceptInquiry, rejectInquiry } from '@/api/inquiries'
import { getContact } from '@/api/users'
import { rethrowAsDomainError } from '@/utils/rethrowAsDomainError'

export const useInquiriesStore = defineStore('inquiries', () => {
  // State: inquiries по relation_id
  const inquiriesByRelationId = ref<Record<string, InquiryDTO[]>>({})
  
  // State: contacts по user_id
  const contactByUserId = ref<Record<string, ContactPayload>>({})
  
  // Loading states
  const isCreatingInquiry = ref(false)
  const isLoadingInquiries = ref(false)
  const isAcceptingInquiry = ref(false)
  const isRejectingInquiry = ref(false)
  const isLoadingContact = ref(false)
  
  // Error states
  const createInquiryError = ref<string | null>(null)
  const loadInquiriesError = ref<string | null>(null)
  const acceptInquiryError = ref<string | null>(null)
  const rejectInquiryError = ref<string | null>(null)
  const loadContactError = ref<string | null>(null)
  
  /**
   * Створити inquiry (запит на доступ до контактів)
   * 
   * @param relationId - ID relation
   * @param message - повідомлення від ініціатора
   * @returns створений inquiry
   */
  async function requestContact(relationId: string, message: string): Promise<InquiryDTO> {
    isCreatingInquiry.value = true
    createInquiryError.value = null
    
    try {
      const inquiry = await createInquiry({ relation_id: relationId, message })
      
      // Оновити локальний стан
      if (!inquiriesByRelationId.value[relationId]) {
        inquiriesByRelationId.value[relationId] = []
      }
      inquiriesByRelationId.value[relationId].push(inquiry)
      
      return inquiry
    } catch (err) {
      // Інваріант: всі domain errors через helper
      try {
        rethrowAsDomainError(err)
      } catch (domainErr) {
        const errorMessage = domainErr instanceof Error ? domainErr.message : 'Unknown error'
        createInquiryError.value = errorMessage
        throw domainErr
      }
    } finally {
      isCreatingInquiry.value = false
    }
  }
  
  /**
   * Завантажити список inquiries для relation
   * 
   * @param relationId - ID relation
   * @returns список inquiries
   */
  async function loadInquiries(relationId: string): Promise<InquiryDTO[]> {
    isLoadingInquiries.value = true
    loadInquiriesError.value = null
    
    try {
      const inquiries = await listInquiries(relationId)
      inquiriesByRelationId.value[relationId] = inquiries
      return inquiries
    } catch (err) {
      try {
        rethrowAsDomainError(err)
      } catch (domainErr) {
        const errorMessage = domainErr instanceof Error ? domainErr.message : 'Unknown error'
        loadInquiriesError.value = errorMessage
        throw domainErr
      }
    } finally {
      isLoadingInquiries.value = false
    }
  }
  
  /**
   * Прийняти inquiry
   * 
   * @param inquiryId - ID inquiry
   * @returns оновлений inquiry
   */
  async function acceptInquiryAction(inquiryId: string): Promise<InquiryDTO> {
    isAcceptingInquiry.value = true
    acceptInquiryError.value = null
    
    try {
      const inquiry = await acceptInquiry(inquiryId)
      
      // Оновити локальний стан
      const relationId = inquiry.relation_id
      if (inquiriesByRelationId.value[relationId]) {
        const index = inquiriesByRelationId.value[relationId].findIndex(i => i.id === inquiryId)
        if (index !== -1) {
          inquiriesByRelationId.value[relationId][index] = inquiry
        }
      }
      
      return inquiry
    } catch (err) {
      try {
        rethrowAsDomainError(err)
      } catch (domainErr) {
        const errorMessage = domainErr instanceof Error ? domainErr.message : 'Unknown error'
        acceptInquiryError.value = errorMessage
        throw domainErr
      }
    } finally {
      isAcceptingInquiry.value = false
    }
  }
  
  /**
   * Відхилити inquiry
   * 
   * @param inquiryId - ID inquiry
   * @returns оновлений inquiry
   */
  async function rejectInquiryAction(inquiryId: string): Promise<InquiryDTO> {
    isRejectingInquiry.value = true
    rejectInquiryError.value = null
    
    try {
      const inquiry = await rejectInquiry(inquiryId)
      
      // Оновити локальний стан
      const relationId = inquiry.relation_id
      if (inquiriesByRelationId.value[relationId]) {
        const index = inquiriesByRelationId.value[relationId].findIndex(i => i.id === inquiryId)
        if (index !== -1) {
          inquiriesByRelationId.value[relationId][index] = inquiry
        }
      }
      
      return inquiry
    } catch (err) {
      try {
        rethrowAsDomainError(err)
      } catch (domainErr) {
        const errorMessage = domainErr instanceof Error ? domainErr.message : 'Unknown error'
        rejectInquiryError.value = errorMessage
        throw domainErr
      }
    } finally {
      isRejectingInquiry.value = false
    }
  }
  
  /**
   * Завантажити контактні дані користувача
   * Завжди повертає структуру з null + locked_reason якщо доступ заборонено
   * 
   * @param userId - ID користувача
   * @returns контактні дані або locked payload
   */
  async function loadContact(userId: string): Promise<ContactPayload> {
    isLoadingContact.value = true
    loadContactError.value = null
    
    try {
      const contact = await getContact(userId)
      contactByUserId.value[userId] = contact
      return contact
    } catch (err) {
      try {
        rethrowAsDomainError(err)
      } catch (domainErr) {
        const errorMessage = domainErr instanceof Error ? domainErr.message : 'Unknown error'
        loadContactError.value = errorMessage
        throw domainErr
      }
    } finally {
      isLoadingContact.value = false
    }
  }
  
  /**
   * Отримати inquiries для конкретного relation (з кешу)
   */
  function getInquiriesForRelation(relationId: string): InquiryDTO[] {
    return inquiriesByRelationId.value[relationId] || []
  }
  
  /**
   * Отримати контакт для користувача (з кешу)
   */
  function getContactForUser(userId: string): ContactPayload | null {
    return contactByUserId.value[userId] || null
  }
  
  return {
    // State
    inquiriesByRelationId,
    contactByUserId,
    
    // Loading states
    isCreatingInquiry,
    isLoadingInquiries,
    isAcceptingInquiry,
    isRejectingInquiry,
    isLoadingContact,
    
    // Error states
    createInquiryError,
    loadInquiriesError,
    acceptInquiryError,
    rejectInquiryError,
    loadContactError,
    
    // Actions
    requestContact,
    loadInquiries,
    acceptInquiry: acceptInquiryAction,
    rejectInquiry: rejectInquiryAction,
    loadContact,
    
    // Getters
    getInquiriesForRelation,
    getContactForUser
  }
})
