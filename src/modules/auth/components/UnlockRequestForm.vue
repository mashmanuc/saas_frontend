<template>
  <Card class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-xl font-semibold">{{ $t('auth.unlock.request.title') }}</h1>
      <p class="text-sm" style="color: var(--text-secondary);">
        {{ $t('auth.unlock.request.description') }}
      </p>
    </header>

    <form class="space-y-4" @submit.prevent="handleSubmit">
      <Input
        :label="$t('auth.unlock.request.emailLabel')"
        type="email"
        v-model="email"
        :error="emailError"
        required
        autocomplete="email"
        data-testid="unlock-request-email-input"
      />

      <Button
        class="w-full"
        type="submit"
        :disabled="loading"
        data-testid="unlock-request-submit-button"
      >
        <span v-if="loading">{{ $t('auth.unlock.request.loading') }}</span>
        <span v-else>{{ $t('auth.unlock.request.submit') }}</span>
      </Button>
    </form>

    <div v-if="success" class="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
      {{ $t('auth.unlock.request.successMessage') }}
    </div>

    <div v-if="error" class="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
      {{ error }}
    </div>

    <p class="text-center text-sm" style="color: var(--text-secondary);">
      <RouterLink to="/auth/login" class="hover:underline font-medium" style="color: var(--accent);">
        {{ $t('auth.unlock.request.backToLogin') }}
      </RouterLink>
    </p>
  </Card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/ui/Button.vue'
import Card from '@/ui/Card.vue'
import Input from '@/ui/Input.vue'
import authApi from '@/api/auth'

const { t } = useI18n()

const loading = ref(false)
const error = ref('')
const success = ref(false)
const email = ref('')
const emailError = ref('')

async function handleSubmit() {
  loading.value = true
  error.value = ''
  success.value = false
  emailError.value = ''
  
  if (!email.value || !email.value.trim()) {
    emailError.value = t('auth.unlock.request.errors.requiredEmail')
    loading.value = false
    return
  }
  
  try {
    await authApi.requestAccountUnlock({ email: email.value })
    success.value = true
    email.value = ''
  } catch (err: any) {
    error.value = err?.response?.data?.message || t('auth.unlock.request.errors.requestFailed')
  } finally {
    loading.value = false
  }
}
</script>
