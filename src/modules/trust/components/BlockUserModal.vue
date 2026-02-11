<template>
  <Modal v-if="isOpen" @close="close" class="block-user-modal">
    <template #header>
      <h3>{{ $t('trust.block.title') }}</h3>
    </template>
    
    <template #body>
      <div class="block-content">
        <div class="user-preview">
          <div class="user-avatar">
            <img v-if="user?.avatar" :src="user.avatar" :alt="user.name" />
            <span v-else class="avatar-placeholder">{{ initials }}</span>
          </div>
          <div class="user-info">
            <h4 class="user-name">{{ user?.display_name || user?.full_name || user?.name || 'User' }}</h4>
            <p class="user-hint">{{ $t('trust.block.userHint') }}</p>
          </div>
        </div>
        
        <div class="form-group">
          <label for="block-reason">{{ $t('trust.block.reasonLabel') }}</label>
          <select id="block-reason" v-model="reason" class="form-select">
            <option value="">{{ $t('trust.block.reasons.select') }}</option>
            <option value="harassment">{{ $t('trust.block.reasons.harassment') }}</option>
            <option value="spam">{{ $t('trust.block.reasons.spam') }}</option>
            <option value="inappropriate">{{ $t('trust.block.reasons.inappropriate') }}</option>
            <option value="other">{{ $t('trust.block.reasons.other') }}</option>
          </select>
        </div>
        
        <div v-if="reason === 'other'" class="form-group">
          <label for="block-note">{{ $t('trust.block.noteLabel') }}</label>
          <textarea
            id="block-note"
            v-model="note"
            class="form-input"
            rows="2"
            :placeholder="$t('trust.block.notePlaceholder')"
          ></textarea>
        </div>
        
        <div class="warning-box">
          <i class="icon-info"></i>
          <p>{{ $t('trust.block.warning') }}</p>
        </div>
        
        <div v-if="error" class="alert alert-error">
          {{ error }}
        </div>
        
        <div v-if="alreadyBlocked" class="alert alert-info">
          {{ $t('trust.block.alreadyBlocked') }}
        </div>
      </div>
    </template>
    
    <template #footer>
      <div class="modal-actions">
        <button class="btn btn-secondary" @click="close">
          {{ $t('common.cancel') }}
        </button>
        <button
          class="btn btn-danger"
          :disabled="!canSubmit || processing || alreadyBlocked"
          @click="submit"
        >
          <span v-if="processing" class="spinner"></span>
          {{ $t('trust.block.submit') }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed } from 'vue'
import Modal from '@/components/ui/Modal.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  user: {
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
  alreadyBlocked: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'submit'])

const reason = ref('')
const note = ref('')

const initials = computed(() => {
  // Use display_name or full_name for initials calculation
  const name = props.user?.display_name || props.user?.full_name || props.user?.name || ''
  const parts = name.split(' ').filter(Boolean)
  const first = parts[0]?.charAt(0) || ''
  const last = parts[1]?.charAt(0) || ''
  return (first + last).toUpperCase()
})

const canSubmit = computed(() => {
  if (!reason.value) return false
  if (reason.value === 'other' && !note.value.trim()) return false
  return true
})

function close() {
  reason.value = ''
  note.value = ''
  emit('close')
}

function submit() {
  emit('submit', {
    userId: props.user?.id,
    reason: reason.value === 'other' ? note.value : reason.value
  })
}
</script>

<style scoped>
.block-user-modal {
  max-width: 480px;
}

.block-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.user-preview {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
}

.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.user-info {
  flex: 1;
}

.user-name {
  font-size: var(--font-size-base);
  font-weight: 600;
  margin: 0 0 var(--spacing-xs);
}

.user-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: 0;
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

.form-select,
.form-input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.form-select:focus,
.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.warning-box {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-info-subtle);
  border: 1px solid var(--color-info);
  border-radius: var(--radius-md);
  color: var(--color-info);
}

.warning-box i {
  flex-shrink: 0;
}

.warning-box p {
  margin: 0;
  font-size: var(--font-size-sm);
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
