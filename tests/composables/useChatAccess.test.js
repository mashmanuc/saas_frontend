import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatAccess } from '@/composables/useChatAccess'
import { useContactAccessStore } from '@/stores/contactAccessStore'

describe('useChatAccess', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should return false when no contact access', () => {
    const { canAccessChat, chatAccessDeniedReason } = useChatAccess(123)

    expect(canAccessChat.value).toBe(false)
    expect(chatAccessDeniedReason.value).toBe('Для доступу до чату потрібно відкрити контакти студента')
  })

  it('should return false for CONTACTS_SHARED level', () => {
    const store = useContactAccessStore()
    store.contactsCache.set(123, {
      contacts: { phone: '+380501234567' },
      access_level: 'CONTACTS_SHARED',
    })

    const { canAccessChat, chatAccessDeniedReason } = useChatAccess(123)

    expect(canAccessChat.value).toBe(false)
    expect(chatAccessDeniedReason.value).toBe('Ваш рівень доступу дозволяє бачити контакти, але не чат. Оновіть пакет.')
  })

  it('should return true for CHAT_ENABLED level', () => {
    const store = useContactAccessStore()
    store.contactsCache.set(123, {
      contacts: { phone: '+380501234567' },
      access_level: 'CHAT_ENABLED',
    })

    const { canAccessChat, chatAccessDeniedReason } = useChatAccess(123)

    expect(canAccessChat.value).toBe(true)
    expect(chatAccessDeniedReason.value).toBeNull()
  })

  it('should return true for FULL_ACCESS level', () => {
    const store = useContactAccessStore()
    store.contactsCache.set(123, {
      contacts: { phone: '+380501234567' },
      access_level: 'FULL_ACCESS',
    })

    const { canAccessChat, chatAccessDeniedReason } = useChatAccess(123)

    expect(canAccessChat.value).toBe(true)
    expect(chatAccessDeniedReason.value).toBeNull()
  })

  it('should be reactive to store changes', () => {
    const store = useContactAccessStore()
    const { canAccessChat } = useChatAccess(123)

    expect(canAccessChat.value).toBe(false)

    // Add access
    store.contactsCache.set(123, {
      contacts: { phone: '+380501234567' },
      access_level: 'CHAT_ENABLED',
    })

    expect(canAccessChat.value).toBe(true)

    // Remove access
    store.contactsCache.delete(123)

    expect(canAccessChat.value).toBe(false)
  })
})
