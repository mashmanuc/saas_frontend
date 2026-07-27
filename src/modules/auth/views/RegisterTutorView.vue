<template>
  <Card class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-xl font-semibold">{{ $t('auth.register.titleTutor') || 'Створити акаунт репетитора' }}</h1>
      <p class="text-sm" style="color: var(--text-secondary);">{{ $t('auth.register.descriptionTutor') || 'Заповніть форму нижче, щоб почати викладати та заробляти' }}</p>
    </header>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <Input
        :label="$t('auth.register.fullName')"
        v-model="form.full_name"
        :error="nameError"
        required
        autocomplete="name"
      />

      <Input
        :label="$t('auth.register.email')"
        type="email"
        v-model="form.email"
        :error="fieldError('email')"
        required
        autocomplete="email"
      />

      <Input
        :label="$t('auth.register.password')"
        type="password"
        v-model="form.password"
        :error="fieldError('password')"
        required
        autocomplete="new-password"
      />
      <Input
        :label="$t('auth.register.passwordConfirm')"
        type="password"
        v-model="form.password_confirm"
        :error="fieldError('password_confirm')"
        required
        autocomplete="new-password"
      />

      <!-- Legal consent: Terms + Tutor Offer + Privacy -->
      <div class="space-y-2">
        <label class="flex items-start gap-3 rounded-lg border p-3 cursor-pointer" :class="form.privacy_policy_accepted ? 'border-[var(--accent)]' : 'border-[var(--border)]'">
          <input v-model="form.privacy_policy_accepted" type="checkbox" required />
          <div class="text-sm">
            <span style="color: var(--text-primary);">{{ $t('auth.register.privacyPolicyText') }}</span>
            <RouterLink to="/legal/terms" target="_blank" class="hover:underline font-medium" style="color: var(--accent);">{{ $t('auth.register.termsLink') }}</RouterLink>
            <span style="color: var(--text-primary);">{{ $t('auth.register.consentSep') }}</span>
            <RouterLink to="/legal/tutor-offer" target="_blank" class="hover:underline font-medium" style="color: var(--accent);">{{ $t('auth.register.tutorOfferLink') }}</RouterLink>
            <span style="color: var(--text-primary);">{{ $t('auth.register.consentAnd') }}</span>
            <RouterLink to="/legal/privacy" target="_blank" class="hover:underline font-medium" style="color: var(--accent);">{{ $t('auth.register.privacyPolicyLink') }}</RouterLink>
          </div>
        </label>
        <p v-if="fieldError('privacy_policy_accepted')" class="text-sm text-red-600">{{ fieldError('privacy_policy_accepted') }}</p>
      </div>

      <Button class="w-full" type="submit" :disabled="auth.loading || !form.privacy_policy_accepted">
        <span v-if="auth.loading">{{ $t('auth.register.loading') }}</span>
        <span v-else>{{ $t('auth.register.submit') }}</span>
      </Button>
    </form>

    <!-- Google OAuth sign-up для тьютора (INV-OAUTH-9 v1.4: role переноситься у register endpoint). -->
    <div v-if="googleEnabled" class="space-y-3">
      <div class="relative flex items-center" aria-hidden="true">
        <div class="flex-grow border-t" style="border-color: var(--border, #e5e7eb);" />
        <span class="mx-3 text-xs uppercase tracking-wider" style="color: var(--text-secondary);">
          {{ $t('auth.login.orContinueWith') }}
        </span>
        <div class="flex-grow border-t" style="border-color: var(--border, #e5e7eb);" />
      </div>
      <GoogleSignInButton
        mode="signup"
        @success="onGoogleSuccess"
        @error="onGoogleError"
      />
      <p
        v-if="googleErrorMessage"
        class="text-sm"
        style="color: var(--danger, #d92d20);"
        data-testid="register-tutor-google-error"
      >
        {{ googleErrorMessage }}
      </p>
    </div>

    <p class="text-center text-sm" style="color: var(--text-secondary);">
      {{ $t('auth.register.haveAccount') }}
      <RouterLink to="/auth/login?role=tutor" class="hover:underline font-medium" style="color: var(--accent);">
        {{ $t('auth.register.loginLink') }}
      </RouterLink>
    </p>

    <p class="text-center text-sm" style="color: var(--text-secondary);">
      {{ $t('auth.register.wantToLearn') || 'Хочете навчатися?' }}
      <RouterLink to="/auth/register/student" class="hover:underline font-medium" style="color: var(--accent);">
        {{ $t('auth.register.registerAsStudent') || 'Стати студентом' }}
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
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../store/authStore'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Input from '../../../ui/Input.vue'
import OnboardingModal from '@/modules/auth/components/OnboardingModal.vue'
import GoogleSignInButton from '../components/GoogleSignInButton.vue'
import { getCanonicalOrigin } from '@/utils/canonicalOrigin'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const auth = useAuthStore()

// 2026-07-23: після реєстрації повертаємо людину туди, звідки вона прийшла
// (?redirect, напр. /workspace — там initLocalWorkspace() → importCloudHandoff()
// перенесе її локальну дошку в акаунт). Без цього гість, що клікнув «в хмару»,
// потрапляв у порожній кабінет, не бачив своєї дошки і йшов назавжди.
// Приймаємо ЛИШЕ внутрішні шляхи (один '/' на початку) — захист від open-redirect.
// Дефолт — '/tutor' (роль-дім), а не легасі '/tutor/profile': той роут вимкнений
// з 2026-06-17 (marketplace extraction) і лише редіректить сюди ж.
const TUTOR_HOME = '/tutor'
function resolvePostAuthTarget() {
  const target = route.query.redirect
  if (typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')) {
    return target
  }
  return TUTOR_HOME
}

const showErrorModal = ref(false)
const googleErrorMessage = ref('')

// INV-OAUTH-S4 gate: показуємо лише коли env налаштований
const googleEnabled = computed(() => Boolean(import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID))

watch(
  () => [auth.error, auth.lastErrorCode],
  ([value, code]) => {
    showErrorModal.value = Boolean(value) && code !== 'validation_failed'
  }
)

function fieldError(field) {
  const map = auth.lastFieldMessages
  if (!map || typeof map !== 'object') return ''
  const list = map[field]
  if (!Array.isArray(list) || list.length === 0) return ''
  return String(list[0])
}

// 2026-07-26: одне поле «Ім'я та прізвище» замість двох — кожне зайве поле
// відсіює частину людей на реєстрації, а бекенду обидва потрібні лише як пара
// (в API вони optional, схема БД не змінюється). Ділимо по першому пробілу
// перед відправкою — так само, як це робить User.full_name-сеттер на бекенді.
const form = reactive({
  account_type: 'tutor',
  full_name: '',
  email: '',
  password: '',
  password_confirm: '',
  privacy_policy_accepted: false,
})

/** «Іван Сірко» → { first_name: 'Іван', last_name: 'Сірко' }; одне слово → прізвище порожнє. */
function splitFullName(value) {
  const parts = String(value ?? '').trim().split(/\s+/).filter(Boolean)
  return { first_name: parts[0] ?? '', last_name: parts.slice(1).join(' ') }
}

/** Помилки бекенда з обох полів показуємо під єдиним інпутом. */
const nameError = computed(() =>
  fieldError('full_name') || fieldError('first_name') || fieldError('last_name'),
)

async function onSubmit() {
  try {
    const origin = getCanonicalOrigin()
    const redirect = resolvePostAuthTarget()
    const redirectQuery = `&redirect=${encodeURIComponent(redirect)}`
    const verify_url = origin ? `${origin}/auth/verify-email?token={token}${redirectQuery}` : undefined

    const { full_name, ...rest } = form
    await auth.register({ ...rest, ...splitFullName(full_name), verify_url })
    router.push({
      name: 'auth-check-email',
      query: { email: form.email, account_type: form.account_type },
    })
  } catch (error) {
    // помилка вже міститься у auth.error
  }
}

async function onGoogleSuccess(res) {
  googleErrorMessage.value = ''
  // INV-OAUTH-9 v1.4 — staged. Якщо новий → автоматично register з role='tutor'.
  if (res && typeof res === 'object' && res.registration_required) {
    try {
      await auth.completeGoogleRegistration(res.registration_token, 'tutor')
      router.push(resolvePostAuthTarget())
      return
    } catch (e) {
      onGoogleError(e)
      return
    }
  }
  if (res && typeof res === 'object' && res.mfa_required) {
    router.push({ name: 'auth-login' })
    return
  }
  // Existing user — у його дім (або туди, звідки прийшов: ?redirect)
  router.push(resolvePostAuthTarget())
}

function onGoogleError(error) {
  const code = error?.response?.data?.error || error?.code || ''
  const status = error?.response?.status
  let key = 'auth.oauth.error.unknown'
  switch (code) {
    case 'invalid_id_token':
      key = 'auth.oauth.error.invalidToken'
      break
    case 'invalid_registration_token':
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
</script>
