<template>
  <Card class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-xl font-semibold">{{ $t('auth.login.title') }}</h1>
      <p class="text-sm" style="color: var(--text-secondary);">{{ $t('auth.login.description') }}</p>
    </header>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <Input
        :label="$t('auth.login.email')"
        type="email"
        v-model="form.email"
        :error="fieldError('email')"
        required
        autocomplete="email"
      />

      <Input
        :label="$t('auth.login.password')"
        type="password"
        v-model="form.password"
        :error="fieldError('password')"
        required
        autocomplete="current-password"
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

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const form = reactive({
  email: '',
  password: '',
})

const showResendVerify = computed(() => auth.lastErrorCode === 'email_not_verified' && Boolean(form.email))

const showErrorModal = ref(false)

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

function goToCheckEmail() {
  router.push({ name: 'auth-check-email', query: { email: form.email } })
}

async function onSubmit() {
  try {
    const user = await auth.login(form)
    const redirect = route.query?.redirect
    const target = typeof redirect === 'string' && redirect ? redirect : getDefaultRouteForRole(user?.role)
    router.push(target)
  } catch (error) {
    // помилка вже відображається через auth.error
  }
}
</script>
