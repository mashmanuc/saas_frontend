<template>
  <Card class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-xl font-semibold">{{ $t('auth.login.title') }}</h1>
      <p class="text-sm text-gray-500">{{ $t('auth.login.description') }}</p>
    </header>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <Input
        :label="$t('auth.login.email')"
        type="email"
        v-model="form.email"
        required
        autocomplete="email"
      />

      <Input
        :label="$t('auth.login.password')"
        type="password"
        v-model="form.password"
        required
        autocomplete="current-password"
      />

      <p v-if="auth.error" class="text-sm text-red-600">
        {{ auth.error }}
      </p>

      <Button class="w-full" type="submit" :disabled="auth.loading">
        <span v-if="auth.loading">{{ $t('auth.login.loading') }}</span>
        <span v-else>{{ $t('auth.login.submit') }}</span>
      </Button>
    </form>

    <p class="text-center text-sm text-gray-500">
      {{ $t('auth.login.noAccount') }}
      <RouterLink to="/auth/register" class="text-indigo-600 hover:underline font-medium">
        {{ $t('auth.login.registerLink') }}
      </RouterLink>
    </p>
  </Card>
</template>

<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/authStore'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Input from '../../../ui/Input.vue'
import { getDefaultRouteForRole } from '../../../config/routes'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({
  email: '',
  password: '',
})

async function onSubmit() {
  try {
    const user = await auth.login(form)
    const target = getDefaultRouteForRole(user?.role)
    router.push(target)
  } catch (error) {
    // помилка вже відображається через auth.error
  }
}
</script>
