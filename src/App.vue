<template>
  <PageThemeProvider>
    <router-view />
    <DiagnosticsPanel v-if="isDev" />
    <AuditOverlayAsync v-if="isAuditMode" />
  </PageThemeProvider>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, ref, computed, defineAsyncComponent } from 'vue'
import { PageThemeProvider } from './modules/ui/theme'
import { DiagnosticsPanel } from './modules/diagnostics'
import { isAuditEnabled } from '@/debug/isAuditEnabled'
import { useAuthStore } from '@/modules/auth/store/authStore'
// import { useUserContextQuery } from '@/api/queries/useUserContextQuery'  // Phase 29 B1 — disabled until backend endpoint ready
import { useNotificationsStore } from '@/stores/notificationsStore'
import { websocketService } from '@/services/websocket'
import { pollingCoordinator } from '@/services/pollingCoordinator'
import { jankDetector } from '@/utils/jankDetector'

const isDev = import.meta.env.DEV

// Phase 30 B4: Lazy-loaded audit overlay (INV-3: 0 bytes in prod if disabled)
const AuditOverlayAsync = defineAsyncComponent(() => import('@/debug/AuditOverlay.vue'))
const isAuditMode = computed(() => isAuditEnabled())

// Jank detector — тільки в dev mode (MutationObserver + fetch patching = overhead у production)
// ERR-3 fix: delay start to avoid adding overhead during initial navigation mount
if (isDev) {
  setTimeout(() => jankDetector.start(), 2000)
}

let unsubNotifPolling = null

const authStore = useAuthStore()

// Phase 29 B1: user context (entitlements + limits + billing) via TanStack Query
// DISABLED: Backend endpoint /v1/users/me/context/ not yet implemented.
// Uncomment when Agent C (Phase 28) deploys the endpoint.
// const { entitlements: _ctx } = useUserContextQuery({ enabled: computed(() => authStore.isAuthenticated) })

onMounted(async () => {
  const notificationsStore = useNotificationsStore()

  await authStore.bootstrap()
  if (!authStore.isAuthenticated) {
    return
  }

  // Setup global WebSocket subscription for notifications
  // This is the SINGLE SOURCE for WS events - Bell just reads from store
  if (authStore.user?.id) {
    setupNotificationsRealtime(authStore.user.id)
    // Anti-jank: use pollingCoordinator instead of manual startPolling
    const pollInterval = isWsConnected.value ? 300_000 : 60_000
    unsubNotifPolling = pollingCoordinator.register({
      id: 'notifications-unread',
      fn: () => notificationsStore.pollUnreadCount(),
      interval: pollInterval,
      priority: 'low',
      runImmediately: true,
      visibilityAware: true,
    })
  }
})

// WebSocket connection state (used for adaptive polling)
const isWsConnected = ref(false)

// WebSocket subscription state for notifications
let wsUnsubscribe = null

function setupNotificationsRealtime(userId) {
  const notificationsStore = useNotificationsStore()
  
  try {
    wsUnsubscribe = websocketService.subscribeNotifications(
      userId,
      (event) => {
        // Media processing complete → dispatch CustomEvent for sidebar components
        if (event.type === 'content.processing_complete' && event.payload) {
          window.dispatchEvent(new CustomEvent('content:processing-complete', {
            detail: event.payload,
          }))
          return
        }
        notificationsStore.handleRealtimeNotification(event)
      }
    )
    isWsConnected.value = true
    notificationsStore.setRealtimeActive(true)
    console.log('[App] WS notifications subscription active')
  } catch (err) {
    console.error('[App] Failed to setup WS notifications:', err)
    isWsConnected.value = false
    notificationsStore.setRealtimeActive(false)
  }
}

function cleanupNotificationsRealtime() {
  if (wsUnsubscribe) {
    wsUnsubscribe()
    wsUnsubscribe = null
  }
  isWsConnected.value = false
  const notificationsStore = useNotificationsStore()
  notificationsStore.setRealtimeActive(false)
  // Anti-jank: unsubscribe from pollingCoordinator instead of manual stopPolling
  if (unsubNotifPolling) {
    unsubNotifPolling()
    unsubNotifPolling = null
  }
}

// Watch auth state to manage WS subscription and polling
const stopAuthWatch = watch(
  () => useAuthStore().isAuthenticated,
  (isAuth) => {
    const authStore = useAuthStore()
    const notificationsStore = useNotificationsStore()
    if (isAuth && authStore.user?.id) {
      // FIX WARN-2: cleanup previous polling before re-registering to avoid subscriber leak
      if (unsubNotifPolling) {
        unsubNotifPolling()
        unsubNotifPolling = null
      }
      setupNotificationsRealtime(authStore.user.id)
      // Anti-jank: use pollingCoordinator
      const pollInterval = isWsConnected.value ? 300_000 : 60_000
      unsubNotifPolling = pollingCoordinator.register({
        id: 'notifications-unread',
        fn: () => notificationsStore.pollUnreadCount(),
        interval: pollInterval,
        priority: 'low',
        runImmediately: true,
        visibilityAware: true,
      })
    } else {
      cleanupNotificationsRealtime()
    }
  }
)

onBeforeUnmount(() => {
  cleanupNotificationsRealtime()
  stopAuthWatch()
  jankDetector.stop()
  pollingCoordinator.dispose()
})
</script>
