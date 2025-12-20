<template>
  <Card class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-xl font-semibold">{{ $t('auth.checkEmail.title') }}</h1>
      <p class="text-sm" style="color: var(--text-secondary);">
        {{ $t('auth.checkEmail.description') }}
      </p>
    </header>

    <div class="space-y-3">
      <p v-if="email" class="text-sm" style="color: var(--text-secondary);">
        {{ $t('auth.checkEmail.sentTo') }}
        <span class="font-medium" style="color: var(--text-primary);">{{ email }}</span>
      </p>

      <p v-if="error" class="text-sm" style="color: var(--danger-bg);">{{ $t('auth.checkEmail.error') }}</p>
      <p v-if="success" class="text-sm" style="color: var(--accent);">{{ $t('auth.checkEmail.success') }}</p>

      <Button class="w-full" :disabled="loading" @click="resend">
        <span v-if="loading">{{ $t('auth.checkEmail.resendLoading') }}</span>
        <span v-else>{{ $t('auth.checkEmail.resend') }}</span>
      </Button>

      <RouterLink to="/auth/login" class="block text-center text-sm hover:underline" style="color: var(--accent);">
        {{ $t('auth.checkEmail.backToLogin') }}
      </RouterLink>
    </div>
  </Card>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import authApi from '../api/authApi'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'

const route = useRoute()
const email = computed(() => (typeof route.query?.email === 'string' ? route.query.email : ''))
const accountType = computed(() => (typeof route.query?.account_type === 'string' ? route.query.account_type : 'student'))

const loading = ref(false)
const error = ref('')
const success = ref('')

async function resend() {
  error.value = ''
  success.value = ''

  if (!email.value) {
    error.value = 'missing_email'
    return
  }

  loading.value = true
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const redirect = accountType.value === 'tutor' ? '/marketplace/my-profile' : ''
    const redirectQuery = redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''
    const verify_url = origin ? `${origin}/auth/verify-email?token={token}${redirectQuery}` : undefined

    await authApi.resendVerifyEmail({ email: email.value, verify_url })
    success.value = 'ok'
  } catch (err) {
    const data = err?.response?.data
    error.value = data?.error || data?.detail || 'unknown'
  } finally {
    loading.value = false
  }
}
</script>
