<template>
  <Card class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-xl font-semibold">{{ $t('auth.verifyEmail.title') }}</h1>
      <p class="text-sm" style="color: var(--text-secondary);">
        {{ $t('auth.verifyEmail.description') }}
      </p>
    </header>

    <div v-if="loading" class="text-sm" style="color: var(--text-secondary);">
      {{ $t('auth.verifyEmail.loading') }}
    </div>

    <div v-else class="space-y-3">
      <p v-if="!error" class="text-sm" style="color: var(--accent);">{{ $t('auth.verifyEmail.success') }}</p>

      <RouterLink :to="loginLink" class="block text-center text-sm hover:underline" style="color: var(--accent);">
        {{ $t('auth.verifyEmail.loginCta') }}
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
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import authApi from '../api/authApi'
import Card from '../../../ui/Card.vue'
import Button from '../../../ui/Button.vue'
import OnboardingModal from '../../onboarding/components/widgets/OnboardingModal.vue'

const route = useRoute()

const loginLink = computed(() => {
  const redirect = typeof route.query?.redirect === 'string' ? route.query.redirect : ''
  return redirect ? `/auth/login?redirect=${encodeURIComponent(redirect)}` : '/auth/login'
})

const loading = ref(true)
const error = ref('')

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

onMounted(async () => {
  const token = typeof route.query?.token === 'string' ? route.query.token : ''
  if (!token) {
    error.value = 'Відсутній токен підтвердження.'
    loading.value = false
    return
  }

  try {
    await authApi.verifyEmail({ token })
  } catch (err) {
    error.value = formatError(err)
  } finally {
    loading.value = false
  }
})
</script>
