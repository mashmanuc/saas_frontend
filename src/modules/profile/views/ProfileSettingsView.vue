<template>
  <div class="space-y-6">
    <Card class="space-y-2">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading :level="1">
            {{ $t('profile.settingsPage.title') }}
          </Heading>
          <p class="text-sm text-muted-foreground">
            {{ $t('profile.settingsPage.description') }}
          </p>
        </div>
        <Button variant="outline" size="sm" @click="goBack">
          {{ $t('profile.actions.cancel') }}
        </Button>
      </div>
    </Card>

    <Card
      v-if="errorMessage"
      class="border-red-200 bg-red-50 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
    >
      {{ errorMessage }}
    </Card>

    <div class="grid gap-6 lg:grid-cols-2">
      <ProfileCard
        :title="$t('profile.settingsPage.timezone.title')"
        :subtitle="$t('profile.settingsPage.timezone.subtitle')"
      >
        <form class="space-y-4" @submit.prevent="handleTimezoneSave">
          <div>
            <label class="mb-1 block text-sm font-medium text-primary">
              {{ $t('profile.form.timezone') }}
              <span class="text-red-500">*</span>
            </label>
            <select
              v-model="form.timezone"
              class="input w-full appearance-none"
              :class="{ error: !!timezoneError, disabled: isSaving }"
              :disabled="isSaving"
            >
              <option value="" disabled>
                {{ $t('profile.form.timezonePlaceholder') }}
              </option>
              <option v-for="option in timezoneOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <p v-if="timezoneError" class="mt-1 text-sm text-red-500">
              {{ timezoneError }}
            </p>
          </div>

          <Button type="submit" variant="primary" :disabled="isSaving" :loading="isSaving">
            {{ isSaving ? $t('profile.settingsPage.actions.saving') : $t('profile.settingsPage.actions.saveTimezone') }}
          </Button>
        </form>

        <div class="mt-8 space-y-3">
          <p class="text-sm font-semibold text-foreground">
            {{ $t('profile.settingsPage.language.label') }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ $t('profile.settingsPage.language.subtitle') }}
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="option in languageOptions"
              :key="option.value"
              type="button"
              class="rounded-full border px-4 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              :class="option.value === form.ui_language ? 'border-primary bg-primary/10 text-primary' : 'border-border-subtle text-muted-foreground hover:text-foreground'"
              :disabled="isSaving"
              @click="handleLanguageChange(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </ProfileCard>

      <ProfileCard
        :title="$t('profile.settingsPage.preferences.title')"
        :subtitle="$t('profile.settingsPage.preferences.subtitle')"
      >
        <div class="space-y-6">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-foreground">
                {{ $t('profile.settingsPage.notifications.label') }}
              </p>
              <p class="text-sm text-muted-foreground">
                {{ $t('profile.settingsPage.notifications.subtitle') }}
              </p>
            </div>
            <button
              type="button"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              :class="form.notifications_enabled ? 'bg-primary' : 'bg-border-subtle'"
              :disabled="isPreferencesDisabled"
              @click="toggleNotifications"
            >
              <span class="sr-only">{{ $t('profile.settingsPage.notifications.label') }}</span>
              <span
                class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
                :class="form.notifications_enabled ? 'translate-x-5' : 'translate-x-1'"
              />
            </button>
          </div>

          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-foreground">
                {{ $t('profile.settingsPage.privacy.label') }}
              </p>
              <p class="text-sm text-muted-foreground">
                {{ $t('profile.settingsPage.privacy.subtitle') }}
              </p>
            </div>
            <button
              type="button"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              :class="form.privacy_public_profile ? 'bg-primary' : 'bg-border-subtle'"
              :disabled="isPreferencesDisabled"
              @click="togglePrivacy"
            >
              <span class="sr-only">{{ $t('profile.settingsPage.privacy.label') }}</span>
              <span
                class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
                :class="form.privacy_public_profile ? 'translate-x-5' : 'translate-x-1'"
              />
            </button>
          </div>
        </div>
      </ProfileCard>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Heading from '../../../ui/Heading.vue'
import ProfileCard from '../components/ProfileCard.vue'
import { useProfileStore } from '../store/profileStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { TIMEZONES } from '../../../utils/timezones'

const router = useRouter()
const { t } = useI18n()
const profileStore = useProfileStore()
const settingsStore = useSettingsStore()

const timezoneOptions = TIMEZONES
const form = reactive({
  timezone: 'Europe/Kyiv',
  ui_language: settingsStore.locale,
  notifications_enabled: true,
  privacy_public_profile: true,
})
const timezoneError = ref('')

const isSaving = computed(() => profileStore.saving)
const isLoadingProfile = computed(() => profileStore.loading && !profileStore.initialized)
const isPreferencesDisabled = computed(() => !profileStore.initialized || profileStore.loading || profileStore.saving)
const errorMessage = computed(() => profileStore.error)
const languageOptions = computed(() => [
  { value: 'uk', label: t('lang.uk') },
  { value: 'en', label: t('lang.en') },
])

watch(
  () => ({
    settings: profileStore.settings,
    user: profileStore.user,
  }),
  ({ settings, user }) => {
    form.timezone = settings?.timezone || user?.timezone || form.timezone || timezoneOptions[0]?.value || 'UTC'
    form.ui_language = settings?.ui_language || form.ui_language || settingsStore.locale
    form.notifications_enabled =
      typeof settings?.notifications_enabled === 'boolean' ? settings.notifications_enabled : form.notifications_enabled
    form.privacy_public_profile =
      typeof settings?.privacy_public_profile === 'boolean'
        ? settings.privacy_public_profile
        : form.privacy_public_profile
  },
  { immediate: true },
)

async function ensureProfileLoaded() {
  if (profileStore.initialized || profileStore.loading) return
  try {
    await profileStore.loadProfile()
  } catch (error) {
    console.error('Failed to load profile', error)
  }
}

function validateTimezone() {
  timezoneError.value = form.timezone ? '' : t('profile.messages.validationTimezone')
  return !timezoneError.value
}

async function handleTimezoneSave() {
  if (!validateTimezone()) return
  try {
    await profileStore.updateSettings({ timezone: form.timezone })
  } catch (error) {
    // error already surfaced via store
  }
}

async function handleLanguageChange(locale) {
  if (!locale || locale === form.ui_language || isSaving.value) return
  const previous = form.ui_language
  form.ui_language = locale
  settingsStore.setLocale(locale)
  try {
    await profileStore.updateSettings({ ui_language: locale })
  } catch (error) {
    form.ui_language = previous
    settingsStore.setLocale(previous)
  }
}

async function toggleNotifications() {
  if (isSaving.value) return
  const nextValue = !form.notifications_enabled
  form.notifications_enabled = nextValue
  try {
    await profileStore.updateSettings({ notifications_enabled: nextValue })
  } catch (error) {
    form.notifications_enabled = !nextValue
  }
}

async function togglePrivacy() {
  if (isSaving.value) return
  const nextValue = !form.privacy_public_profile
  form.privacy_public_profile = nextValue
  try {
    await profileStore.updateSettings({ privacy_public_profile: nextValue })
  } catch (error) {
    form.privacy_public_profile = !nextValue
  }
}

function goBack() {
  router.push('/dashboard/profile')
}

onMounted(() => {
  ensureProfileLoaded()
})
</script>
