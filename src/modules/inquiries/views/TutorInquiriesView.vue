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
        Ліміт прийомів вичерпано: <strong>0 / 10</strong> (оновиться автоматично)
      </div>
    </div>
    
    <!-- Loading State -->
    <LoadingState v-if="isLoading && !items.length" :message="$t('inquiries.loading')" />
    
    <!-- Error State -->
    <ErrorState
      v-else-if="errorState"
      :variant="errorState.variant"
      :title="errorState.title"
      :message="errorState.message"
      :retry-after="errorState.retryAfter"
      :show-retry="errorState.showRetry"
      @retry="handleRetry"
    />
    
    <!-- Empty State (новий текст) -->
    <div v-else-if="!items.length" class="empty-state">
      <p class="empty-title">Наразі у вас немає запитів від студентів.</p>
      <p class="empty-description">Коли з'являться — ви зможете прийняти їх одразу.</p>
    </div>
    
    <!-- Inquiries List -->
    <div v-else class="inquiries-list">
      <InquiryCard
        v-for="inquiry in items"
        :key="inquiry.id"
        :inquiry="inquiry"
        current-user-role="tutor"
        :show-actions="inquiry.status === 'OPEN'"
      >
        <template #actions>
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

import { ref, onMounted } from 'vue'
import { useInquiriesStore } from '@/stores/inquiriesStore'
import { useContactsStore } from '@/stores/contactsStore'
import { useAcceptanceStore } from '@/stores/acceptanceStore'
import { useInquiryAccept } from '@/composables/useInquiryAccept'
import { useInquiryErrorHandler } from '@/composables/useInquiryErrorHandler'
import { storeToRefs } from 'pinia'
import type { ContactsDTO } from '@/types/inquiries'
import Button from '@/ui/Button.vue'
import Modal from '@/ui/Modal.vue'
import LoadingState from '@/components/inquiries/LoadingState.vue'
import ErrorState from '@/components/inquiries/ErrorState.vue'
import EmptyInquiriesState from '@/components/inquiries/EmptyInquiriesState.vue'
import InquiryCard from '@/components/inquiries/InquiryCard.vue'
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

onMounted(async () => {
  await Promise.all([
    loadInquiries(),
    contactsStore.fetchStats(),
    acceptanceStore.fetchAvailability()
  ])
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
  background: var(--info-bg, #F0F9FF);
  border: 2px solid var(--accent);
  border-radius: var(--radius-md);
}

.limit-text {
  font-size: var(--text-sm);
  color: var(--accent);
  line-height: 1.5;
}

.limit-text strong {
  font-weight: 700;
}

.limit-exhausted {
  background: var(--danger-bg, #FEF2F2);
  border-color: var(--danger, #EF4444);
  color: var(--danger, #991B1B);
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-md);
  margin: calc(-1 * var(--space-md)) calc(-1 * var(--space-lg));
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
</style>
