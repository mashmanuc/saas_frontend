<template>
  <aside
    role="navigation"
    :aria-label="$t('sidebar.ariaLabel')"
    class="app-sidebar"
    :class="{ collapsed: layout.sidebar.isCollapsed, 'mobile-open': layout.sidebar.isOpen }"
    data-testid="app-sidebar"
  >
    <div class="sidebar-header">
      <router-link to="/" class="sidebar-logo">
        <svg
          class="logo-icon-svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="24" height="24" rx="6" fill="currentColor" />
          <path
            d="M6 17V7l4 5 4-5v10M18 7v10"
            stroke="var(--card-bg, #fff)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span v-if="!layout.sidebar.isCollapsed" class="logo-text">M4SH</span>
      </router-link>
      <button
        v-if="!layout.sidebar.isCollapsed"
        class="collapse-btn desktop-only"
        :title="$t('sidebar.collapse')"
        :aria-expanded="true"
        :aria-label="$t('sidebar.collapse')"
        @click="layout.toggleSidebar()"
      >
        <ChevronsLeft :size="16" />
      </button>
      <button
        v-if="layout.sidebar.isCollapsed"
        class="collapse-btn desktop-only"
        :title="$t('sidebar.expand')"
        :aria-expanded="false"
        :aria-label="$t('sidebar.expand')"
        @click="layout.toggleSidebar()"
      >
        <ChevronsRight :size="16" />
      </button>
      <button
        class="close-btn mobile-only"
        :aria-label="$t('sidebar.closeMobile')"
        style="touch-action: manipulation;"
        @click="layout.closeSidebar()"
      >
        <X :size="16" />
      </button>
    </div>

    <nav class="sidebar-nav">
      <AppSidebarSection
        v-for="section in sections"
        :key="section.key"
        :section="section"
        :collapsed="layout.sidebar.isCollapsed"
      />
    </nav>

    <SidebarCoachingMarks />

    <div class="sidebar-footer" v-if="!layout.sidebar.isCollapsed">
      <span class="sidebar-version">v0.89</span>
    </div>
  </aside>

  <Transition name="overlay">
    <div
      v-if="layout.sidebar.isOpen"
      class="sidebar-overlay"
      style="touch-action: auto;"
      @click="layout.closeSidebar()"
    />
  </Transition>
</template>

<script setup lang="ts">
import { ChevronsLeft, ChevronsRight, X } from 'lucide-vue-next'
import AppSidebarSection from './AppSidebarSection.vue'
import SidebarCoachingMarks from './SidebarCoachingMarks.vue'
import type { SidebarSection } from './sidebar.types'
import { useLayoutStore } from '@/stores/layoutStore'

// Stage 4 of LAYOUT_SSOT migration:
// - props (collapsed, mobileOpen) DELETED — read from store directly.
// - emits (toggle-collapse, close-mobile) DELETED — actions called directly on store.
// - NO local ref(...) for sidebar state. Single source of truth = layoutStore.
// Refs: saas_docs/plans/LAYOUT_SSOT_2026-05-02.md §6 Stage 4.
defineProps<{
  sections: SidebarSection[]
}>()

const layout = useLayoutStore()
</script>

<style scoped>
.app-sidebar {
  /* G-2 Stage 2: dimensions from tokens.css (INV-G2-1, INV-G2-6). */
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

.app-sidebar.collapsed {
  width: var(--app-sidebar-width-collapsed);
}

/* ── Header ── */
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

.logo-text {
  letter-spacing: 0.02em;
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
  touch-action: manipulation;
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

.collapse-btn:focus-visible,
.close-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* ── Navigation ── */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-sm) 0;
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
}

.sidebar-nav::-webkit-scrollbar {
  width: 4px;
}

.sidebar-nav::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-nav::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 2px;
}

@media (pointer: coarse) {
  .sidebar-nav::-webkit-scrollbar {
    width: 8px;
  }
  .sidebar-nav::-webkit-scrollbar-thumb {
    border-radius: 4px;
  }
}

/* ── Footer ── */
.sidebar-footer {
  border-top: 1px solid var(--border-color);
  padding: var(--space-sm) var(--space-md);
  flex-shrink: 0;
}

.sidebar-version {
  font-size: 0.6875rem;
  color: var(--text-muted, var(--text-secondary));
  opacity: 0.5;
}

/* ── Overlay ── */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--text-primary, #000) 40%, transparent);
  z-index: 199;
}

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.25s ease;
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

/* ── Collapsed state ── */
.collapsed .sidebar-header {
  justify-content: center;
  padding: 0;
}

.collapsed .sidebar-nav :deep(.nav-item) {
  justify-content: center;
  padding: var(--space-xs);
  margin: 1px var(--space-xs);
}

.collapsed .sidebar-nav :deep(.nav-section-label) {
  display: none;
}

/* ── Mobile / Desktop visibility ── */
.mobile-only { display: none; }
.desktop-only { display: flex; }

@media (max-width: 1024px) {
  .app-sidebar {
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    /* G-2 INV-G2-6: mobile width = desktop (no 280→260 jump). */
    width: var(--app-sidebar-width-mobile);
  }

  .app-sidebar.mobile-open {
    transform: translateX(0);
  }

  .app-sidebar.collapsed {
    /* In overlay mode collapsed flag is moot; keep mobile width consistent. */
    width: var(--app-sidebar-width-mobile);
  }

  .mobile-only { display: flex; }
  .desktop-only { display: none; }
}
</style>
