<template>
  <PageThemeProvider>
    <router-view />
    <DiagnosticsPanel v-if="isDev" />
    <AuditOverlayAsync v-if="isAuditMode" />
    <!-- Global chat overlay — відкривається з notification (bell/toast) по thread_id -->
    <ChatModalAsync
      v-if="authStore.isAuthenticated"
      :is-open="chatOverlay.isOpen"
      :initial-thread-id="chatOverlay.threadId"
      :other-user-name="chatOverlay.otherUserName"
      @close="chatOverlay.close"
    />
    <!-- UIA Command Palette (Ctrl+Shift+K) — глобальна продуктова точка входу (вкл. редактор дошки).
         Gated VITE_FEATURE_UIA + tutor/staff усередині. Removable: видалити modules/intent + цей рядок. -->
    <CommandPalette v-if="authStore.isAuthenticated" />
  </PageThemeProvider>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, ref, computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import { PageThemeProvider } from './modules/ui/theme'
import { DiagnosticsPanel } from './modules/diagnostics'
import { isAuditEnabled } from '@/debug/isAuditEnabled'
import { useAuthStore } from '@/modules/auth/store/authStore'
// import { useUserContextQuery } from '@/api/queries/useUserContextQuery'  // Phase 29 B1 — disabled until backend endpoint ready
import { useNotificationsStore } from '@/stores/notificationsStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { websocketService } from '@/services/websocket'
import { pollingCoordinator } from '@/services/pollingCoordinator'
import { jankDetector } from '@/utils/jankDetector'
import { notifyInfo } from '@/utils/notify'
import { useChatOverlayStore } from '@/stores/chatOverlayStore'

const ChatModalAsync = defineAsyncComponent(() => import('@/modules/chat/components/ChatModal.vue'))
const CommandPalette = defineAsyncComponent(() => import('@/modules/intent/CommandPalette.vue'))

const isDev = import.meta.env.DEV

// ═══════════════════════════════════════════════════
// Layout SSoT — synchronous init BEFORE first render (INV-LAYOUT-1, R-2)
// ═══════════════════════════════════════════════════
// CRITICAL: must be top-level synchronous (NOT onMounted) — sets viewport
// from window dimensions and <html data-hydrated="true"> BEFORE first commit.
// Without this, mobile devices see 1-frame desktop layout flicker.
// Refs: saas_docs/plans/LAYOUT_SSOT_2026-05-02.md §4.1, INV-LAYOUT-11.

// Stage 5 mode (post-sweep) — listener budget tightened to ≤2 (was ≤3 transitional).
// Legacy Dashboard composables deleted; only layoutStore + WB useDeviceMode
// own resize-related listeners now.
if (typeof window !== 'undefined') {
  window.__layoutStage5Mode = true
}

const layout = useLayoutStore()
layout.init()
layout.bindRouteChanges(useRoute())

// Global chat overlay — notification (bell/toast) відкриває working ChatModal по thread_id.
// P4 suppression: не показувати toast якщо саме цей thread уже відкрито в overlay.
const chatOverlay = useChatOverlayStore()

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
    // FE-P1 (2026-04-30): runImmediately = false коли WS connected — initial
    // unread count прийде через WS handshake/server-push, не via HTTP poll
    // (запобігає дублюванню в init burst + WS-receive). Якщо WS down → poll
    // кожні 60s, runImmediately=true як fallback.
    unsubNotifPolling = pollingCoordinator.register({
      id: 'notifications-unread',
      fn: () => notificationsStore.pollUnreadCount(),
      interval: pollInterval,
      priority: 'low',
      runImmediately: !isWsConnected.value,
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

        // LESSON_STARTED → active toast з кнопкою "Приєднатись"
        if (event.type === 'LESSON_STARTED' && event.payload) {
          notifyInfo(event.payload.body || 'Тьютор чекає на вас', {
            title: event.payload.title || 'Урок розпочався',
            action: {
              href: event.payload.data?.room_url,
              label: 'Приєднатись',
            },
            timeout: 12000,
          })
        }

        // CHAT_MESSAGE → toast з кнопкою "Відкрити" (відкриває working ChatModal по thread_id).
        // P4 suppression: не показувати toast якщо саме цей thread уже відкрито в overlay.
        // Bell badge оновлюється завжди (нижче через handleRealtimeNotification).
        if (event.type === 'CHAT_MESSAGE' && event.payload) {
          const threadId = event.payload.data?.thread_id
          const viewingThisThread = threadId && chatOverlay.isOpen && chatOverlay.threadId === threadId
          if (!viewingThisThread) {
            notifyInfo(event.payload.body || 'Нове повідомлення', {
              title: event.payload.title || 'Нове повідомлення',
              action: threadId ? { label: 'Відкрити', chatThreadId: threadId } : undefined,
              timeout: 8000,
            })
          }
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
      // FE-P1: runImmediately gated на WS state (consistent з onMounted handler)
      unsubNotifPolling = pollingCoordinator.register({
        id: 'notifications-unread',
        fn: () => notificationsStore.pollUnreadCount(),
        interval: pollInterval,
        priority: 'low',
        runImmediately: !isWsConnected.value,
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
  // Layout SSoT cleanup — primarily for HMR/tests; in prod App rarely unmounts.
  // HMR survival is also covered by acceptHMRUpdate hook у layoutStore.ts.
  layout.destroy()
})
</script>
