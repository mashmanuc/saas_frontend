<template>
  <div class="space-y-6">
    <Card class="space-y-2">
      <Heading :level="1">{{ $t('userProfile.changeEmail.title') }}</Heading>
      <p class="text-sm text-muted-foreground">{{ $t('userProfile.changeEmail.subtitle') }}</p>
    </Card>

    <Card v-if="error" class="border-red-200 bg-red-50 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {{ error }}
    </Card>

    <Card v-if="success" class="border-green-200 bg-green-50 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">
      {{ success }}
    </Card>

    <Card class="space-y-4">
      <form @submit.prevent="submit" class="space-y-4">
        <Input :label="$t('userProfile.changeEmail.newEmail')" type="email" v-model="newEmail" required :disabled="loading" />
        <Input :label="$t('userProfile.changeEmail.password')" type="password" v-model="password" required :disabled="loading" autocomplete="current-password" />
        <Button variant="primary" type="submit" :loading="loading" :disabled="loading">
          {{ $t('userProfile.changeEmail.submit') }}
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

const newEmail = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

async function submit() {
  error.value = ''
  success.value = ''
  loading.value = true
  try {
    await authApi.changeEmail({ new_email: newEmail.value, password: password.value })
    success.value = t('userProfile.changeEmail.success')
    notifySuccess(success.value)
    newEmail.value = ''
    password.value = ''
  } catch (err) {
    const data = err?.response?.data
    if (data?.fields) {
      const firstKey = Object.keys(data.fields)[0]
      const firstVal = data.fields[firstKey]
      if (Array.isArray(firstVal) && firstVal.length) {
        error.value = String(firstVal[0])
      } else {
        error.value = t('userProfile.changeEmail.error')
      }
    } else {
      error.value = data?.error || data?.detail || t('userProfile.changeEmail.error')
    }
    notifyError(error.value)
  } finally {
    loading.value = false
  }
}
</script>
