<template>
  <Card class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-xl font-semibold">{{ $t('auth.reset.title') }}</h1>
      <p class="text-sm" style="color: var(--text-secondary);">{{ $t('auth.reset.description') }}</p>
    </header>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <Input
        :label="$t('auth.reset.newPassword')"
        type="password"
        v-model="password"
        :error="fieldError('new_password')"
        required
        autocomplete="new-password"
      />
      <Input
        :label="$t('auth.reset.confirmPassword')"
        type="password"
        v-model="confirm"
        :error="fieldError('new_password_confirm')"
        required
        autocomplete="new-password"
      />
      <p v-if="success" class="text-sm" style="color: var(--accent);">{{ $t('auth.reset.success') }}</p>

      <Button class="w-full" type="submit" :disabled="loading">
        <span v-if="loading">{{ $t('auth.reset.loading') }}</span>
        <span v-else>{{ $t('auth.reset.submit') }}</span>
      </Button>
    </form>

    <RouterLink to="/auth/login" class="block text-center text-sm hover:underline" style="color: var(--accent);">
      {{ $t('auth.reset.backToLogin') }}
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
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import authApi from '../api/authApi'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Input from '../../../ui/Input.vue'
import OnboardingModal from '../../onboarding/components/widgets/OnboardingModal.vue'

const route = useRoute()
const token = computed(() => (typeof route.query?.token === 'string' ? route.query.token : ''))

const password = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

const fieldMessages = ref(null)
const showErrorModal = ref(false)

watch(
  () => error.value,
  (value) => {
    showErrorModal.value = Boolean(value)
  }
)

function fieldError(field) {
  const map = fieldMessages.value
  if (!map || typeof map !== 'object') return ''
  const list = map[field]
  if (!Array.isArray(list) || list.length === 0) return ''
  return String(list[0])
}

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

  if (status === 422 && data && typeof data === 'object') {
    fieldMessages.value = data.field_messages && typeof data.field_messages === 'object' ? data.field_messages : null
    const summary = Array.isArray(data.summary) ? data.summary : null
    if (summary && summary.length > 0) return withRequestId(String(summary[0]))
    const msg = data.message
    return withRequestId(typeof msg === 'string' && msg.trim().length > 0 ? msg : 'Перевірте дані.')
  }

  if (data && typeof data === 'object') {
    const msg = data.message || data.detail
    if (typeof msg === 'string' && msg.trim().length > 0) return withRequestId(msg)
  }

  return withRequestId('Тимчасова помилка. Спробуйте пізніше.')
}

async function onSubmit() {
  error.value = ''
  success.value = ''
  fieldMessages.value = null

  if (!token.value) {
    error.value = 'Відсутній токен для скидання пароля.'
    return
  }

  if (password.value !== confirm.value) {
    error.value = 'Паролі не співпадають.'
    return
  }

  loading.value = true
  try {
    await authApi.resetPassword({ token: token.value, new_password: password.value, new_password_confirm: confirm.value })
    success.value = 'ok'
  } catch (err) {
    error.value = formatError(err)
  } finally {
    loading.value = false
  }
}
</script>
