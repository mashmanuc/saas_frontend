<template>
  <Card class="space-y-6">
    <header class="space-y-1 text-center">
      <h1 class="text-xl font-semibold">{{ $t('auth.invite.accept.title') }}</h1>
      <p class="text-sm text-gray-500">{{ $t('auth.invite.accept.description') }}</p>
    </header>

    <div v-if="error" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
      {{ error }}
    </div>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <Input
        :label="$t('auth.invite.accept.password')"
        type="password"
        v-model="form.password"
        :error="fieldError('password')"
        required
        autocomplete="new-password"
      />
      <Input
        :label="$t('auth.invite.accept.confirmPassword')"
        type="password"
        v-model="confirmPassword"
        :error="confirmPasswordError"
        required
        autocomplete="new-password"
      />

      <Input
        :label="$t('auth.invite.accept.firstName')"
        v-model="form.first_name"
        :error="fieldError('first_name')"
        autocomplete="given-name"
      />
      <Input
        :label="$t('auth.invite.accept.lastName')"
        v-model="form.last_name"
        :error="fieldError('last_name')"
        autocomplete="family-name"
      />

      <Button class="w-full" type="submit" :disabled="auth.loading">
        <span v-if="auth.loading">{{ $t('auth.invite.accept.loading') }}</span>
        <span v-else>{{ $t('auth.invite.accept.submit') }}</span>
      </Button>
    </form>
  </Card>

  <OnboardingModal :open="showErrorModal" @close="showErrorModal = false">
    <template #title>
      {{ $t('notify.types.error') }}
    </template>

    <p class="text-sm text-gray-600">
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
import { useI18n } from 'vue-i18n'
import OnboardingModal from '../../onboarding/components/widgets/OnboardingModal.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const token = route.params.token
const { t } = useI18n()

const form = reactive({
  token,
  password: '',
  first_name: '',
  last_name: '',
})

const confirmPassword = ref('')
const error = ref(null)
const showErrorModal = ref(false)

const confirmPasswordError = computed(() => {
  if (!error.value) return null
  if (error.value !== t('auth.invite.accept.passwordMismatch')) return null
  return error.value
})

function fieldError(field) {
  if (!auth.lastFieldMessages) return null
  const v = auth.lastFieldMessages[field]
  return Array.isArray(v) && v.length > 0 ? String(v[0]) : null
}

watch(
  () => [auth.error, auth.lastErrorCode],
  () => {
    if (!auth.error) {
      showErrorModal.value = false
      return
    }

    // 422 показуємо інлайн, решту — модалкою
    if (auth.lastErrorCode && auth.lastErrorCode !== 'validation_failed') {
      showErrorModal.value = true
    }
  }
)

async function onSubmit() {
  error.value = null
  showErrorModal.value = false
  if (form.password !== confirmPassword.value) {
    error.value = t('auth.invite.accept.passwordMismatch')
    return
  }

  try {
    const user = await auth.acceptInvite(form)
    router.push(getDefaultRouteForRole(user?.role))
  } catch (err) {
    if (auth.lastErrorCode === 'validation_failed') {
      error.value = null
      return
    }
    error.value = auth.error
    if (!error.value) {
      error.value = t('auth.invite.accept.genericError')
    }
  }
}
</script>
