<template>
  <Modal
    :open="show"
    :title="$t('profile.security.mfa.backupCodesTitle')"
    size="md"
    @close="handleClose"
  >
    <div class="space-y-4">
      <p class="description">
        {{ $t('profile.security.mfa.backupCodesSubtitle') }}
      </p>

      <div v-if="loading" class="loading-box">
        <Loader2 :size="24" class="animate-spin" />
        <p>{{ $t('common.loading') }}</p>
      </div>

      <div v-else-if="infoMessage" class="info-box">
        <AlertCircle :size="18" />
        <div>
          <p class="info-title">{{ $t('profile.security.mfa.backupCodesNotAvailable') }}</p>
          <p class="info-text">{{ infoMessage }}</p>
          <p v-if="requestId" class="request-id">Request ID: {{ requestId }}</p>
        </div>
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
          <Button variant="secondary" @click="downloadCodes">
            <template #iconLeft><Download :size="16" /></template>
            {{ $t('profile.security.mfa.downloadCodes') }}
          </Button>
          <Button variant="secondary" @click="copyCodes">
            <template #iconLeft><Copy :size="16" /></template>
            {{ $t('profile.security.mfa.copyCodes') }}
          </Button>
        </div>

        <div v-if="copied" class="success-message">
          {{ $t('profile.security.mfa.codesCopied') }}
        </div>
      </div>
    </div>

    <template #footer>
      <Button variant="ghost" @click="regenerateCodes" :disabled="loading">
        {{ $t('profile.security.mfa.regenerateCodes') }}
      </Button>
      <Button variant="primary" @click="handleClose">
        {{ $t('common.close') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, AlertCircle, Download, Copy } from 'lucide-vue-next'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
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
const infoMessage = ref('')
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
  infoMessage.value = ''
  requestId.value = ''
  copied.value = false
  
  try {
    // Request token first
    const tokenRes = await authApi.requestBackupCodesToken()
    const token = tokenRes?.download_token
    
    if (!token) {
      throw new Error('No token received')
    }
    
    // Get codes with token
    const res = await authApi.getBackupCodesWithToken(token)
    
    // Backend повертає тільки повідомлення, що коди були показані при setup
    // Показуємо це повідомлення як інформаційне, а не помилку
    if (res?.message) {
      infoMessage.value = res.message
      codes.value = []
    } else {
      codes.value = Array.isArray(res?.codes) ? res.codes : []
    }
  } catch (err) {
    error.value = err?.response?.data?.detail || err?.response?.data?.message || t('profile.security.mfa.errors.loadCodesFailed')
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
.description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}

.loading-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xl);
}

.loading-box p {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.error-box {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  background: color-mix(in srgb, var(--danger-bg) 15%, transparent);
  color: var(--danger-bg);
  border: 1px solid color-mix(in srgb, var(--danger-bg) 30%, transparent);
}

.error-box p {
  margin: 0;
  flex: 1;
}

.info-box {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-md);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  background: color-mix(in srgb, var(--info-bg) 15%, transparent);
  color: var(--info-bg);
  border: 1px solid color-mix(in srgb, var(--info-bg) 30%, transparent);
}

.info-box > div {
  flex: 1;
}

.info-title {
  font-weight: 600;
  margin: 0 0 var(--space-2xs) 0;
  font-size: var(--text-sm);
}

.info-text {
  margin: 0;
  line-height: 1.5;
}

.request-id {
  font-size: var(--text-xs);
  opacity: 0.8;
  margin-top: var(--space-2xs);
  font-family: monospace;
}

.codes-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.codes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-sm);
  padding: var(--space-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.code-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-sm);
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
  background: var(--card-bg);
  padding: var(--space-2xs) var(--space-xs);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.actions {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.success-message {
  padding: var(--space-sm);
  background: color-mix(in srgb, var(--success-bg) 15%, transparent);
  color: var(--success-bg);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  text-align: center;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
