import { defineStore } from 'pinia'
import { ref, computed, toRaw } from 'vue'
import { notificationsApi } from '@/api/notifications'
import type { InAppNotification, NotificationPreferences, RealtimeNotificationEvent } from '@/types/notifications'
import { rethrowAsDomainError } from '@/utils/rethrowAsDomainError'

function deepClone<T>(value: T): T {
  const raw = toRaw(value) as T
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(raw)
    } catch {
      // ignore and fallback to JSON clone
    }
  }
  return JSON.parse(JSON.stringify(raw)) as T
}

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<InAppNotification[]>([])
  const unreadCount = ref<number>(0)
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const preferences = ref<NotificationPreferences | null>(null)
  const isLoadingPreferences = ref<boolean>(false)
  const preferencesError = ref<string | null>(null)

  // Dev / playground compatibility (existing project expectations)
  const mockOffline = ref(false)
  const debugEvents = ref<any[]>([])

  let pollInterval: ReturnType<typeof setInterval> | null = null

  // WebSocket realtime state
  const isRealtimeActive = ref(false)
  let wsUnsubscribe: (() => void) | null = null

  const unreadItems = computed(() => items.value.filter(n => !n.read_at))

  const latestItems = computed(() => items.value.slice(0, 10))

  const sortedItems = computed(() => {
    return [...items.value].sort((a, b) => {
      const at = a.created_at ? Date.parse(a.created_at) : 0
      const bt = b.created_at ? Date.parse(b.created_at) : 0
      return bt - at
    })
  })

  async function loadNotifications(params?: { unreadOnly?: boolean; limit?: number; offset?: number }) {
    isLoading.value = true
    error.value = null

    try {
      const response = await notificationsApi.getNotifications(params)
      
      // ⚠️ CONTRACT FIX: Backend returns { notifications: [...] }
      const rawNotifications = response?.notifications ?? []
      const notifications = Array.isArray(rawNotifications) ? deepClone(rawNotifications) : []
      
      items.value = notifications
      unreadCount.value = notifications.filter(n => !n.read_at).length
      
      // Повертаємо response для пагінації
      return response
    } catch (err) {
      error.value = String(err)
      items.value = []
      try {
        rethrowAsDomainError(err)
      } catch {
        // keep UI-driven error handling
      }
      return null
    } finally {
      isLoading.value = false
    }
  }

  // Backward compatibility: legacy test suite + old UI pieces
  async function fetchNotifications(options?: { replace?: boolean; cursor?: string | null }) {
    // Old API supported cursor pagination; current v0.65 MVP uses limit.
    // Keep behavior minimal for tests.
    await loadNotifications({ limit: 10 })
  }

  async function markAsRead(id: string) {
    const notification = items.value.find(n => n.id === id)
    if (!notification) return

    const wasUnread = !notification.read_at

    notification.read_at = new Date().toISOString()
    if (wasUnread) {
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }

    try {
      const updated = await notificationsApi.markAsRead(id)
      const index = items.value.findIndex(n => n.id === id)
      if (index !== -1) {
        const current = items.value[index]
        const patch = deepClone(updated)
        items.value[index] = {
          ...current,
          ...patch,
          // keep optimistic timestamp if API returned partial payload
          read_at: patch.read_at ?? current.read_at,
        }
      }
    } catch (err) {
      if (wasUnread) {
        unreadCount.value += 1
      }
      notification.read_at = null
      error.value = String(err)
      rethrowAsDomainError(err)
    }
  }

  async function markAllAsRead() {
    const previousItems = deepClone(items.value)
    const previousUnreadCount = unreadCount.value

    items.value.forEach(n => {
      if (!n.read_at) {
        n.read_at = new Date().toISOString()
      }
    })
    unreadCount.value = 0

    try {
      await notificationsApi.markAllAsRead()
    } catch (err) {
      items.value = previousItems
      unreadCount.value = previousUnreadCount
      error.value = String(err)
      rethrowAsDomainError(err)
    }
  }

  async function pollUnreadCount() {
    /**
     * ⚠️ Оптимізація: не оновлюємо state якщо count не змінився
     * CONTRACT FIX: Backend returns { notifications: [...] }
     */
    try {
      const response = await notificationsApi.getNotifications({ unreadOnly: true, limit: 1 })
      // Backend returns { notifications: [...] } not { count: N }
      // Compute count from notifications array length
      const notifications = response?.notifications ?? []
      const newCount = Array.isArray(notifications) ? notifications.length : 0
      const currentCount = unreadCount.value
      
      // Оновлюємо тільки якщо значення змінилося
      if (newCount !== currentCount) {
        unreadCount.value = newCount
      }
    } catch (err) {
      // Silent fail - log only for debugging
      console.error('[notificationsStore] pollUnreadCount failed:', err)
    }
  }

  function startPolling(intervalMs: number = 60000) {
    if (pollInterval) {
      stopPolling()
    }
    pollInterval = setInterval(() => {
      pollUnreadCount()
    }, intervalMs)
    pollUnreadCount()
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  async function loadPreferences() {
    isLoadingPreferences.value = true
    preferencesError.value = null

    try {
      preferences.value = deepClone(await notificationsApi.getPreferences())
    } catch (err) {
      preferencesError.value = String(err)
      rethrowAsDomainError(err)
    } finally {
      isLoadingPreferences.value = false
    }
  }

  async function updatePreferences(updates: Partial<NotificationPreferences>) {
    isLoadingPreferences.value = true
    preferencesError.value = null

    const previous = preferences.value ? deepClone(preferences.value) : null

    if (preferences.value) {
      Object.assign(preferences.value, updates)
    }

    try {
      preferences.value = deepClone(await notificationsApi.updatePreferences(updates))
    } catch (err) {
      if (previous) {
        preferences.value = previous
      }
      preferencesError.value = String(err)
      rethrowAsDomainError(err)
    } finally {
      isLoadingPreferences.value = false
    }
  }

  /**
   * Handle realtime notification from WebSocket
   * Adds notification to list and updates unread count
   */
  function handleRealtimeNotification(event: RealtimeNotificationEvent) {
    const { payload } = event

    // Check if notification already exists (idempotency)
    const existingIndex = items.value.findIndex(n => n.id === payload.id)
    if (existingIndex !== -1) {
      // Update existing if needed
      return
    }

    // Convert to InAppNotification format
    const newNotification: InAppNotification = {
      id: payload.id,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      created_at: payload.created_at,
      read_at: null, // Realtime notifications are always unread initially
    }

    // Add to beginning of list (newest first)
    items.value = [newNotification, ...items.value]
    unreadCount.value += 1

    // Log for debugging
    debugEvents.value = [
      { type: 'realtime_notification', at: new Date().toISOString(), id: payload.id },
      ...debugEvents.value.slice(0, 99) // Keep last 100 events
    ]
  }

  /**
   * Mark store as having active realtime connection
   * Used to adjust polling behavior
   */
  function setRealtimeActive(active: boolean) {
    isRealtimeActive.value = active
  }

  function addMockNotification(input: any) {
    // Used by DevThemePlayground and legacy tests
    const now = new Date().toISOString()
    const normalized: InAppNotification = {
      id: String(input?.id ?? `mock-${Date.now()}`),
      type: String(input?.type ?? 'mock'),
      title: String(input?.title ?? ''),
      body: String(input?.body ?? input?.payload?.body ?? ''),
      data: (input?.data && typeof input.data === 'object') ? input.data : {},
      created_at: String(input?.created_at ?? now),
      read_at: input?.read_at ?? null,
      // tolerate extra fields in runtime
      ...(input?.payload ? { payload: { ...input.payload, title: input.title } } : {}),
    } as any

    items.value = [normalized, ...items.value]
    if (!normalized.read_at) {
      unreadCount.value += 1
    }
    debugEvents.value = [{ type: 'mock_notification', at: now, id: normalized.id }, ...debugEvents.value]
  }

  function toggleOfflineSimulation() {
    mockOffline.value = !mockOffline.value
  }

  function $reset() {
    items.value = []
    unreadCount.value = 0
    isLoading.value = false
    error.value = null
    preferences.value = null
    isLoadingPreferences.value = false
    preferencesError.value = null
    mockOffline.value = false
    debugEvents.value = []
    stopPolling()
  }

  return {
    items,
    unreadCount,
    isLoading,
    error,
    preferences,
    isLoadingPreferences,
    preferencesError,
    unreadItems,
    latestItems,
    sortedItems,
    loadNotifications,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    pollUnreadCount,
    startPolling,
    stopPolling,
    handleRealtimeNotification,
    setRealtimeActive,
    isRealtimeActive,
    loadPreferences,
    updatePreferences,
    addMockNotification,
    toggleOfflineSimulation,
    mockOffline,
    debugEvents,

    // Legacy aliases for older tests/UI
    loading: isLoading,
    lastError: error,
    $reset,
  }
})
