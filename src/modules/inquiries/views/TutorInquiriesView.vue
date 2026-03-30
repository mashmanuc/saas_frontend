<template>
  <div class="tutor-inquiries-view">
    <div class="view-header">
      <h1>{{ $t('inquiries.tutor.title') }}</h1>
      <p class="view-description">{{ $t('inquiries.tutor.description') }}</p>
    </div>
    
    <!-- Phase 2.3: Decline Streak Warning -->
    <DeclineStreakWarning
      :decline-streak="declineStreak"
      :is-blocked="isBlocked"
    />
    
    <!-- Accept Limit Info Block (ЗАВЖДИ ВИДИМИЙ) -->
    <div class="accept-limit-info">
      <div v-if="acceptanceStore.remainingAccepts > 0" class="limit-text">
        Ваш ліміт прийомів: <strong>{{ acceptanceStore.remainingAccepts }} / 10</strong> доступно за останні 30 днів
      </div>
      <div v-else class="limit-text limit-exhausted">
        Ліміт прийомів вичерпано: <strong>0 / 10</strong>
        <span v-if="nextAvailableText"> — наступний слот: {{ nextAvailableText }}</span>
      </div>
    </div>
    
    <!-- Error State -->
    <ErrorState
      v-if="errorState && !items.length"
      :variant="errorState.variant"
      :title="errorState.title"
      :message="errorState.message"
      :retry-after="errorState.retryAfter"
      :show-retry="errorState.showRetry"
      @retry="handleRetry"
    />

    <!-- Skeleton loaders (перший завантаження без даних) -->
    <div v-else-if="isLoading && !items.length" class="inquiries-list">
      <InquiryCardSkeleton v-for="i in 3" :key="i" />
    </div>

    <!-- Empty State -->
    <div v-else-if="!isLoading && !items.length" class="empty-state">
      <p class="empty-title">Наразі у вас немає запитів від студентів.</p>
      <p class="empty-description">Коли з'являться — ви зможете прийняти їх одразу.</p>
    </div>

    <!-- Inquiries List (залишається видимим під час рефетчу) -->
    <div v-else class="inquiries-list">
      <InquiryCard
        v-for="inquiry in items"
        :key="inquiry.id"
        :inquiry="inquiry"
        current-user-role="tutor"
        :show-actions="true"
      >
        <template #actions>
          <!-- OPEN + relation не active: показуємо кнопки Прийняти/Відхилити -->
          <template v-if="inquiry.status === 'OPEN' && (inquiry as any).relation_status !== 'active'">
            <Button
              variant="primary"
              size="sm"
              :disabled="isLoading || isAccepting || !acceptanceStore.canAccept"
              @click="handleAccept(inquiry.id)"
            >
              {{ isAccepting ? $t('inquiries.tutor.accepting') : $t('inquiries.tutor.accept') }}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              :disabled="isLoading"
              @click="openRejectModal(inquiry.id)"
            >
              {{ $t('inquiries.tutor.reject') }}
            </Button>
          </template>

          <!-- ACCEPTED або relation вже active (прийнято через dashboard): підтвердження -->
          <div v-else-if="inquiry.status === 'ACCEPTED' || (inquiry as any).relation_status === 'active'" class="status-message status-accepted-msg">
            ✓ {{ $t('inquiries.tutor.acceptedMessage') }}
          </div>

          <!-- REJECTED -->
          <div v-else-if="inquiry.status === 'REJECTED'" class="status-message status-rejected-msg">
            {{ $t('inquiries.tutor.rejectedMessage') }}
          </div>

          <!-- EXPIRED -->
          <div v-else-if="inquiry.status === 'EXPIRED'" class="status-message status-expired-msg">
            {{ $t('inquiries.tutor.expiredMessage') }}
          </div>

          <!-- CANCELLED -->
          <div v-else-if="inquiry.status === 'CANCELLED'" class="status-message status-cancelled-msg">
            {{ $t('inquiries.tutor.cancelledMessage') }}
          </div>
        </template>
      </InquiryCard>
    </div>
    
    <!-- Reject Modal -->
    <RejectInquiryModal
      :show="showRejectModal"
      :inquiry-id="selectedInquiryId!"
      @close="closeRejectModal"
      @success="handleRejectSuccess"
    />
    
    <!-- Accept Success Modal (показує контакти) -->
    <Modal :open="showContactsModal" :title="$t('inquiries.tutor.contactsUnlocked')" size="sm" @close="closeContactsModal">
      <div v-if="unlockedContacts" class="contacts-display">
        <div class="contact-item">
          <span class="contact-label">Email:</span>
          <span class="contact-value">{{ unlockedContacts.email }}</span>
        </div>
        <div v-if="unlockedContacts.phone" class="contact-item">
          <span class="contact-label">Телефон:</span>
          <span class="contact-value">{{ unlockedContacts.phone }}</span>
        </div>
        <div v-if="unlockedContacts.telegram" class="contact-item">
          <span class="contact-label">Telegram:</span>
          <span class="contact-value">{{ unlockedContacts.telegram }}</span>
        </div>
      </div>
      <template #footer>
        <Button variant="primary" @click="closeContactsModal">
          {{ $t('common.close') }}
        </Button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
/**
 * TutorInquiriesView (Phase 1 v0.86)
 * 
 * Дашборд тьютора для перегляду та управління inquiries
 */

import { ref, computed, onMounted } from 'vue'
import { useInquiriesStore } from '@/stores/inquiriesStore'
import { useContactsStore } from '@/stores/contactsStore'
import { useAcceptanceStore } from '@/stores/acceptanceStore'
import { useInquiryAccept } from '@/composables/useInquiryAccept'
import { useInquiryErrorHandler } from '@/composables/useInquiryErrorHandler'
import { useInquiryWebSocket } from '@/composables/useInquiryWebSocket'
import { storeToRefs } from 'pinia'
import type { ContactsDTO } from '@/types/inquiries'
import Button from '@/ui/Button.vue'
import Modal from '@/ui/Modal.vue'
import LoadingState from '@/components/inquiries/LoadingState.vue'
import ErrorState from '@/components/inquiries/ErrorState.vue'
import EmptyInquiriesState from '@/components/inquiries/EmptyInquiriesState.vue'
import InquiryCard from '@/components/inquiries/InquiryCard.vue'
import InquiryCardSkeleton from '@/components/inquiries/InquiryCardSkeleton.vue'
import RejectInquiryModal from '@/components/inquiries/RejectInquiryModal.vue'
import DeclineStreakWarning from '@/components/contacts/DeclineStreakWarning.vue'

const inquiriesStore = useInquiriesStore()
const contactsStore = useContactsStore()
const acceptanceStore = useAcceptanceStore()
const { items, isLoading } = storeToRefs(inquiriesStore)
const { declineStreak, isBlocked } = storeToRefs(contactsStore)
const { errorState, handleError, clearError } = useInquiryErrorHandler()
const { isAccepting, handleAccept: handleAcceptWithGrace } = useInquiryAccept()

const showRejectModal = ref(false)
const selectedInquiryId = ref<string | null>(null)
const showContactsModal = ref(false)
const unlockedContacts = ref<ContactsDTO | null>(null)

// Format next available date
const nextAvailableText = computed(() => {
  const nextAvailable = acceptanceStore.data?.next_available_at
  if (!nextAvailable) return null
  
  const date = new Date(nextAvailable)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return 'сьогодні'
  } else if (diffDays === 1) {
    return 'завтра'
  } else if (diffDays <= 7) {
    return `через ${diffDays} днів`
  } else {
    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })
  }
})

onMounted(async () => {
  await Promise.all([
    loadInquiries(),
    contactsStore.fetchStats(),
    acceptanceStore.fetchAvailability()
  ])
})

// Setup WebSocket for real-time inquiry updates
useInquiryWebSocket({
  onEvent: (event) => {
    // Refresh inquiries when we receive any inquiry event
    loadInquiries()
  }
})

async function loadInquiries() {
  clearError()
  try {
    await inquiriesStore.fetchInquiries({ role: 'tutor' })
  } catch (err) {
    handleError(err)
  }
}

async function handleAccept(inquiryId: string) {
  clearError()
  try {
    // SSOT-compliant accept with grace token retry
    await handleAcceptWithGrace(String(inquiryId))
    
    // Phase 2.3 INV-3: Refetch balance + ledger after accept
    await contactsStore.afterAcceptRefresh()
    
    // Note: contacts are shown via InquiryService response
    // For now, we keep the old modal logic for backward compatibility
    // TODO: Migrate to new accept response structure
  } catch (err) {
    handleError(err)
  }
}

function openRejectModal(inquiryId: string) {
  selectedInquiryId.value = inquiryId
  showRejectModal.value = true
}

function closeRejectModal() {
  showRejectModal.value = false
  selectedInquiryId.value = null
}

function handleRejectSuccess() {
  closeRejectModal()
}

function closeContactsModal() {
  showContactsModal.value = false
  unlockedContacts.value = null
}

function handleRetry() {
  loadInquiries()
}
</script>

<style scoped>
.tutor-inquiries-view {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--space-lg);
}

.view-header {
  margin-bottom: var(--space-2xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.view-header h1 {
  margin: 0 0 var(--space-xs) 0;
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
}

.view-description {
  margin: 0;
  font-size: var(--text-base);
  color: var(--text-secondary);
}

/* Accept Limit Info Block */
.accept-limit-info {
  margin: var(--space-lg) 0;
  padding: var(--space-md) var(--space-lg);
  background: #ecfdf5;
  border: 2px solid #10b981;
  border-radius: var(--radius-md);
}

.limit-text {
  font-size: var(--text-sm);
  color: #065f46;
  line-height: 1.5;
}

.limit-text strong {
  font-weight: 700;
}

.limit-exhausted {
  background: #fef2f2;
  border-color: #ef4444;
  color: #991b1b;
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-md);
  margin: calc(-1 * var(--space-md)) calc(-1 * var(--space-lg));
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .accept-limit-info {
    background: rgba(16, 185, 129, 0.1);
    border-color: #34d399;
  }

  .limit-text {
    color: #a7f3d0;
  }

  .limit-exhausted {
    background: rgba(239, 68, 68, 0.1);
    border-color: #f87171;
    color: #fca5a5;
  }
}

:root[data-theme='dark'] .accept-limit-info,
.dark .accept-limit-info {
  background: rgba(16, 185, 129, 0.1);
  border-color: #34d399;
}

:root[data-theme='dark'] .limit-text,
.dark .limit-text {
  color: #a7f3d0;
}

:root[data-theme='dark'] .limit-exhausted,
.dark .limit-exhausted {
  background: rgba(239, 68, 68, 0.1);
  border-color: #f87171;
  color: #fca5a5;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: var(--space-2xl) var(--space-lg);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  margin-top: var(--space-lg);
}

.empty-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-xs) 0;
}

.empty-description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.inquiries-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

/* Contacts Display (inside Modal) */
.contacts-display {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.contact-item {
  display: flex;
  justify-content: space-between;
  padding: var(--space-sm);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.contact-label {
  font-weight: 500;
  color: var(--text-secondary);
}

.contact-value {
  color: var(--text-primary);
  font-weight: 600;
}

/* Status messages in actions area */
.status-message {
  font-size: var(--text-sm);
  font-weight: 600;
  padding: 6px 14px;
  border-radius: var(--radius-md);
  width: 100%;
}

.status-accepted-msg {
  color: #065F46;
  background: #D1FAE5;
}

.status-rejected-msg {
  color: #991B1B;
  background: #FEE2E2;
}

.status-expired-msg {
  color: #92400E;
  background: #FEF3C7;
}

.status-cancelled-msg {
  color: #6B7280;
  background: #F3F4F6;
}

:root[data-theme='dark'] .status-accepted-msg,
.dark .status-accepted-msg {
  color: #A7F3D0;
  background: rgba(16, 185, 129, 0.15);
}

:root[data-theme='dark'] .status-rejected-msg,
.dark .status-rejected-msg {
  color: #FCA5A5;
  background: rgba(239, 68, 68, 0.15);
}

:root[data-theme='dark'] .status-expired-msg,
.dark .status-expired-msg {
  color: #FCD34D;
  background: rgba(245, 158, 11, 0.15);
}

:root[data-theme='dark'] .status-cancelled-msg,
.dark .status-cancelled-msg {
  color: #D1D5DB;
  background: rgba(107, 114, 128, 0.15);
}
</style>
