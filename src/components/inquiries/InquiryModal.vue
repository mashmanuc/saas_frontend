<template>
  <div v-if="isOpen" class="inquiry-modal-overlay" @click.self="handleClose">
    <div class="inquiry-modal">
      <div class="inquiry-modal-header">
        <h2>{{ $t('inquiry.modal.title') }}</h2>
        <button 
          class="inquiry-modal-close" 
          @click="handleClose"
          :disabled="isLoading"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div class="inquiry-modal-body">
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <textarea
              v-model="message"
              :placeholder="$t('inquiry.modal.messagePlaceholder')"
              :disabled="isLoading"
              class="inquiry-textarea"
              rows="5"
              required
              data-testid="inquiry-message-input"
            />
            <p v-if="!message && showValidation" class="error-text">
              {{ $t('inquiry.modal.messageRequired') }}
            </p>
          </div>

          <div v-if="errorMessage" class="error-banner" data-testid="inquiry-error-banner">
            {{ errorMessage }}
            <button
              v-if="isSubscriptionError"
              type="button"
              class="btn-upgrade"
              @click="handleUpgrade"
              data-testid="inquiry-upgrade-button"
            >
              {{ $t('inquiry.modal.upgradeNow') }}
            </button>
          </div>

          <div class="inquiry-modal-actions">
            <div class="actions-left">
              <div class="actions-menu-wrapper">
                <button
                  type="button"
                  class="btn-text"
                  @click="showActionsMenu = !showActionsMenu"
                  :disabled="isLoading"
                  data-testid="inquiry-actions-menu-button"
                >
                  ⋮
                </button>
                <div v-if="showActionsMenu" class="actions-menu" data-testid="inquiry-actions-menu">
                  <button type="button" class="menu-item" @click="handleReport" data-testid="inquiry-report-button">
                    {{ $t('trust.report.action') }}
                  </button>
                  <button type="button" class="menu-item" @click="handleBlock" data-testid="inquiry-block-button">
                    {{ $t('trust.block.action') }}
                  </button>
                </div>
              </div>
            </div>
            <div class="actions-right">
              <Button
                variant="secondary"
                @click="handleClose"
                :disabled="isLoading"
              >
                {{ $t('inquiry.modal.cancelButton') }}
              </Button>
              <Button
                type="submit"
                variant="primary"
                :disabled="isLoading || !message.trim()"
                data-testid="inquiry-submit-button"
              >
                {{ isLoading ? $t('inquiry.modal.sending') : $t('inquiry.modal.sendButton') }}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <ReportModal
      :is-open="isReportModalOpen"
      :target-type="ReportTargetType.INQUIRY"
      :target-id="relationId"
      @close="isReportModalOpen = false"
      @success="handleReportSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useInquiriesStore } from '@/stores/inquiriesStore'
import { useRelationsStore } from '@/stores/relationsStore'
import { useTrustStore } from '@/stores/trustStore'
import { useRouter } from 'vue-router'
import { 
  InquiryAlreadyExistsError, 
  InquiryNotAllowedError,
  InquiryInvalidStateError,
  SubscriptionRequiredError,
  UserBlockedError
} from '@/utils/errors'
import { useI18n } from 'vue-i18n'
import ReportModal from '@/components/trust/ReportModal.vue'
import { ReportTargetType } from '@/types/trust'
import Button from '@/ui/Button.vue'

interface Props {
  isOpen: boolean
  relationId: string
}

interface Emits {
  (e: 'close'): void
  (e: 'success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const inquiriesStore = useInquiriesStore()
const relationsStore = useRelationsStore()
const trustStore = useTrustStore()
const router = useRouter()

const message = ref('')
const showValidation = ref(false)
const errorMessage = ref<string | null>(null)
const isLoading = ref(false)
const isSubscriptionError = ref(false)
const isReportModalOpen = ref(false)
const showActionsMenu = ref(false)

const relation = computed(() => {
  return relationsStore.relations.find(r => r.id === props.relationId)
})

const otherUserId = computed((): number | null => {
  if (!relation.value) return null
  return parseInt(relation.value.tutor.id)
})

// Reset form when modal opens
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    message.value = ''
    showValidation.value = false
    errorMessage.value = null
    isSubscriptionError.value = false
  }
})

async function handleSubmit() {
  showValidation.value = true
  
  if (!message.value.trim()) {
    return
  }

  isLoading.value = true
  errorMessage.value = null

  try {
    await inquiriesStore.requestContact(props.relationId, message.value.trim())
    
    // Refetch relations to get updated inquiry_status
    await relationsStore.fetchRelations()
    
    emit('success')
    emit('close')
  } catch (err) {
    // Map domain errors to user-friendly messages
    if (err instanceof InquiryAlreadyExistsError) {
      errorMessage.value = t('inquiry.errors.already_exists')
      isSubscriptionError.value = false
    } else if (err instanceof InquiryNotAllowedError) {
      errorMessage.value = t('inquiry.errors.not_allowed')
      isSubscriptionError.value = false
    } else if (err instanceof InquiryInvalidStateError) {
      errorMessage.value = t('inquiry.errors.invalid_state')
      isSubscriptionError.value = false
    } else if (err instanceof SubscriptionRequiredError) {
      errorMessage.value = t('inquiry.errors.subscription_required')
      isSubscriptionError.value = true
    } else if (err instanceof UserBlockedError) {
      errorMessage.value = t('inquiry.errors.user_blocked')
      isSubscriptionError.value = false
    } else {
      errorMessage.value = t('inquiry.modal.error')
      isSubscriptionError.value = false
    }
  } finally {
    isLoading.value = false
  }
}

function handleUpgrade() {
  router.push('/billing')
  emit('close')
}

function handleClose() {
  if (!isLoading.value) {
    emit('close')
  }
}

function handleReport() {
  showActionsMenu.value = false
  isReportModalOpen.value = true
}

async function handleBlock() {
  if (!otherUserId.value) return
  
  showActionsMenu.value = false
  
  if (confirm(t('trust.block.confirmMessage'))) {
    try {
      await trustStore.blockUser({
        user_id: otherUserId.value,
        reason: 'Blocked from inquiry modal'
      })
      emit('close')
    } catch (err) {
      errorMessage.value = t('trust.block.error')
    }
  }
}

function handleReportSuccess() {
  isReportModalOpen.value = false
}
</script>

<style scoped>
.inquiry-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.inquiry-modal {
  background: var(--card-bg);
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.inquiry-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.inquiry-modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.inquiry-modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.inquiry-modal-close:hover:not(:disabled) {
  color: #374151;
}

.inquiry-modal-close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.inquiry-modal-body {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.inquiry-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
}

.inquiry-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.inquiry-textarea:disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}

.error-text {
  color: #ef4444;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.error-banner {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.btn-upgrade {
  background-color: #3b82f6;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  align-self: flex-start;
}

.btn-upgrade:hover {
  background-color: #2563eb;
}

.inquiry-modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn-text {
  background: none;
  color: #6b7280;
  padding: 0.5rem;
  font-size: 1.25rem;
  font-weight: 600;
}

.btn-text:hover:not(:disabled) {
  color: #374151;
  background-color: #f3f4f6;
}

.actions-left {
  flex: 1;
}

.actions-right {
  display: flex;
  gap: 0.75rem;
}

.actions-menu-wrapper {
  position: relative;
  display: inline-block;
}

.actions-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 0.5rem;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  min-width: 150px;
  z-index: 10;
}

.menu-item {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  color: #374151;
  transition: background-color 0.2s;
}

.menu-item:hover {
  background-color: #f3f4f6;
}

.menu-item:first-child {
  border-radius: 6px 6px 0 0;
}

.menu-item:last-child {
  border-radius: 0 0 6px 6px;
}
</style>
