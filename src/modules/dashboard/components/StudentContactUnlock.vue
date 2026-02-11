<template>
  <div class="student-contact-unlock">
    <!-- v0.87.0: ІНВАРІАНТ - якщо relation.status === 'active', контакти ЗАВЖДИ видимі -->
    
    <!-- Якщо relation НЕ ACTIVE - показуємо кнопку unlock -->
    <div v-if="relation.status !== 'active'" class="unlock-prompt">
      <p class="unlock-message">
        {{ $t('contacts.unlockPrompt') }}
      </p>
      <button
        class="btn btn-primary"
        :disabled="loading"
        @click="handleUnlock"
      >
        <span v-if="!loading">{{ $t('contacts.unlockButton') }}</span>
        <span v-else>{{ $t('common.loading') }}</span>
      </button>
    </div>

    <!-- Якщо relation ACTIVE - ЗАВЖДИ показуємо контакти -->
    <div v-if="relation.status === 'active'" class="contacts-display">
      <h4>{{ $t('contacts.studentContacts') }}</h4>
      
      <!-- Завантаження -->
      <div v-if="loading" class="loading-state">
        {{ $t('common.loading') }}...
      </div>
      
      <!-- Контакти завантажені -->
      <div v-else-if="studentContacts">
        <div class="contact-item" v-if="studentContacts.phone">
          <span class="contact-icon">📱</span>
          <span class="contact-value">{{ studentContacts.phone }}</span>
        </div>
        <div class="contact-item" v-if="studentContacts.telegram">
          <span class="contact-icon">💬</span>
          <span class="contact-value">@{{ studentContacts.telegram }}</span>
        </div>
        <div class="contact-item" v-if="studentContacts.email">
          <span class="contact-icon">📧</span>
          <span class="contact-value">{{ studentContacts.email }}</span>
        </div>
        
        <!-- Якщо жодного контакту немає -->
        <div v-if="!studentContacts.phone && !studentContacts.telegram && !studentContacts.email" class="no-contacts">
          {{ $t('contacts.noContactsAvailable') }}
        </div>
      </div>
      
      <!-- Контакти ще не завантажені - показуємо стан завантаження, НЕ кнопку (SSOT: ACTIVE = контакти завжди доступні) -->
      <div v-if="relation.status === 'active' && !studentContacts && !loading" class="loading-state">
        {{ $t('common.loading') }}...
      </div>

      <!-- Кнопка revoke (опціонально) -->
      <button
        v-if="showRevokeButton && studentContacts"
        class="btn btn-danger btn-sm"
        @click="handleRevoke"
      >
        {{ $t('contacts.revokeButton') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useContactAccessStore } from '@/stores/contactAccessStore'

const props = defineProps({
  relation: {
    type: Object,
    required: true,
  },
  showRevokeButton: {
    type: Boolean,
    default: false,
  },
})

const contactAccessStore = useContactAccessStore()

const studentId = computed(() => props.relation.student?.id || props.relation.student_id)

// v0.89.1: SSOT - спочатку перевіряємо контакти в relation (Dashboard API), потім в store
const studentContacts = computed(() => {
  // Пріоритет 1: контакти вже є в relation з Dashboard API
  if (props.relation.contacts && (props.relation.contacts.phone || props.relation.contacts.email || props.relation.contacts.telegram)) {
    return props.relation.contacts
  }
  // Пріоритет 2: контакти з store (якщо були завантажені раніше)
  return contactAccessStore.getStudentContacts(studentId.value)
})

const loading = computed(() => contactAccessStore.loading)
const hasAccess = computed(() => 
  contactAccessStore.hasAccess(studentId.value)
)

// v0.89.1: SSOT - ACTIVE relation = контакти завжди доступні
// Якщо контакти вже є в relation - не потрібно додатково завантажувати
onMounted(() => {
  const hasContactsInRelation = props.relation.contacts && (props.relation.contacts.phone || props.relation.contacts.email)
  const hasContactsInStore = !!contactAccessStore.getStudentContacts(studentId.value)
  
  if (props.relation.status === 'active' && !hasContactsInRelation && !hasContactsInStore) {
    const relationId = props.relation.id || props.relation.relation_id
    if (relationId) {
      contactAccessStore.fetchContactAccessByRelation(relationId)
    }
  }
})

async function handleUnlock() {
  try {
    // Тільки для не-ACTIVE статусів - використовуємо inquiry_id
    const inquiryId = props.relation.contact_unlock_inquiry_id
    
    if (!inquiryId) {
      console.error('No inquiry_id available for unlock')
      return
    }
    
    await contactAccessStore.unlockContacts({
      inquiryId,
      studentId: studentId.value
    })
  } catch (error) {
    console.error('Unlock failed:', error)
  }
}

async function loadContacts() {
  // v0.89: DEPRECATED - не використовується для ACTIVE студентів
  // Для ACTIVE використовується fetchContactAccessByRelation напряму
  console.warn('[StudentContactUnlock] loadContacts is deprecated for active relations')
}

async function handleRevoke() {
  if (!confirm('Ви впевнені, що хочете відкликати доступ до контактів?')) {
    return
  }

  try {
    await contactAccessStore.revokeContacts(studentId.value)
  } catch (error) {
    console.error('Revoke failed:', error)
  }
}
</script>

<style scoped>
.unlock-prompt {
  padding: 1rem;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.unlock-message {
  margin-bottom: 0.75rem;
  color: #0c4a6e;
}

.contacts-display {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.contact-icon {
  font-size: 1.25rem;
}

.contact-value {
  font-family: monospace;
  color: #374151;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  background: #ef4444;
  color: white;
  margin-top: 0.5rem;
}

.btn-danger:hover {
  background: #dc2626;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background: #4b5563;
}

.loading-state {
  color: #6b7280;
  font-style: italic;
  padding: 0.5rem 0;
}

.no-contacts {
  color: #9ca3af;
  font-style: italic;
  padding: 0.5rem 0;
}

.load-contacts {
  padding: 0.5rem 0;
}
</style>
