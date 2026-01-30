<template>
  <OnboardingModal
    :show="show"
    :title="$t('auth.mfa.setup.title')"
    :closable="!loading"
    @close="handleClose"
  >
    <div class="space-y-6">
      <div v-if="step === 'qr'" class="space-y-4">
        <p class="text-sm text-muted-foreground">
          {{ $t('auth.mfa.setup.description') }}
        </p>

        <div v-if="qrSvg" class="rounded-lg border bg-white p-4 text-center" v-html="qrSvg" />

        <div v-if="secretHint" class="space-y-2">
          <p class="text-sm font-medium">{{ $t('auth.mfa.setup.secretLabel') }}</p>
          <code class="block rounded border bg-muted px-3 py-2 text-sm">{{ secretHint }}</code>
        </div>

        <div v-if="backupCodes.length" class="space-y-2">
          <p class="text-sm font-semibold text-foreground">{{ $t('auth.mfa.setup.backupCodesTitle') }}</p>
          <p class="text-sm text-muted-foreground">{{ $t('auth.mfa.setup.backupCodesDescription') }}</p>
          <div class="grid gap-2 sm:grid-cols-2">
            <code v-for="code in backupCodes" :key="code" class="rounded border bg-muted px-3 py-2 text-sm">
              {{ code }}
            </code>
          </div>
          <Button variant="outline" size="sm" @click="downloadBackupCodes">
            {{ $t('auth.mfa.setup.downloadCodes') }}
          </Button>
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
import OnboardingModal from '@/modules/onboarding/components/widgets/OnboardingModal.vue'
import Button from '@/ui/Button.vue'
import Input from '@/ui/Input.vue'
import mfaApi from '@/api/mfa'
import { logAuthEvent, AUTH_EVENTS } from '@/utils/telemetry/authEvents'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const { t } = useI18n()

const loading = ref(false)
const error = ref('')
const step = ref<'qr' | 'success'>('qr')
const qrSvg = ref('')
const secretHint = ref('')
const backupCodes = ref<string[]>([])
const otp = ref('')
const otpError = ref('')

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
    const res = await mfaApi.setup({ method: 'totp' })
    qrSvg.value = res.qr_svg || ''
    secretHint.value = res.secret_hint || ''
    backupCodes.value = Array.isArray(res.backup_codes) ? res.backup_codes : []
    step.value = 'qr'
    logAuthEvent({
      event: AUTH_EVENTS.MFA_SETUP_STARTED,
    })
  } catch (err: any) {
    error.value = err?.response?.data?.message || t('auth.mfa.setup.errors.initFailed')
  } finally {
    loading.value = false
  }
}

async function handleConfirm() {
  loading.value = true
  error.value = ''
  otpError.value = ''
  
  try {
    await mfaApi.confirm({ otp: otp.value })
    step.value = 'success'
    logAuthEvent({
      event: AUTH_EVENTS.MFA_SETUP_COMPLETED,
    })
    emit('success')
  } catch (err: any) {
    const code = err?.response?.data?.code
    logAuthEvent({
      event: AUTH_EVENTS.MFA_CHALLENGE_FAILED,
      errorCode: code,
      errorMessage: err?.response?.data?.message,
    })
    if (code === 'mfa_invalid_code') {
      otpError.value = t('auth.mfa.setup.errors.invalidCode')
    } else {
      error.value = err?.response?.data?.message || t('auth.mfa.setup.errors.confirmFailed')
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
</script>
