<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-medium">{{ $t('users.settings.contacts.title') }}</h3>
      <p class="text-sm text-muted-foreground">
        {{ $t('users.settings.contacts.description') }}
      </p>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <form v-else @submit.prevent="handleSubmit" class="space-y-4">
      <!-- Phone -->
      <div>
        <label for="phone" class="block text-sm font-medium mb-1">
          {{ $t('users.settings.contacts.phone') }}
        </label>
        <input
          id="phone"
          v-model="formData.phone"
          type="tel"
          class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          :placeholder="$t('users.settings.contacts.phonePlaceholder')"
          :disabled="saving"
        />
        <p class="mt-1 text-xs text-muted-foreground">
          {{ $t('users.settings.contacts.phoneHint') }}
        </p>
      </div>

      <!-- Telegram -->
      <div>
        <label for="telegram" class="block text-sm font-medium mb-1">
          {{ $t('users.settings.contacts.telegram') }}
        </label>
        <input
          id="telegram"
          v-model="formData.telegram_username"
          type="text"
          class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          :placeholder="$t('users.settings.contacts.telegramPlaceholder')"
          :disabled="saving"
        />
        <p class="mt-1 text-xs text-muted-foreground">
          {{ $t('users.settings.contacts.telegramHint') }}
        </p>
      </div>

      <!-- Timezone -->
      <div>
        <label for="timezone" class="block text-sm font-medium mb-1">
          {{ $t('users.settings.contacts.timezone') }}
        </label>
        <select
          id="timezone"
          v-model="formData.timezone"
          class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          :disabled="saving"
        >
          <option value="Europe/Kyiv">Europe/Kyiv (UTC+2)</option>
          <option value="Europe/London">Europe/London (UTC+0)</option>
          <option value="America/New_York">America/New_York (UTC-5)</option>
          <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
          <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
        </select>
      </div>

      <!-- Error Message -->
      <div v-if="errorMessage" class="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
        {{ errorMessage }}
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-3">
        <button
          type="button"
          class="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-surface-muted"
          :disabled="saving"
          @click="loadContacts"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          type="submit"
          class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          :disabled="saving"
        >
          {{ saving ? $t('common.saving') : $t('common.save') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { getStudentProfile, updateStudentProfile } from '@/api/students'
import { getTutorProfile, updateTutorProfile } from '@/api/tutors'
import { notifySuccess, notifyError } from '@/utils/notify'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const authStore = useAuthStore()

const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const formData = ref({
  phone: '',
  telegram_username: '',
  timezone: 'Europe/Kyiv'
})

const userRole = computed(() => authStore.user?.role)

async function loadContacts() {
  loading.value = true
  errorMessage.value = ''

  try {
    let profile
    if (userRole.value === 'student') {
      profile = await getStudentProfile()
    } else if (userRole.value === 'tutor') {
      profile = await getTutorProfile()
    }

    if (profile) {
      formData.value = {
        phone: profile.phone || '',
        telegram_username: profile.telegram_username || '',
        timezone: profile.timezone || 'Europe/Kyiv'
      }
    }
  } catch (error) {
    console.error('Failed to load contacts:', error)
    errorMessage.value = t('users.settings.contacts.loadError')
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  saving.value = true
  errorMessage.value = ''

  try {
    if (userRole.value === 'student') {
      await updateStudentProfile(formData.value)
    } else if (userRole.value === 'tutor') {
      await updateTutorProfile(formData.value)
    }
    
    notifySuccess(t('users.settings.contacts.saveSuccess'))
  } catch (error) {
    console.error('Failed to save contacts:', error)
    
    if (error.response?.data?.field_errors) {
      const fieldErrors = error.response.data.field_errors
      const firstError = Object.values(fieldErrors)[0]
      errorMessage.value = Array.isArray(firstError) ? firstError[0] : firstError
    } else if (error.response?.data?.detail) {
      errorMessage.value = error.response.data.detail
    } else {
      errorMessage.value = t('users.settings.contacts.saveError')
    }
    
    notifyError(errorMessage.value)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadContacts()
})
</script>
