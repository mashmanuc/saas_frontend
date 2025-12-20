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

      <p v-if="success" class="text-sm" style="color: var(--accent);">{{ $t('auth.checkEmail.success') }}</p>

      <Button class="w-full" :disabled="loading" @click="resend">
        <span v-if="loading">{{ $t('auth.checkEmail.resendLoading') }}</span>
        <span v-else>{{ $t('auth.checkEmail.resend') }}</span>
      </Button>

      <RouterLink to="/auth/login" class="block text-center text-sm hover:underline" style="color: var(--accent);">
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
import authApi from '../api/authApi'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import OnboardingModal from '../../onboarding/components/widgets/OnboardingModal.vue'

const route = useRoute()
const email = computed(() => (typeof route.query?.email === 'string' ? route.query.email : ''))
const accountType = computed(() => (typeof route.query?.account_type === 'string' ? route.query.account_type : 'student'))

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
      retryAfter ? `Забагато запитів. Спробуйте через ${retryAfter}с.` : 'Забагато запитів. Спробуйте пізніше.'
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

  return withRequestId('Тимчасова помилка. Спробуйте пізніше.')
}

async function resend() {
  error.value = ''
  success.value = ''

  if (!email.value) {
    error.value = 'Email не вказано.'
    return
  }

  loading.value = true
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const redirect = accountType.value === 'tutor' ? '/marketplace/my-profile' : ''
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
