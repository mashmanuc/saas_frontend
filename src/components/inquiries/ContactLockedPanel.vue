<template>
  <div class="contact-locked-panel" data-testid="contact-locked-panel">
    <div class="locked-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    </div>

    <h3 class="locked-title">{{ $t('contact.locked.title') }}</h3>

    <p class="locked-reason" data-testid="locked-reason-text">
      {{ reasonText }}
    </p>

    <div class="locked-actions">
      <!-- inquiry_required: Show "Request contact" button -->
      <Button
        v-if="lockedReason === 'inquiry_required'"
        variant="primary"
        @click="handleRequestContact"
        data-testid="request-contact-button"
      >
        {{ $t('contact.locked.actions.requestContact') }}
      </Button>

      <!-- inquiry_pending: Show waiting text -->
      <p
        v-else-if="lockedReason === 'inquiry_pending'"
        class="waiting-text"
        data-testid="waiting-text"
      >
        {{ $t('contact.locked.actions.waiting') }}
      </p>

      <!-- no_active_lesson: Show "Book lesson" button -->
      <Button
        v-else-if="lockedReason === 'no_active_lesson'"
        variant="primary"
        @click="handleBookLesson"
        data-testid="book-lesson-button"
      >
        {{ $t('contact.locked.actions.bookLesson') }}
      </Button>

      <!-- subscription_required: Show "Upgrade" button (placeholder) -->
      <Button
        v-else-if="lockedReason === 'subscription_required'"
        variant="primary"
        @click="handleUpgrade"
        data-testid="upgrade-button"
      >
        {{ $t('contact.locked.actions.upgrade') }}
      </Button>

      <!-- inquiry_rejected: Show text -->
      <p
        v-else-if="lockedReason === 'inquiry_rejected'"
        class="locked-reason"
        data-testid="inquiry-rejected-text"
      >
        {{ $t('contact.locked.reasons.inquiry_rejected') }}
      </p>

      <!-- inquiry_expired: Show text -->
      <p
        v-else-if="lockedReason === 'inquiry_expired'"
        class="locked-reason"
        data-testid="inquiry-expired-text"
      >
        {{ $t('contact.locked.reasons.inquiry_expired') }}
      </p>

      <!-- forbidden: Show text -->
      <p
        v-else-if="lockedReason === 'forbidden'"
        class="locked-reason"
        data-testid="forbidden-text"
      >
        {{ $t('contact.locked.reasons.forbidden') }}
      </p>

      <!-- user_blocked: Show text -->
      <p
        v-else-if="lockedReason === 'user_blocked'"
        class="locked-reason"
        data-testid="user-blocked-text"
      >
        {{ $t('contact.locked.reasons.user_blocked') }}
      </p>

      <!-- blocked_by_user: Show text -->
      <p
        v-else-if="lockedReason === 'blocked_by_user'"
        class="locked-reason"
        data-testid="blocked-by-user-text"
      >
        {{ $t('contact.locked.reasons.blocked_by_user') }}
      </p>

      <!-- user_banned: Show text -->
      <p
        v-else-if="lockedReason === 'user_banned'"
        class="locked-reason"
        data-testid="user-banned-text"
      >
        {{ $t('contact.locked.reasons.user_banned') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { ContactLockedReason } from '@/types/inquiries'
import Button from '@/ui/Button.vue'

interface Props {
  lockedReason: ContactLockedReason
}

interface Emits {
  (e: 'requestContact'): void
  (e: 'bookLesson'): void
  (e: 'upgrade'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const router = useRouter()

/**
 * Отримати текст причини блокування з i18n
 */
const reasonText = computed(() => {
  if (!props.lockedReason) {
    return ''
  }
  
  const key = `contact.locked.reasons.${props.lockedReason}`
  return t(key)
})

function handleRequestContact() {
  emit('requestContact')
}

function handleBookLesson() {
  emit('bookLesson')
}

function handleUpgrade() {
  // Navigate to billing page for upgrade
  router.push('/billing')
  emit('upgrade')
}
</script>

<style scoped>
.contact-locked-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  text-align: center;
}

.locked-icon {
  color: #9ca3af;
  margin-bottom: 1rem;
}

.locked-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.75rem 0;
}

.locked-reason {
  font-size: 1rem;
  color: #6b7280;
  margin: 0 0 1.5rem 0;
  max-width: 400px;
}

.locked-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  max-width: 300px;
}

.waiting-text {
  font-size: 0.875rem;
  color: #6b7280;
  font-style: italic;
  margin: 0;
}
</style>
