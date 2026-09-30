<template>
  <Card class="space-y-5 text-center">
    <p v-if="loading" class="text-sm" style="color: var(--text-secondary);">
      {{ $t('auth.verifyEmail.loading') }}
    </p>

    <template v-else>
      <!-- Б-113: повторний клік по листу — не помилка, а спокійне «вже підтверджено» -->
      <div v-if="outcome === 'ok' || outcome === 'already_verified'" class="space-y-3" data-testid="verify-ok">
        <div class="verify-mark" aria-hidden="true">✓</div>
        <h1 class="text-xl font-semibold">
          {{ outcome === 'already_verified' ? $t('auth.verifyEmail.alreadyVerified') : $t('auth.verifyEmail.success') }}
        </h1>
      </div>

      <!-- Б-113: застаріле або невірне посилання — новий лист одразу тут (адреси в посиланні немає) -->
      <form v-else-if="outcome === 'link_expired'" class="space-y-3 text-left" data-testid="verify-expired" @submit.prevent="resend">
        <h1 class="text-xl font-semibold text-center">{{ $t('auth.verifyEmail.linkExpired') }}</h1>
        <Input
          v-model="resendEmail"
          :label="$t('auth.login.email')"
          type="email"
          required
          autocomplete="email"
          data-testid="verify-resend-email"
        />
        <Button class="w-full" type="submit" :disabled="resending || !resendEmail.trim()" data-testid="verify-resend-submit">
          {{ resending ? $t('auth.checkEmail.resendLoading') : $t('auth.login.resendVerifyCta') }}
        </Button>
        <p v-if="resent" class="text-sm text-center" style="color: var(--accent);" data-testid="verify-resend-done">
          {{ $t('auth.checkEmail.success') }}
        </p>
        <p v-if="resendError" class="text-sm text-center" style="color: var(--danger, #d92d20);" data-testid="verify-resend-error">
          {{ resendError }}
        </p>
      </form>

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
import { useI18n } from 'vue-i18n'
import authApi from '../api/authApi'
import { useAuthStore } from '../store/authStore'
import Card from '../../../ui/Card.vue'
import Button from '../../../ui/Button.vue'
import Input from '../../../ui/Input.vue'
import OnboardingModal from '@/modules/auth/components/OnboardingModal.vue'
import { getCanonicalOrigin } from '@/utils/canonicalOrigin'

const { t } = useI18n()
const route = useRoute()

const loginLink = computed(() => {
  const redirect = typeof route.query?.redirect === 'string' ? route.query.redirect : ''
  return redirect ? `/auth/login?redirect=${encodeURIComponent(redirect)}` : '/auth/login'
})

const loading = ref(true)
const error = ref('')
// Б-113: чим закінчилось підтвердження. 'error' — лише справжня помилка (вікно, як і раніше).
const outcome = ref('ok')
const resendEmail = ref('')
const resending = ref(false)
const resent = ref(false)
const resendError = ref('')

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

onMounted(async () => {
  const token = typeof route.query?.token === 'string' ? route.query.token : ''
  if (!token) {
    error.value = t('auth.verifyEmail.noToken')
    loading.value = false
    return
  }

  try {
    await authApi.verifyEmail({ token })
  } catch (err) {
    // Бекенд розрізняє «вже підтверджено» і «посилання застаріле/невірне» (V1AuthVerifyEmailView) —
    // це не помилки сервера, тож без вікна «Помилка сервера».
    const code = errorCode(err)
    if (code === 'already_verified') outcome.value = 'already_verified'
    else if (code === 'invalid_token') outcome.value = 'link_expired'
    else {
      outcome.value = 'error'
      error.value = formatError(err)
    }
  } finally {
    loading.value = false
  }
})

/** Код помилки з відповіді: пласка форма `{ error: 'code' }` або вкладена `{ error: { code } }`. */
function errorCode(err) {
  const data = err?.response?.data
  if (!data || typeof data !== 'object') return ''
  if (typeof data.error === 'string') return data.error
  const nested = data.error && typeof data.error === 'object' ? data.error : null
  return String(data.code || nested?.code || '').toLowerCase()
}

async function resend() {
  if (resending.value || !resendEmail.value.trim()) return
  resending.value = true
  resent.value = false
  resendError.value = ''
  try {
    // Той самий лист, що й зі сторінки «Перевірте пошту»; redirect з цього посилання — у новий лист.
    const origin = getCanonicalOrigin()
    const redirect = typeof route.query?.redirect === 'string' ? route.query.redirect : ''
    const redirectQuery = redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''
    const verify_url = origin ? `${origin}/auth/verify-email?token={token}${redirectQuery}` : undefined
    // Сюди приходять зі старого листа, часто в новому браузері: CSRF-куки ще немає, а
    // resend-verify-email без неї відповідає 422 (verify-email і скидання пароля — без CSRF).
    await useAuthStore().ensureCsrfToken()
    await authApi.resendVerifyEmail({ email: resendEmail.value.trim(), verify_url })
    resent.value = true
  } catch (err) {
    resendError.value = formatError(err)
  } finally {
    resending.value = false
  }
}
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
