<template>
  <div class="space-y-6">
    <Card class="space-y-2">
      <Heading :level="1">{{ $t('userProfile.changePassword.title') }}</Heading>
      <p class="text-sm text-muted-foreground">{{ $t('userProfile.changePassword.subtitle') }}</p>
    </Card>

    <Card v-if="error" class="border-red-200 bg-red-50 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {{ error }}
    </Card>

    <Card v-if="success" class="border-green-200 bg-green-50 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">
      {{ success }}
    </Card>

    <Card class="space-y-4">
      <form @submit.prevent="submit" class="space-y-4">
        <Input :label="$t('userProfile.changePassword.currentPassword')" type="password" v-model="currentPassword" required :disabled="loading" autocomplete="current-password" />
        <Input :label="$t('userProfile.changePassword.newPassword')" type="password" v-model="newPassword" required :disabled="loading" autocomplete="new-password" />
        <Input :label="$t('userProfile.changePassword.confirmPassword')" type="password" v-model="confirmPassword" required :disabled="loading" autocomplete="new-password" />
        <Button variant="primary" type="submit" :loading="loading" :disabled="loading">
          {{ $t('userProfile.changePassword.submit') }}
        </Button>
      </form>
    </Card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import authApi from '../../auth/api/authApi'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Heading from '../../../ui/Heading.vue'
import Input from '../../../ui/Input.vue'
import { notifySuccess, notifyError } from '../../../utils/notify'
import { i18n } from '../../../i18n'

const t = (key) => {
  try {
    return i18n.global?.t?.(key) ?? key
  } catch {
    return key
  }
}

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

async function submit() {
  error.value = ''
  success.value = ''

  if (newPassword.value !== confirmPassword.value) {
    error.value = t('userProfile.changePassword.mismatch')
    notifyError(error.value)
    return
  }

  loading.value = true
  try {
    await authApi.changePassword({ current_password: currentPassword.value, new_password: newPassword.value, new_password_confirm: confirmPassword.value })
    success.value = t('userProfile.changePassword.success')
    notifySuccess(success.value)
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err) {
    const data = err?.response?.data
    if (data?.fields) {
      const firstKey = Object.keys(data.fields)[0]
      const firstVal = data.fields[firstKey]
      if (Array.isArray(firstVal) && firstVal.length) {
        error.value = String(firstVal[0])
      } else {
        error.value = t('userProfile.changePassword.error')
      }
    } else {
      error.value = data?.error || data?.detail || t('userProfile.changePassword.error')
    }
    notifyError(error.value)
  } finally {
    loading.value = false
  }
}
</script>
