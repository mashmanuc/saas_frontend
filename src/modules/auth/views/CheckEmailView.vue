<template>
  <Card class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-xl font-semibold">{{ $t('auth.checkEmail.title') }}</h1>
      <p class="text-sm" style="color: var(--text-secondary);">
        {{ $t('auth.checkEmail.description') }}
      </p>
    </header>

    <div class="space-y-3">
      <p v-if="email" class="text-sm" style="color: var(--text-secondary);">
        {{ $t('auth.checkEmail.sentTo') }}
        <span class="font-medium" style="color: var(--text-primary);">{{ email }}</span>
      </p>

      <!-- Перший лист від нового відправника часто падає в «Спам» — новачок чекав і йшов. -->
      <p class="text-sm" style="color: var(--text-secondary);" data-testid="check-email-spam-hint">
        {{ $t('auth.checkEmail.spamHint') }}
      </p>

      <p v-if="success" class="text-sm" style="color: var(--accent);">{{ $t('auth.checkEmail.success') }}</p>

      <Button class="w-full" :disabled="loading" @click="resend">
        <span v-if="loading">{{ $t('auth.checkEmail.resendLoading') }}</span>
        <span v-else>{{ $t('auth.checkEmail.resend') }}</span>
      </Button>

      <RouterLink :to="loginLink" class="block text-center text-sm hover:underline" style="color: var(--accent);">
        {{ $t('auth.checkEmail.backToLogin') }}
      </RouterLink>
    </div>
  </Card>

  <OnboardingModal
    :show="showErrorModal"
    :title="$t('errors.http.serverError')"
    closable
    @close="showErrorModal = false"
  >
    <p class="text-sm" style="color: var(--text-primary);">
      {{ error }}
    </p>

    <template #footer>
      <Button @click="showErrorModal = false">OK</Button>
    </template>
  </OnboardingModal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import authApi from '../api/authApi'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import OnboardingModal from '@/modules/auth/components/OnboardingModal.vue'
import { getCanonicalOrigin } from '@/utils/canonicalOrigin'

const { t } = useI18n()
const route = useRoute()
const email = computed(() => (typeof route.query?.email === 'string' ? route.query.email : ''))
const accountType = computed(() => (typeof route.query?.account_type === 'string' ? route.query.account_type : 'student'))

// Б-154: куди людина йшла, коли почала реєстрацію (?redirect передає RegisterTutorView). Лише
// внутрішні шляхи — захист від open-redirect, як у RegisterTutorView. Без нього — як і було: для
// тьютора роль-дім `/tutor` (легасі `/tutor/profile` лише редіректить туди ж).
const returnTo = computed(() => {
  const target = route.query?.redirect
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : ''
})
const loginLink = computed(() =>
  returnTo.value ? `/auth/login?redirect=${encodeURIComponent(returnTo.value)}` : '/auth/login')

const loading = ref(false)
const error = ref('')
const success = ref('')

const showErrorModal = ref(false)

watch(
  () => error.value,
  (value) => {
    showErrorModal.value = Boolean(value)
  }
)

const formatError = (err) => {
  const status = err?.response?.status
  const data = err?.response?.data
  const requestId = data && typeof data === 'object' ? data.request_id : null
  const withRequestId = (msg) => (requestId ? `${msg} (request_id: ${requestId})` : msg)

  if (status === 429) {
    const retryAfter = err?.response?.headers?.['retry-after']
    return withRequestId(
      retryAfter ? t('auth.requestErrors.tooManyRetryIn', { seconds: retryAfter }) : t('auth.requestErrors.tooMany')
    )
  }

  if (data && typeof data === 'object') {
    const msg = data.message || data.detail
    if (typeof msg === 'string' && msg.trim().length > 0) return withRequestId(msg)
    const fieldMessages = data.field_messages
    if (fieldMessages && typeof fieldMessages === 'object') {
      const firstKey = Object.keys(fieldMessages)[0]
      const firstVal = firstKey ? fieldMessages[firstKey] : null
      if (Array.isArray(firstVal) && firstVal.length) return withRequestId(String(firstVal[0]))
    }
  }

  return withRequestId(t('auth.requestErrors.temporary'))
}

async function resend() {
  error.value = ''
  success.value = ''

  if (!email.value) {
    error.value = t('auth.checkEmail.noEmail')
    return
  }

  loading.value = true
  try {
    const origin = getCanonicalOrigin()
    const redirect = returnTo.value || (accountType.value === 'tutor' ? '/tutor' : '')
    const redirectQuery = redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''
    const verify_url = origin ? `${origin}/auth/verify-email?token={token}${redirectQuery}` : undefined

    await authApi.resendVerifyEmail({ email: email.value, verify_url })
    success.value = 'ok'
  } catch (err) {
    error.value = formatError(err)
  } finally {
    loading.value = false
  }
}
</script>
