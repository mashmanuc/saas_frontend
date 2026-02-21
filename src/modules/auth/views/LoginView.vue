<template>
  <Card class="space-y-6">
    <div v-if="auth.isAccountLocked && auth.lockedUntil" class="rounded-lg border border-red-300 bg-red-50 p-4">
      <p class="text-sm font-semibold text-red-800">{{ $t('auth.login.accountLocked') }}</p>
      <p class="text-sm text-red-700 mt-1">{{ $t('auth.login.lockedUntil', { until: formatLockedUntil(auth.lockedUntil) }) }}</p>
      <Button variant="outline" size="sm" class="mt-3" @click="showUnlockModal = true">
        {{ $t('auth.login.requestUnlock') }}
      </Button>
    </div>

    <header class="space-y-1">
      <h1 class="text-xl font-semibold">{{ step === 'otp' ? $t('auth.login.otpTitle') : $t('auth.login.title') }}</h1>
      <p class="text-sm" style="color: var(--text-secondary);">
        {{ step === 'otp' ? $t('auth.login.otpDescription') : $t('auth.login.description') }}
      </p>
    </header>

    <form v-if="step === 'password'" class="space-y-4" @submit.prevent="onSubmit">
      <Input
        :label="$t('auth.login.email')"
        type="email"
        v-model="form.email"
        :error="fieldError('email')"
        required
        autocomplete="email"
        data-testid="login-email-input"
      />

      <Input
        :label="$t('auth.login.password')"
        type="password"
        v-model="form.password"
        :error="fieldError('password')"
        required
        autocomplete="current-password"
        data-testid="login-password-input"
      />

      <RouterLink
        to="/auth/forgot-password"
        class="block text-sm hover:underline"
        style="color: var(--accent);"
      >
        {{ $t('auth.login.forgotPassword') }}
      </RouterLink>

      <button
        v-if="showResendVerify"
        type="button"
        class="block text-left text-sm hover:underline"
        style="color: var(--accent);"
        @click="goToCheckEmail"
      >
        {{ $t('auth.login.resendVerifyCta') }}
      </button>

      <Button
        class="w-full"
        type="submit"
        :disabled="auth.loading"
        data-testid="login-submit-button"
      >
        <span v-if="auth.loading">{{ $t('auth.login.loading') }}</span>
        <span v-else>{{ $t('auth.login.submit') }}</span>
      </Button>

      <p
        v-if="inlineErrorMessage"
        class="text-sm"
        style="color: var(--danger, #d92d20);"
        data-testid="login-inline-error"
      >
        {{ inlineErrorMessage }}
      </p>
    </form>

    <form v-else class="space-y-4" @submit.prevent="onSubmitOtp">
      <Input
        :label="$t('auth.login.otpLabel')"
        type="text"
        v-model="otp"
        :error="fieldError('otp')"
        required
        autocomplete="one-time-code"
        inputmode="numeric"
        data-testid="login-otp-input"
      />

      <div class="flex items-center justify-between gap-3">
        <Button variant="ghost" type="button" :disabled="auth.loading" @click="backToPassword">
          {{ $t('auth.login.otpBack') }}
        </Button>
        <Button variant="outline" type="button" :disabled="auth.loading" @click="resendOtp">
          {{ $t('auth.login.otpResend') }}
        </Button>
      </div>

      <Button class="w-full" type="submit" :disabled="auth.loading">
        <span v-if="auth.loading">{{ $t('auth.login.otpLoading') }}</span>
        <span v-else>{{ $t('auth.login.otpSubmit') }}</span>
      </Button>
    </form>

    <p class="text-center text-sm" style="color: var(--text-secondary);">
      {{ $t('auth.login.noAccount') }}
      <RouterLink :to="registerLink" class="hover:underline font-medium" style="color: var(--accent);">
        {{ $t('auth.login.registerLink') }}
      </RouterLink>
    </p>
  </Card>

  <OnboardingModal
    :show="showErrorModal"
    :title="$t('errors.http.serverError')"
    closable
    @close="showErrorModal = false"
  >
    <p class="text-sm" style="color: var(--text-primary);">
      {{ auth.error }}
    </p>

    <template #footer>
      <Button @click="showErrorModal = false">OK</Button>
    </template>
  </OnboardingModal>

  <UnlockConfirmModal
    :show="showUnlockModal"
    @close="showUnlockModal = false"
    @success="handleUnlockSuccess"
  />

  <WebAuthnPrompt
    :show="showWebAuthnPrompt"
    :challenge="auth.webAuthnChallenge"
    :on-success="handleWebAuthnSuccess"
    :on-fallback-to-otp="handleWebAuthnFallback"
    :on-cancel="handleWebAuthnCancel"
  />
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../store/authStore'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Input from '../../../ui/Input.vue'
import { getDefaultRouteForRole } from '../../../config/routes'
import OnboardingModal from '../../onboarding/components/widgets/OnboardingModal.vue'
import WebAuthnPrompt from '../components/WebAuthnPrompt.vue'
import UnlockConfirmModal from '../components/UnlockConfirmModal.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const { t } = useI18n()

const form = reactive({
  email: '',
  password: '',
})

const step = ref('password')
const otp = ref('')
const showWebAuthnPrompt = ref(false)
const showUnlockModal = ref(false)

// v0.82.0: Локальна валідація перед запитом
const validationErrors = reactive({
  email: '',
  password: '',
})

const showResendVerify = computed(() => auth.lastErrorCode === 'email_not_verified' && Boolean(form.email))

const registerLink = computed(() => {
  const roleParam = route.query.role
  if (roleParam === 'student' || roleParam === 'tutor') {
    return `/auth/register?role=${roleParam}`
  }
  return '/auth/register'
})

const modalSuppressedErrors = new Set([
  'invalid_credentials',
  'email_not_verified',
  'rate_limited',
])

const inlineErrorMessage = computed(() => {
  switch (auth.lastErrorCode) {
    case 'invalid_credentials':
      return t('auth.login.errors.invalidCredentials')
    case 'rate_limited':
      return t('auth.login.errors.rateLimited')
    case 'email_not_verified':
      return t('auth.login.errors.invalidCredentials')
    default:
      return auth.lastErrorCode ? t('auth.login.errors.unknown') : ''
  }
})

const showErrorModal = ref(false)

watch(
  () => [auth.error, auth.lastErrorCode],
  ([value, code]) => {
    const suppressed = modalSuppressedErrors.has(code)
    showErrorModal.value = Boolean(value) && code !== 'validation_failed' && code !== 'mfa_invalid_code' && code !== 'session_expired' && !suppressed
  }
)

function fieldError(field) {
  // v0.82.0: Пріоритет локальної валідації над серверною
  if (validationErrors[field]) {
    return validationErrors[field]
  }
  
  // Серверні помилки (якщо є)
  const map = auth.lastFieldMessages
  if (!map || typeof map !== 'object') return ''
  const list = map[field]
  if (!Array.isArray(list) || list.length === 0) return ''
  return String(list[0])
}

function validateForm() {
  // v0.82.0: Валідація перед запитом згідно з ТЗ
  let isValid = true
  
  validationErrors.email = ''
  validationErrors.password = ''
  
  if (!form.email || !form.email.trim()) {
    validationErrors.email = t('auth.login.errors.requiredEmail')
    isValid = false
  }
  
  if (!form.password || !form.password.trim()) {
    validationErrors.password = t('auth.login.errors.requiredPassword')
    isValid = false
  }
  
  return isValid
}

function goToCheckEmail() {
  router.push({ name: 'auth-check-email', query: { email: form.email } })
}

async function onSubmit() {
  // v0.82.0: Валідація перед запитом
  if (!validateForm()) {
    return
  }
  
  // Очищаємо локальні помилки валідації перед запитом
  validationErrors.email = ''
  validationErrors.password = ''
  
  try {
    const res = await auth.login(form)
    if (res && typeof res === 'object' && res.webauthn_required) {
      await auth.loadWebAuthnChallenge()
      showWebAuthnPrompt.value = true
      return
    }
    if (res && typeof res === 'object' && res.mfa_required) {
      step.value = 'otp'
      otp.value = ''
      return
    }

    const user = res
    const redirect = route.query?.redirect
    // v0.88.4: Redirect визначається через role (SSOT: config/routes.js)
    let target
    // Ignore Solo v2 redirects - always go to dashboard first
    const isSoloV2Redirect = redirect && typeof redirect === 'string' && redirect.includes('/solo-v2')
    if (redirect && typeof redirect === 'string' && !isSoloV2Redirect) {
      target = redirect
    } else {
      target = getDefaultRouteForRole(user?.role)
    }
    router.push(target)
  } catch (error) {
    // v0.82.0: Помилка вже відображається через auth.error
    // auth.loading автоматично скидається в finally блоці authStore.login
  }
}

async function onSubmitOtp() {
  try {
    const user = await auth.verifyMfa(otp.value)
    const redirect = route.query?.redirect
    // v0.88.4: Redirect визначається через role (SSOT: config/routes.js)
    let target
    // Ignore Solo v2 redirects - always go to dashboard first
    const isSoloV2Redirect = redirect && typeof redirect === 'string' && redirect.includes('/solo-v2')
    if (redirect && typeof redirect === 'string' && !isSoloV2Redirect) {
      target = redirect
    } else {
      target = getDefaultRouteForRole(user?.role)
    }
    router.push(target)
  } catch (error) {
    // помилка вже відображається через auth.error
  }
}

function backToPassword() {
  step.value = 'password'
  otp.value = ''
  auth.pendingMfaSessionId = null
}

async function resendOtp() {
  // Повторний login за тими ж credentials може створити нову MFA-сесію / відправити OTP повторно
  try {
    const res = await auth.login(form)
    if (res && typeof res === 'object' && res.mfa_required) {
      otp.value = ''
    }
  } catch (_error) {
    // помилка вже відображається через auth.error
  }
}

async function handleWebAuthnSuccess(credential) {
  try {
    const user = await auth.verifyWebAuthn(credential)
    showWebAuthnPrompt.value = false
    const redirect = route.query?.redirect
    // v0.88.4: Redirect визначається через role (SSOT: config/routes.js)
    let target
    // Ignore Solo v2 redirects - always go to dashboard first
    const isSoloV2Redirect = redirect && typeof redirect === 'string' && redirect.includes('/solo-v2')
    if (redirect && typeof redirect === 'string' && !isSoloV2Redirect) {
      target = redirect
    } else {
      target = getDefaultRouteForRole(user?.role)
    }
    router.push(target)
  } catch (error) {
    throw error
  }
}

function handleWebAuthnFallback() {
  showWebAuthnPrompt.value = false
  step.value = 'otp'
  otp.value = ''
}

function handleWebAuthnCancel() {
  showWebAuthnPrompt.value = false
  auth.pendingWebAuthnSessionId = null
}

function handleUnlockSuccess() {
  showUnlockModal.value = false
  auth.lockedUntil = null
  auth.lastErrorCode = null
}

function formatLockedUntil(dateString) {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    return date.toLocaleString()
  } catch {
    return dateString
  }
}
</script>
