<template>
  <PageThemeProvider>
    <router-view />
    <DiagnosticsPanel v-if="isDev" />
  </PageThemeProvider>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, ref } from 'vue'
import { PageThemeProvider } from './modules/ui/theme'
import { DiagnosticsPanel } from './modules/diagnostics'
import { useEntitlementsStore } from '@/stores/entitlementsStore'
import { useBillingStore } from '@/modules/billing/stores/billingStore'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { websocketService } from '@/services/websocket'
import { pollingCoordinator } from '@/services/pollingCoordinator'
import { jankDetector } from '@/utils/jankDetector'

const isDev = import.meta.env.DEV

// Anti-jank: start jank detector (silent in production, verbose in dev)
if (isDev) {
  jankDetector.start()
} else {
  jankDetector.startSilent()
}

let unsubNotifPolling = null

onMounted(async () => {
  const entitlementsStore = useEntitlementsStore()
  const billingStore = useBillingStore()
  const authStore = useAuthStore()
  const notificationsStore = useNotificationsStore()

  await authStore.bootstrap()
  if (!authStore.isAuthenticated) {
    return
  }
  
  try {
    await Promise.all([
      entitlementsStore.loadEntitlements(),
      billingStore.fetchMe()
    ])
  } catch (err) {
    console.debug('Failed to load entitlements/billing on app mount:', err)
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
