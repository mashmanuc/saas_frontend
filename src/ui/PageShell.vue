<template>
  <div class="min-h-screen flex bg-page text-body">

    <!-- New Sidebar -->
    <AppSidebar
      :sections="sidebarSections"
      :collapsed="sidebar.collapsed.value"
      :mobile-open="sidebar.mobileOpen.value"
      @toggle-collapse="sidebar.toggleCollapse"
      @close-mobile="sidebar.closeMobile"
    />

    <!-- Main area: offset for fixed sidebar -->
    <div
      class="flex-1 flex flex-col transition-[margin] duration-200"
      :class="mainAreaClass"
    >
      <TopNav @toggle-side-nav="sidebar.openMobile" />

      <main
        :class="[
          'mx-auto w-full',
          isMobile ? 'px-3 py-4' : 'p-6',
          isDesktop ? 'max-w-6xl' : 'max-w-full'
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
import { computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import TopNav from './TopNav.vue'
import ToastContainer from './ToastContainer.vue'
import GlobalLoader from './GlobalLoader.vue'
import SessionRevokedBanner from '../components/SessionRevokedBanner.vue'
import { useAuthStore } from '../modules/auth/store/authStore'
import { useSidebar } from '../composables/useSidebar'
import { useSidebarBadges } from '../composables/useSidebarBadges'
import { useResponsiveLayout } from '../composables/useResponsiveLayout'
import { getSectionedMenuByRole } from '../config/menu'

const router = useRouter()
const authStore = useAuthStore()
const sidebar = useSidebar()
const sidebarBadges = useSidebarBadges()
const { isMobile, isDesktop, width } = useResponsiveLayout()

onMounted(() => {
  sidebar.initFromStorage()
})

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
  if (!isDesktop.value) return '' // mobile/tablet — sidebar is overlay, no offset
  if (sidebar.collapsed.value) return 'lg:ml-16'
  return 'lg:ml-[260px]'
})

// Auto-collapse sidebar when viewport < 1280px
watch(width, (w) => {
  if (w < 1280 && !sidebar.collapsed.value && isDesktop.value) {
    sidebar.toggleCollapse()
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
