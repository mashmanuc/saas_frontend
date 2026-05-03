<template>
  <div class="min-h-screen flex bg-page text-body">

    <!-- Sidebar (Stage 4 done — single source of truth = layoutStore).
         AppSidebar reads layout.sidebar.* directly + calls store actions
         on click. PageShell only passes :sections (data, not state).
         INV-LAYOUT-7 satisfied automatically (no bridge to race). -->
    <AppSidebar :sections="sidebarSections" />

    <!-- Main area: offset for fixed sidebar.
         G-2 Stage 2 Path B (Tailwind JIT verify failed for lg:ml-[var(...)],
         так що використовуємо Vue inline :style binding замість Tailwind class).
         CSS vars resolve runtime через standard CSS — без Tailwind involvement. -->
    <div
      class="flex-1 flex flex-col transition-[margin] duration-200"
      :style="mainAreaStyle"
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

// ═══════════════════════════════════════════════════════════════════
// ARCHITECTURAL NOTE — Layout margins via Vue :style (LOCKED 2026-05-02)
// ═══════════════════════════════════════════════════════════════════
//
// IMPORTANT: Tailwind JIT does NOT support CSS var arbitrary values
// reliably in this project (`lg:ml-[var(--app-sidebar-width)]` returns
// 0 matches у production CSS — verified via `npm run build` + grep).
//
// Layout margins for the main shell area are controlled via Vue :style
// binding bound to `mainAreaStyle` computed. CSS vars resolve at runtime
// through standard CSS engine — no Tailwind dependency.
//
// 🔒 DO NOT revert this to Tailwind classes (e.g. `lg:ml-[var(...)]`,
//    `lg:ml-[260px]`, etc.). This is INV-G2-7 — architectural decision,
//    not a temporary fallback. See:
//      - saas_docs/plans/G2_CSS_TOKENS_RESEARCH_2026-05-02.md §12.1
//      - INV-G2-7 (Layout margins via Vue :style)
//
// Why locked:
//   - Single source of truth: layoutStore (state) + tokens.css (vars).
//   - Layout is store-driven, consistent with rest of Layout SSoT.
//   - Reactive: `layout.sidebar.isCollapsed` change → margin updates
//     without Tailwind regeneration.
//   - Simpler debug: store stress tests cover margin behavior.
//
// Allowed: Tailwind utility classes for OTHER layout aspects (padding,
// flex, grid, etc.). Forbidden ONLY for sidebar margin offsets here.
const mainAreaStyle = computed(() => {
  // Overlay mode (mobile/tablet) — sidebar is fixed-positioned, no margin offset.
  if (layout.sidebarMode === 'overlay') return {}
  // Static mode (desktop) — main content offsets by sidebar width.
  return {
    marginLeft: layout.sidebar.isCollapsed
      ? 'var(--app-sidebar-width-collapsed)'
      : 'var(--app-sidebar-width)',
  }
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
