import { computed } from 'vue'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { useNegotiationChatStore } from '@/stores/negotiationChatStore'

let globalSocket: WebSocket | null = null
let globalReconnectTimer: ReturnType<typeof setTimeout> | null = null
let globalShouldReconnect = false
let globalThreadId: string | null = null
let globalUserId: number | null = null

function getWsUrl(threadId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = window.location.host.includes(':5173')
    ? window.location.host.replace(':5173', ':8000')
    : (window.location.host || 'localhost:8000')
  const authStore = useAuthStore()
  const token = authStore.access || ''
  return `${protocol}://${host}/ws/room/${threadId}/?token=${token}`
}

function handleWsMessage(data: any): void {
  if (!data || data.type !== 'room.message' || !data.payload) return
  
  const payload = data.payload
  const store = useNegotiationChatStore()
  
  switch (payload.type) {
    case 'message.new':
      if (payload.message && globalThreadId) {
        store.appendMessage(globalThreadId, payload.message, globalUserId || undefined)
      }
      break
    case 'message.edited':
      if (payload.message && globalThreadId) {
        store.updateMessage(globalThreadId, payload.message)
      }
      break
    case 'message.deleted':
      if (payload.message_id && globalThreadId) {
        store.deleteMessage(globalThreadId, payload.message_id)
      }
      break
    case 'message.read':
      if (payload.message_id && globalThreadId) {
        store.markMessageRead(globalThreadId, payload.message_id)
      }
      break
  }
}

function connectInternal(threadId: string, userId?: number): void {
  if (globalSocket) {
    globalSocket.close()
    globalSocket = null
  }
  globalShouldReconnect = true
  globalThreadId = threadId
  globalUserId = userId || null

  try {
    globalSocket = new WebSocket(getWsUrl(threadId))
    globalSocket.onopen = () => console.log('[WS] Connected:', threadId)
    globalSocket.onmessage = (e) => handleWsMessage(JSON.parse(e.data))
    globalSocket.onclose = () => {
      if (globalShouldReconnect && !globalReconnectTimer) {
        globalReconnectTimer = setTimeout(() => {
          globalReconnectTimer = null
          if (globalShouldReconnect && globalThreadId) connectInternal(globalThreadId)
        }, 3000)
      }
    }
  } catch (err) {
    console.error('[WS] Connect failed:', err)
  }
}

function disconnectInternal(): void {
  globalShouldReconnect = false
  if (globalReconnectTimer) {
    clearTimeout(globalReconnectTimer)
    globalReconnectTimer = null
  }
  if (globalSocket) {
    globalSocket.close()
    globalSocket = null
  }
  globalThreadId = null
}

export function wsConnect(threadId: string, userId?: number): void {
  if (globalThreadId === threadId && globalSocket?.readyState === WebSocket.OPEN) return
  disconnectInternal()
  connectInternal(threadId, userId)
}

export function wsDisconnect(): void {
  disconnectInternal()
}

export function wsSend(message: any): boolean {
  if (!globalSocket || globalSocket.readyState !== WebSocket.OPEN) return false
  globalSocket.send(JSON.stringify(message))
  return true
}

export function wsIsConnected(): boolean {
  return globalSocket !== null && globalSocket.readyState === WebSocket.OPEN
}

export function useChatWebSocket() {
  const store = useNegotiationChatStore()
  return {
    connect: wsConnect,
    disconnect: wsDisconnect,
    send: wsSend,
    isConnected: wsIsConnected,
    messages: computed(() => store.currentMessages),
  }
}
