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
          v-model="formData.language"
          :disabled="saving"
          class="input mt-1"
          @change="handleChange"
        >
          <option value="uk">Українська</option>
          <option value="en">English</option>
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

      <div class="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p class="font-medium text-foreground">
            {{ $t('users.settings.general.darkMode') }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ $t('users.settings.general.darkModeDescription') }}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          :aria-checked="formData.dark_mode"
          :disabled="saving"
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          :class="formData.dark_mode ? 'bg-primary' : 'bg-surface-muted'"
          @click="toggleDarkMode"
        >
          <span
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            :class="formData.dark_mode ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
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
import { updateUserSettings } from '@/api/users'
import { notifySuccess, notifyError } from '@/utils/notify'
import { i18n } from '@/i18n'

const profileStore = useProfileStore()

const formData = ref({
  language: 'uk',
  timezone: 'UTC',
  dark_mode: false
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
      language: profileStore.settings.language || 'uk',
      timezone: profileStore.settings.timezone || 'UTC',
      dark_mode: profileStore.settings.dark_mode || false
    }
    initialData.value = { ...formData.value }
  }
})

function handleChange() {
  errorMessage.value = ''
}

function toggleDarkMode() {
  formData.value.dark_mode = !formData.value.dark_mode
  handleChange()
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
