<template>
  <Card class="space-y-4">
    <header class="space-y-1 text-center">
      <h1 class="text-xl font-semibold">{{ $t('auth.invite.validation.title') }}</h1>
      <p class="text-sm text-gray-500">{{ $t('auth.invite.validation.description') }}</p>
    </header>

    <div v-if="loading" class="text-center text-gray-500 text-sm">
      {{ $t('auth.invite.validation.loading') }}
    </div>

    <div v-else-if="error" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
      {{ error }}
    </div>

    <div v-else-if="invite" class="space-y-4">
      <div class="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
        <p class="font-medium">
          {{ $t('auth.invite.validation.emailLabel') }} {{ invite.email }}
        </p>
        <p class="text-gray-600">
          {{ $t('auth.invite.validation.nameLabel') }}
          {{ invite.first_name }} {{ invite.last_name }} —
          {{ $t('auth.invite.validation.roleLabel') }}
          <strong>{{ invite.role }}</strong>
        </p>
      </div>

      <RouterLink
        class="btn-primary block text-center"
        :to="{ name: 'invite-accept', params: { token } }"
      >
        {{ $t('auth.invite.validation.continue') }}
      </RouterLink>
    </div>
  </Card>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import authApi from '../api/authApi'
import Card from '../../../ui/Card.vue'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const token = route.params.token
const { t } = useI18n()

const loading = ref(true)
const error = ref(null)
const invite = ref(null)

onMounted(async () => {
  try {
    invite.value = await authApi.validateInvite(token)
  } catch (err) {
    error.value = err.response?.data?.detail || t('auth.invite.validation.error')
  } finally {
    loading.value = false
  }
})
</script>
