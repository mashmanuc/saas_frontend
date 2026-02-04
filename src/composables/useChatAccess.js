import { computed } from 'vue'
import { useContactAccessStore } from '@/stores/contactAccessStore'

/**
 * Composable для перевірки доступу до чату
 * Використовує ContactAccess domain для визначення чи може тьютор спілкуватися зі студентом
 * 
 * @param {number} studentId - ID студента
 * @returns {Object} - { canAccessChat, chatAccessDeniedReason }
 */
export function useChatAccess(studentId) {
  const contactAccessStore = useContactAccessStore()

  const canAccessChat = computed(() => {
    // ❌ НЕПРАВИЛЬНО: перевіряти relation.status
    // ✅ ПРАВИЛЬНО: перевіряти ContactAccess.access_level
    return contactAccessStore.canAccessChat(studentId)
  })

  const chatAccessDeniedReason = computed(() => {
    if (!contactAccessStore.hasContactAccess(studentId)) {
      return 'Для доступу до чату потрібно відкрити контакти студента'
    }

    const accessLevel = contactAccessStore.getAccessLevel(studentId)
    if (accessLevel === 'CONTACTS_SHARED') {
      return 'Ваш рівень доступу дозволяє бачити контакти, але не чат. Оновіть пакет.'
    }

    return null
  })

  return {
    canAccessChat,
    chatAccessDeniedReason,
  }
}
