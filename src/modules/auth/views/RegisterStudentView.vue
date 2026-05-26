<template>
  <Card class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-xl font-semibold">{{ $t('auth.register.titleStudent') || 'Створити акаунт студента' }}</h1>
      <p class="text-sm" style="color: var(--text-secondary);">{{ $t('auth.register.descriptionStudent') || 'Заповніть форму нижче, щоб знайти репетитора та почати навчання' }}</p>
    </header>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          :label="$t('auth.register.firstName')"
          v-model="form.first_name"
          :error="fieldError('first_name')"
          required
          autocomplete="given-name"
        />
        <Input
          :label="$t('auth.register.lastName')"
          v-model="form.last_name"
          :error="fieldError('last_name')"
          required
          autocomplete="family-name"
        />
      </div>

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

      <!-- Age Gate -->
      <div class="space-y-2">
        <label class="block text-sm font-medium" style="color: var(--text-primary);">
          Вік учня
        </label>
        <div class="space-y-2">
          <label
            v-for="opt in ageOptions"
            :key="opt.value"
            class="flex items-center gap-3 rounded-lg border p-3 cursor-pointer"
            :class="form.age_group === opt.value ? 'border-[var(--accent)]' : 'border-[var(--border)]'"
          >
            <input type="radio" v-model="form.age_group" :value="opt.value" class="shrink-0" />
            <span class="text-sm" style="color: var(--text-primary);">{{ opt.label }}</span>
          </label>
        </div>
        <!-- Блокуюче повідомлення для < 14 -->
        <div
          v-if="form.age_group === 'under14'"
          class="rounded-lg border p-4 text-sm space-y-1"
          style="border-color: var(--accent); background: var(--accent-subtle, #f0f4ff);"
        >
          <p class="font-medium" style="color: var(--text-primary);">
            Реєстрація для дітей до 14 років
          </p>
          <p style="color: var(--text-secondary);">
            Для учнів до 14 років реєстрацію здійснює батько або опікун від свого імені.
            Зверніться на
            <a href="mailto:support@m4sh.org" class="underline" style="color: var(--accent);">support@m4sh.org</a>
            або зареєструйтесь як батько і додайте дитину до акаунту.
          </p>
        </div>
      </div>

      <!-- Privacy Policy Checkbox -->
      <div class="space-y-2">
        <label class="flex items-start gap-3 rounded-lg border p-3 cursor-pointer" :class="form.privacy_policy_accepted ? 'border-[var(--accent)]' : 'border-[var(--border)]'">
          <input v-model="form.privacy_policy_accepted" type="checkbox" required />
          <div class="text-sm">
            <span style="color: var(--text-primary);">{{ $t('auth.register.privacyPolicyText') }}</span>
            <RouterLink to="/legal/privacy" target="_blank" class="hover:underline font-medium" style="color: var(--accent);">{{ $t('auth.register.privacyPolicyLink') }}</RouterLink>
          </div>
        </label>
        <p v-if="fieldError('privacy_policy_accepted')" class="text-sm text-red-600">{{ fieldError('privacy_policy_accepted') }}</p>
      </div>

      <Button class="w-full" type="submit" :disabled="auth.loading || !form.privacy_policy_accepted || !canSubmit">
        <span v-if="auth.loading">{{ $t('auth.register.loading') }}</span>
        <span v-else>{{ $t('auth.register.submit') }}</span>
      </Button>
    </form>

    <!-- Google OAuth sign-up (INV-OAUTH-9: завжди STUDENT — підходить цій воронці).
         Tutor-registration НЕ має Google button (TutorView). -->
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
        data-testid="register-google-error"
      >
        {{ googleErrorMessage }}
      </p>
    </div>

    <p class="text-center text-sm" style="color: var(--text-secondary);">
      {{ $t('auth.register.haveAccount') }}
      <RouterLink to="/auth/login?role=student" class="hover:underline font-medium" style="color: var(--accent);">
        {{ $t('auth.register.loginLink') }}
      </RouterLink>
    </p>

    <p class="text-center text-sm" style="color: var(--text-secondary);">
      {{ $t('auth.register.wantToTeach') || 'Хочете викладати?' }}
      <RouterLink to="/auth/register/tutor" class="hover:underline font-medium" style="color: var(--accent);">
        {{ $t('auth.register.registerAsTutor') || 'Стати репетитором' }}
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
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../store/authStore'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Input from '../../../ui/Input.vue'
import OnboardingModal from '../../onboarding/components/widgets/OnboardingModal.vue'
import GoogleSignInButton from '../components/GoogleSignInButton.vue'
import { getCanonicalOrigin } from '@/utils/canonicalOrigin'

const router = useRouter()
const { t } = useI18n()
const auth = useAuthStore()

const showErrorModal = ref(false)
const googleErrorMessage = ref('')

const ageOptions = [
  { value: 'adult', label: '18 років і старше' },
  { value: 'teen', label: '14–17 років' },
  { value: 'under14', label: 'Менше 14 років' },
]

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

const form = reactive({
  account_type: 'student',
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  password_confirm: '',
  privacy_policy_accepted: false,
  age_group: '',  // 'adult' | 'teen' | 'under14'
})

const canSubmit = computed(() =>
  form.age_group !== '' && form.age_group !== 'under14'
)

async function onSubmit() {
  try {
    const origin = getCanonicalOrigin()
    const verify_url = origin ? `${origin}/auth/verify-email?token={token}` : undefined

    await auth.register({ ...form, verify_url })
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
  // INV-OAUTH-9 v1.4 — staged. Якщо новий → автоматично register з role='student'.
  if (res && typeof res === 'object' && res.registration_required) {
    try {
      await auth.completeGoogleRegistration(res.registration_token, 'student')
      router.push('/')
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
  router.push('/')
}

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
</script>
