<template>
  <form class="space-y-6" @submit.prevent="handleSubmit">
    <div>
      <h3 class="text-lg font-semibold text-foreground">
        {{ $t('users.settings.notifications.title') }}
      </h3>
      <p class="text-sm text-muted-foreground">
        {{ $t('users.settings.notifications.description') }}
      </p>
    </div>

    <div class="space-y-4">
      <div class="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p class="font-medium text-foreground">
            {{ $t('users.settings.notifications.email') }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ $t('users.settings.notifications.emailDescription') }}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          :aria-checked="formData.email_notifications"
          :disabled="saving"
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          :class="formData.email_notifications ? 'bg-primary' : 'bg-surface-muted'"
          @click="formData.email_notifications = !formData.email_notifications"
        >
          <span
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            :class="formData.email_notifications ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
      </div>

      <div class="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p class="font-medium text-foreground">
            {{ $t('users.settings.notifications.sms') }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ $t('users.settings.notifications.smsDescription') }}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          :aria-checked="formData.sms_notifications"
          :disabled="saving"
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          :class="formData.sms_notifications ? 'bg-primary' : 'bg-surface-muted'"
          @click="formData.sms_notifications = !formData.sms_notifications"
        >
          <span
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            :class="formData.sms_notifications ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
      </div>
    </div>

    <!-- Telegram Notifications (tutors only) -->
    <TelegramNotifications v-if="isTutor" />

    <div v-if="errorMessage" class="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
      {{ errorMessage }}
    </div>

    <div class="flex justify-end gap-3">
      <Button
        type="button"
        variant="outline"
        :disabled="saving || !hasChanges"
        @click="handleReset"
      >
        {{ $t('ui.reset') }}
      </Button>
      <Button
        type="submit"
        variant="primary"
        :disabled="saving || !hasChanges"
        :loading="saving"
      >
        {{ saving ? $t('ui.saving') : $t('ui.save') }}
      </Button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from '@/ui/Button.vue'
import TelegramNotifications from './TelegramNotifications.vue'
import { useProfileStore } from '../../store/profileStore'
import { useAuthStore } from '@/stores/authStore'
import { updateUserSettings } from '@/api/users'
import { notifySuccess, notifyError } from '@/utils/notify'
import { i18n } from '@/i18n'

const profileStore = useProfileStore()
const authStore = useAuthStore()
const isTutor = computed(() => authStore.user?.role === 'tutor')

const formData = ref({
  email_notifications: true,
  sms_notifications: false
})

const initialData = ref({ ...formData.value })
const saving = ref(false)
const errorMessage = ref('')

const hasChanges = computed(() => {
  return JSON.stringify(formData.value) !== JSON.stringify(initialData.value)
})

onMounted(async () => {
  if (profileStore.settings) {
    formData.value = {
      email_notifications: profileStore.settings.email_notifications ?? true,
      sms_notifications: profileStore.settings.sms_notifications ?? false
    }
    initialData.value = { ...formData.value }
  }
})

function handleReset() {
  formData.value = { ...initialData.value }
  errorMessage.value = ''
}

async function handleSubmit() {
  if (!hasChanges.value) return

  saving.value = true
  errorMessage.value = ''

  try {
    await updateUserSettings(formData.value)
    await profileStore.loadProfile()
    initialData.value = { ...formData.value }
    notifySuccess(i18n.global.t('users.settings.saveSuccess'))
  } catch (error: any) {
    errorMessage.value = error?.response?.data?.detail || i18n.global.t('users.settings.saveError')
    notifyError(errorMessage.value)
  } finally {
    saving.value = false
  }
}
</script>
