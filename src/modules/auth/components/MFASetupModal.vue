<template>
  <OnboardingModal
    :show="show"
    :title="$t('auth.mfa.setup.title')"
    :closable="!loading"
    @close="handleClose"
  >
    <div class="space-y-6">
      <!-- Крок 1: QR код + OTP підтвердження -->
      <div v-if="step === 'qr'" class="space-y-4">
        <p class="text-sm text-muted-foreground">
          {{ $t('auth.mfa.setup.description') }}
        </p>

        <div v-if="qrSvg" class="rounded-lg border bg-white p-4 text-center" v-html="qrSvg" />

        <div v-if="secretHint" class="space-y-2">
          <p class="text-sm font-medium">{{ $t('auth.mfa.setup.secretLabel') }}</p>
          <code class="block rounded border bg-muted px-3 py-2 text-sm">{{ secretHint }}</code>
        </div>

        <form class="space-y-4" @submit.prevent="handleConfirm">
          <Input
            :label="$t('auth.mfa.setup.otpLabel')"
            v-model="otp"
            :disabled="loading"
            :error="otpError"
            required
            inputmode="numeric"
            autocomplete="one-time-code"
            data-testid="mfa-setup-otp-input"
          />
          <div class="flex flex-wrap gap-2">
            <Button variant="primary" type="submit" :disabled="loading" :loading="loading">
              {{ $t('auth.mfa.setup.confirm') }}
            </Button>
            <Button variant="outline" type="button" :disabled="loading" @click="handleClose">
              {{ $t('auth.mfa.setup.cancel') }}
            </Button>
          </div>
        </form>
      </div>

      <!-- Крок 2: Backup codes (тільки після підтвердження OTP) -->
      <div v-else-if="step === 'backup'" class="space-y-4">
        <div class="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p class="text-sm font-semibold text-amber-800">{{ $t('auth.mfa.setup.backupCodesTitle') }}</p>
          <p class="text-sm text-amber-700 mt-1">{{ $t('auth.mfa.setup.backupCodesDescription') }}</p>
        </div>

        <div v-if="backupCodes.length" class="space-y-3">
          <div class="grid gap-2 sm:grid-cols-2">
            <code v-for="code in backupCodes" :key="code" class="rounded border bg-muted px-3 py-2 text-sm font-mono">
              {{ code }}
            </code>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" @click="downloadBackupCodes">
              <template #iconLeft>
                <Download :size="16" />
              </template>
              {{ $t('auth.mfa.setup.downloadCodes') }}
            </Button>
            <Button variant="outline" size="sm" @click="copyBackupCodes">
              <template #iconLeft>
                <Copy :size="16" />
              </template>
              {{ $t('auth.mfa.setup.copyCodes') }}
            </Button>
          </div>

          <div class="flex items-start gap-2 pt-2">
            <input
              id="backup-codes-check"
              v-model="confirmedBackupCodes"
              type="checkbox"
              class="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label for="backup-codes-check" class="text-sm text-muted-foreground cursor-pointer">
              {{ $t('auth.mfa.setup.backupCodesConfirm') }}
            </label>
          </div>
        </div>

        <div class="flex flex-wrap gap-2 pt-2">
          <Button
            variant="primary"
            :disabled="!confirmedBackupCodes || loading"
            :loading="loading"
            @click="finishSetup"
          >
            {{ $t('auth.mfa.setup.finish') }}
          </Button>
        </div>
      </div>

      <!-- Крок 3: Успіх -->
      <div v-else-if="step === 'success'" class="space-y-4">
        <div class="rounded-lg border border-green-300 bg-green-50 p-4">
          <p class="text-sm text-green-800">{{ $t('auth.mfa.setup.successMessage') }}</p>
        </div>
        <Button variant="primary" @click="handleClose">
          {{ $t('auth.mfa.setup.close') }}
        </Button>
      </div>

      <div v-if="error" class="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
        {{ error }}
      </div>
    </div>
  </OnboardingModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Download, Copy } from 'lucide-vue-next'
import OnboardingModal from '@/modules/onboarding/components/widgets/OnboardingModal.vue'
import Button from '@/ui/Button.vue'
import Input from '@/ui/Input.vue'
import mfaApi from '@/api/mfa'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { logAuthEvent, AUTH_EVENTS } from '@/utils/telemetry/authEvents'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const { t } = useI18n()
const authStore = useAuthStore()

const loading = ref(false)
const error = ref('')
const step = ref<'qr' | 'backup' | 'success'>('qr')
const qrSvg = ref('')
const secretHint = ref('')
const backupCodes = ref<string[]>([])
const otp = ref('')
const otpError = ref('')
const confirmedBackupCodes = ref(false)

watch(() => props.show, async (newVal) => {
  if (newVal) {
    await initSetup()
  } else {
    reset()
  }
})

async function initSetup() {
  loading.value = true
  error.value = ''
  otpError.value = ''
  
  try {
    // Ensure CSRF token is present before making POST request
    await authStore.ensureCsrfToken()
    
    const res = await mfaApi.setup({ method: 'totp' })
    qrSvg.value = res.qr_svg || ''
    secretHint.value = res.secret_hint || ''
    backupCodes.value = Array.isArray(res.backup_codes) ? res.backup_codes : []
    step.value = 'qr'
    logAuthEvent({
      event: AUTH_EVENTS.MFA_SETUP_STARTED,
    })
  } catch (err: any) {
    const status = err?.response?.status
    const data = err?.response?.data
    const fields = data?.fields || data?.field_messages
    
    // CSRF token error — retry once after refreshing token
    if (status === 422 && fields?.csrf) {
      try {
        await authStore.ensureCsrfToken()
        const res = await mfaApi.setup({ method: 'totp' })
        qrSvg.value = res.qr_svg || ''
        secretHint.value = res.secret_hint || ''
        backupCodes.value = Array.isArray(res.backup_codes) ? res.backup_codes : []
        step.value = 'qr'
        logAuthEvent({ event: AUTH_EVENTS.MFA_SETUP_STARTED })
        return
      } catch (retryErr: any) {
        error.value = t('auth.mfa.setup.errors.csrfFailed')
        return
      }
    }
    
    // MFA already enabled
    if (status === 409 && data?.error === 'mfa_already_enabled') {
      error.value = t('auth.mfa.setup.errors.alreadyEnabled')
      return
    }
    
    // Session expired
    if (status === 401) {
      error.value = t('auth.mfa.setup.errors.sessionExpired')
      return
    }
    
    error.value = data?.message || data?.detail || t('auth.mfa.setup.errors.initFailed')
  } finally {
    loading.value = false
  }
}

async function handleConfirm() {
  error.value = ''
  otpError.value = ''

  if (!otp.value || !/^\d{6}$/.test(otp.value)) {
    otpError.value = t('auth.mfa.status.errors.invalidOtpFormat')
    return
  }

  loading.value = true

  try {
    await mfaApi.confirm({ otp: otp.value })
    // Після успішного підтвердження OTP → показуємо backup codes
    step.value = 'backup'
    logAuthEvent({
      event: AUTH_EVENTS.MFA_SETUP_COMPLETED,
    })
  } catch (err: any) {
    const errorCode = err?.response?.data?.error || err?.response?.data?.code
    logAuthEvent({
      event: AUTH_EVENTS.MFA_CHALLENGE_FAILED,
      errorCode: errorCode,
      errorMessage: err?.response?.data?.message || err?.response?.data?.detail,
    })
    if (errorCode === 'mfa_invalid_code') {
      otpError.value = t('auth.mfa.setup.errors.invalidCode')
    } else {
      error.value = err?.response?.data?.detail || err?.response?.data?.message || t('auth.mfa.setup.errors.confirmFailed')
    }
  } finally {
    loading.value = false
  }
}

function handleClose() {
  emit('close')
}

function reset() {
  step.value = 'qr'
  qrSvg.value = ''
  secretHint.value = ''
  backupCodes.value = []
  otp.value = ''
  error.value = ''
  otpError.value = ''
  confirmedBackupCodes.value = false
  loading.value = false
}

function downloadBackupCodes() {
  const text = backupCodes.value.join('\n')
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mfa-backup-codes.txt'
  a.click()
  URL.revokeObjectURL(url)
}

async function copyBackupCodes() {
  const text = backupCodes.value.join('\n')
  try {
    await navigator.clipboard.writeText(text)
  } catch (err) {
    console.error('Failed to copy backup codes', err)
  }
}

function finishSetup() {
  step.value = 'success'
  emit('success')
}
</script>
