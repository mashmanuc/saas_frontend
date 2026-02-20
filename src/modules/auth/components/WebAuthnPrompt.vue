<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Fingerprint, AlertCircle, Loader2 } from 'lucide-vue-next'
import { authenticateWithWebAuthn } from '@/utils/webauthn'
import type { WebAuthnChallenge } from '@/utils/webauthn'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'

const props = defineProps<{
  show: boolean
  challenge?: WebAuthnChallenge
  onSuccess?: (credential: any) => Promise<void>
  onFallbackToOtp?: () => void
  onCancel?: () => void
}>()

const { t } = useI18n()

const isAuthenticating = ref(false)
const error = ref('')
const requestId = ref('')

async function handleAuthenticate() {
  if (!props.challenge || !props.onSuccess) return
  
  isAuthenticating.value = true
  error.value = ''
  requestId.value = ''
  
  try {
    const credential = await authenticateWithWebAuthn(props.challenge)
    await props.onSuccess(credential)
  } catch (err: any) {
    const errorCode = err?.response?.data?.error || err?.error
    if (errorCode === 'webauthn_replay_detected') {
      error.value = t('auth.webauthn.errors.replayDetected')
    } else if (errorCode === 'webauthn_attestation_invalid') {
      error.value = t('auth.webauthn.errors.attestationInvalid')
    } else if (errorCode === 'webauthn_challenge_expired') {
      error.value = t('auth.webauthn.errors.challengeExpired')
    } else if (errorCode === 'webauthn_invalid_assertion') {
      error.value = t('auth.webauthn.errors.invalidAssertion')
    } else {
      error.value = err?.message || t('auth.webauthn.authError')
    }
    requestId.value = err?.response?.data?.request_id || err?.request_id || ''
  } finally {
    isAuthenticating.value = false
  }
}

function handleFallback() {
  if (isAuthenticating.value) return
  if (props.onFallbackToOtp) props.onFallbackToOtp()
}

function handleCancel() {
  if (isAuthenticating.value) return
  if (props.onCancel) props.onCancel()
}
</script>

<template>
  <Modal
    :open="show"
    size="sm"
    @close="handleCancel"
  >
    <template #header>
      <div class="header-column">
        <div class="header-icon">
          <Fingerprint :size="32" />
        </div>
        <h3 class="modal-title">{{ t('auth.webauthn.promptTitle') }}</h3>
        <span class="beta-badge">{{ t('auth.webauthn.betaLabel') }}</span>
      </div>
    </template>

    <div class="space-y-4">
      <p class="description">
        {{ t('auth.webauthn.promptDescription') }}
      </p>

      <div v-if="error" class="error-box">
        <AlertCircle :size="18" />
        <div>
          <p>{{ error }}</p>
          <p v-if="requestId" class="request-id">Request ID: {{ requestId }}</p>
        </div>
      </div>

      <div v-if="isAuthenticating" class="authenticating-box">
        <Loader2 :size="24" class="animate-spin" />
        <p>{{ t('auth.webauthn.authenticating') }}</p>
      </div>
    </div>

    <template #footer>
      <Button variant="ghost" :disabled="isAuthenticating" @click="handleFallback">
        {{ t('auth.webauthn.useOtpInstead') }}
      </Button>
      <Button variant="secondary" :disabled="isAuthenticating" @click="handleCancel">
        {{ t('common.cancel') }}
      </Button>
      <Button variant="primary" :disabled="isAuthenticating" :loading="isAuthenticating" @click="handleAuthenticate">
        <template v-if="!isAuthenticating" #iconLeft><Fingerprint :size="16" /></template>
        {{ isAuthenticating ? t('auth.webauthn.authenticating') : t('auth.webauthn.authenticate') }}
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
.header-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  text-align: center;
  flex: 1;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  border-radius: var(--radius-full);
}

.modal-title {
  font-size: var(--text-xl);
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.beta-badge {
  padding: var(--space-2xs) var(--space-xs);
  background: color-mix(in srgb, var(--warning-bg) 20%, transparent);
  color: var(--warning-bg);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
}

.description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
  text-align: center;
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

.request-id {
  font-size: var(--text-xs);
  opacity: 0.8;
  margin-top: var(--space-2xs);
  font-family: monospace;
}

.authenticating-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-lg);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.authenticating-box p {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
