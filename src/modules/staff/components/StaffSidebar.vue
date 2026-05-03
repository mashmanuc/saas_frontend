<template>
  <aside
    class="staff-sidebar"
    :class="{ collapsed: collapsed, 'mobile-open': mobileOpen }"
    data-testid="staff-sidebar"
  >
    <div class="sidebar-header">
      <router-link to="/staff" class="sidebar-logo">
        <ShieldCheck class="logo-icon-svg" :size="22" />
        <span v-if="!collapsed" class="logo-text">{{ $t('staff.consoleName') }}</span>
      </router-link>
      <button
        v-if="!collapsed"
        class="collapse-btn desktop-only"
        :title="$t('staff.sidebar.collapse')"
        @click="$emit('toggle-collapse')"
      >
        <ChevronsLeft :size="16" />
      </button>
      <button
        v-if="collapsed"
        class="collapse-btn desktop-only"
        :title="$t('staff.sidebar.expand')"
        @click="$emit('toggle-collapse')"
      >
        <ChevronsRight :size="16" />
      </button>
      <button
        class="close-btn mobile-only"
        @click="$emit('close-mobile')"
      >
        <X :size="16" />
      </button>
    </div>

    <nav class="sidebar-nav">
      <div class="nav-section">
        <span v-if="!collapsed" class="nav-section-label">{{ $t('staff.sidebar.overview') }}</span>
        <router-link
          to="/staff"
          class="nav-item"
          :class="{ active: route.path === '/staff' }"
          :title="collapsed ? $t('staff.sidebar.dashboard') : undefined"
          exact
        >
          <LayoutDashboard class="nav-icon-svg" :size="18" />
          <span v-if="!collapsed" class="nav-label">{{ $t('staff.sidebar.dashboard') }}</span>
        </router-link>
        <router-link
          to="/staff/users"
          class="nav-item"
          :class="{ active: route.path.startsWith('/staff/users') }"
          :title="collapsed ? $t('staff.sidebar.users') : undefined"
        >
          <Users class="nav-icon-svg" :size="18" />
          <span v-if="!collapsed" class="nav-label">{{ $t('staff.sidebar.users') }}</span>
        </router-link>
      </div>

      <div class="nav-section">
        <span v-if="!collapsed" class="nav-section-label">{{ $t('staff.sidebar.operations') }}</span>
        <router-link
          to="/staff/reports"
          class="nav-item"
          :class="{ active: route.path.startsWith('/staff/reports') }"
          :title="collapsed ? $t('staff.sidebar.reports') : undefined"
        >
          <Flag class="nav-icon-svg" :size="18" />
          <span v-if="!collapsed" class="nav-label">{{ $t('staff.sidebar.reports') }}</span>
          <span v-if="!collapsed && openReportsCount > 0" class="nav-badge danger">{{ openReportsCount }}</span>
        </router-link>
        <router-link
          to="/staff/profile-moderation"
          class="nav-item"
          :class="{ active: route.path.startsWith('/staff/profile-moderation') }"
          :title="collapsed ? $t('staff.sidebar.profileModeration') : undefined"
        >
          <UserCheck class="nav-icon-svg" :size="18" />
          <span v-if="!collapsed" class="nav-label">{{ $t('staff.sidebar.profileModeration') }}</span>
        </router-link>
        <router-link
          to="/staff/verification"
          class="nav-item"
          :class="{ active: route.path.startsWith('/staff/verification') }"
          :title="collapsed ? $t('staff.sidebar.verification') : undefined"
        >
          <BadgeCheck class="nav-icon-svg" :size="18" />
          <span v-if="!collapsed" class="nav-label">{{ $t('staff.sidebar.verification') }}</span>
        </router-link>
        <router-link
          to="/staff/tutor-activity"
          class="nav-item"
          :class="{ active: route.path.startsWith('/staff/tutor-activity') }"
          :title="collapsed ? $t('staff.sidebar.tutorActivity') : undefined"
        >
          <Activity class="nav-icon-svg" :size="18" />
          <span v-if="!collapsed" class="nav-label">{{ $t('staff.sidebar.tutorActivity') }}</span>
        </router-link>
      </div>

      <div class="nav-section">
        <span v-if="!collapsed" class="nav-section-label">{{ $t('staff.sidebar.financeSection') }}</span>
        <router-link
          to="/staff/billing"
          class="nav-item"
          :class="{ active: route.path.startsWith('/staff/billing') }"
          :title="collapsed ? $t('staff.sidebar.billing') : undefined"
        >
          <CreditCard class="nav-icon-svg" :size="18" />
          <span v-if="!collapsed" class="nav-label">{{ $t('staff.sidebar.billing') }}</span>
        </router-link>
        <router-link
          to="/staff/payouts"
          class="nav-item"
          :class="{ active: route.path.startsWith('/staff/payouts') }"
          :title="collapsed ? $t('staff.sidebar.payouts') : undefined"
        >
          <Banknote class="nav-icon-svg" :size="18" />
          <span v-if="!collapsed" class="nav-label">{{ $t('staff.sidebar.payouts') }}</span>
        </router-link>
      </div>

      <div class="nav-section">
        <span v-if="!collapsed" class="nav-section-label">{{ $t('staff.sidebar.system') }}</span>
        <router-link
          to="/staff/health"
          class="nav-item"
          :class="{ active: route.path.startsWith('/staff/health') }"
          :title="collapsed ? $t('staff.sidebar.health') : undefined"
        >
          <HeartPulse class="nav-icon-svg" :size="18" />
          <span v-if="!collapsed" class="nav-label">{{ $t('staff.sidebar.health') }}</span>
        </router-link>
        <router-link
          to="/staff/health/realtime"
          class="nav-item"
          :class="{ active: route.path === '/staff/health/realtime' }"
          :title="collapsed ? 'Realtime' : undefined"
        >
          <Activity class="nav-icon-svg" :size="18" />
          <span v-if="!collapsed" class="nav-label">Realtime</span>
        </router-link>
        <router-link
          v-if="userRole === 'superadmin' || userRole === 'SUPERADMIN'"
          to="/staff/subscription-plans"
          class="nav-item"
          :class="{ active: route.path.startsWith('/staff/subscription-plans') }"
          :title="collapsed ? $t('staff.sidebar.subscriptionPlans') : undefined"
        >
          <PackageOpen class="nav-icon-svg" :size="18" />
          <span v-if="!collapsed" class="nav-label">{{ $t('staff.sidebar.subscriptionPlans') }}</span>
        </router-link>
        <router-link
          to="/staff/platform-settings"
          class="nav-item"
          :class="{ active: route.path.startsWith('/staff/platform-settings') }"
          :title="collapsed ? $t('staff.sidebar.platformSettings') : undefined"
        >
          <SlidersHorizontal class="nav-icon-svg" :size="18" />
          <span v-if="!collapsed" class="nav-label">{{ $t('staff.sidebar.platformSettings') }}</span>
        </router-link>
        <router-link
          to="/staff/analytics"
          class="nav-item"
          :class="{ active: route.path.startsWith('/staff/analytics') }"
          :title="collapsed ? $t('staff.sidebar.analytics') : undefined"
        >
          <BarChart3 class="nav-icon-svg" :size="18" />
          <span v-if="!collapsed" class="nav-label">{{ $t('staff.sidebar.analytics') }}</span>
        </router-link>
      </div>
    </nav>

    <div class="sidebar-footer">
      <router-link
        to="/"
        class="nav-item"
        :title="collapsed ? $t('staff.sidebar.backToApp') : undefined"
      >
        <ArrowLeft class="nav-icon-svg" :size="18" />
        <span v-if="!collapsed" class="nav-label">{{ $t('staff.sidebar.backToApp') }}</span>
      </router-link>
    </div>
  </aside>

  <!-- Mobile overlay -->
  <div
    v-if="mobileOpen"
    class="sidebar-overlay"
    @click="$emit('close-mobile')"
  />
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import {
  ShieldCheck,
  ChevronsLeft,
  ChevronsRight,
  X,
  LayoutDashboard,
  Users,
  Flag,
  UserCheck,
  BadgeCheck,
  Activity,
  CreditCard,
  Banknote,
  HeartPulse,
  PackageOpen,
  BarChart3,
  SlidersHorizontal,
  ArrowLeft,
} from 'lucide-vue-next'

defineProps<{
  collapsed: boolean
  mobileOpen: boolean
  openReportsCount?: number
  userRole?: string
}>()

defineEmits<{
  'toggle-collapse': []
  'close-mobile': []
}>()

const route = useRoute()
</script>

<style scoped>
.staff-sidebar {
  /* G-2 Stage 2: dimensions from tokens.css (shared with AppSidebar). */
  width: var(--app-sidebar-width);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--card-bg);
  border-right: 1px solid var(--border-color);
  transition: width 0.2s ease;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 200;
}

.staff-sidebar.collapsed {
  width: var(--app-sidebar-width-collapsed);
}

.sidebar-header {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-md);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  text-decoration: none;
  color: var(--text-primary);
  font-weight: 700;
  font-size: var(--text-base);
  overflow: hidden;
  white-space: nowrap;
}

.logo-icon-svg {
  flex-shrink: 0;
  color: var(--accent);
}

.collapse-btn,
.close-btn {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  transition: all var(--transition-base);
  flex-shrink: 0;
}

.collapse-btn:hover,
.close-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-sm) 0;
}

.nav-section {
  padding: var(--space-xs) 0;
}

.nav-section + .nav-section {
  border-top: 1px solid var(--border-color);
  margin-top: var(--space-xs);
  padding-top: var(--space-sm);
}

.nav-section-label {
  display: block;
  padding: var(--space-xs) var(--space-md);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted, var(--text-secondary));
  opacity: 0.7;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-md);
  margin: 1px var(--space-xs);
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: 500;
  transition: all var(--transition-base);
  white-space: nowrap;
  overflow: hidden;
}

.nav-item:hover {
  color: var(--text-primary);
  background: var(--bg-secondary);
}

.nav-item.active {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.nav-icon-svg {
  flex-shrink: 0;
  width: 20px;
}

.nav-badge {
  margin-left: auto;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 0.6875rem;
  font-weight: 600;
  flex-shrink: 0;
}

.nav-badge.danger {
  background: var(--danger-bg, #ef4444);
  color: #fff;
}

.sidebar-footer {
  border-top: 1px solid var(--border-color);
  padding: var(--space-sm) 0;
  flex-shrink: 0;
}

.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 199;
}

/* Collapsed state */
.collapsed .sidebar-header {
  justify-content: center;
  padding: 0;
}

.collapsed .nav-item {
  justify-content: center;
  padding: var(--space-xs);
  margin: 1px var(--space-xs);
}

.collapsed .nav-section-label {
  display: none;
}

/* Mobile / Desktop visibility */
.mobile-only { display: none; }
.desktop-only { display: flex; }

@media (max-width: 1024px) {
  .staff-sidebar {
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    /* G-2 INV-G2-6: mobile width = desktop. */
    width: var(--app-sidebar-width-mobile);
  }

  .staff-sidebar.mobile-open {
    transform: translateX(0);
  }

  .staff-sidebar.collapsed {
    width: var(--app-sidebar-width-mobile);
  }

  .mobile-only { display: flex; }
  .desktop-only { display: none; }
}
</style>
