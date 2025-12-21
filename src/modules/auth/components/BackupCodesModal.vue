<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click="handleClose">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ $t('profile.security.mfa.backupCodesTitle') }}</h2>
          <button type="button" class="close-btn" @click="handleClose">×</button>
        </div>

        <div class="modal-body">
          <p class="description">
            {{ $t('profile.security.mfa.backupCodesSubtitle') }}
          </p>

          <div v-if="loading" class="loading-box">
            <Loader2 :size="24" class="animate-spin" />
            <p>{{ $t('common.loading') }}</p>
          </div>

          <div v-else-if="error" class="error-box">
            <AlertCircle :size="18" />
            <div>
              <p>{{ error }}</p>
              <p v-if="requestId" class="request-id">Request ID: {{ requestId }}</p>
            </div>
          </div>

          <div v-else-if="codes.length" class="codes-container">
            <div class="codes-grid">
              <div v-for="(code, index) in codes" :key="index" class="code-item">
                <span class="code-number">{{ index + 1 }}.</span>
                <code class="code-value">{{ code }}</code>
              </div>
            </div>

            <div class="actions">
              <button type="button" class="btn btn-secondary" @click="downloadCodes">
                <Download :size="16" />
                {{ $t('profile.security.mfa.downloadCodes') }}
              </button>
              <button type="button" class="btn btn-secondary" @click="copyCodes">
                <Copy :size="16" />
                {{ $t('profile.security.mfa.copyCodes') }}
              </button>
            </div>

            <div v-if="copied" class="success-message">
              {{ $t('profile.security.mfa.codesCopied') }}
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" @click="regenerateCodes" :disabled="loading">
            {{ $t('profile.security.mfa.regenerateCodes') }}
          </button>
          <button type="button" class="btn btn-primary" @click="handleClose">
            {{ $t('common.close') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, AlertCircle, Download, Copy } from 'lucide-vue-next'
import authApi from '../api/authApi'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
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
const codes = ref([])
const copied = ref(false)

watch(() => props.show, async (newVal) => {
  if (newVal) {
    await loadCodes()
  }
})

async function loadCodes() {
  loading.value = true
  error.value = ''
  requestId.value = ''
  copied.value = false
  
  try {
    // Request token first
    const tokenRes = await authApi.requestBackupCodesToken()
    const token = tokenRes?.token
    
    if (!token) {
      throw new Error('No token received')
    }
    
    // Get codes with token
    const res = await authApi.getBackupCodesWithToken(token)
    codes.value = Array.isArray(res?.codes) ? res.codes : []
  } catch (err) {
    error.value = err?.response?.data?.message || t('profile.security.mfa.errors.loadCodesFailed')
    requestId.value = err?.response?.data?.request_id || ''
  } finally {
    loading.value = false
  }
}

async function regenerateCodes() {
  if (!confirm(t('profile.security.mfa.regenerateConfirm'))) return
  
  loading.value = true
  error.value = ''
  requestId.value = ''
  
  try {
    const res = await authApi.regenerateBackupCodes()
    codes.value = Array.isArray(res?.codes) ? res.codes : []
  } catch (err) {
    error.value = err?.response?.data?.message || t('profile.security.mfa.errors.regenerateFailed')
    requestId.value = err?.response?.data?.request_id || ''
  } finally {
    loading.value = false
  }
}

function downloadCodes() {
  const text = codes.value.map((code, i) => `${i + 1}. ${code}`).join('\n')
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `backup-codes-${Date.now()}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function copyCodes() {
  const text = codes.value.join('\n')
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 3000)
  } catch (err) {
    console.error('Failed to copy codes', err)
  }
}

function handleClose() {
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
  gap: 1rem;
}

.description {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}

.loading-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
}

.loading-box p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
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

.codes-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.codes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
  padding: 1rem;
  background: var(--surface-secondary);
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-color);
}

.code-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.code-number {
  color: var(--text-secondary);
  font-weight: 500;
  min-width: 1.5rem;
}

.code-value {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--surface-card);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm, 4px);
  border: 1px solid var(--border-color);
}

.actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.success-message {
  padding: 0.75rem;
  background: var(--success-bg, #d1fae5);
  color: var(--success, #059669);
  border-radius: var(--radius-md, 8px);
  font-size: 0.875rem;
  text-align: center;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
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

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
