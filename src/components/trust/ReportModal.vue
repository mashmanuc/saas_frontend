<template>
  <div v-if="isOpen" class="report-modal-overlay" @click.self="handleClose" data-testid="report-modal-overlay">
    <div class="report-modal" data-testid="report-modal">
      <div class="modal-header">
        <h2 class="modal-title">{{ $t('trust.report.title') }}</h2>
        <button 
          class="close-button" 
          @click="handleClose"
          :disabled="isSubmitting"
          data-testid="close-button"
          :aria-label="$t('common.close')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- Success state -->
        <div v-if="isSuccess" class="success-state" data-testid="success-state">
          <div class="success-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h3 class="success-title">{{ $t('trust.report.success.title') }}</h3>
          <p class="success-message">{{ $t('trust.report.success.message') }}</p>
          <button class="btn btn-primary" @click="handleClose" data-testid="success-close-button">
            {{ $t('common.close') }}
          </button>
        </div>

        <!-- Form state -->
        <form v-else @submit.prevent="handleSubmit" data-testid="report-form">
          <!-- Category dropdown -->
          <div class="form-group">
            <label for="report-category" class="form-label">
              {{ $t('trust.report.category.label') }}
              <span class="required">*</span>
            </label>
            <select
              id="report-category"
              v-model="formData.category"
              class="form-select"
              :disabled="isSubmitting"
              required
              data-testid="category-select"
            >
              <option value="" disabled>{{ $t('trust.report.category.placeholder') }}</option>
              <option value="SPAM">{{ $t('trust.report.category.spam') }}</option>
              <option value="HARASSMENT">{{ $t('trust.report.category.harassment') }}</option>
              <option value="FRAUD">{{ $t('trust.report.category.fraud') }}</option>
              <option value="INAPPROPRIATE">{{ $t('trust.report.category.inappropriate') }}</option>
              <option value="OTHER">{{ $t('trust.report.category.other') }}</option>
            </select>
          </div>

          <!-- Details textarea -->
          <div class="form-group">
            <label for="report-details" class="form-label">
              {{ $t('trust.report.details.label') }}
              <span class="required">*</span>
            </label>
            <textarea
              id="report-details"
              v-model="formData.details"
              class="form-textarea"
              :placeholder="$t('trust.report.details.placeholder')"
              :disabled="isSubmitting"
              required
              rows="6"
              maxlength="5000"
              data-testid="details-textarea"
            ></textarea>
            <div class="char-count">{{ formData.details.length }} / 5000</div>
          </div>

          <!-- Error message -->
          <div v-if="errorMessage" class="error-message" data-testid="error-message">
            {{ errorMessage }}
          </div>

          <!-- Actions -->
          <div class="modal-actions">
            <button
              type="button"
              class="btn btn-secondary"
              @click="handleClose"
              :disabled="isSubmitting"
              data-testid="cancel-button"
            >
              {{ $t('common.cancel') }}
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="isSubmitting || !isFormValid"
              data-testid="submit-button"
            >
              <span v-if="isSubmitting" class="spinner"></span>
              {{ isSubmitting ? $t('trust.report.submitting') : $t('trust.report.submit') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTrustStore } from '@/stores/trustStore'
import { ReportCategory, ReportTargetType } from '@/types/trust'
import { RateLimitedError } from '@/utils/errors'

interface Props {
  isOpen: boolean
  targetType: ReportTargetType
  targetId?: string | null
}

interface Emits {
  (e: 'close'): void
  (e: 'success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const trustStore = useTrustStore()

const formData = ref({
  category: '' as ReportCategory | '',
  details: '',
})

const isSubmitting = ref(false)
const isSuccess = ref(false)
const errorMessage = ref<string | null>(null)

const isFormValid = computed(() => {
  return formData.value.category !== '' && formData.value.details.trim().length > 0
})

watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    resetForm()
  }
})

function resetForm() {
  formData.value = {
    category: '',
    details: '',
  }
  isSubmitting.value = false
  isSuccess.value = false
  errorMessage.value = null
}

async function handleSubmit() {
  if (!isFormValid.value || isSubmitting.value) {
    return
  }

  isSubmitting.value = true
  errorMessage.value = null

  try {
    await trustStore.createReport({
      target_type: props.targetType,
      target_id: props.targetId || null,
      category: formData.value.category as ReportCategory,
      details: formData.value.details.trim(),
    })

    isSuccess.value = true
    emit('success')
  } catch (err) {
    if (err instanceof RateLimitedError) {
      const seconds = err.meta.retry_after_seconds
      const hours = Math.floor(seconds / 3600)
      errorMessage.value = t('trust.report.error.rateLimited', { hours })
    } else {
      errorMessage.value = t('trust.report.error.generic')
    }
  } finally {
    isSubmitting.value = false
  }
}

function handleClose() {
  if (!isSubmitting.value) {
    emit('close')
  }
}
</script>

<style scoped>
.report-modal-overlay {
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
  padding: 1rem;
}

.report-modal {
  background: white;
  border-radius: 8px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  color: #6b7280;
  transition: color 0.2s;
  border-radius: 4px;
}

.close-button:hover:not(:disabled) {
  color: #111827;
  background-color: #f3f4f6;
}

.close-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-body {
  padding: 1.5rem;
}

.success-state {
  text-align: center;
  padding: 2rem 1rem;
}

.success-icon {
  color: #10b981;
  margin-bottom: 1rem;
}

.success-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.5rem 0;
}

.success-message {
  color: #6b7280;
  margin: 0 0 1.5rem 0;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.required {
  color: #ef4444;
}

.form-select,
.form-textarea {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  transition: border-color 0.2s;
}

.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-select:disabled,
.form-textarea:disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}

.form-textarea {
  resize: vertical;
  font-family: inherit;
}

.char-count {
  text-align: right;
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.error-message {
  padding: 0.75rem 1rem;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.625rem 1.25rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.btn-secondary {
  background-color: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #e5e7eb;
}

.spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .report-modal {
    max-width: 100%;
    margin: 0;
    border-radius: 0;
    max-height: 100vh;
  }

  .modal-actions {
    flex-direction: column-reverse;
  }

  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
