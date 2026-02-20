<template>
  <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h2>{{ $t('inquiries.reject.title') }}</h2>
        <button @click="$emit('close')" class="close-btn">✕</button>
      </div>
      
      <div class="modal-body">
        <form @submit.prevent="handleSubmit" class="reject-form">
          <div class="form-group">
            <label for="reason">{{ $t('inquiries.reject.reason') }} *</label>
            <select 
              id="reason"
              v-model="form.reason" 
              required
              class="form-control"
            >
              <option value="">{{ $t('inquiries.reject.reasonPlaceholder') }}</option>
              <option value="BUSY">{{ $t('inquiries.reject.reasons.BUSY') }}</option>
              <option value="BUDGET_LOW">{{ $t('inquiries.reject.reasons.BUDGET_LOW') }}</option>
              <option value="LEVEL_MISMATCH">{{ $t('inquiries.reject.reasons.LEVEL_MISMATCH') }}</option>
              <option value="SUBJECT_MISMATCH">{{ $t('inquiries.reject.reasons.SUBJECT_MISMATCH') }}</option>
              <option value="OTHER">{{ $t('inquiries.reject.reasons.OTHER') }}</option>
            </select>
          </div>
          
          <div v-if="form.reason === 'OTHER'" class="form-group">
            <label for="comment">{{ $t('inquiries.reject.comment') }} *</label>
            <textarea 
              id="comment"
              v-model="form.comment" 
              rows="3"
              :placeholder="$t('inquiries.reject.commentPlaceholder')"
              required
              class="form-control"
              maxlength="500"
            ></textarea>
            <span class="char-count">{{ form.comment.length }}/500</span>
          </div>
          
          <!-- Error Display -->
          <ErrorState
            v-if="errorState"
            :variant="errorState.variant"
            :title="errorState.title"
            :message="errorState.message"
            :show-retry="errorState.showRetry"
            @retry="clearError"
          />
          
          <!-- Actions -->
          <div class="form-actions">
            <Button 
              variant="secondary"
              @click="$emit('close')" 
              :disabled="isSubmitting"
            >
              {{ $t('common.cancel') }}
            </Button>
            <Button 
              type="submit" 
              variant="danger"
              :disabled="isSubmitting || !isFormValid"
            >
              <span v-if="!isSubmitting">{{ $t('inquiries.reject.submit') }}</span>
              <span v-else>{{ $t('inquiries.reject.submitting') }}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * RejectInquiryModal Component (Phase 1 v0.86)
 * 
 * Модальне вікно для відхилення inquiry тьютором
 */

import { ref, reactive, computed } from 'vue'
import { useInquiriesStore } from '@/stores/inquiriesStore'
import { useInquiryErrorHandler } from '@/composables/useInquiryErrorHandler'
import type { RejectionReason } from '@/types/inquiries'
import ErrorState from './ErrorState.vue'
import Button from '@/ui/Button.vue'

const props = defineProps<{
  show: boolean
  inquiryId: string
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const inquiriesStore = useInquiriesStore()
const { errorState, handleError, clearError } = useInquiryErrorHandler()

const isSubmitting = ref(false)

const form = reactive({
  reason: '' as RejectionReason | '',
  comment: ''
})

const isFormValid = computed(() => {
  if (!form.reason) return false
  if (form.reason === 'OTHER' && !form.comment.trim()) return false
  return true
})

async function handleSubmit() {
  if (!isFormValid.value) return
  
  isSubmitting.value = true
  clearError()
  
  try {
    await inquiriesStore.rejectInquiry(props.inquiryId, {
      reason: form.reason as RejectionReason,
      comment: form.comment || undefined
    })
    emit('success')
  } catch (err) {
    handleError(err)
  } finally {
    isSubmitting.value = false
  }
}

function handleOverlayClick() {
  if (!isSubmitting.value) {
    emit('close')
  }
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

.modal-container {
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-height: 90vh;
  overflow-y: auto;
  max-width: 500px;
  width: 100%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
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

.reject-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-weight: 500;
  color: #374151;
}

.form-control {
  padding: 10px 12px;
  border: 1px solid #D1D5DB;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-control:focus {
  outline: none;
  border-color: #4F46E5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.char-count {
  font-size: 12px;
  color: #9CA3AF;
  text-align: right;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 8px;
}

</style>
