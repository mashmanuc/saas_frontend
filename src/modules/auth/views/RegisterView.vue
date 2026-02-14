<template>
  <Card class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-xl font-semibold">{{ formTitle }}</h1>
      <p class="text-sm" style="color: var(--text-secondary);">{{ formDescription }}</p>
    </header>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <!-- Account Type Selector - only shown when role is not preselected -->
      <div v-if="!isRolePreselected" class="space-y-2">
        <p class="text-sm font-medium" style="color: var(--text-primary);">{{ $t('auth.register.accountType') }}</p>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="flex items-start gap-3 rounded-lg border p-3 cursor-pointer" :class="form.account_type === 'student' ? 'border-[var(--accent)]' : 'border-[var(--border)]'">
            <input v-model="form.account_type" type="radio" value="student" name="account_type" />
            <div>
              <div class="text-sm font-medium">{{ $t('auth.register.accountTypeStudent') }}</div>
              <div class="text-xs" style="color: var(--text-secondary);">{{ $t('auth.register.accountTypeStudentHint') }}</div>
            </div>
          </label>
          <label class="flex items-start gap-3 rounded-lg border p-3 cursor-pointer" :class="form.account_type === 'tutor' ? 'border-[var(--accent)]' : 'border-[var(--border)]'">
            <input v-model="form.account_type" type="radio" value="tutor" name="account_type" />
            <div>
              <div class="text-sm font-medium">{{ $t('auth.register.accountTypeTutor') }}</div>
              <div class="text-xs" style="color: var(--text-secondary);">{{ $t('auth.register.accountTypeTutorHint') }}</div>
            </div>
          </label>
        </div>
      </div>

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

      <Button class="w-full" type="submit" :disabled="auth.loading || !form.privacy_policy_accepted">
        <span v-if="auth.loading">{{ $t('auth.register.loading') }}</span>
        <span v-else>{{ $t('auth.register.submit') }}</span>
      </Button>
    </form>

    <p class="text-center text-sm" style="color: var(--text-secondary);">
      {{ $t('auth.register.haveAccount') }}
      <RouterLink to="/auth/login" class="hover:underline font-medium" style="color: var(--accent);">
        {{ $t('auth.register.loginLink') }}
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
import { reactive, ref, watch, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../store/authStore'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Input from '../../../ui/Input.vue'
import OnboardingModal from '../../onboarding/components/widgets/OnboardingModal.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const showErrorModal = ref(false)

// Determine if account type is pre-selected from URL
const isRolePreselected = computed(() => {
  const roleParam = route.query.role
  return roleParam === 'student' || roleParam === 'tutor'
})

const roleFromUrl = computed(() => {
  return route.query.role || 'student'
})

// Dynamic title based on role
const formTitle = computed(() => {
  if (form.account_type === 'student') {
    return $t('auth.register.titleStudent') || 'Створити акаунт студента'
  }
  return $t('auth.register.titleTutor') || 'Створити акаунт репетитора'
})

const formDescription = computed(() => {
  if (form.account_type === 'student') {
    return $t('auth.register.descriptionStudent') || 'Заповніть форму нижче, щоб знайти репетитора та почати навчання'
  }
  return $t('auth.register.descriptionTutor') || 'Заповніть форму нижче, щоб почати викладати та заробляти'
})

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
})

// Set account type from URL parameter if present
onMounted(() => {
  const roleParam = route.query.role
  if (roleParam === 'student' || roleParam === 'tutor') {
    form.account_type = roleParam
  }
})

async function onSubmit() {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const redirect = form.account_type === 'tutor' ? '/marketplace/my-profile' : ''
    const redirectQuery = redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''
    const verify_url = origin ? `${origin}/auth/verify-email?token={token}${redirectQuery}` : undefined

    await auth.register({ ...form, verify_url })
    router.push({
      name: 'auth-check-email',
      query: { email: form.email, account_type: form.account_type },
    })
  } catch (error) {
    // помилка вже міститься у auth.error
  }
}
</script>
