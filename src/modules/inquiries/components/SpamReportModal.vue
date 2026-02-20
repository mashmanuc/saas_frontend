<template>
  <Modal :open="isOpen" @close="close" class="spam-report-modal">
    <template #header>
      <h3>{{ $t('inquiries.spam.title') }}</h3>
    </template>
    
    <template #default>
      <div class="spam-report-content">
        <div class="warning-box">
          <i class="icon-alert-triangle"></i>
          <p>{{ $t('inquiries.spam.warning') }}</p>
        </div>
        
        <div class="inquiry-preview">
          <h4>{{ $t('inquiries.spam.inquiryPreview') }}</h4>
          <div class="preview-card">
            <div class="preview-header">
              <strong>{{ inquiry?.student?.display_name || inquiry?.student?.full_name }}</strong>
              <span class="preview-date">{{ formatDate(inquiry?.created_at) }}</span>
            </div>
            <p class="preview-message">{{ inquiry?.message }}</p>
          </div>
        </div>
        
        <div class="form-group">
          <label for="spam-reason">
            {{ $t('inquiries.spam.reasonLabel') }} ({{ $t('common.optional') }})
          </label>
          <textarea
            id="spam-reason"
            v-model="reason"
            class="form-input"
            rows="3"
            :placeholder="$t('inquiries.spam.reasonPlaceholder')"
            maxlength="500"
          ></textarea>
          <span class="char-count">{{ reason.length }}/500</span>
        </div>
        
        <div v-if="error" class="alert alert-error">
          {{ error }}
        </div>
        
        <div v-if="alreadyReported" class="alert alert-info">
          {{ $t('inquiries.spam.alreadyReported') }}
        </div>
      </div>
    </template>
    
    <template #footer>
      <div class="modal-actions">
        <Button variant="outline" @click="close">
          {{ $t('common.cancel') }}
        </Button>
        <Button
          variant="danger"
          :disabled="processing || alreadyReported"
          :loading="processing"
          @click="submit"
        >
          {{ $t('inquiries.spam.submit') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed } from 'vue'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  inquiry: {
    type: Object,
    default: null
  },
  processing: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  },
  alreadyReported: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'submit'])

const reason = ref('')

function formatDate(dateString) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function close() {
  reason.value = ''
  emit('close')
}

function submit() {
  emit('submit', { 
    inquiryId: props.inquiry?.id, 
    reason: reason.value 
  })
}
</script>

<style scoped>
.spam-report-modal {
  max-width: 560px;
}

.spam-report-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.warning-box {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-warning-subtle);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-md);
  color: var(--color-warning);
}

.warning-box i {
  flex-shrink: 0;
  font-size: 20px;
}

.warning-box p {
  margin: 0;
  font-size: var(--font-size-sm);
}

.inquiry-preview h4 {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.preview-card {
  padding: var(--spacing-md);
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.preview-date {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.preview-message {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.form-group label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.form-input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  background: var(--color-surface);
  color: var(--color-text-primary);
  resize: vertical;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.char-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  text-align: right;
}

.alert {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.alert-error {
  background: var(--color-error-subtle);
  color: var(--color-error);
  border: 1px solid var(--color-error);
}

.alert-info {
  background: var(--color-info-subtle);
  color: var(--color-info);
  border: 1px solid var(--color-info);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.btn-danger {
  background: var(--color-error);
  color: var(--color-error-text);
}

.btn-danger:hover:not(:disabled) {
  background: var(--color-error-hover);
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border-color: var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-surface-hover);
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
