<template>
  <form class="space-y-6" @submit.prevent="handleSubmit">
    <div>
      <h3 class="text-lg font-semibold text-foreground">
        {{ $t('users.settings.general.title') }}
      </h3>
      <p class="text-sm text-muted-foreground">
        {{ $t('users.settings.general.description') }}
      </p>
    </div>

    <div class="space-y-4">
      <div>
        <label for="language" class="block text-sm font-medium text-foreground">
          {{ $t('users.settings.general.language') }}
        </label>
        <select
          id="language"
          v-model="formData.ui_language"
          :disabled="saving"
          class="input mt-1"
          @change="handleChange"
        >
          <option value="uk">Українська</option>
          <option value="en">English</option>
          <option value="ru">Русский</option>
        </select>
      </div>

      <div>
        <label for="timezone" class="block text-sm font-medium text-foreground">
          {{ $t('users.settings.general.timezone') }}
        </label>
        <select
          id="timezone"
          v-model="formData.timezone"
          :disabled="saving"
          class="input mt-1"
          @change="handleChange"
        >
          <option value="UTC">UTC</option>
          <option value="Europe/Kiev">Europe/Kiev</option>
          <option value="Europe/London">Europe/London</option>
          <option value="America/New_York">America/New_York</option>
          <option value="America/Los_Angeles">America/Los_Angeles</option>
        </select>
      </div>

      <!-- Помічник Інтегралик — увімк/вимк (per-акаунт, синхронно) -->
      <div class="flex items-start gap-3 pt-2">
        <input
          id="integralyk"
          v-model="formData.integralyk_enabled"
          type="checkbox"
          :disabled="saving"
          class="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          @change="handleChange"
        />
        <label for="integralyk" class="text-sm">
          <span class="block font-medium text-foreground">Помічник Інтегралик</span>
          <span class="block text-muted-foreground">Показувати AI-помічника (маскот + командна палітра). Вимкніть, якщо не потрібен.</span>
        </label>
      </div>
    </div>

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
import { useProfileStore } from '../../store/profileStore'
import { getUserSettings, updateUserSettings } from '@/api/users'
import { notifySuccess, notifyError } from '@/utils/notify'
import { i18n } from '@/i18n'

const profileStore = useProfileStore()

const formData = ref({
  ui_language: 'uk',
  timezone: 'UTC',
  integralyk_enabled: true
})

const initialData = ref({ ...formData.value })
const saving = ref(false)
const loading = ref(false)
const errorMessage = ref('')

const hasChanges = computed(() => {
  return JSON.stringify(formData.value) !== JSON.stringify(initialData.value)
})

onMounted(async () => {
  // Try cached settings first, then fetch from API
  let settings = profileStore.settings
  if (!settings) {
    loading.value = true
    try {
      settings = await getUserSettings()
      profileStore.settings = settings
    } catch { /* silent — form will use defaults */ }
    finally { loading.value = false }
  }
  if (settings) {
    formData.value = {
      ui_language: settings.ui_language || settings.language || 'uk',
      timezone: settings.timezone || 'UTC',
      integralyk_enabled: settings.integralyk_enabled !== false
    }
    initialData.value = { ...formData.value }
  }
})

function handleChange() {
  errorMessage.value = ''
}

function handleReset() {
  formData.value = { ...initialData.value }
  errorMessage.value = ''
}

async function handleSubmit() {
  if (!hasChanges.value) return

  saving.value = true
  errorMessage.value = ''

  try {
    const updated = await updateUserSettings(formData.value)
    // Update local settings in profileStore without calling loadProfile
    if (profileStore.settings) {
      profileStore.settings = { ...profileStore.settings, ...updated }
    }
    initialData.value = { ...formData.value }
    // Apply locale change
    if (formData.value.ui_language && i18n.global.locale) {
      i18n.global.locale.value = formData.value.ui_language as any
    }
    notifySuccess(i18n.global.t('users.settings.saveSuccess'))
  } catch (error: any) {
    errorMessage.value = error?.response?.data?.detail || i18n.global.t('users.settings.saveError')
    notifyError(errorMessage.value)
  } finally {
    saving.value = false
  }
}
</script>
