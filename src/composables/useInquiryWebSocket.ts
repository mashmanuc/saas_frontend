/**
 * useInquiryWebSocket composable - Phase 3 F3.3
 * 
 * WebSocket integration для inquiry domain з exponential backoff reconnect.
 * 
 * Інваріанти:
 * - WS URL: /ws/inquiries/ (без user_id у path)
 * - Events: inquiry.created, inquiry.updated
 * - Payload: { type, inquiry: { id, status, updated_at } }
 * - Reconnect: exponential backoff 1s → 2s → 4s → 8s → cap 30s
 * - На 401/403: зупинити reconnect, показати toast
 * - Без sound/desktop notifications
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { useInquiriesStore } from '@/stores/inquiriesStore'
import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'
import { buildWsUrl } from '@/utils/wsUrl'

interface InquiryWebSocketEvent {
  type: 'inquiry.created' | 'inquiry.updated'
  inquiry: {
    id: string
    status: string
    updated_at: string
  }
}

interface UseInquiryWebSocketOptions {
  autoConnect?: boolean
  onEvent?: (event: InquiryWebSocketEvent) => void
}

export function useInquiryWebSocket(options: UseInquiryWebSocketOptions = {}) {
  const { autoConnect = true, onEvent } = options
  
  const inquiriesStore = useInquiriesStore()
  const toast = useToast()
  const { t } = useI18n()
  
  const isConnected = ref(false)
  const reconnectAttempts = ref(0)
  const shouldReconnect = ref(true)
  
  let ws: WebSocket | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  
  const INITIAL_DELAY = 1000 // 1s
  const MAX_DELAY = 30000 // 30s
  const BACKOFF_MULTIPLIER = 2
  
  /**
   * Розрахувати delay для exponential backoff
   */
  function getReconnectDelay(): number {
    const delay = INITIAL_DELAY * Math.pow(BACKOFF_MULTIPLIER, reconnectAttempts.value)
    return Math.min(delay, MAX_DELAY)
  }
  
  /**
   * Підключитися до WebSocket
   */
  function connect() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      return
    }
    
    const wsUrl = buildWsUrl('/ws/inquiries/')
    
    try {
      ws = new WebSocket(wsUrl)
      
      ws.onopen = () => {
        isConnected.value = true
        reconnectAttempts.value = 0 // Reset delay on successful connection
        
        // Telemetry
        if (typeof window !== 'undefined' && (window as any).telemetry) {
          (window as any).telemetry.track('inquiry.ws_connected', {
            attempts: reconnectAttempts.value
          })
        }
      }
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as InquiryWebSocketEvent
          
          // Handle inquiry events
          if (data.type === 'inquiry.created' || data.type === 'inquiry.updated') {
            // Refresh inquiries store
            inquiriesStore.refetch()
            
            // Call custom handler if provided
            if (onEvent) {
              onEvent(data)
            }
            
            // Telemetry
            if (typeof window !== 'undefined' && (window as any).telemetry) {
              (window as any).telemetry.track('inquiry.ws_event', {
                type: data.type,
                inquiry_id: data.inquiry.id,
                status: data.inquiry.status
              })
            }
          }
        } catch (err) {
          console.error('[inquiry-ws] Failed to parse message:', err)
        }
      }
      
      ws.onerror = (error) => {
        console.error('[inquiry-ws] WebSocket error:', error)
        
        // Telemetry
        if (typeof window !== 'undefined' && (window as any).telemetry) {
          (window as any).telemetry.track('inquiry.ws_error', {
            attempts: reconnectAttempts.value
          })
        }
      }
      
      ws.onclose = (event) => {
        isConnected.value = false
        
        // Check for auth errors (401/403)
        if (event.code === 1008 || event.code === 4401 || event.code === 4403) {
          shouldReconnect.value = false
          toast.error(t('inquiries.ws.sessionExpired'))
          
          // Telemetry
          if (typeof window !== 'undefined' && (window as any).telemetry) {
            (window as any).telemetry.track('inquiry.ws_auth_error', {
              code: event.code
            })
          }
          
          return
        }
        
        // Reconnect with exponential backoff
        if (shouldReconnect.value) {
          const delay = getReconnectDelay()
          reconnectAttempts.value++
          
          reconnectTimeout = setTimeout(() => {
            connect()
          }, delay)
          
          // Telemetry
          if (typeof window !== 'undefined' && (window as any).telemetry) {
            (window as any).telemetry.track('inquiry.ws_reconnecting', {
              attempts: reconnectAttempts.value,
              delay
            })
          }
        }
      }
    } catch (err) {
      console.error('[inquiry-ws] Failed to create WebSocket:', err)
    }
  }
  
  /**
   * Відключитися від WebSocket
   */
  function disconnect() {
    shouldReconnect.value = false
    
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    
    if (ws) {
      ws.close()
      ws = null
    }
    
    isConnected.value = false
  }
  
  onMounted(() => {
    if (autoConnect) {
      connect()
    }
  })
  
  onUnmounted(() => {
    disconnect()
  })
  
  return {
    isConnected,
    reconnectAttempts,
    connect,
    disconnect
  }
}
