<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click="handleClose">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <div class="header-icon">
            <AlertTriangle :size="24" />
          </div>
          <h2>{{ $t(`operator.actions.${action}.title`) }}</h2>
        </div>

        <div class="modal-body">
          <p class="description">
            {{ $t(`operator.actions.${action}.description`) }}
          </p>

          <div class="warning-box">
            <AlertTriangle :size="18" />
            <p>{{ $t(`operator.actions.${action}.warning`) }}</p>
          </div>

          <div class="risks-section">
            <h3 class="risks-title">{{ $t('operator.actions.risks') }}</h3>
            <ul class="risks-list">
              <li v-for="(risk, index) in risks" :key="index">{{ risk }}</li>
            </ul>
          </div>

          <div class="confirmation-checkbox">
            <input
              type="checkbox"
              id="confirm-risks"
              v-model="confirmedRisks"
            />
            <label for="confirm-risks">
              {{ $t('operator.actions.confirmRisks') }}
            </label>
          </div>

          <div v-if="error" class="error-box">
            <AlertCircle :size="18" />
            <div>
              <p>{{ error }}</p>
              <p v-if="requestId" class="request-id">Request ID: {{ requestId }}</p>
            </div>
          </div>

          <div v-if="success" class="success-box">
            <p>{{ success }}</p>
            <p v-if="requestId" class="request-id">Request ID: {{ requestId }}</p>
          </div>
        </div>

        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="executing"
            @click="handleClose"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            type="button"
            class="btn btn-danger"
            :disabled="!confirmedRisks || executing"
            @click="handleExecute"
          >
            {{ executing ? $t('common.executing') : $t('operator.actions.execute') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, AlertCircle } from 'lucide-vue-next'
import operatorApi from '../api/operatorApi'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  action: {
    type: String,
    required: true,
  },
  payload: {
    type: Object,
    default: () => ({}),
  },
  onExecute: {
    type: Function,
    default: null,
  },
  onClose: {
    type: Function,
    default: null,
  },
})

const { t } = useI18n()

const confirmedRisks = ref(false)
const executing = ref(false)
const error = ref('')
const success = ref('')
const requestId = ref('')

const risks = computed(() => {
  const riskKey = `operator.actions.${props.action}.risks`
  const risksText = t(riskKey)
  
  if (risksText === riskKey) return []
  
  return risksText.split('|').filter(r => r.trim())
})

function generateIdempotencyKey() {
  return `op_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

async function handleExecute() {
  if (!confirmedRisks.value || executing.value) return
  
  executing.value = true
  error.value = ''
  success.value = ''
  requestId.value = ''
  
  try {
    const idempotencyKey = generateIdempotencyKey()
    const result = await operatorApi.executeAction(props.action, props.payload, idempotencyKey)
    
    requestId.value = result?.request_id || ''
    success.value = t('operator.actions.executeSuccess')
    
    setTimeout(() => {
      handleClose()
    }, 2000)
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('operator.actions.executeError')
    requestId.value = err?.response?.data?.request_id || ''
  } finally {
    executing.value = false
  }
}

function handleClose() {
  if (executing.value) return
  
  confirmedRisks.value = false
  error.value = ''
  success.value = ''
  requestId.value = ''
  
  if (props.onClose) props.onClose()
}

watch(() => props.show, (newVal) => {
  if (!newVal) {
    confirmedRisks.value = false
    error.value = ''
    success.value = ''
    requestId.value = ''
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
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
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: var(--danger-bg, #fee2e2);
  color: var(--danger, #dc2626);
  border-radius: 50%;
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
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

.warning-box {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: var(--radius-md, 8px);
  font-size: 0.875rem;
  background: var(--warning-bg, #fef3c7);
  color: var(--warning, #f59e0b);
  border: 1px solid var(--warning-border, #fcd34d);
}

.warning-box p {
  margin: 0;
  flex: 1;
}

.risks-section {
  padding: 1rem;
  background: var(--surface-secondary);
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-color);
}

.risks-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.75rem 0;
}

.risks-list {
  margin: 0;
  padding-left: 1.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.risks-list li {
  margin: 0.5rem 0;
  line-height: 1.5;
}

.confirmation-checkbox {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--surface-secondary);
  border-radius: var(--radius-md, 8px);
  border: 2px solid var(--border-color);
}

.confirmation-checkbox input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.confirmation-checkbox label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
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

.success-box {
  padding: 0.75rem;
  border-radius: var(--radius-md, 8px);
  font-size: 0.875rem;
  background: var(--success-bg, #d1fae5);
  color: var(--success, #059669);
  border: 1px solid var(--success-border, #6ee7b7);
}

.success-box p {
  margin: 0;
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
  justify-content: flex-end;
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

.btn-secondary {
  background: var(--surface-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--surface-hover);
}

.btn-danger {
  background: var(--danger, #dc2626);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: var(--danger-hover, #b91c1c);
}

.btn:disabled {
  opacity: 0.5;
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
