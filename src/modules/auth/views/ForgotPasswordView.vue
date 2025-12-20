<template>
  <Card class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-xl font-semibold">{{ $t('auth.forgot.title') }}</h1>
      <p class="text-sm" style="color: var(--text-secondary);">{{ $t('auth.forgot.description') }}</p>
    </header>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <Input
        :label="$t('auth.forgot.email')"
        type="email"
        v-model="email"
        required
        autocomplete="email"
      />

      <p v-if="message" class="text-sm" style="color: var(--accent);">{{ $t('auth.forgot.success') }}</p>

      <Button class="w-full" type="submit" :disabled="loading">
        <span v-if="loading">{{ $t('auth.forgot.loading') }}</span>
        <span v-else>{{ $t('auth.forgot.submit') }}</span>
      </Button>
    </form>

    <RouterLink to="/auth/login" class="block text-center text-sm hover:underline" style="color: var(--accent);">
      {{ $t('auth.forgot.backToLogin') }}
    </RouterLink>
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
import { ref, watch } from 'vue'
import authApi from '../api/authApi'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Input from '../../../ui/Input.vue'
import OnboardingModal from '../../onboarding/components/widgets/OnboardingModal.vue'

const email = ref('')
const loading = ref(false)
const error = ref('')
const message = ref('')

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

async function onSubmit() {
  error.value = ''
  message.value = ''
  loading.value = true
  try {
    await authApi.requestPasswordReset({ email: email.value })
    message.value = 'ok'
  } catch (err) {
    error.value = formatError(err)
  } finally {
    loading.value = false
  }
}
</script>
