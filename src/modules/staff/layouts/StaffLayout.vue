<template>
  <div class="staff-layout" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <StaffSidebar
      :collapsed="sidebarCollapsed"
      :mobile-open="mobileMenuOpen"
      :open-reports-count="openReportsCount"
      @toggle-collapse="sidebarCollapsed = !sidebarCollapsed"
      @close-mobile="mobileMenuOpen = false"
    />

    <div class="staff-content">
      <header class="staff-topbar" data-testid="staff-topbar">
        <div class="topbar-left">
          <button
            class="mobile-menu-btn"
            @click="mobileMenuOpen = true"
          >
            ☰
          </button>
        </div>

        <div class="topbar-right">
          <span class="topbar-user" v-if="authStore.user">
            {{ authStore.user.first_name || authStore.user.email }}
          </span>
          <Button
            variant="ghost"
            size="sm"
            data-testid="staff-logout-btn"
            @click="handleLogout"
          >
            {{ $t('staff.nav.logout') }}
          </Button>
        </div>
      </header>

      <main class="staff-main">
        <StaffBreadcrumbs />
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth/store/authStore'
import apiClient from '@/utils/apiClient'
import Button from '@/ui/Button.vue'
import StaffSidebar from '../components/StaffSidebar.vue'
import StaffBreadcrumbs from '../components/StaffBreadcrumbs.vue'

const router = useRouter()
const authStore = useAuthStore()

const sidebarCollapsed = ref(false)
const mobileMenuOpen = ref(false)
const openReportsCount = ref(0)

const handleLogout = async () => {
  await authStore.logout()
  router.push('/auth/login')
}

onMounted(async () => {
  try {
    const res = await apiClient.get('/v1/staff/stats/overview/', {
      meta: { skipLoader: true },
    })
    if (res?.trust?.open_reports != null) {
      openReportsCount.value = res.trust.open_reports
    }
  } catch {
    // Silent — badge is non-critical
  }
})
</script>

<style scoped>
.staff-layout {
  min-height: 100vh;
  display: flex;
  background: var(--bg-primary);
}

.staff-content {
  flex: 1;
  margin-left: 260px;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  transition: margin-left 0.2s ease;
}

.sidebar-collapsed .staff-content {
  margin-left: 64px;
}

.staff-topbar {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-lg);
  background: var(--card-bg);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 100;
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.mobile-menu-btn {
  display: none;
  background: none;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  cursor: pointer;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.topbar-user {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: 500;
}

.staff-main {
  flex: 1;
  padding: var(--space-lg);
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
}

@media (max-width: 1024px) {
  .staff-content {
    margin-left: 0;
  }

  .sidebar-collapsed .staff-content {
    margin-left: 0;
  }

  .mobile-menu-btn {
    display: flex;
  }
}

@media (max-width: 768px) {
  .staff-main {
    padding: var(--space-md);
  }

  .staff-topbar {
    padding: 0 var(--space-md);
  }
}
</style>
