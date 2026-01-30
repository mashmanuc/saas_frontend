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

    <div v-if="error" class="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
      <p>{{ error }}</p>
      <p v-if="lastRequestId" class="mt-1 text-xs opacity-80">Request ID: {{ lastRequestId }}</p>
    </div>

    <div
      v-if="success"
      class="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800"
      data-testid="sessions-success"
    >
      <p>{{ success }}</p>
      <p v-if="lastRequestId" class="mt-1 text-xs opacity-80">Request ID: {{ lastRequestId }}</p>
    </div>

    <MFAStatusWidget />

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
import MFAStatusWidget from '../../auth/components/MFAStatusWidget.vue'

const router = useRouter()
const { t } = useI18n()

const loading = ref(false)
const error = ref('')
const success = ref('')

const sessionsLoading = ref(false)
const sessions = ref([])
const revokeLoadingId = ref(null)

const showWebAuthnEnroll = ref(false)
const webauthnCredentials = ref([])
const credentialRevokeId = ref(null)
const showBackupCodes = ref(false)
const lastRequestId = ref('')

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
  error.value = ''
  success.value = ''
  lastRequestId.value = ''
  
  try {
    const res = await authApi.revokeWebAuthnCredential(credentialId)
    await loadWebAuthnCredentials()
    success.value = t('profile.security.webauthn.removeSuccess')
    lastRequestId.value = res?.request_id || ''
  } catch (err) {
    error.value = err?.response?.data?.message || t('profile.security.webauthn.removeError')
    lastRequestId.value = err?.response?.data?.request_id || ''
  } finally {
    credentialRevokeId.value = null
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
