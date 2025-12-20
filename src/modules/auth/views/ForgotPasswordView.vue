<template>
  <Card class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-xl font-semibold">{{ $t('auth.forgot.title') }}</h1>
      <p class="text-sm" style="color: var(--text-secondary);">{{ $t('auth.forgot.description') }}</p>
    </header>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <Input
        :label="$t('auth.forgot.email')"
        type="email"
        v-model="email"
        required
        autocomplete="email"
      />

      <p v-if="message" class="text-sm" style="color: var(--accent);">{{ $t('auth.forgot.success') }}</p>
      <p v-if="error" class="text-sm" style="color: var(--danger-bg);">{{ $t('auth.forgot.error') }}</p>

      <Button class="w-full" type="submit" :disabled="loading">
        <span v-if="loading">{{ $t('auth.forgot.loading') }}</span>
        <span v-else>{{ $t('auth.forgot.submit') }}</span>
      </Button>
    </form>

    <RouterLink to="/auth/login" class="block text-center text-sm hover:underline" style="color: var(--accent);">
      {{ $t('auth.forgot.backToLogin') }}
    </RouterLink>
  </Card>
</template>

<script setup>
import { ref } from 'vue'
import authApi from '../api/authApi'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Input from '../../../ui/Input.vue'

const email = ref('')
const loading = ref(false)
const error = ref('')
const message = ref('')

async function onSubmit() {
  error.value = ''
  message.value = ''
  loading.value = true
  try {
    await authApi.requestPasswordReset({ email: email.value })
    message.value = 'ok'
  } catch (err) {
    const data = err?.response?.data
    error.value = data?.error || data?.detail || 'unknown'
  } finally {
    loading.value = false
  }
}
</script>
