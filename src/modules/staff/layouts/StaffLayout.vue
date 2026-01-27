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
          <button
            class="logout-btn"
            data-testid="staff-logout-btn"
            @click="handleLogout"
          >
            {{ $t('staff.nav.logout') }}
          </button>
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
  background: #f8fafc;
}

.staff-header {
  background: white;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 2rem;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
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
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a202c;
}

.staff-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.nav-link {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  text-decoration: none;
  color: #64748b;
  font-weight: 500;
  transition: all 0.2s;
}

.nav-link:hover {
  color: #1a202c;
  background: #f1f5f9;
}

.nav-link.active {
  color: #3b82f6;
  background: #eff6ff;
}

.header-right {
  flex-shrink: 0;
}

.logout-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  background: white;
  color: #64748b;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.logout-btn:hover {
  border-color: #cbd5e1;
  color: #1a202c;
}

.staff-main {
  flex: 1;
  padding: 2rem 0;
}

@media (max-width: 768px) {
  .header-content {
    padding: 0 1rem;
    flex-wrap: wrap;
    height: auto;
    padding-top: 1rem;
    padding-bottom: 1rem;
  }

  .staff-nav {
    order: 3;
    width: 100%;
    justify-content: flex-start;
    padding-top: 0.5rem;
  }

  .header-right {
    order: 2;
  }
}
</style>
