<template>
  <div class="staff-layout">
    <header class="staff-header" data-testid="staff-header">
      <div class="header-content">
        <div class="header-left">
          <router-link to="/staff" class="logo">
            <span class="logo-text">M4SH Staff</span>
          </router-link>
        </div>

        <nav class="staff-nav" data-testid="staff-nav">
          <router-link
            to="/staff"
            class="nav-link"
            data-testid="nav-dashboard"
            exact-active-class="active"
          >
            {{ $t('staff.nav.dashboard') }}
          </router-link>
          <router-link
            to="/staff/tutor-activity"
            class="nav-link"
            data-testid="nav-tutor-activity"
            active-class="active"
          >
            {{ $t('staff.nav.tutorActivity') }}
          </router-link>
        </nav>

        <div class="header-right">
          <Button
            variant="ghost"
            size="sm"
            data-testid="staff-logout-btn"
            @click="handleLogout"
          >
            {{ $t('staff.nav.logout') }}
          </Button>
        </div>
      </div>
    </header>

    <main class="staff-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import Button from '@/ui/Button.vue'

const router = useRouter()
const authStore = useAuthStore()

const handleLogout = async () => {
  await authStore.logout()
  router.push('/auth/login')
}
</script>

<style scoped>
.staff-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.staff-header {
  background: var(--card-bg);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 var(--space-xl);
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xl);
}

.header-left {
  flex-shrink: 0;
}

.logo {
  text-decoration: none;
  display: flex;
  align-items: center;
}

.logo-text {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-primary);
}

.staff-nav {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex: 1;
}

.nav-link {
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: var(--text-secondary);
  font-weight: 500;
  transition: all var(--transition-base);
}

.nav-link:hover {
  color: var(--text-primary);
  background: var(--bg-secondary);
}

.nav-link.active {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.header-right {
  flex-shrink: 0;
}

.staff-main {
  flex: 1;
  padding: var(--space-xl) 0;
}

@media (max-width: 768px) {
  .header-content {
    padding: 0 var(--space-md);
    flex-wrap: wrap;
    height: auto;
    padding-top: var(--space-md);
    padding-bottom: var(--space-md);
  }

  .staff-nav {
    order: 3;
    width: 100%;
    justify-content: flex-start;
    padding-top: var(--space-xs);
  }

  .header-right {
    order: 2;
  }
}
</style>
