<template>
  <Card class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-xl font-semibold">{{ $t('auth.reset.title') }}</h1>
      <p class="text-sm" style="color: var(--text-secondary);">{{ $t('auth.reset.description') }}</p>
    </header>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <Input
        :label="$t('auth.reset.newPassword')"
        type="password"
        v-model="password"
        required
        autocomplete="new-password"
      />
      <Input
        :label="$t('auth.reset.confirmPassword')"
        type="password"
        v-model="confirm"
        required
        autocomplete="new-password"
      />

      <p v-if="error" class="text-sm" style="color: var(--danger-bg);">{{ $t('auth.reset.error') }}</p>
      <p v-if="success" class="text-sm" style="color: var(--accent);">{{ $t('auth.reset.success') }}</p>

      <Button class="w-full" type="submit" :disabled="loading">
        <span v-if="loading">{{ $t('auth.reset.loading') }}</span>
        <span v-else>{{ $t('auth.reset.submit') }}</span>
      </Button>
    </form>

    <RouterLink to="/auth/login" class="block text-center text-sm hover:underline" style="color: var(--accent);">
      {{ $t('auth.reset.backToLogin') }}
    </RouterLink>
  </Card>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import authApi from '../api/authApi'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Input from '../../../ui/Input.vue'

const route = useRoute()
const token = computed(() => (typeof route.query?.token === 'string' ? route.query.token : ''))

const password = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

async function onSubmit() {
  error.value = ''
  success.value = ''

  if (!token.value) {
    error.value = 'token_missing'
    return
  }

  if (password.value !== confirm.value) {
    error.value = 'mismatch'
    return
  }

  loading.value = true
  try {
    await authApi.resetPassword({ token: token.value, new_password: password.value, new_password_confirm: confirm.value })
    success.value = 'ok'
  } catch (err) {
    const data = err?.response?.data
    if (data?.fields?.token?.length) {
      error.value = String(data.fields.token[0])
    } else if (data?.fields) {
      const firstKey = Object.keys(data.fields)[0]
      const firstVal = data.fields[firstKey]
      if (Array.isArray(firstVal) && firstVal.length) {
        error.value = String(firstVal[0])
      } else {
        error.value = data?.error || 'unknown'
      }
    } else {
      error.value = data?.error || data?.detail || 'unknown'
    }
  } finally {
    loading.value = false
  }
}
</script>
