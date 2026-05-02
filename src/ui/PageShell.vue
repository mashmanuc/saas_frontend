<template>
  <div class="min-h-screen flex bg-page text-body">

    <!-- Sidebar (Stage 4 done — single source of truth = layoutStore).
         AppSidebar reads layout.sidebar.* directly + calls store actions
         on click. PageShell only passes :sections (data, not state).
         INV-LAYOUT-7 satisfied automatically (no bridge to race). -->
    <AppSidebar :sections="sidebarSections" />

    <!-- Main area: offset for fixed sidebar -->
    <div
      class="flex-1 flex flex-col transition-[margin] duration-200"
      :class="mainAreaClass"
    >
      <TopNav @toggle-side-nav="layout.openSidebar()" />

      <main
        :class="[
          'mx-auto w-full',
          layout.isMobile ? 'px-3 py-4' : 'p-6',
          layout.isDesktop ? 'max-w-6xl' : 'max-w-full'
        ]"
      >
        <router-view />
      </main>
    </div>

    <!-- Toasts & Loader overlay -->
    <ToastContainer class="z-50" />
    <GlobalLoader />

    <!-- Session Revoked Banner -->
    <SessionRevokedBanner
      :show="authStore.showSessionRevokedBanner"
      :request-id="authStore.sessionRevokedRequestId"
      @close="authStore.showSessionRevokedBanner = false"
    />
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import TopNav from './TopNav.vue'
import ToastContainer from './ToastContainer.vue'
import GlobalLoader from './GlobalLoader.vue'
import SessionRevokedBanner from '../components/SessionRevokedBanner.vue'
import { useAuthStore } from '../modules/auth/store/authStore'
import { useSidebarBadges } from '../composables/useSidebarBadges'
import { useLayoutStore } from '@/stores/layoutStore'
import { getSectionedMenuByRole } from '../config/menu'

const router = useRouter()
const authStore = useAuthStore()
const layout = useLayoutStore()
const sidebarBadges = useSidebarBadges()

// Stage 3 of LAYOUT_SSOT migration — see saas_docs/plans/LAYOUT_SSOT_2026-05-02.md.
// - Legacy composables removed (instances → singleton store).
// - localStorage read happens у layoutStore.init() (App.vue setup).
// - Auto-collapse breakpoint watch DELETED — D-1 LOCKED: collapse_bp == overlay_bp == lg.
//   Sidebar collapses ONLY via manual user toggle (button or Ctrl+B).
// - mainAreaClass reads sidebarMode + isCollapsed via store derived getters.
//   Tailwind ml-* classes will become CSS vars in G-2 (audit).

const sidebarSections = computed(() => {
  const sections = getSectionedMenuByRole(authStore.user?.role)
  return sections.map(section => ({
    ...section,
    items: section.items.map(item => {
      const badge = sidebarBadges.getBadge(item.to)
      if (badge) {
        return { ...item, badge: badge.count, badgeType: badge.type }
      }
      return item
    }),
  }))
})

const mainAreaClass = computed(() => {
  // Overlay mode (mobile/tablet) — sidebar is fixed-positioned, no margin offset.
  if (layout.sidebarMode === 'overlay') return ''
  // Static mode (desktop) — main content offsets by sidebar width.
  if (layout.sidebar.isCollapsed) return 'lg:ml-16'
  return 'lg:ml-[260px]'
})

watch(
  () => authStore.showSessionRevokedBanner,
  (show) => {
    if (show) {
      router.push('/auth/login')
    }
  }
)
</script>
