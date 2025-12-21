<template>
  <div class="space-y-6">
    <Card class="space-y-2">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading :level="1">{{ $t('profile.security.title') }}</Heading>
          <p class="text-sm text-muted-foreground">{{ $t('profile.security.subtitle') }}</p>
        </div>
        <Button variant="outline" size="sm" @click="goBack">
          {{ $t('profile.actions.cancel') }}
        </Button>
      </div>
    </Card>

    <Card
      v-if="error"
      class="border-red-200 bg-red-50 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
    >
      {{ error }}
    </Card>

    <Card
      v-if="success"
      class="border-green-200 bg-green-50 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200"
      data-testid="sessions-success"
    >
      {{ success }}
    </Card>

    <Card class="space-y-6">
      <div class="space-y-2">
        <p class="text-sm font-semibold text-foreground">{{ $t('profile.security.mfa.title') }}</p>
        <p class="text-sm text-muted-foreground">{{ $t('profile.security.mfa.subtitle') }}</p>
      </div>

      <div v-if="step === 'idle'" class="space-y-4">
        <Button variant="primary" :disabled="loading" :loading="loading" @click="startSetup">
          {{ $t('profile.security.mfa.start') }}
        </Button>
        <Button variant="outline" :disabled="loading" @click="showBackupCodes = true">
          {{ $t('profile.security.mfa.viewBackupCodes') }}
        </Button>
      </div>

      <div v-else-if="step === 'setup'" class="space-y-6">
        <div class="space-y-2">
          <p class="text-sm font-semibold text-foreground">{{ $t('profile.security.mfa.qrTitle') }}</p>
          <p class="text-sm text-muted-foreground">{{ $t('profile.security.mfa.qrSubtitle') }}</p>
        </div>

        <div v-if="qrSvg" class="rounded-lg border bg-white p-4 text-center" v-html="qrSvg" />

        <div v-if="secretHint" class="text-sm text-muted-foreground">
          {{ $t('profile.security.mfa.secretHintLabel') }}: <span class="font-medium text-foreground">{{ secretHint }}</span>
        </div>

        <div v-if="backupCodes.length" class="space-y-2">
          <p class="text-sm font-semibold text-foreground">{{ $t('profile.security.mfa.backupCodesTitle') }}</p>
          <p class="text-sm text-muted-foreground">{{ $t('profile.security.mfa.backupCodesSubtitle') }}</p>
          <div class="grid gap-2 sm:grid-cols-2">
            <code v-for="code in backupCodes" :key="code" class="rounded border bg-muted px-3 py-2 text-sm">
              {{ code }}
            </code>
          </div>
        </div>

        <form class="space-y-4" @submit.prevent="confirmSetup">
          <Input
            :label="$t('profile.security.mfa.otpLabel')"
            v-model="otp"
            :disabled="loading"
            required
            inputmode="numeric"
            autocomplete="one-time-code"
          />
          <div class="flex flex-wrap gap-2">
            <Button variant="primary" type="submit" :disabled="loading" :loading="loading">
              {{ $t('profile.security.mfa.confirm') }}
            </Button>
            <Button variant="outline" type="button" :disabled="loading" @click="reset">
              {{ $t('profile.security.mfa.cancel') }}
            </Button>
          </div>
        </form>
      </div>

      <div v-else class="space-y-4">
        <Button variant="outline" type="button" @click="reset">
          {{ $t('profile.security.mfa.reset') }}
        </Button>
      </div>
    </Card>

    <Card class="space-y-6">
      <div class="space-y-2">
        <p class="text-sm font-semibold text-foreground">{{ $t('profile.security.webauthn.title') }}</p>
        <p class="text-sm text-muted-foreground">{{ $t('profile.security.webauthn.subtitle') }}</p>
      </div>

      <div class="space-y-4">
        <Button variant="primary" :disabled="loading" @click="showWebAuthnEnroll = true">
          {{ $t('profile.security.webauthn.enrollCta') }}
        </Button>

        <div v-if="webauthnCredentials.length" class="space-y-3">
          <p class="text-sm font-medium text-foreground">{{ $t('profile.security.webauthn.credentialsList') }}</p>
          <div
            v-for="cred in webauthnCredentials"
            :key="cred.id"
            class="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4"
          >
            <div class="space-y-1">
              <p class="text-sm font-medium text-foreground">{{ cred.device_label || $t('profile.security.webauthn.unknownDevice') }}</p>
              <p class="text-sm text-muted-foreground">{{ $t('profile.security.webauthn.lastUsed') }}: {{ formatDateTime(cred.last_used_at) }}</p>
              <p class="text-xs text-muted-foreground">Created: {{ formatDateTime(cred.created_at) }}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              type="button" 
              :disabled="loading || credentialRevokeId === cred.id"
              :data-testid="`webauthn-revoke-${cred.id}`"
              @click="revokeCredential(cred.id)"
            >
              {{ $t('profile.security.webauthn.remove') }}
            </Button>
          </div>
        </div>
      </div>
    </Card>

    <Card class="space-y-4">
      <div class="space-y-1">
        <p class="text-sm font-semibold text-foreground">{{ $t('profile.security.sessions.title') }}</p>
        <p class="text-sm text-muted-foreground">{{ $t('profile.security.sessions.subtitle') }}</p>
      </div>

      <div v-if="sessionsLoading" class="text-sm text-muted-foreground">
        {{ $t('profile.security.sessions.loading') }}
      </div>

      <div v-else-if="sessions.length === 0" class="text-sm text-muted-foreground">
        {{ $t('profile.security.sessions.empty') }}
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="s in sessions"
          :key="s.id"
          class="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4"
        >
          <div class="space-y-1">
            <p class="text-sm font-medium text-foreground">
              {{ s.device || $t('profile.security.sessions.unknownDevice') }}
              <span v-if="s.current" class="ml-2 rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {{ $t('profile.security.sessions.current') }}
              </span>
            </p>
            <p class="text-sm text-muted-foreground">
              {{ $t('profile.security.sessions.ip') }}: {{ s.ip || '-' }}
            </p>
            <p class="text-sm text-muted-foreground">
              {{ $t('profile.security.sessions.lastActive') }}: {{ formatDateTime(s.last_active_at) }}
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              :disabled="sessionsLoading || s.current"
              :loading="revokeLoadingId === s.id"
              :data-testid="`session-revoke-${s.id}`"
              @click="revoke(s.id)"
            >
              {{ $t('profile.security.sessions.revoke') }}
            </Button>
          </div>
        </div>
      </div>
    </Card>

    <WebAuthnEnrollModal
      :show="showWebAuthnEnroll"
      :on-close="() => showWebAuthnEnroll = false"
      :on-enroll="handleWebAuthnEnroll"
    />

    <BackupCodesModal
      :show="showBackupCodes"
      :on-close="() => showBackupCodes = false"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Heading from '../../../ui/Heading.vue'
import Input from '../../../ui/Input.vue'
import authApi from '../../auth/api/authApi'
import WebAuthnEnrollModal from '../../auth/components/WebAuthnEnrollModal.vue'
import BackupCodesModal from '../../auth/components/BackupCodesModal.vue'

const router = useRouter()
const { t } = useI18n()

const loading = ref(false)
const error = ref('')
const success = ref('')

const step = ref('idle')
const qrSvg = ref('')
const secretHint = ref('')
const backupCodes = ref([])
const otp = ref('')

const sessionsLoading = ref(false)
const sessions = ref([])
const revokeLoadingId = ref(null)

const showWebAuthnEnroll = ref(false)
const webauthnCredentials = ref([])
const credentialRevokeId = ref(null)
const showBackupCodes = ref(false)

function goBack() {
  router.push('/dashboard/profile')
}

async function loadWebAuthnCredentials() {
  try {
    const res = await authApi.getWebAuthnCredentials()
    webauthnCredentials.value = Array.isArray(res) ? res : []
  } catch (err) {
    console.error('Failed to load WebAuthn credentials', err)
  }
}

async function revokeCredential(credentialId) {
  if (!confirm(t('profile.security.webauthn.removeConfirm'))) return
  
  credentialRevokeId.value = credentialId
  try {
    await authApi.revokeWebAuthnCredential(credentialId)
    await loadWebAuthnCredentials()
    success.value = t('profile.security.webauthn.removeSuccess')
  } catch (err) {
    error.value = err?.response?.data?.message || t('profile.security.webauthn.removeError')
  } finally {
    credentialRevokeId.value = null
  }
}

function reset() {
  loading.value = false
  error.value = ''
  success.value = ''
  step.value = 'idle'
  qrSvg.value = ''
  secretHint.value = ''
  backupCodes.value = []
  otp.value = ''
}

async function startSetup() {
  error.value = ''
  success.value = ''
  loading.value = true
  try {
    const res = await authApi.mfaSetup({ method: 'totp' })
    qrSvg.value = res?.qr_svg || ''
    secretHint.value = res?.secret_hint || ''
    backupCodes.value = Array.isArray(res?.backup_codes) ? res.backup_codes : []
    step.value = 'setup'
  } catch (err) {
    error.value = err?.response?.data?.message || err?.response?.data?.detail || t('profile.security.mfa.errors.setupFailed')
  } finally {
    loading.value = false
  }
}

async function confirmSetup() {
  error.value = ''
  success.value = ''
  loading.value = true
  try {
    await authApi.mfaConfirm({ otp: otp.value })
    success.value = t('profile.security.mfa.success.enabled')
    step.value = 'done'
  } catch (err) {
    error.value = err?.response?.data?.message || err?.response?.data?.detail || t('profile.security.mfa.errors.confirmFailed')
  } finally {
    loading.value = false
  }
}

function formatDateTime(value) {
  if (!value) return '-'
  try {
    const dt = new Date(value)
    if (Number.isNaN(dt.getTime())) return String(value)
    return dt.toLocaleString()
  } catch {
    return String(value)
  }
}

async function loadSessions() {
  sessionsLoading.value = true
  try {
    const res = await authApi.getSessions()
    sessions.value = Array.isArray(res) ? res : (Array.isArray(res?.results) ? res.results : [])
  } catch (err) {
    error.value = err?.response?.data?.message || err?.response?.data?.detail || t('profile.security.sessions.errors.loadFailed')
  } finally {
    sessionsLoading.value = false
  }
}

async function revoke(id) {
  if (!id) return
  error.value = ''
  success.value = ''
  revokeLoadingId.value = id
  try {
    await authApi.revokeSession(id)
    success.value = t('profile.security.sessions.success.revoked')
    await loadSessions()
  } catch (err) {
    const code = err?.response?.data?.code
    if (code === 'session_current_forbidden') {
      error.value = t('profile.security.sessions.errors.currentForbidden')
    } else if (code === 'session_not_found') {
      error.value = t('profile.security.sessions.errors.notFound')
    } else {
      error.value = err?.response?.data?.message || err?.response?.data?.detail || t('profile.security.sessions.errors.revokeFailed')
    }
  } finally {
    revokeLoadingId.value = null
  }
}

async function handleWebAuthnEnroll(registration) {
  error.value = ''
  success.value = ''
  loading.value = true
  try {
    await authApi.webauthnRegister(registration)
    await loadWebAuthnCredentials()
    showWebAuthnEnroll.value = false
    success.value = t('profile.security.webauthn.enrollSuccess')
  } catch (err) {
    error.value = err?.response?.data?.message || t('profile.security.webauthn.enrollError')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadSessions()
  loadWebAuthnCredentials()
})
</script>
