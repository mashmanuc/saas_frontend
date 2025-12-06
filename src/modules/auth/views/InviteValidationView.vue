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
      <div
        class="rounded border p-3 text-sm"
        :class="isValid ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-700'"
      >
        <p class="font-medium">
          {{ isValid ? $t('auth.invite.validation.status.valid') : $t('auth.invite.validation.status.invalid', { status: inviteStatus }) }}
        </p>
        <p class="text-xs text-gray-600">
          {{ $t('auth.invite.validation.statusLabel') }}
          <span class="font-semibold uppercase tracking-wide">{{ inviteStatus }}</span>
        </p>
      </div>

      <dl class="space-y-3 text-sm">
        <div v-for="field in standardFields" :key="field.key" class="flex flex-col gap-1 rounded border border-border-subtle p-3">
          <dt class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ field.label }}</dt>
          <dd class="font-medium text-foreground break-words">{{ field.value }}</dd>
        </div>
      </dl>

      <div v-if="extraFields.length" class="space-y-2">
        <p class="text-xs uppercase tracking-wide text-gray-500">{{ $t('auth.invite.validation.extraTitle') }}</p>
        <dl class="space-y-2">
          <div v-for="field in extraFields" :key="field.key" class="rounded border border-border-subtle p-3">
            <dt class="text-xs font-semibold text-gray-500">{{ field.label }}</dt>
            <dd class="text-sm font-mono whitespace-pre-wrap break-words">{{ field.value }}</dd>
          </div>
        </dl>
      </div>

      <RouterLink
        v-if="isValid"
        class="btn-primary block text-center"
        :to="{ name: 'invite-accept', params: { token } }"
      >
        {{ $t('auth.invite.validation.continue') }}
      </RouterLink>

      <p v-else class="text-sm text-amber-700">
        {{ $t('auth.invite.validation.invalidStatusHint') }}
      </p>
    </div>
  </Card>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import authApi from '../api/authApi'
import Card from '../../../ui/Card.vue'
import { useI18n } from 'vue-i18n'
import { formatDateTime } from '../../../utils/datetime'

const route = useRoute()
const token = route.params.token
const { t } = useI18n()

const loading = ref(true)
const error = ref(null)
const invite = ref(null)

const inviteStatus = computed(() => invite.value?.status || 'unknown')
const isValid = computed(() => inviteStatus.value?.toLowerCase() === 'valid')

const standardFields = computed(() => {
  if (!invite.value) return []

  const data = [
    {
      key: 'email',
      label: t('auth.invite.validation.emailLabel'),
      value: invite.value.email,
    },
    {
      key: 'tutor_name',
      label: t('auth.invite.validation.tutorLabel'),
      value: invite.value.tutor_name,
    },
    {
      key: 'expires_at',
      label: t('auth.invite.validation.expiresLabel'),
      value: invite.value.expires_at ? formatDateTime(invite.value.expires_at) : null,
    },
    {
      key: 'note',
      label: t('auth.invite.validation.noteLabel'),
      value: invite.value.note,
    },
  ]

  return data.filter((item) => Boolean(item.value))
})

const extraFields = computed(() => {
  if (!invite.value) return []
  const knownKeys = new Set(['email', 'tutor_name', 'status', 'expires_at', 'note'])

  return Object.entries(invite.value)
    .filter(([key, value]) => !knownKeys.has(key) && value !== null && value !== undefined)
    .map(([key, value]) => ({
      key,
      label: key.replace(/_/g, ' '),
      value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value),
    }))
})

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
