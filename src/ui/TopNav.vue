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

      <!-- Logo -->
      <router-link to="/" class="flex items-center">
        <svg width="100" height="32" viewBox="0 0 200 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#1DB954"/>
              <stop offset="100%" stop-color="#158f3e"/>
            </linearGradient>
          </defs>
          <!-- M4 (dark on light) -->
          <text x="0" y="48"
            font-family="'Arial Black', sans-serif"
            font-weight="900"
            font-size="52"
            letter-spacing="-2"
            fill="var(--text-primary, #111816)">M4</text>
          <!-- SH (green gradient) -->
          <text x="88" y="48"
            font-family="'Arial Black', sans-serif"
            font-weight="900"
            font-size="52"
            letter-spacing="-2"
            fill="url(#logoGrad)">SH</text>
          <!-- Green dot accent -->
          <circle cx="192" cy="12" r="7" fill="#1DB954"/>
        </svg>
      </router-link>

      <!-- Primary Navigation -->
      <nav v-if="auth.isAuthenticated" class="hidden md:flex items-center gap-1 ml-6">
        <router-link
          v-for="item in primaryNav"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          :class="{ active: $route.path === item.to || $route.path.startsWith(item.to + '/') }"
        >
          {{ $t(item.label) }}
        </router-link>
      </nav>
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
        <span v-if="false" class="realtime-indicator" role="status">
          <span class="dot" aria-hidden="true" />
          <span class="label">{{ $t('realtime.offline') }}</span>
        </span>
        <ContactsBalanceWidget v-if="auth.user?.role === 'tutor'" class="hidden sm:block" />
        <NotificationBell class="hidden sm:block" />
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
import NotificationBell from '../components/Notifications/NotificationBell.vue'
import ContactsBalanceWidget from '../components/contacts/ContactsBalanceWidget.vue'
import { useRealtimeStore } from '../stores/realtimeStore'

const router = useRouter()
const auth = useAuthStore()
const settings = useSettingsStore()
const theme = useThemeStore()
const realtime = useRealtimeStore()
const { t } = useI18n()

const isRealtimeOffline = computed(() => realtime.status !== 'open')

/* ------------------------- Primary Navigation ------------------------- */
const PRIMARY_NAV_BY_ROLE = {
  tutor: [],
  student: [],
  admin: [
    { label: 'nav.staff', to: '/staff' },
    { label: 'nav.dashboard', to: '/tutor' },
  ],
  superadmin: [
    { label: 'nav.staff', to: '/staff' },
    { label: 'nav.dashboard', to: '/tutor' },
  ],
}

const primaryNav = computed(() => {
  const role = auth.user?.role
  return PRIMARY_NAV_BY_ROLE[role] || []
})

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

<style scoped>
.nav-link {
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.nav-link:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.nav-link.active {
  color: var(--accent);
  background: rgba(79, 70, 229, 0.1);
}
</style>
