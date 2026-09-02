// WB Remote: WS-канал ТЕЛЕФОНА-пульта до сесії дошки.
// Ref: LAW §9 «Remote control», CLASSROOM_REMOTE_VISION_2026-09-02.md крок 5.
//
// Навмисно НЕ usePresence: пульт не шле presence.join (не з'являється в реєстрі
// кімнати, не породжує presence.leave), не веде курсорів і не бутстрапить
// opsSync. Лише: підключитись тим самим URL/токеном, слати remote.command,
// слухати remote.state. Обмежений reconnect (як у presence), без нескінченних
// петель: після MAX_RECONNECT — кнопка «Підключити ще раз» у UI.

import { ref, onUnmounted, type Ref } from 'vue'
import { getWsBaseUrl, isPresenceAvailable, _getFreshTokenAsync } from './usePresence'

export type RemoteChannelState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'unavailable'

export interface RemoteStateDetail {
  pair: string
  clientId: string
  pageIndex: number
  pageCount: number
}

const LOG_PREFIX = '[WB:remote]'
const MAX_RECONNECT = 5
const RECONNECT_BASE_MS = 1000

function jitter(ms: number): number {
  const j = ms * 0.2
  return Math.max(0, Math.round(ms + (Math.random() * 2 - 1) * j))
}

export function useRemoteChannel(opts: { onState: (s: RemoteStateDetail) => void; onError?: (code: string) => void }) {
  const state: Ref<RemoteChannelState> = ref('idle')
  const lastError = ref<string | null>(null)

  let ws: WebSocket | null = null
  let sessionId: string | null = null
  let manualClose = false
  let attempts = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  }

  async function connect(sid: string): Promise<void> {
    sessionId = sid
    manualClose = false
    clearTimer()

    if (!isPresenceAvailable()) {
      state.value = 'unavailable'
      return
    }
    const token = await _getFreshTokenAsync()
    if (!token) {
      state.value = 'disconnected'
      lastError.value = 'no_token'
      return
    }
    if (ws) { try { ws.close() } catch { /* noop */ } ws = null }

    state.value = attempts > 0 ? 'reconnecting' : 'connecting'
    const url = `${getWsBaseUrl()}/ws/winterboard/${sid}/?token=${encodeURIComponent(token)}`
    let socket: WebSocket
    try {
      socket = new WebSocket(url)
    } catch (err) {
      console.error(LOG_PREFIX, 'WebSocket create failed', err)
      state.value = 'disconnected'
      return
    }
    ws = socket

    socket.onopen = () => {
      if (ws !== socket) return
      attempts = 0
      state.value = 'connected'
      lastError.value = null
    }
    socket.onmessage = (ev) => {
      if (ws !== socket) return
      let msg: any
      try { msg = JSON.parse(ev.data) } catch { return }
      if (msg?.type === 'remote.state') {
        opts.onState({
          pair: String(msg.pair ?? ''),
          clientId: String(msg.client_id ?? ''),
          pageIndex: Number(msg.page_index),
          pageCount: Number(msg.page_count),
        })
      } else if (msg?.type === 'error') {
        lastError.value = String(msg.code ?? 'error')
        opts.onError?.(String(msg.code ?? 'error'))
      }
      // решта типів (presence.*, ops.applied, stroke.broadcast…) пульту не потрібні
    }
    socket.onclose = (ev) => {
      if (ws !== socket) return   // late close від попереднього сокета (INV-WS-1)
      ws = null
      if (manualClose) { state.value = 'disconnected'; return }
      // 4401/4403/4008 — не мережа, а відмова: не крутити reconnect
      if (ev.code === 4401 || ev.code === 4403 || ev.code === 4008) {
        state.value = 'disconnected'
        lastError.value = `ws_${ev.code}`
        return
      }
      scheduleReconnect()
    }
    socket.onerror = () => { /* onclose прийде слідом */ }
  }

  function scheduleReconnect() {
    if (!sessionId || manualClose) return
    if (attempts >= MAX_RECONNECT) {
      state.value = 'disconnected'
      lastError.value = 'reconnect_exhausted'
      return
    }
    attempts += 1
    state.value = 'reconnecting'
    const delay = jitter(RECONNECT_BASE_MS * Math.pow(2, attempts - 1))
    clearTimer()
    reconnectTimer = setTimeout(() => { if (sessionId) void connect(sessionId) }, delay)
  }

  /** Явна повторна спроба з UI після вичерпаних reconnect. */
  function retry(): void {
    attempts = 0
    if (sessionId) void connect(sessionId)
  }

  function disconnect(): void {
    manualClose = true
    clearTimer()
    if (ws) { try { ws.close(1000, 'remote closed') } catch { /* noop */ } ws = null }
    state.value = 'disconnected'
  }

  /** Повертає true, якщо повідомлення реально пішло в сокет. */
  function send(data: Record<string, unknown>): boolean {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    try { ws.send(JSON.stringify(data)); return true } catch { return false }
  }

  onUnmounted(disconnect)

  return { state, lastError, connect, disconnect, retry, send }
}
