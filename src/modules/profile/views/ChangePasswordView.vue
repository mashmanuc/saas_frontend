<template>
  <div class="space-y-6">
    <Card class="space-y-2">
      <Heading :level="1">{{ $t('userProfile.changePassword.title') }}</Heading>
      <p class="text-sm text-muted-foreground">{{ $t('userProfile.changePassword.subtitle') }}</p>
    </Card>

    <Card v-if="globalError" class="border-red-200 bg-red-50 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {{ globalError }}
    </Card>

    <Card v-if="success" class="border-green-200 bg-green-50 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">
      {{ success }}
    </Card>

    <Card class="space-y-4">
      <form @submit.prevent="submit" class="space-y-4">
        <Input
          :label="$t('userProfile.changePassword.currentPassword')"
          type="password"
          v-model="currentPassword"
          required
          :disabled="loading"
          :error="fieldErrors.currentPassword"
          autocomplete="current-password"
        />
        <Input
          :label="$t('userProfile.changePassword.newPassword')"
          type="password"
          v-model="newPassword"
          required
          :disabled="loading"
          :error="fieldErrors.newPassword"
          autocomplete="new-password"
        />
        <Input
          :label="$t('userProfile.changePassword.confirmPassword')"
          type="password"
          v-model="confirmPassword"
          required
          :disabled="loading"
          :error="fieldErrors.confirmPassword"
          autocomplete="new-password"
        />
        <Button variant="primary" type="submit" :loading="loading" :disabled="loading">
          {{ $t('userProfile.changePassword.submit') }}
        </Button>
      </form>
    </Card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
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

const MIN_PASSWORD_LENGTH = 8

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const globalError = ref('')
const success = ref('')
const fieldErrors = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

function clearErrors() {
  globalError.value = ''
  success.value = ''
  fieldErrors.currentPassword = ''
  fieldErrors.newPassword = ''
  fieldErrors.confirmPassword = ''
}

function validateForm() {
  let valid = true
  clearErrors()

  if (!currentPassword.value.trim()) {
    fieldErrors.currentPassword = t('userProfile.changePassword.errors.currentRequired')
    valid = false
  }

  if (!newPassword.value.trim()) {
    fieldErrors.newPassword = t('userProfile.changePassword.errors.newRequired')
    valid = false
  } else if (newPassword.value.length < MIN_PASSWORD_LENGTH) {
    fieldErrors.newPassword = t('userProfile.changePassword.errors.tooShort')
    valid = false
  } else if (newPassword.value === currentPassword.value) {
    fieldErrors.newPassword = t('userProfile.changePassword.errors.sameAsCurrent')
    valid = false
  }

  if (!confirmPassword.value.trim()) {
    fieldErrors.confirmPassword = t('userProfile.changePassword.errors.confirmRequired')
    valid = false
  } else if (newPassword.value !== confirmPassword.value) {
    fieldErrors.confirmPassword = t('userProfile.changePassword.errors.mismatch')
    valid = false
  }

  return valid
}

function mapBackendError(err) {
  const status = err?.response?.status
  const data = err?.response?.data

  if (!err?.response) {
    return { global: t('userProfile.changePassword.errors.network') }
  }

  if (status === 429) {
    return { global: t('userProfile.changePassword.errors.rateLimited') }
  }

  if (status === 401 || status === 403) {
    const detail = data?.detail || data?.error || ''
    if (detail.includes('invalid_credentials') || detail.includes('Authentication')) {
      return { field: 'currentPassword', message: t('userProfile.changePassword.errors.wrongCurrent') }
    }
    return { field: 'currentPassword', message: t('userProfile.changePassword.errors.wrongCurrent') }
  }

  if (data?.fields || data?.field_errors) {
    const fields = data.fields || data.field_errors
    const result = {}

    for (const [key, messages] of Object.entries(fields)) {
      const msg = Array.isArray(messages) ? messages[0] : messages
      const mapped = mapFieldMessage(key, String(msg))
      if (mapped.field) {
        result[mapped.field] = mapped.message
      }
    }

    if (Object.keys(result).length > 0) return { fieldErrors: result }
  }

  if (data?.non_field_errors) {
    const nfe = Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors
    return { global: mapPasswordValidationMessage(String(nfe)) }
  }

  if (data?.new_password) {
    const msgs = Array.isArray(data.new_password) ? data.new_password : [data.new_password]
    return { field: 'newPassword', message: mapPasswordValidationMessage(String(msgs[0])) }
  }

  const fallback = data?.detail || data?.error || data?.message
  if (fallback) {
    return { global: mapPasswordValidationMessage(String(fallback)) }
  }

  return { global: t('userProfile.changePassword.error') }
}

function mapFieldMessage(fieldName, message) {
  const lower = message.toLowerCase()

  if (fieldName === 'current_password') {
    if (lower.includes('required') || lower.includes('blank') || lower === 'missing') {
      return { field: 'currentPassword', message: t('userProfile.changePassword.errors.currentRequired') }
    }
    return { field: 'currentPassword', message: t('userProfile.changePassword.errors.wrongCurrent') }
  }

  if (fieldName === 'new_password') {
    return { field: 'newPassword', message: mapPasswordValidationMessage(message) }
  }

  if (fieldName === 'new_password_confirm') {
    if (lower.includes('mismatch') || lower.includes('match')) {
      return { field: 'confirmPassword', message: t('userProfile.changePassword.errors.mismatch') }
    }
    if (lower.includes('required') || lower.includes('blank') || lower === 'missing') {
      return { field: 'confirmPassword', message: t('userProfile.changePassword.errors.confirmRequired') }
    }
    return { field: 'confirmPassword', message }
  }

  return { field: null, message }
}

function mapPasswordValidationMessage(message) {
  const lower = message.toLowerCase()

  if (lower.includes('too short') || lower.includes('short') || lower.includes('at least')) {
    return t('userProfile.changePassword.errors.tooShort')
  }
  if (lower.includes('too common') || lower.includes('common')) {
    return t('userProfile.changePassword.errors.tooCommon')
  }
  if (lower.includes('entirely numeric') || lower.includes('numeric')) {
    return t('userProfile.changePassword.errors.entirelyNumeric')
  }
  if (lower.includes('similar') || lower.includes('personal')) {
    return t('userProfile.changePassword.errors.tooSimilar')
  }
  if (lower.includes('mismatch') || lower.includes('match')) {
    return t('userProfile.changePassword.errors.mismatch')
  }
  if (lower.includes('required') || lower.includes('blank') || lower === 'missing') {
    return t('userProfile.changePassword.errors.newRequired')
  }

  return message || t('userProfile.changePassword.error')
}

async function submit() {
  if (!validateForm()) return

  loading.value = true
  clearErrors()

  try {
    await authApi.changePassword({
      current_password: currentPassword.value,
      new_password: newPassword.value,
      new_password_confirm: confirmPassword.value,
    })
    success.value = t('userProfile.changePassword.success')
    notifySuccess(success.value)
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err) {
    const mapped = mapBackendError(err)

    if (mapped.global) {
      globalError.value = mapped.global
      notifyError(globalError.value)
    } else if (mapped.field && mapped.message) {
      fieldErrors[mapped.field] = mapped.message
      notifyError(mapped.message)
    } else if (mapped.fieldErrors) {
      Object.assign(fieldErrors, mapped.fieldErrors)
      const firstMsg = Object.values(mapped.fieldErrors)[0]
      if (firstMsg) notifyError(firstMsg)
    }
  } finally {
    loading.value = false
  }
}
</script>
