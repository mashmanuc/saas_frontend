<template>
  <Card class="space-y-4">
    <div class="space-y-2">
      <p class="text-sm font-semibold text-foreground">{{ $t('auth.mfa.status.title') }}</p>
      <p class="text-sm text-muted-foreground">{{ $t('auth.mfa.status.subtitle') }}</p>
    </div>

    <div v-if="mfaEnabled" class="space-y-4">
      <div class="rounded-lg border border-green-300 bg-green-50 p-4">
        <p class="text-sm font-medium text-green-800">{{ $t('auth.mfa.status.enabled') }}</p>
        <p v-if="enabledAt" class="text-xs text-green-600 mt-1">
          {{ $t('auth.mfa.status.enabledAt', { date: formatDate(enabledAt) }) }}
        </p>
        <p v-if="backupCodesRemaining !== null" class="text-xs mt-1" :class="backupCodesRemaining === 0 ? 'text-red-600 font-semibold' : 'text-green-600'">
          {{ $t('auth.mfa.status.backupCodesRemaining', { count: backupCodesRemaining }) }}
          <span v-if="backupCodesRemaining === 0">{{ $t('auth.mfa.status.noCodesWarning') }}</span>
        </p>
      </div>

      <div v-if="showDisableInput" class="space-y-3 p-3 border rounded-lg bg-slate-50">
        <Input
          v-model="disableOtp"
          :label="$t('auth.mfa.status.otpLabel')"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="8"
          :placeholder="$t('auth.mfa.status.otpPlaceholder')"
        />
        <div class="flex gap-2">
          <Button @click="confirmDisable" :loading="loading" variant="destructive" size="sm">
            {{ $t('auth.mfa.status.confirmDisable') }}
          </Button>
          <Button variant="outline" @click="cancelDisable" size="sm">
            {{ $t('common.cancel') }}
          </Button>
        </div>
      </div>

      <div v-else class="flex flex-wrap gap-2">
        <Button variant="outline" :disabled="loading" @click="startDisable">
          {{ $t('auth.mfa.status.disable') }}
        </Button>
        <Button variant="outline" size="sm" @click="showBackupCodesModal = true">
          {{ $t('auth.mfa.status.viewBackupCodes') }}
        </Button>
      </div>

      <div class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p class="font-semibold">
          {{ $t('auth.mfa.status.backupCodesInfoTitle') }}
        </p>
        <p class="mt-1">
          {{ $t('auth.mfa.status.backupCodesInfoDescription') }}
        </p>
      </div>

      <BackupCodesModal :show="showBackupCodesModal" @close="showBackupCodesModal = false" />
    </div>

    <div v-else class="space-y-4">
      <div class="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
        <p class="text-sm font-medium text-yellow-800">{{ $t('auth.mfa.status.disabled') }}</p>
      </div>

      <Button variant="primary" :disabled="loading" @click="handleEnable">
        {{ $t('auth.mfa.status.enable') }}
      </Button>
    </div>

    <div v-if="error" class="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
      {{ error }}
    </div>

    <div v-if="success" class="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
      {{ success }}
    </div>

    <MFASetupModal
      :show="showSetupModal"
      @close="showSetupModal = false"
      @success="handleSetupSuccess"
    />

  </Card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import Input from '@/ui/Input.vue'
import MFASetupModal from './MFASetupModal.vue'
import BackupCodesModal from './BackupCodesModal.vue'
import mfaApi from '@/api/mfa'
import authApi from '../api/authApi'
import { logAuthEvent, AUTH_EVENTS } from '@/utils/telemetry/authEvents'

const { t } = useI18n()

const loading = ref(false)
const error = ref('')
const success = ref('')
const mfaEnabled = ref(false)
const enabledAt = ref<string | null>(null)
const backupCodesRemaining = ref<number | null>(null)
const showSetupModal = ref(false)
const showBackupCodesModal = ref(false)
const showDisableInput = ref(false)
const disableOtp = ref('')

onMounted(() => {
  checkMfaStatus()
})

async function checkMfaStatus() {
  try {
    const res = await authApi.getMfaStatus()
    mfaEnabled.value = res?.enabled || false
    enabledAt.value = res?.enabled_at || null
    backupCodesRemaining.value = res?.backup_codes_remaining ?? null
  } catch (err: any) {
    if (err?.response?.status === 404) {
      mfaEnabled.value = false
    }
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
}

function handleEnable() {
  showSetupModal.value = true
}

function startDisable() {
  if (!confirm(t('auth.mfa.status.disableConfirm'))) return
  showDisableInput.value = true
  disableOtp.value = ''
}

function cancelDisable() {
  showDisableInput.value = false
  disableOtp.value = ''
}

async function confirmDisable() {
  const otp = disableOtp.value.trim()
  if (!otp) {
    error.value = t('auth.mfa.status.errors.otpRequired')
    return
  }

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    await authApi.disableMfa({ otp })
    mfaEnabled.value = false
    enabledAt.value = null
    backupCodesRemaining.value = null
    success.value = t('auth.mfa.status.disableSuccess')
    showDisableInput.value = false
    disableOtp.value = ''
    logAuthEvent({
      event: AUTH_EVENTS.MFA_DISABLED,
    })
  } catch (err: any) {
    const errorCode = err?.response?.data?.error
    if (errorCode === 'mfa_invalid_code') {
      error.value = t('auth.mfa.status.errors.invalidOtpCode')
    } else if (errorCode === 'mfa_not_enabled') {
      error.value = t('auth.mfa.status.errors.mfaNotEnabled')
    } else {
      error.value = err?.response?.data?.detail || t('auth.mfa.status.errors.disableFailed')
    }
  } finally {
    loading.value = false
  }
}

function handleSetupSuccess() {
  mfaEnabled.value = true
  success.value = t('auth.mfa.status.enableSuccess')
  showSetupModal.value = false
}
</script>
