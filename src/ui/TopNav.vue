<template>
  <header
    class="w-full h-16 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800/70
           flex items-center justify-between px-6 sticky top-0 z-40 backdrop-blur"
  >
    <!-- LEFT: Logo + Mobile Menu Button -->
    <div class="flex items-center gap-4">
      <!-- Mobile menu toggle -->
      <button
        class="md:hidden text-gray-700 dark:text-gray-300"
        @click="$emit('toggleSideNav')"
      >
        ☰
      </button>

      <h1 class="font-semibold text-lg text-gray-800 dark:text-gray-100">
        M4SH Platform
      </h1>
    </div>

    <!-- RIGHT SIDE -->
    <div class="flex items-center gap-4">

      <!-- Theme toggle -->
      <div class="flex items-center gap-1 rounded-full border border-gray-200 dark:border-neutral-700 overflow-hidden text-xs" :aria-label="$t('nav.theme.label')">
        <button
          v-for="option in themeOptions"
          :key="option.value"
          type="button"
          class="px-2.5 py-1 flex items-center gap-1 transition"
          :class="theme.theme === option.value
            ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
            : 'text-gray-600 dark:text-gray-300'"
          :title="$t(option.labelKey)"
          :aria-pressed="theme.theme === option.value"
          @click="setTheme(option.value)"
        >
          <span aria-hidden="true">{{ option.icon }}</span>
          <span class="hidden lg:inline">{{ $t(option.labelKey) }}</span>
        </button>
      </div>

      <!-- User avatar -->
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
          {{ userInitials }}
        </div>

        <span class="hidden md:inline text-gray-700 dark:text-gray-200 text-sm">
          {{ auth.user.first_name }}
        </span>
      </div>

      <!-- Logout -->
      <button
        @click="logout"
        class="text-sm text-red-500 hover:text-red-600 dark:text-red-400"
      >
        {{ $t('nav.logout') }}
      </button>

      <!-- Role badge -->
      <span
        v-if="roleLabel"
        class="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium dark:bg-neutral-800 dark:text-gray-200"
      >
        {{ roleLabel }}
      </span>

      <!-- Language switch -->
      <div class="flex items-center rounded-full border border-gray-200 dark:border-neutral-700 overflow-hidden text-xs">
        <button
          v-for="locale in localeOptions"
          :key="locale"
          type="button"
          @click="changeLocale(locale)"
          class="px-3 py-1 transition-colors"
          :class="locale === currentLocale ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-300'"
        >
          {{ locale.toUpperCase() }}
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../modules/auth/store/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useThemeStore } from '../stores/themeStore'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const auth = useAuthStore()
const settings = useSettingsStore()
const theme = useThemeStore()
const { t } = useI18n()

/* ------------------------- Logout ------------------------- */
function logout() {
  auth.logout()
  router.push('/auth/login')
}

/* ------------------------- User initials ------------------------- */
const userInitials = computed(() => {
  if (!auth.user) return '?'
  const f = auth.user.first_name?.[0] ?? ''
  const l = auth.user.last_name?.[0] ?? ''
  return (f + l).toUpperCase()
})

/* ------------------------- Theme toggle ------------------------- */
const themeOptions = [
  { value: 'light', icon: '☀️', labelKey: 'nav.theme.light' },
  { value: 'dark', icon: '🌙', labelKey: 'nav.theme.dark' },
  { value: 'system', icon: '🖥', labelKey: 'nav.theme.system' },
]

function setTheme(value) {
  theme.setTheme(value)
}

const roleLabel = computed(() => {
  const role = auth.user?.role
  if (!role) return ''
  return t(`role.${role}`)
})

/* ------------------------- Language toggle ------------------------- */
const localeOptions = ['uk', 'en']
const currentLocale = computed(() => settings.locale)

function changeLocale(locale) {
  if (locale === currentLocale.value) return
  settings.setLocale(locale)
}
</script>
