<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click="handleClose">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ $t('marketplace.draft.mergeConfirmTitle') }}</h2>
          <button type="button" class="close-btn" @click="handleClose">×</button>
        </div>

        <div class="modal-body">
          <p class="description">
            {{ $t('marketplace.draft.mergeConfirmDescription') }}
          </p>

          <div v-if="mergedFields && mergedFields.length" class="merged-summary">
            <h3 class="summary-title">{{ $t('marketplace.draft.mergedChanges') }}</h3>
            <div class="changes-list">
              <div v-for="field in mergedFields" :key="field.name" class="change-item">
                <div class="field-name">{{ field.name }}</div>
                <div class="field-change">
                  <span class="old-value">{{ formatValue(field.oldValue) }}</span>
                  <span class="arrow">→</span>
                  <span class="new-value">{{ formatValue(field.newValue) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="error" class="error-box">
            <AlertCircle :size="18" />
            <div>
              <p>{{ error }}</p>
              <p v-if="requestId" class="request-id">Request ID: {{ requestId }}</p>
              <button type="button" class="btn btn-sm btn-ghost" @click="handleRetry" :disabled="loading">
                {{ $t('common.retry') }}
              </button>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" @click="handleRollback" :disabled="loading">
            {{ $t('marketplace.draft.rollback') }}
          </button>
          <div class="footer-actions">
            <button type="button" class="btn btn-secondary" @click="handleClose" :disabled="loading">
              {{ $t('common.cancel') }}
            </button>
            <button type="button" class="btn btn-primary" @click="handleConfirm" :disabled="loading">
              {{ loading ? $t('common.saving') : $t('marketplace.draft.confirmMerge') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertCircle } from 'lucide-vue-next'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  mergedFields: {
    type: Array,
    default: () => [],
  },
  onConfirm: {
    type: Function,
    default: () => {},
  },
  onRollback: {
    type: Function,
    default: () => {},
  },
  onClose: {
    type: Function,
    default: () => {},
  },
})

const { t } = useI18n()

const loading = ref(false)
const error = ref('')
const requestId = ref('')

function formatValue(value) {
  if (value === null || value === undefined) return '(empty)'
  if (typeof value === 'string') return value.length > 50 ? value.substring(0, 50) + '...' : value
  if (Array.isArray(value)) return `[${value.length} items]`
  if (typeof value === 'object') return '{...}'
  return String(value)
}

async function handleConfirm() {
  loading.value = true
  error.value = ''
  requestId.value = ''
  
  try {
    const result = await props.onConfirm()
    requestId.value = result?.request_id || ''
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('marketplace.draft.confirmError')
    requestId.value = err?.response?.data?.request_id || ''
  } finally {
    loading.value = false
  }
}

async function handleRetry() {
  await handleConfirm()
}

async function handleRollback() {
  if (!confirm(t('marketplace.draft.rollbackConfirm'))) return
  
  loading.value = true
  error.value = ''
  requestId.value = ''
  
  try {
    const result = await props.onRollback()
    requestId.value = result?.request_id || ''
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('marketplace.draft.rollbackError')
    requestId.value = err?.response?.data?.request_id || ''
  } finally {
    loading.value = false
  }
}

function handleClose() {
  if (loading.value) return
  if (props.onClose) props.onClose()
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
  padding: 1rem;
}

.modal-content {
  background: var(--surface-card);
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm, 4px);
}

.close-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.description {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}

.merged-summary {
  padding: 1rem;
  background: var(--surface-secondary);
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-color);
}

.summary-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem 0;
}

.changes-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.change-item {
  padding: 0.75rem;
  background: var(--surface-card);
  border-radius: var(--radius-sm, 4px);
  border: 1px solid var(--border-color);
}

.field-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.field-change {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
}

.old-value {
  color: var(--danger, #dc2626);
  text-decoration: line-through;
  opacity: 0.7;
}

.arrow {
  color: var(--text-secondary);
  font-weight: 600;
}

.new-value {
  color: var(--success, #059669);
  font-weight: 500;
}

.error-box {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: var(--radius-md, 8px);
  font-size: 0.875rem;
  background: var(--danger-bg, #fee2e2);
  color: var(--danger, #dc2626);
  border: 1px solid var(--danger-border, #fca5a5);
}

.error-box p {
  margin: 0;
  flex: 1;
}

.request-id {
  font-size: 0.75rem;
  opacity: 0.8;
  margin-top: 0.25rem;
  font-family: monospace;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.footer-actions {
  display: flex;
  gap: 0.75rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  text-decoration: underline;
}

.btn-ghost:hover:not(:disabled) {
  color: var(--text-primary);
}

.btn-secondary {
  background: var(--surface-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--surface-hover);
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.3s ease;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95);
}
</style>
