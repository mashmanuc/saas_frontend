<template>
  <Card class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-xl font-semibold">{{ $t('auth.register.title') }}</h1>
      <p class="text-sm" style="color: var(--text-secondary);">{{ $t('auth.register.description') }}</p>
    </header>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          :label="$t('auth.register.firstName')"
          v-model="form.first_name"
          required
          autocomplete="given-name"
        />
        <Input
          :label="$t('auth.register.lastName')"
          v-model="form.last_name"
          required
          autocomplete="family-name"
        />
      </div>

      <Input
        :label="$t('auth.register.email')"
        type="email"
        v-model="form.email"
        required
        autocomplete="email"
      />

      <Input
        :label="$t('auth.register.password')"
        type="password"
        v-model="form.password"
        required
        autocomplete="new-password"
      />

      <p v-if="auth.error" class="text-sm" style="color: var(--danger-bg);">
        {{ auth.error }}
      </p>

      <Button class="w-full" type="submit" :disabled="auth.loading">
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
  first_name: '',
  last_name: '',
  email: '',
  password: '',
})

async function onSubmit() {
  try {
    const user = await auth.register(form)
    router.push(getDefaultRouteForRole(user?.role))
  } catch (error) {
    // помилка вже міститься у auth.error
  }
}
</script>
