/**
 * Composable for realtime connection status — v0.13.0
 * Provides reactive connection status and reconnection UI
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { realtimeService } from '../services/realtime'
import { CONNECTION_STATUS, mapToUiStatus } from '../core/realtime/reconnect'
import { notifyInfo, notifyWarning, notifyError } from '../utils/notify'
import { i18n } from '../i18n'

const t = (key, params) => {
  try {
    return i18n.global?.t?.(key, params) ?? key
  } catch {
    return key
  }
}

/**
 * Global reactive state (shared across components)
 */
const globalStatus = ref(CONNECTION_STATUS.DISCONNECTED)
const reconnectAttempt = ref(0)
const maxRetries = ref(5)
const isSyncing = ref(false)
const lastConnectedAt = ref(null)

/**
 * Composable for realtime connection status
 * @param {object} options
 * @returns {object}
 */
export function useRealtimeStatus(options = {}) {
  const { showNotifications = true, autoConnect = false } = options
  
  // Computed properties
  const isConnected = computed(() => globalStatus.value === CONNECTION_STATUS.CONNECTED)
  const isReconnecting = computed(() => globalStatus.value === CONNECTION_STATUS.RECONNECTING)
  const isDisconnected = computed(() => globalStatus.value === CONNECTION_STATUS.DISCONNECTED)
  const isFailed = computed(() => globalStatus.value === CONNECTION_STATUS.FAILED)
  
  const statusLabel = computed(() => {
    switch (globalStatus.value) {
      case CONNECTION_STATUS.CONNECTED:
        return t('errors.websocket.reconnected')
      case CONNECTION_STATUS.CONNECTING:
        return t('errors.websocket.reconnecting', { attempt: 1, max: maxRetries.value })
      case CONNECTION_STATUS.RECONNECTING:
        return t('errors.websocket.reconnecting', { attempt: reconnectAttempt.value, max: maxRetries.value })
      case CONNECTION_STATUS.SYNCING:
        return t('errors.websocket.syncing')
      case CONNECTION_STATUS.FAILED:
        return t('errors.websocket.maxRetries')
      default:
        return t('errors.websocket.disconnected')
    }
  })
  
  // Status change handler
  const handleStatusChange = (status) => {
    const uiStatus = mapToUiStatus(status)
    const prevStatus = globalStatus.value
    globalStatus.value = uiStatus
    
    if (!showNotifications) return
    
    // Show appropriate notification
    if (uiStatus === CONNECTION_STATUS.CONNECTED && prevStatus !== CONNECTION_STATUS.CONNECTED) {
      lastConnectedAt.value = new Date()
      if (prevStatus === CONNECTION_STATUS.RECONNECTING || prevStatus === CONNECTION_STATUS.SYNCING) {
        notifyInfo(t('errors.websocket.reconnected'))
      }
    } else if (uiStatus === CONNECTION_STATUS.FAILED) {
      notifyError(t('errors.websocket.maxRetries'))
    } else if (uiStatus === CONNECTION_STATUS.DISCONNECTED && prevStatus === CONNECTION_STATUS.CONNECTED) {
      notifyWarning(t('errors.websocket.disconnected'))
    }
  }
  
  // Realtime service event handlers
  let unsubscribeStatus = null
  
  const setupListeners = () => {
    unsubscribeStatus = realtimeService.on('status', (status) => {
      if (status === 'open') {
        handleStatusChange('connected')
      } else if (status === 'closed') {
        handleStatusChange('disconnected')
      } else if (status === 'connecting') {
        handleStatusChange('connecting')
      } else if (status === 'offline') {
        globalStatus.value = CONNECTION_STATUS.DISCONNECTED
      }
    })
  }
  
  const cleanup = () => {
    if (unsubscribeStatus) {
      unsubscribeStatus()
      unsubscribeStatus = null
    }
  }
  
  // Lifecycle
  onMounted(() => {
    setupListeners()
    
    // Check current status
    const currentState = realtimeService.getState()
    if (currentState === 'open') {
      globalStatus.value = CONNECTION_STATUS.CONNECTED
    }
    
    if (autoConnect && currentState !== 'open') {
      realtimeService.connect()
    }
  })
  
  onUnmounted(() => {
    cleanup()
  })
  
  // Manual reconnect trigger
  const reconnect = async () => {
    globalStatus.value = CONNECTION_STATUS.CONNECTING
    try {
      await realtimeService.connect()
    } catch (error) {
      console.error('[useRealtimeStatus] reconnect failed:', error)
    }
  }
  
  // Start syncing state (call after reconnect to show syncing indicator)
  const startSyncing = () => {
    isSyncing.value = true
    globalStatus.value = CONNECTION_STATUS.SYNCING
  }
  
  const stopSyncing = () => {
    isSyncing.value = false
    if (realtimeService.getState() === 'open') {
      globalStatus.value = CONNECTION_STATUS.CONNECTED
    }
  }
  
  return {
    // State
    status: globalStatus,
    isConnected,
    isReconnecting,
    isDisconnected,
    isFailed,
    isSyncing,
    reconnectAttempt,
    maxRetries,
    lastConnectedAt,
    
    // Computed
    statusLabel,
    
    // Actions
    reconnect,
    startSyncing,
    stopSyncing,
  }
}

export default useRealtimeStatus
