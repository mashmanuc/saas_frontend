<template>
  <Card class="space-y-6">
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

      <Button class="w-full" type="submit" :disabled="auth.loading">
        <span v-if="auth.loading">{{ $t('auth.login.loading') }}</span>
        <span v-else>{{ $t('auth.login.submit') }}</span>
      </Button>
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
      <RouterLink to="/auth/register" class="hover:underline font-medium" style="color: var(--accent);">
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

  <WebAuthnPrompt
    :show="showWebAuthnPrompt"
    :on-authenticate="handleWebAuthnAuthenticate"
    :on-fallback-to-otp="handleWebAuthnFallback"
    :on-cancel="handleWebAuthnCancel"
  />
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../store/authStore'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Input from '../../../ui/Input.vue'
import { getDefaultRouteForRole } from '../../../config/routes'
import OnboardingModal from '../../onboarding/components/widgets/OnboardingModal.vue'
import WebAuthnPrompt from '../components/WebAuthnPrompt.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const form = reactive({
  email: '',
  password: '',
})

const step = ref('password')
const otp = ref('')
const showWebAuthnPrompt = ref(false)

const showResendVerify = computed(() => auth.lastErrorCode === 'email_not_verified' && Boolean(form.email))

const showErrorModal = ref(false)

watch(
  () => [auth.error, auth.lastErrorCode],
  ([value, code]) => {
    showErrorModal.value = Boolean(value) && code !== 'validation_failed' && code !== 'mfa_invalid_code' && code !== 'session_expired'
  }
)

function fieldError(field) {
  const map = auth.lastFieldMessages
  if (!map || typeof map !== 'object') return ''
  const list = map[field]
  if (!Array.isArray(list) || list.length === 0) return ''
  return String(list[0])
}

function goToCheckEmail() {
  router.push({ name: 'auth-check-email', query: { email: form.email } })
}

async function onSubmit() {
  try {
    const res = await auth.login(form)
    if (res && typeof res === 'object' && res.webauthn_required) {
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
    const target = typeof redirect === 'string' && redirect ? redirect : getDefaultRouteForRole(user?.role)
    router.push(target)
  } catch (error) {
    // помилка вже відображається через auth.error
  }
}

async function onSubmitOtp() {
  try {
    const user = await auth.verifyMfa(otp.value)
    const redirect = route.query?.redirect
    const target = typeof redirect === 'string' && redirect ? redirect : getDefaultRouteForRole(user?.role)
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

async function handleWebAuthnAuthenticate() {
  try {
    // Тут має бути виклик navigator.credentials.get() для отримання assertion
    // Поки що заглушка, бо WebAuthn API потребує реального credential
    const mockAssertion = {
      credential_id: 'mock_credential',
      client_data_json: 'mock_client_data',
      authenticator_data: 'mock_auth_data',
      signature: 'mock_signature',
      user_handle: 'mock_handle'
    }
    const user = await auth.verifyWebAuthn(mockAssertion)
    showWebAuthnPrompt.value = false
    const redirect = route.query?.redirect
    const target = typeof redirect === 'string' && redirect ? redirect : getDefaultRouteForRole(user?.role)
    router.push(target)
  } catch (error) {
    // помилка вже відображається через auth.error
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
</script>
