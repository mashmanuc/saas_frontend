<template>
  <router-link
    :to="item.to"
    class="nav-item"
    :class="{ active: isActive }"
    :title="collapsed ? $t(item.label) : (item.hint ? $t(item.hint) : undefined)"
    :aria-current="isActive ? 'page' : undefined"
  >
    <component :is="iconComponent" class="nav-icon-svg" :size="18" />
    <span v-if="!collapsed" class="nav-label">{{ $t(item.label) }}</span>
    <span
      v-if="!collapsed && item.badge && item.badge > 0"
      class="nav-badge"
      :class="item.badgeType || 'info'"
      :aria-label="$t('sidebar.badge.ariaLabel', { count: item.badge })"
    >
      {{ item.badge }}
    </span>
  </router-link>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  Home,
  Calendar,
  BookOpen,
  PencilLine,
  Users,
  MessageCircle,
  Inbox,
  Briefcase,
  Wallet,
  BarChart3,
  Settings,
  Bell,
  Search,
  LayoutDashboard,
  CreditCard,
  GraduationCap,
  Package,
  Layout,
  Folder,
  Circle,
  Gamepad2,
  LifeBuoy,
} from 'lucide-vue-next'

import type { Component } from 'vue'
import type { SidebarItem } from './sidebar.types'

const ICON_MAP: Record<string, Component> = {
  'home': Home,
  'calendar': Calendar,
  'book-open': BookOpen,
  'pencil-line': PencilLine,
  'users': Users,
  'message-circle': MessageCircle,
  'inbox': Inbox,
  'briefcase': Briefcase,
  'wallet': Wallet,
  'bar-chart-3': BarChart3,
  'settings': Settings,
  'bell': Bell,
  'search': Search,
  'layout-dashboard': LayoutDashboard,
  'credit-card': CreditCard,
  'graduation-cap': GraduationCap,
  'package': Package,
  'layout': Layout,
  'folder': Folder,
  'gamepad-2': Gamepad2,
  'life-buoy': LifeBuoy,
}

const props = defineProps<{
  item: SidebarItem
  collapsed: boolean
}>()

const route = useRoute()

const isActive = computed(() => {
  const path = route.path
  if (props.item.to === '/tutor' || props.item.to === '/student') {
    return path === props.item.to
  }
  return path === props.item.to || path.startsWith(props.item.to + '/')
})

const iconComponent = computed(() => {
  return ICON_MAP[props.item.icon] || Circle
})
</script>

<style scoped>
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
  min-height: var(--touch-target-min, 44px);
  touch-action: manipulation;
}

.nav-item:hover {
  color: var(--text-primary);
  background: var(--bg-secondary);
}

.nav-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.nav-item.active {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.nav-icon-svg {
  flex-shrink: 0;
  width: 20px;
}

.nav-label {
  overflow: hidden;
  text-overflow: ellipsis;
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
  color: var(--accent-contrast, #fff);
}

.nav-badge.warning {
  background: var(--warning-bg, #f59e0b);
  color: var(--accent-contrast, #fff);
}

.nav-badge.info {
  background: var(--info-bg, #3b82f6);
  color: var(--accent-contrast, #fff);
}
</style>
