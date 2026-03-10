<template>
  <header
    class="w-full h-16 flex items-center justify-between px-3 xs:px-4 md:px-6 sticky top-0 z-40"
    style="background-color: var(--nav-bg); border-bottom: 1px solid var(--border-color); backdrop-filter: blur(10px);"
  >
    <!-- LEFT: Logo + Mobile Menu Button -->
    <div class="flex items-center gap-4">
      <!-- Mobile menu toggle -->
      <button
        class="lg:hidden flex items-center justify-center w-10 h-10 rounded-md transition touch-target"
        style="color: var(--text-primary); touch-action: manipulation;"
        :aria-label="$t('sidebar.expand')"
        @click="$emit('toggleSideNav')"
      >
        <Menu :size="20" />
      </button>

      <!-- Logo: compact on mobile (<480px), full on larger -->
      <router-link to="/" class="flex items-center">
        <!-- Compact logo (M4 only) for xs screens -->
        <svg class="xs:hidden" width="50" height="32" viewBox="0 0 100 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <text x="0" y="48"
            font-family="'Arial Black', sans-serif"
            font-weight="900"
            font-size="52"
            letter-spacing="-2"
            fill="var(--text-primary, #111816)">M4</text>
          <circle cx="92" cy="12" r="7" fill="#1DB954"/>
        </svg>
        <!-- Full logo for xs+ -->
        <svg class="hidden xs:block" width="100" height="32" viewBox="0 0 200 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#1DB954"/>
              <stop offset="100%" stop-color="#158f3e"/>
            </linearGradient>
          </defs>
          <text x="0" y="48"
            font-family="'Arial Black', sans-serif"
            font-weight="900"
            font-size="52"
            letter-spacing="-2"
            fill="var(--text-primary, #111816)">M4</text>
          <text x="88" y="48"
            font-family="'Arial Black', sans-serif"
            font-weight="900"
            font-size="52"
            letter-spacing="-2"
            fill="url(#logoGrad)">SH</text>
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
    <div class="flex items-center gap-3">
      <ContactsBalanceWidget v-if="auth.user?.role === 'tutor'" class="hidden md:block" />
      <NotificationBell class="hidden xs:block" />
      <AvatarDropdown />
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../modules/auth/store/authStore'
import NotificationBell from '../components/Notifications/NotificationBell.vue'
import ContactsBalanceWidget from '../components/contacts/ContactsBalanceWidget.vue'
import AvatarDropdown from './AvatarDropdown.vue'
import { Menu } from 'lucide-vue-next'

const auth = useAuthStore()

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
