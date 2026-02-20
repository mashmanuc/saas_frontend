<template>
  <div class="modal-overlay" @click.self="handleCancel" data-testid="block-slot-modal-overlay">
    <div class="modal-content" role="dialog" aria-labelledby="block-slot-title" aria-modal="true">
      <div class="modal-header">
        <h3 id="block-slot-title" class="modal-title">{{ t('calendar.blockSlot.title') }}</h3>
        <Button
          variant="ghost"
          iconOnly
          @click="handleCancel"
          :aria-label="t('common.close')"
          data-testid="close-modal"
        >
          <XIcon :size="20" />
        </Button>
      </div>

      <div class="modal-body">
        <!-- Slot Info -->
        <div class="slot-info-section">
          <div class="info-row">
            <CalendarIcon :size="16" class="icon" />
            <span class="info-text">{{ formatDate(slot.start) }}</span>
          </div>
          <div class="info-row">
            <ClockIcon :size="16" class="icon" />
            <span class="info-text">{{ formatTime(slot.start) }} - {{ formatTime(slot.end) }}</span>
          </div>
        </div>

        <!-- Reason Input -->
        <div class="reason-section">
          <label for="block-reason" class="reason-label">
            {{ t('calendar.blockSlot.reason') }}
            <span class="optional-text">({{ t('common.optional') }})</span>
          </label>
          <Textarea
            id="block-reason"
            v-model="blockReason"
            :placeholder="t('calendar.blockSlot.reasonPlaceholder')"
            :disabled="isLoading"
            :rows="4"
            data-testid="block-reason-textarea"
          />
        </div>

        <!-- Warning Message -->
        <div class="warning-message" role="alert">
          <AlertCircleIcon :size="20" class="warning-icon" />
          <p class="warning-text">{{ t('calendar.blockSlot.warning') }}</p>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="loading-state" role="status" aria-live="polite">
          <LoaderIcon :size="20" class="spinner" />
          <span>{{ t('calendar.blockSlot.blocking') }}</span>
        </div>
      </div>

      <div class="modal-footer">
        <Button
          variant="outline"
          @click="handleCancel"
          :disabled="isLoading"
          data-testid="cancel-block"
        >
          {{ t('common.cancel') }}
        </Button>
        <Button
          variant="danger"
          @click="handleBlock"
          :loading="isLoading"
          data-testid="confirm-block"
        >
          <template v-if="!isLoading" #iconLeft>
            <BanIcon :size="16" />
          </template>
          {{ t('calendar.blockSlot.block') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { X as XIcon, Calendar as CalendarIcon, Clock as ClockIcon, AlertCircle as AlertCircleIcon, Loader as LoaderIcon, Ban as BanIcon } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import Textarea from '@/ui/Textarea.vue'
import { bookingApi } from '@/modules/booking/api/booking'
import { useSlotStore } from '@/stores/slotStore'
import { useToast } from '@/composables/useToast'
import type { AccessibleSlot } from '@/modules/booking/types/calendarWeek'

interface Props {
  slot: AccessibleSlot
}

interface Emits {
  blocked: [slotId: number]
  cancelled: []
  error: [error: any]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const slotStore = useSlotStore()
const toast = useToast()

const blockReason = ref('')
const isLoading = ref(false)

function formatDate(dateStr: string): string {
  // AccessibleSlot doesn't have date field, extract from start
  const date = new Date(dateStr || props.slot.start)
  return date.toLocaleDateString(undefined, { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

function formatTime(timeStr: string): string {
  if (!timeStr) return ''
  
  // Handle both full datetime strings and time-only strings
  if (timeStr.includes('T')) {
    const date = new Date(timeStr)
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    })
  }
  
  // Time-only format (HH:MM or HH:MM:SS)
  return timeStr.substring(0, 5)
}

async function handleBlock() {
  if (!props.slot.id) return
  
  isLoading.value = true
  
  try {
    await bookingApi.blockSlot(Number(props.slot.id), blockReason.value || undefined)
    
    console.log('[BlockSlotModal] Slot blocked:', props.slot.id)
    
    toast.success(t('calendar.blockSlot.success'))
    emit('blocked', props.slot.id)
  } catch (error: any) {
    console.error('[BlockSlotModal] Failed to block slot:', error)
    
    // Handle 401 errors - retry after token refresh
    if (error?.response?.status === 401 && !error.config?._retryAfter401) {
      console.log('[BlockSlotModal] 401 detected, retrying after token refresh...')
      try {
        if (error.config) {
          error.config._retryAfter401 = true
        }
        await bookingApi.blockSlot(Number(props.slot.id), blockReason.value || undefined)
        
        toast.success(t('calendar.blockSlot.success'))
        emit('blocked', props.slot.id)
        return
      } catch (retryError) {
        console.error('[BlockSlotModal] Retry failed:', retryError)
        toast.error(t('calendar.blockSlot.error'))
        emit('error', retryError)
        return
      }
    }
    
    // Handle 422 validation errors
    if (error?.response?.status === 422) {
      const errorCode = error?.response?.data?.error?.code
      console.warn('[BlockSlotModal] Validation error:', errorCode)
      
      if (errorCode === 'CANNOT_BLOCK_BOOKED') {
        toast.error(t('calendar.blockSlot.errors.cannotBlockBooked'))
      } else if (errorCode === 'CANNOT_BLOCK_PAST') {
        toast.error(t('calendar.blockSlot.errors.cannotBlockPast'))
      } else {
        toast.error(t('calendar.blockSlot.error'))
      }
    } else {
      toast.error(t('calendar.blockSlot.error'))
    }
    
    emit('error', error)
  } finally {
    isLoading.value = false
  }
}

function handleCancel() {
  emit('cancelled')
}
</script>

<style scoped>
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

.modal-content {
  background: var(--color-bg-primary, white);
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
  margin: 0;
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  border-radius: 6px;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.15s;
}

.close-button:hover {
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--color-text-primary, #111827);
}

.modal-body {
  padding: 24px;
}

.slot-info-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--color-bg-secondary, #f3f4f6);
  border-radius: 8px;
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon {
  color: var(--color-primary, #3b82f6);
  flex-shrink: 0;
}

.info-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge--available {
  background: var(--color-success-light, #d1fae5);
  color: var(--color-success-dark, #065f46);
}

.status-badge--booked {
  background: var(--color-warning-light, #fef3c7);
  color: var(--color-warning-dark, #92400e);
}

.status-badge--blocked {
  background: var(--color-error-light, #fee2e2);
  color: var(--color-error-dark, #991b1b);
}

.reason-section {
  margin-bottom: 20px;
}

.reason-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
  margin-bottom: 8px;
}

.optional-text {
  font-weight: 400;
  color: var(--color-text-secondary, #6b7280);
  font-size: 13px;
}

.reason-textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  min-height: 100px;
  transition: border-color 0.15s;
}

.reason-textarea:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
}

.reason-textarea:disabled {
  background: var(--color-bg-secondary, #f3f4f6);
  cursor: not-allowed;
}

.warning-message {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--color-warning-light, #fef3c7);
  border: 1px solid var(--color-warning, #f59e0b);
  border-radius: 8px;
  margin-bottom: 20px;
}

.warning-icon {
  flex-shrink: 0;
  color: var(--color-warning, #f59e0b);
}

.warning-text {
  font-size: 13px;
  color: var(--color-warning-dark, #92400e);
  margin: 0;
  line-height: 1.5;
}

.loading-state {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--color-bg-secondary, #f3f4f6);
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
}

.btn-secondary {
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--color-text-primary, #111827);
  border: 1px solid var(--color-border, #e5e7eb);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  background: var(--color-error, #ef4444);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: var(--color-error-dark, #dc2626);
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .modal-content {
    max-width: 100%;
    margin: 0;
    border-radius: 0;
    max-height: 100vh;
  }
  
  .modal-footer {
    flex-direction: column-reverse;
  }
  
  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
