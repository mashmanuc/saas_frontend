<template>
  <Card class="space-y-4">
    <div class="space-y-2">
      <p class="text-sm font-semibold text-foreground">{{ $t('auth.mfa.status.title') }}</p>
      <p class="text-sm text-muted-foreground">{{ $t('auth.mfa.status.subtitle') }}</p>
    </div>

    <div v-if="mfaEnabled" class="space-y-4">
      <div class="rounded-lg border border-green-300 bg-green-50 p-4">
        <p class="text-sm font-medium text-green-800">{{ $t('auth.mfa.status.enabled') }}</p>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button variant="outline" :disabled="loading" @click="handleDisable">
          {{ $t('auth.mfa.status.disable') }}
        </Button>
        <Button variant="outline" :disabled="loading" @click="handleRegenerateCodes">
          {{ $t('auth.mfa.status.regenerateCodes') }}
        </Button>
        <Button variant="outline" :disabled="loading" @click="handleViewCodes">
          {{ $t('auth.mfa.status.viewCodes') }}
        </Button>
      </div>
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

    <BackupCodesModal
      :show="showBackupCodesModal"
      @close="showBackupCodesModal = false"
    />
  </Card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import MFASetupModal from './MFASetupModal.vue'
import BackupCodesModal from './BackupCodesModal.vue'
import mfaApi from '@/api/mfa'
import { logAuthEvent, AUTH_EVENTS } from '@/utils/telemetry/authEvents'

const { t } = useI18n()

const loading = ref(false)
const error = ref('')
const success = ref('')
const mfaEnabled = ref(false)
const showSetupModal = ref(false)
const showBackupCodesModal = ref(false)

onMounted(() => {
  checkMfaStatus()
})

async function checkMfaStatus() {
  try {
    const res = await mfaApi.getBackupCodes()
    mfaEnabled.value = Array.isArray(res.codes) && res.codes.length > 0
  } catch (err: any) {
    if (err?.response?.status === 404) {
      mfaEnabled.value = false
    }
  }
}

function handleEnable() {
  showSetupModal.value = true
}

async function handleDisable() {
  if (!confirm(t('auth.mfa.status.disableConfirm'))) return
  
  loading.value = true
  error.value = ''
  success.value = ''
  
  try {
    const password = prompt(t('auth.mfa.status.passwordPrompt'))
    if (!password) return
    
    await mfaApi.disable({ password })
    mfaEnabled.value = false
    success.value = t('auth.mfa.status.disableSuccess')
    logAuthEvent({
      event: AUTH_EVENTS.MFA_DISABLED,
    })
  } catch (err: any) {
    error.value = err?.response?.data?.message || t('auth.mfa.status.errors.disableFailed')
  } finally {
    loading.value = false
  }
}

async function handleRegenerateCodes() {
  if (!confirm(t('auth.mfa.status.regenerateConfirm'))) return
  
  loading.value = true
  error.value = ''
  success.value = ''
  
  try {
    await mfaApi.regenerateBackupCodes()
    success.value = t('auth.mfa.status.regenerateSuccess')
    showBackupCodesModal.value = true
    logAuthEvent({
      event: AUTH_EVENTS.MFA_BACKUP_CODES_REGENERATED,
    })
  } catch (err: any) {
    error.value = err?.response?.data?.message || t('auth.mfa.status.errors.regenerateFailed')
  } finally {
    loading.value = false
  }
}

function handleViewCodes() {
  showBackupCodesModal.value = true
}

function handleSetupSuccess() {
  mfaEnabled.value = true
  success.value = t('auth.mfa.status.enableSuccess')
  showSetupModal.value = false
}
</script>
