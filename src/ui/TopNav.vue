<template>
  <header
    class="w-full h-16 flex items-center justify-between px-6 sticky top-0 z-40"
    style="background-color: var(--nav-bg); border-bottom: 1px solid var(--border-color); backdrop-filter: blur(10px);"
  >
    <!-- LEFT: Logo + Mobile Menu Button -->
    <div class="flex items-center gap-4">
      <!-- Mobile menu toggle -->
      <button
        class="md:hidden"
        style="color: var(--text-primary);"
        @click="$emit('toggleSideNav')"
      >
        ☰
      </button>

      <h1 class="font-semibold text-lg" style="color: var(--text-primary);">
        M4SH Platform
      </h1>
    </div>

    <!-- RIGHT SIDE -->
    <div class="flex items-center gap-4">

      <!-- Theme toggle -->
      <div
        class="flex items-center gap-1 rounded-full overflow-hidden text-xs"
        style="border: 1px solid var(--border-color);"
        :aria-label="$t('nav.theme.label')"
      >
        <button
          v-for="option in themeOptions"
          :key="option.value"
          type="button"
          class="px-2.5 py-1 flex items-center gap-1 transition"
          :style="theme.theme === option.value
            ? 'background: var(--accent); color: var(--accent-contrast);'
            : 'color: var(--text-secondary);'"
          :title="$t(option.labelKey)"
          :aria-pressed="theme.theme === option.value"
          @click="setTheme(option.value)"
        >
          <span aria-hidden="true">{{ option.icon }}</span>
          <span class="hidden lg:inline">{{ $t(option.labelKey) }}</span>
        </button>
      </div>

      <div class="flex items-center gap-2">
        <span v-if="isRealtimeOffline" class="realtime-indicator" role="status">
          <span class="dot" aria-hidden="true" />
          <span class="label">{{ $t('realtime.offline') }}</span>
        </span>
        <NotificationDropdown class="hidden sm:block" />
      </div>

      <!-- User avatar -->
      <div class="flex items-center gap-2">
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center font-bold"
          style="background: var(--accent); color: var(--accent-contrast);"
        >
          {{ userInitials }}
        </div>

        <span class="hidden md:inline text-sm" style="color: var(--text-primary);">
          {{ userName }}
        </span>
      </div>

      <!-- Logout -->
      <button
        @click="logout"
        class="text-sm transition"
        style="color: var(--danger-bg);"
      >
        {{ $t('nav.logout') }}
      </button>

      <!-- Role badge -->
      <span
        v-if="roleLabel"
        class="px-2 py-1 rounded-full text-xs font-medium"
        style="background-color: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);"
      >
        {{ roleLabel }}
      </span>

      <!-- Language switch -->
      <div
        class="flex items-center rounded-full overflow-hidden text-xs"
        style="border: 1px solid var(--border-color);"
      >
        <button
          v-for="locale in localeOptions"
          :key="locale"
          type="button"
          @click="changeLocale(locale)"
          class="px-3 py-1 transition-colors"
          :style="locale === currentLocale
            ? 'background: var(--accent); color: var(--accent-contrast);'
            : 'color: var(--text-secondary);'"
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
import NotificationDropdown from './NotificationDropdown.vue'
import { useRealtimeStore } from '../stores/realtimeStore'

const router = useRouter()
const auth = useAuthStore()
const settings = useSettingsStore()
const theme = useThemeStore()
const realtime = useRealtimeStore()
const { t } = useI18n()

const isRealtimeOffline = computed(() => realtime.status !== 'open')

/* ------------------------- Logout ------------------------- */
async function logout() {
  try {
    await auth.logout()
  } finally {
    router.push('/auth/login').catch(() => {})
  }
}

/* ------------------------- User initials ------------------------- */
const userInitials = computed(() => {
  if (!auth.user) return '?'
  const f = auth.user.first_name?.[0] ?? ''
  const l = auth.user.last_name?.[0] ?? ''
  return (f + l).toUpperCase()
})

const userName = computed(() => {
  if (!auth.user) return ''
  return auth.user.first_name || auth.user.email || ''
})

/* ------------------------- Theme toggle ------------------------- */
const themeOptions = [
  { value: 'light', icon: '🌿', labelKey: 'nav.theme.light' },
  { value: 'dark', icon: '🌙', labelKey: 'nav.theme.dark' },
  { value: 'classic', icon: '🎓', labelKey: 'nav.theme.classic' },
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
