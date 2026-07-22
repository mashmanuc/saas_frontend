<template>
  <div class="student-contact-unlock">
    <!-- v0.87.0: ІНВАРІАНТ - якщо relation.status === 'active', контакти ЗАВЖДИ видимі -->
    
    <!-- Якщо relation НЕ ACTIVE - показуємо кнопку unlock -->
    <div v-if="relation.status !== 'active'" class="unlock-prompt">
      <p class="unlock-message">
        {{ $t('contacts.unlockPrompt') }}
      </p>
      <Button
        variant="primary"
        :disabled="loading"
        :loading="loading"
        @click="handleUnlock"
      >
        {{ $t('contacts.unlockButton') }}
      </Button>
    </div>

    <!-- Якщо relation ACTIVE - ЗАВЖДИ показуємо контакти -->
    <div v-if="relation.status === 'active'" class="contacts-display">
      <p class="contacts-label">{{ $t('contacts.studentContacts') }}</p>

      <!-- Завантаження -->
      <div v-if="loading" class="loading-state">
        {{ $t('common.loading') }}...
      </div>

      <!-- Контакти завантажені -->
      <div v-else-if="studentContacts" class="contacts-rows">
        <a class="contact-item" v-if="studentContacts.phone" :href="`tel:${studentContacts.phone}`">
          <svg class="contact-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <span class="contact-value">{{ studentContacts.phone }}</span>
        </a>
        <a class="contact-item" v-if="studentContacts.telegram" :href="`https://t.me/${studentContacts.telegram}`" target="_blank" rel="noopener">
          <svg class="contact-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.5 4.5 2.5 12l6 2m13-9.5-4 15-5-5.5m9-9.5-11 9.5m0 0V21l3-3"/></svg>
          <span class="contact-value">@{{ studentContacts.telegram }}</span>
        </a>
        <a class="contact-item" v-if="studentContacts.email" :href="`mailto:${studentContacts.email}`">
          <svg class="contact-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
          <span class="contact-value">{{ studentContacts.email }}</span>
        </a>

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
        type="button"
        class="revoke-link"
        @click="handleRevoke"
      >
        {{ $t('contacts.revokeButton') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContactAccessStore } from '@/stores/contactAccessStore'
import Button from '@/ui/Button.vue'

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

const { t } = useI18n()
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
  if (!confirm(t('contacts.revokeConfirm'))) {
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
  padding: var(--space-md);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
}

.unlock-message {
  margin-bottom: var(--space-sm);
  color: var(--text-primary);
}

.contacts-display {
  padding: 0;
  background: transparent;
}

.contacts-label {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin: 0 0 0.5rem;
}

.contacts-rows {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.contact-item {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  width: fit-content;
  color: var(--text-primary);
  text-decoration: none;
  font-size: 0.875rem;
  border-radius: var(--radius-md, 8px);
  transition: color 0.15s ease;
}

.contact-item:hover {
  color: var(--accent);
}

.contact-ic {
  width: 1.05rem;
  height: 1.05rem;
  color: var(--text-secondary);
  flex: 0 0 auto;
}

.contact-item:hover .contact-ic {
  color: var(--accent);
}

.contact-value {
  color: inherit;
}

.revoke-link {
  margin-top: 0.6rem;
  padding: 0;
  background: none;
  border: none;
  color: var(--danger, #dc2626);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  opacity: 0.85;
  transition: opacity 0.15s ease;
}

.revoke-link:hover {
  opacity: 1;
  text-decoration: underline;
}

.loading-state {
  color: var(--text-secondary);
  font-style: italic;
  padding: var(--space-xs) 0;
}

.no-contacts {
  color: var(--text-secondary);
  font-style: italic;
  padding: var(--space-xs) 0;
}
</style>
