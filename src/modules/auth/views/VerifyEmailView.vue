<template>
  <Card class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-xl font-semibold">{{ $t('auth.verifyEmail.title') }}</h1>
      <p class="text-sm" style="color: var(--text-secondary);">
        {{ $t('auth.verifyEmail.description') }}
      </p>
    </header>

    <div v-if="loading" class="text-sm" style="color: var(--text-secondary);">
      {{ $t('auth.verifyEmail.loading') }}
    </div>

    <div v-else class="space-y-3">
      <p v-if="error" class="text-sm" style="color: var(--danger-bg);">{{ error }}</p>
      <p v-else class="text-sm" style="color: var(--accent);">{{ $t('auth.verifyEmail.success') }}</p>

      <RouterLink :to="loginLink" class="block text-center text-sm hover:underline" style="color: var(--accent);">
        {{ $t('auth.verifyEmail.loginCta') }}
      </RouterLink>
    </div>
  </Card>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import authApi from '../api/authApi'
import Card from '../../../ui/Card.vue'

const route = useRoute()

const loginLink = computed(() => {
  const redirect = typeof route.query?.redirect === 'string' ? route.query.redirect : ''
  return redirect ? `/auth/login?redirect=${encodeURIComponent(redirect)}` : '/auth/login'
})

const loading = ref(true)
const error = ref('')

onMounted(async () => {
  const token = typeof route.query?.token === 'string' ? route.query.token : ''
  if (!token) {
    error.value = 'token_missing'
    loading.value = false
    return
  }

  try {
    await authApi.verifyEmail({ token })
  } catch (err) {
    const data = err?.response?.data
    if (data?.fields?.token?.length) {
      error.value = String(data.fields.token[0])
    } else {
      error.value = data?.error || data?.detail || 'unknown'
    }
  } finally {
    loading.value = false
  }
})
</script>
