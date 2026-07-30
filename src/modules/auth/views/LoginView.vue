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

    <!-- Google OAuth (PR 2 — Phase 2 rollout). Показуємо тільки на password step
         і тільки якщо VITE_GOOGLE_OAUTH_CLIENT_ID сконфігуровано. -->
    <div v-if="step === 'password' && googleEnabled" class="space-y-3">
      <div class="relative flex items-center" aria-hidden="true">
        <div class="flex-grow border-t" style="border-color: var(--border, #e5e7eb);" />
        <span class="mx-3 text-xs uppercase tracking-wider" style="color: var(--text-secondary);">
          {{ $t('auth.login.orContinueWith') }}
        </span>
        <div class="flex-grow border-t" style="border-color: var(--border, #e5e7eb);" />
      </div>
      <GoogleSignInButton
        mode="signin"
        @success="onGoogleSuccess"
        @error="onGoogleError"
      />
      <!-- Згода ДО кліку: новий Google-юзер створює акаунт одразу, без модалки,
           тож умови мають бути перед очима саме тут (email-форма має чекбокс). -->
      <p class="text-center text-xs" style="color: var(--text-secondary);">
        {{ $t('auth.oauth.consentPrefix') }}
        <RouterLink to="/legal/terms" target="_blank" class="hover:underline" style="color: var(--accent);">{{ $t('auth.register.termsLink') }}</RouterLink>
        {{ $t('auth.register.consentAnd') }}
        <RouterLink to="/legal/privacy" target="_blank" class="hover:underline" style="color: var(--accent);">{{ $t('auth.register.privacyPolicyLink') }}</RouterLink>
      </p>
      <p
        v-if="googleErrorMessage"
        class="text-sm"
        style="color: var(--danger, #d92d20);"
        data-testid="login-google-error"
      >
        {{ googleErrorMessage }}
      </p>
    </div>

    <!-- Explicit step check (бо v-else розривався Google-блоком вище) -->
    <form v-if="step === 'otp'" class="space-y-4" @submit.prevent="onSubmitOtp">
      <Input
        :label="isBackupCodeMode ? $t('auth.login.backupCodeLabel') : $t('auth.login.otpLabel')"
        type="text"
        v-model="otp"
        :error="fieldError('otp')"
        required
        autocomplete="one-time-code"
        :inputmode="isBackupCodeMode ? 'text' : 'numeric'"
        :maxlength="isBackupCodeMode ? 8 : 6"
        :placeholder="isBackupCodeMode ? $t('auth.login.backupCodePlaceholder') : $t('auth.login.otpPlaceholder')"
        data-testid="login-otp-input"
      />

      <div class="flex items-center justify-between text-sm">
        <button
          type="button"
          class="hover:underline"
          style="color: var(--accent);"
          @click="toggleBackupCodeMode"
        >
          {{ isBackupCodeMode ? $t('auth.login.useTotp') : $t('auth.login.useBackupCode') }}
        </button>
        <button
          type="button"
          class="hover:underline"
          style="color: var(--text-secondary);"
          @click="backToPassword"
        >
          {{ $t('auth.login.otpBack') }}
        </button>
      </div>

      <div class="text-center text-sm" style="color: var(--text-secondary);">
        {{ $t('auth.login.lostPhone') }}
        <a href="mailto:support@m4sh.org" style="color: var(--accent);" class="hover:underline">
          {{ $t('auth.login.contactSupport') }}
        </a>
      </div>

      <div class="flex items-center justify-between gap-3 pt-2">
        <Button variant="outline" type="button" :disabled="auth.loading" @click="resendOtp">
          {{ $t('auth.login.otpResend') }}
        </Button>
        <Button class="w-full" type="submit" :disabled="auth.loading">
          <span v-if="auth.loading">{{ $t('auth.login.otpLoading') }}</span>
          <span v-else>{{ $t('auth.login.otpSubmit') }}</span>
        </Button>
      </div>
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
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../store/authStore'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Input from '../../../ui/Input.vue'
import { getDefaultRouteForRole } from '../../../config/routes'
import OnboardingModal from '@/modules/auth/components/OnboardingModal.vue'
import WebAuthnPrompt from '../components/WebAuthnPrompt.vue'
import UnlockConfirmModal from '../components/UnlockConfirmModal.vue'
import GoogleSignInButton from '../components/GoogleSignInButton.vue'
import { activeLocale } from '@/utils/i18nDate'

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
const isBackupCodeMode = ref(false)
const showWebAuthnPrompt = ref(false)
const showUnlockModal = ref(false)
const googleErrorMessage = ref('')

// Staged registration state (INV-OAUTH-9 v1.4)

// Google OAuth доступний лише коли VITE_GOOGLE_OAUTH_CLIENT_ID сконфігуровано
// (Phase 2 rollout — без env var кнопку не показуємо).
const googleEnabled = computed(() => Boolean(import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID))

// v0.82.0: Локальна валідація перед запитом
const validationErrors = reactive({
  email: '',
  password: '',
})

// FIX: Показуємо повідомлення про закінчення сесії при завантаженні
onMounted(() => {
  const msg = sessionStorage.getItem('auth_message')
  if (msg === 'session_expired') {
    sessionStorage.removeItem('auth_message')
    auth.lastErrorCode = 'session_expired'
    auth.error = t('errors.api.sessionExpired')
  }
})

const showResendVerify = computed(() => auth.lastErrorCode === 'email_not_verified' && Boolean(form.email))

// 2026-07-23: раніше вело на лендінг (/start) — людина, що тиснула «Зареєструватися»,
// мусила шукати форму серед маркетингових секцій. Ведемо напряму на форму і
// зберігаємо ?redirect (інакше губиться шлях назад, напр. на /workspace).
// 2026-07-30: ?role=student більше не веде на відкриту реєстрацію учня —
// у BYO учень приходить лише за запрошенням тьютора. Завжди форма тьютора.
const registerLink = computed(() => {
  const redirect = route.query.redirect
  const query = typeof redirect === 'string' && redirect ? { redirect } : {}
  return { path: '/auth/register/tutor', query }
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

    router.push(resolvePostAuthTarget(res))
  } catch (error) {
    // v0.82.0: Помилка вже відображається через auth.error
    // auth.loading автоматично скидається в finally блоці authStore.login
  }
}

/**
 * Google sign-in success handler.
 * `res` може бути:
 *   - { registration_required: true, registration_token, claims_preview } — INV-OAUTH-9 v1.4
 *   - { mfa_required: true, session_id } — MFA flow
 *   - user object (звичайний login)
 */
async function onGoogleSuccess(res) {
  googleErrorMessage.value = ''

  // 2026-07-30: НОВИЙ юзер → створюємо акаунт тьютора ОДРАЗУ, без модалки.
  // Раніше тут відкривався RolePickerModal з вибором «учень/тьютор». Після
  // закриття шляху учня (BYO — учень лише за запрошенням) у ньому лишився
  // ОДИН варіант: діалог «Оберіть тип акаунта» з однією кнопкою = зайвий клік
  // і брехливий заголовок (знахідка власника на проді).
  // Згода: показується РЯДКОМ ПІД Google-кнопкою ДО кліку (email-форма має
  // свій чекбокс) — людина бачить умови перед дією, а не після.
  if (res && typeof res === 'object' && res.registration_required) {
    try {
      const user = await auth.completeGoogleRegistration(res.registration_token, 'tutor')
      router.push(resolvePostAuthTarget(user))
    } catch (e) {
      onGoogleError(e)
    }
    return
  }

  if (res && typeof res === 'object' && res.mfa_required) {
    step.value = 'otp'
    otp.value = ''
    return
  }
  router.push(resolvePostAuthTarget(res))
}

/**
 * Куди вести після успішної авторизації/реєстрації.
 * Шанує ?redirect (лише внутрішні шляхи — захист від open-redirect), інакше
 * роль-дім. Один хелпер на всі шляхи: пароль, Google-логін, Google-реєстрація —
 * щоб жоден із них більше не «губив» шлях назад (постмортем 2026-07-29).
 */
function resolvePostAuthTarget(user) {
  const redirect = route.query?.redirect
  if (
    typeof redirect === 'string' && redirect.startsWith('/') &&
    !redirect.startsWith('//') && !redirect.includes('/solo-v2')
  ) {
    return redirect
  }
  return getDefaultRouteForRole(user?.role)
}

/**
 * Google sign-in error handler. Mapping HTTP error → i18n key per §6.5 у плані.
 */
function onGoogleError(error) {
  const code = error?.response?.data?.error || error?.code || ''
  const status = error?.response?.status
  let key = 'auth.oauth.error.unknown'
  switch (code) {
    case 'invalid_id_token':
      key = 'auth.oauth.error.invalidToken'
      break
    case 'account_deactivated':
      key = 'auth.oauth.error.deactivated'
      break
    case 'account_exists_unverified':
      key = 'auth.oauth.error.emailUnverified'
      break
    case 'cross_provider_merge_forbidden':
      key = 'auth.oauth.error.crossProvider'
      break
    case 'google_verify_unavailable':
      key = 'auth.oauth.error.googleUnavailable'
      break
    default:
      if (status === 429) key = 'auth.oauth.error.throttled'
      else if (status === 503) key = 'auth.oauth.error.googleUnavailable'
      else if (error?.message === 'gis_load_failed') key = 'auth.oauth.error.scriptFailed'
  }
  googleErrorMessage.value = t(key)
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
  isBackupCodeMode.value = false
  auth.pendingMfaSessionId = null
}

function toggleBackupCodeMode() {
  isBackupCodeMode.value = !isBackupCodeMode.value
  otp.value = ''
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
    return date.toLocaleString(activeLocale())
  } catch {
    return dateString
  }
}
</script>
