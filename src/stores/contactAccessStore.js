import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import contactsApi from '@/api/contacts'
import { notifySuccess, notifyError, notifyInfo } from '@/utils/notify'

export const useContactAccessStore = defineStore('contactAccess', () => {
  // State
  const contactsCache = ref(new Map()) // studentId -> {contacts, access_level, unlocked_at}
  const loading = ref(false)

  // Getters
  const hasContactAccess = computed(() => (studentId) => {
    return contactsCache.value.has(studentId)
  })

  const getStudentContacts = computed(() => (studentId) => {
    return contactsCache.value.get(studentId)?.contacts || null
  })

  const getAccessLevel = computed(() => (studentId) => {
    return contactsCache.value.get(studentId)?.access_level || 'NONE'
  })

  const canAccessChat = computed(() => (studentId) => {
    const level = getAccessLevel.value(studentId)
    return level === 'CHAT_ENABLED' || level === 'FULL_ACCESS'
  })

  const canOpenChat = computed(() => (studentId) => {
    // Простіша перевірка: чи є ContactAccess взагалі
    // Chat domain сам вирішує, що робити з цим доступом
    return contactsCache.value.has(studentId)
  })

  // Actions
  async function unlockContacts({ inquiryId, studentId }) {
    if (!inquiryId) {
      throw new Error('inquiryId is required for unlockContacts')
    }
    if (!studentId) {
      throw new Error('studentId is required for unlockContacts cache update')
    }

    console.log('[ContactAccessStore] Unlocking contacts:', { inquiryId, studentId })
    loading.value = true
    try {
      // Production: force_unlock НЕ використовується (тільки для staff через admin panel)
      const response = await contactsApi.unlockContacts(inquiryId, false)
      console.log('[ContactAccessStore] Unlock response:', response)
      
      const contactsPayload = response?.contacts || {}
      const accessLevel = response?.access_level || 'CONTACTS_SHARED'

      console.log('[ContactAccessStore] Caching contacts:', { studentId, contactsPayload, accessLevel })
      contactsCache.value.set(studentId, {
        contacts: contactsPayload,
        access_level: accessLevel,
        unlocked_at: new Date().toISOString(),
      })

      if (response?.was_already_unlocked) {
        notifyInfo?.('Контакти вже були відкриті') ?? notifySuccess('Контакти вже відкриті')
        // v0.88: НЕ викликати refetch якщо контакти вже були відкриті - уникаємо infinite loop
      } else {
        notifySuccess('Контакти успішно відкрито')
        
        // v0.87.0: КРИТИЧНО - refetch relations після unlock для синхронізації UI
        // v0.88: Тільки якщо це НОВИЙ unlock, не was_already_unlocked
        try {
          const { useRelationsStore } = await import('./relationsStore')
          const relationsStore = useRelationsStore()
          await relationsStore.fetchTutorRelations()
        } catch (refetchError) {
          console.warn('[ContactAccessStore] Failed to refetch relations:', refetchError)
        }
      }

      return response
    } catch (error) {
      console.error('[ContactAccessStore] Unlock error:', error)
      console.error('[ContactAccessStore] Error response:', error?.response)
      console.error('[ContactAccessStore] Error data:', error?.response?.data)
      notifyError(
        error?.response?.data?.detail || error?.response?.data?.message || 'Помилка при відкритті контактів'
      )
      throw error
    } finally {
      loading.value = false
    }
  }

  async function revokeContacts(studentId, reason = '') {
    loading.value = true
    try {
      await contactsApi.revokeContacts(studentId, reason)

      // Видаляємо з кешу
      contactsCache.value.delete(studentId)

      notifySuccess('Доступ до контактів відкликано')
    } catch (error) {
      notifyError(
        error?.response?.data?.detail || 'Помилка при відкликанні доступу'
      )
      throw error
    } finally {
      loading.value = false
    }
  }

  async function fetchContacts(studentId) {
    loading.value = true
    try {
      const response = await contactsApi.getContacts(studentId)

      contactsCache.value.set(studentId, {
        contacts: response.contacts,
        access_level: 'CONTACTS_SHARED', // Якщо API повернув контакти, значить є доступ
        unlocked_at: new Date().toISOString(),
      })

      return response.contacts
    } catch (error) {
      // 403 = немає доступу
      if (error?.response?.status === 403) {
        contactsCache.value.delete(studentId)
      }
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * Phase 1 v0.87: Fetch contact access by relation ID
   * Використовується після accept для отримання контактів студента
   */
  async function fetchContactAccessByRelation(relationId) {
    loading.value = true
    try {
      const response = await contactsApi.getContactsByRelation(relationId)
      
      console.log('[ContactAccessStore] Fetched contacts by relation:', response)
      
      const studentId = response.student_id
      contactsCache.value.set(studentId, {
        contacts: response.contacts,
        access_level: response.can_open_chat ? 'CHAT_ENABLED' : 'CONTACTS_SHARED',
        unlocked_at: response.unlocked_at,
        relation_id: response.relation_id,
      })

      return response
    } catch (error) {
      console.error('[ContactAccessStore] Failed to fetch contacts by relation:', error)
      if (error?.response?.status === 403 || error?.response?.status === 404) {
        // Контакти не розблоковані або relation не знайдено
        console.warn('[ContactAccessStore] Contacts not unlocked or relation not found')
      }
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * Phase 1 v0.87: Check contact access (lightweight)
   * Використовується для guards перед відкриттям чату
   */
  async function checkContactAccessAPI(studentId) {
    try {
      const response = await contactsApi.checkContactAccess(studentId)
      
      if (response.has_access) {
        // Оновлюємо кеш з мінімальною інформацією
        contactsCache.value.set(studentId, {
          contacts: null, // Контакти не завантажені, тільки перевірка доступу
          access_level: 'CHAT_ENABLED',
          unlocked_at: response.unlocked_at,
          relation_id: response.relation_id,
        })
      } else {
        // Видаляємо з кешу якщо немає доступу
        contactsCache.value.delete(studentId)
      }

      return response.has_access
    } catch (error) {
      console.error('[ContactAccessStore] Failed to check contact access:', error)
      return false
    }
  }

  function clearCache() {
    contactsCache.value.clear()
  }

  function $reset() {
    contactsCache.value = new Map()
    loading.value = false
  }

  return {
    // State
    loading,
    contactsCache,

    // Getters
    hasContactAccess,
    getStudentContacts,
    getAccessLevel,
    canAccessChat,
    canOpenChat,

    // Actions
    unlockContacts,
    revokeContacts,
    fetchContacts,
    fetchContactAccessByRelation, // Phase 1 v0.87
    checkContactAccessAPI, // Phase 1 v0.87
    clearCache,
    $reset,
  }
})
