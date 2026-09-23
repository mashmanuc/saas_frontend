<template>
  <Card class="space-y-5 text-center">
    <p v-if="loading" class="text-sm" style="color: var(--text-secondary);">
      {{ $t('auth.verifyEmail.loading') }}
    </p>

    <template v-else>
      <div v-if="!error" class="space-y-3">
        <div class="verify-mark" aria-hidden="true">✓</div>
        <h1 class="text-xl font-semibold">{{ $t('auth.verifyEmail.success') }}</h1>
      </div>

      <!-- Єдина дія на екрані — кнопка на всю ширину, а не дрібне посилання,
           що губилося посеред порожнього поля (FIRST USER GATE 2026-09-23, крок 0). -->
      <RouterLink :to="loginLink" class="verify-login-btn">
        {{ $t('auth.verifyEmail.loginCta') }}
      </RouterLink>
    </template>
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
import OnboardingModal from '@/modules/auth/components/OnboardingModal.vue'

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

<style scoped>
.verify-mark {
  width: 48px;
  height: 48px;
  margin: 0 auto;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  line-height: 1;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.verify-login-btn {
  display: block;
  width: 100%;
  padding: 10px 16px;
  border-radius: 8px;
  background: var(--accent);
  color: var(--accent-contrast, #fff);
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
  transition: background 0.15s ease;
}

.verify-login-btn:hover {
  background: var(--accent-hover, var(--accent));
}
</style>
