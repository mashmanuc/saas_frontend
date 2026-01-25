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
    
    <!-- Empty State -->
    <EmptyInquiriesState
      v-else-if="!items.length"
      :title="$t('inquiries.tutor.empty.title')"
      :description="$t('inquiries.tutor.empty.description')"
    />
    
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
          <button 
            @click="handleAccept(inquiry.id)"
            class="btn btn-primary btn-sm"
            :disabled="isLoading"
          >
            {{ $t('inquiries.tutor.accept') }}
          </button>
          <button 
            @click="openRejectModal(inquiry.id)"
            class="btn btn-secondary btn-sm"
            :disabled="isLoading"
          >
            {{ $t('inquiries.tutor.reject') }}
          </button>
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
    <div v-if="showContactsModal" class="modal-overlay" @click="closeContactsModal">
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <h2>{{ $t('inquiries.tutor.contactsUnlocked') }}</h2>
          <button @click="closeContactsModal" class="close-btn">✕</button>
        </div>
        <div class="modal-body">
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
          <button @click="closeContactsModal" class="btn btn-primary">
            {{ $t('common.close') }}
          </button>
        </div>
      </div>
    </div>
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
import { useInquiryErrorHandler } from '@/composables/useInquiryErrorHandler'
import { storeToRefs } from 'pinia'
import type { ContactsDTO } from '@/types/inquiries'
import LoadingState from '@/components/inquiries/LoadingState.vue'
import ErrorState from '@/components/inquiries/ErrorState.vue'
import EmptyInquiriesState from '@/components/inquiries/EmptyInquiriesState.vue'
import InquiryCard from '@/components/inquiries/InquiryCard.vue'
import RejectInquiryModal from '@/components/inquiries/RejectInquiryModal.vue'
import DeclineStreakWarning from '@/components/contacts/DeclineStreakWarning.vue'

const inquiriesStore = useInquiriesStore()
const contactsStore = useContactsStore()
const { items, isLoading } = storeToRefs(inquiriesStore)
const { declineStreak, isBlocked } = storeToRefs(contactsStore)
const { errorState, handleError, clearError } = useInquiryErrorHandler()

const showRejectModal = ref(false)
const selectedInquiryId = ref<number | null>(null)
const showContactsModal = ref(false)
const unlockedContacts = ref<ContactsDTO | null>(null)

onMounted(async () => {
  await Promise.all([
    loadInquiries(),
    contactsStore.fetchStats()
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

async function handleAccept(inquiryId: number) {
  clearError()
  try {
    const response = await inquiriesStore.acceptInquiry(inquiryId)
    
    // Phase 2.3 INV-3: Refetch balance + ledger after accept
    await contactsStore.afterAcceptRefresh()
    
    // Показати контакти студента
    unlockedContacts.value = response.contacts
    showContactsModal.value = true
  } catch (err) {
    handleError(err)
  }
}

function openRejectModal(inquiryId: number) {
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
  padding: 24px;
}

.view-header {
  margin-bottom: 32px;
}

.view-header h1 {
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 700;
  color: #111827;
}

.view-description {
  margin: 0;
  font-size: 16px;
  color: #6B7280;
}

.inquiries-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-primary {
  background: #4F46E5;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #4338CA;
}

.btn-secondary {
  background: #F3F4F6;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #E5E7EB;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Contacts Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  width: 100%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #E5E7EB;
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #9CA3AF;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #F3F4F6;
  color: #374151;
}

.modal-body {
  padding: 24px;
}

.contacts-display {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.contact-item {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: #F9FAFB;
  border-radius: 6px;
}

.contact-label {
  font-weight: 500;
  color: #6B7280;
}

.contact-value {
  color: #111827;
  font-weight: 600;
}
</style>
