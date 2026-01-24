<template>
  <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h2>{{ $t('inquiries.form.title') }}</h2>
        <button @click="$emit('close')" class="close-btn">✕</button>
      </div>
      
      <div class="modal-body">
        <form @submit.prevent="handleSubmit" class="inquiry-form">
          <!-- Tutor Preview -->
          <div class="tutor-preview">
            <img :src="tutor.avatar || '/default-avatar.png'" class="avatar-sm" alt="" />
            <div>
              <h3>{{ tutor.full_name }}</h3>
              <p class="subjects">{{ tutor.subjects?.join(', ') || '' }}</p>
            </div>
          </div>
          
          <!-- Form Fields -->
          <div class="form-group">
            <label for="student_level">{{ $t('inquiries.form.studentLevel') }} *</label>
            <select 
              id="student_level"
              v-model="form.student_level" 
              required
              class="form-control"
            >
              <option value="">{{ $t('inquiries.form.studentLevelPlaceholder') }}</option>
              <option value="beginner">{{ $t('inquiries.form.levels.beginner') }}</option>
              <option value="intermediate">{{ $t('inquiries.form.levels.intermediate') }}</option>
              <option value="advanced">{{ $t('inquiries.form.levels.advanced') }}</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="budget">{{ $t('inquiries.form.budget') }} *</label>
            <input 
              id="budget"
              v-model.number="form.budget" 
              type="number" 
              min="0"
              step="50"
              placeholder="500"
              required
              class="form-control"
            />
            <span v-if="tutor.min_hourly_rate" class="hint">
              {{ $t('inquiries.form.budgetHint', { rate: tutor.min_hourly_rate }) }}
            </span>
            <span v-if="budgetTooLow" class="error-text">
              ⚠️ {{ $t('inquiries.form.budgetTooLow') }}
            </span>
          </div>
          
          <div class="form-group">
            <label for="start_preference">{{ $t('inquiries.form.startPreference') }} *</label>
            <select 
              id="start_preference"
              v-model="form.start_preference" 
              required
              class="form-control"
            >
              <option value="asap">{{ $t('inquiries.form.startOptions.asap') }}</option>
              <option value="week">{{ $t('inquiries.form.startOptions.week') }}</option>
              <option value="month">{{ $t('inquiries.form.startOptions.month') }}</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="message">{{ $t('inquiries.form.message') }} *</label>
            <textarea 
              id="message"
              v-model="form.message" 
              rows="4"
              :placeholder="$t('inquiries.form.messagePlaceholder')"
              required
              class="form-control"
              maxlength="500"
            ></textarea>
            <span class="char-count">{{ form.message.length }}/500</span>
          </div>
          
          <!-- Error Display -->
          <ErrorState
            v-if="errorState"
            :variant="errorState.variant"
            :title="errorState.title"
            :message="errorState.message"
            :retry-after="errorState.retryAfter"
            :show-retry="errorState.showRetry"
            @retry="clearError"
          />
          
          <!-- Actions -->
          <div class="form-actions">
            <button 
              type="button" 
              @click="$emit('close')" 
              class="btn btn-secondary"
              :disabled="isSubmitting"
            >
              {{ $t('inquiries.form.cancel') }}
            </button>
            <button 
              type="submit" 
              class="btn btn-primary" 
              :disabled="isSubmitting || !isFormValid"
            >
              <span v-if="!isSubmitting">{{ $t('inquiries.form.submit') }}</span>
              <span v-else>{{ $t('inquiries.form.submitting') }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * InquiryFormModal Component (Phase 1 v0.86)
 * 
 * Форма для створення inquiry від студента до тьютора
 */

import { ref, reactive, computed } from 'vue'
import { useInquiriesStore } from '@/stores/inquiriesStore'
import { useInquiryErrorHandler } from '@/composables/useInquiryErrorHandler'
import ErrorState from './ErrorState.vue'

interface Tutor {
  id: number
  full_name: string
  avatar?: string
  subjects?: string[]
  min_hourly_rate?: number
}

const props = defineProps<{
  show: boolean
  tutor: Tutor
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const inquiriesStore = useInquiriesStore()
const { errorState, handleError, clearError } = useInquiryErrorHandler()

const isSubmitting = ref(false)

const form = reactive({
  student_level: '',
  budget: props.tutor.min_hourly_rate || 500,
  start_preference: 'asap',
  message: ''
})

const budgetTooLow = computed(() => {
  return props.tutor.min_hourly_rate && form.budget < props.tutor.min_hourly_rate
})

const isFormValid = computed(() => {
  return form.student_level && 
         form.budget > 0 && 
         form.start_preference && 
         form.message.trim().length >= 10
})

async function handleSubmit() {
  console.log('[InquiryFormModal] handleSubmit called', {
    isFormValid: isFormValid.value,
    tutorId: props.tutor.id,
    messageLength: form.message.length,
    formData: {
      student_level: form.student_level,
      budget: form.budget,
      start_preference: form.start_preference
    }
  })
  
  if (!isFormValid.value) {
    console.warn('[InquiryFormModal] Form invalid, aborting')
    return
  }
  
  isSubmitting.value = true
  clearError()
  
  try {
    console.log('[InquiryFormModal] Calling createInquiry...')
    await inquiriesStore.createInquiry(String(props.tutor.id), form.message)
    console.log('[InquiryFormModal] Success!')
    emit('success')
  } catch (err) {
    console.error('[InquiryFormModal] Error:', err)
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
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-height: 90vh;
  overflow-y: auto;
  max-width: 600px;
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

.inquiry-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.tutor-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #F9FAFB;
  border-radius: 8px;
}

.avatar-sm {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.tutor-preview h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.tutor-preview .subjects {
  margin: 0;
  font-size: 14px;
  color: #6B7280;
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

.hint {
  font-size: 12px;
  color: #6B7280;
}

.error-text {
  font-size: 12px;
  color: #EF4444;
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

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: #F3F4F6;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #E5E7EB;
}

.btn-primary {
  background: #4F46E5;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #4338CA;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
