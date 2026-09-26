// WB Remote: WS-канал ТЕЛЕФОНА-пульта до сесії дошки.
// Ref: LAW §9 «Remote control», CLASSROOM_REMOTE_VISION_2026-09-02.md крок 5.
//
// Навмисно НЕ usePresence: пульт не шле presence.join (не з'являється в реєстрі
// кімнати, не породжує presence.leave), не веде курсорів і не бутстрапить
// opsSync. Лише: підключитись тим самим URL/токеном, слати remote.command,
// слухати remote.state. Обмежений reconnect (як у presence), без нескінченних
// петель: після MAX_RECONNECT — кнопка «Підключити ще раз» у UI.
//
// v1.1: канал НЕ ковтає помилки. `lastError` — код останньої серверної
// відповіді type=error (forbidden / invalid_message / rate_limit) або
// закриття (ws_4008 / ws_rejected …); UI пульта показує людині причину.
// v1 цього не показував — власник дивився на «Зв'язок є» + «Чекаю дошку…»
// і не міг зрозуміти, що саме не так.

import { ref, onUnmounted, type Ref } from 'vue'
import { getWsBaseUrl, isPresenceAvailable, _getFreshTokenAsync } from './usePresence'

export type RemoteChannelState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'unavailable'

export interface RemoteStateDetail {
  pair: string
  clientId: string
  pageIndex: number
  pageCount: number
  /** v1.2 — масштаб полотна на ноутбуці (для інформації) */
  zoom?: number
  /** v1.2 — картки задач поточної сторінки: скільки, чи показано відповідь/розбір усім */
  cards?: { count: number; answer: boolean | null; solution: boolean | null; presenting?: boolean }
  /** Дошка з фіналізованим записом: команди дійдуть, але нічого не збережеться */
  frozen?: boolean
  /** Відео з пульта (V1) — YouTube-картки поточної сторінки ноутбука */
  videos?: Array<{ objectId: string; title: string; state: RemoteVideoPlayState; error?: RemoteVideoError }>
  /** v1.6 — предмет і мова матеріалу Інтегралика на ноутбуці (LAW §9) */
  assistant?: {
    subjectMode: 'auto' | 'locked'
    subject: string
    subjectSource: string
    languageMode: 'auto' | 'locked'
    contentLanguage: 'uk' | 'en'
  }
}

/** v1.6: закритий набір полів; зіпсоване поле відкидаємо, стан лишається валідним. */
export function parseRemoteAssistant(raw: any): RemoteStateDetail['assistant'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const modes = ['auto', 'locked']
  if (!modes.includes(raw.subject_mode) || !modes.includes(raw.language_mode)) return undefined
  if (typeof raw.subject !== 'string' || !raw.subject || raw.subject.length > 32) return undefined
  if (typeof raw.subject_source !== 'string' || raw.subject_source.length > 24) return undefined
  if (raw.content_language !== 'uk' && raw.content_language !== 'en') return undefined
  return {
    subjectMode: raw.subject_mode,
    subject: raw.subject,
    subjectSource: raw.subject_source,
    languageMode: raw.language_mode,
    contentLanguage: raw.content_language,
  }
}

/** v1.7 (LAW §9, INV-27): картки поточної сторінки.
 *
 * Винесено з обробника повідомлень навмисно — так само, як `parseRemoteAssistant`
 * вище. Доки розбір жив усередині `socket.onmessage`, жоден тест не міг його
 * виконати, і саме там непомітно загубився `presenting`: ноутбук поле рахував і
 * слав, пульт його читав, а між ними воно зникало — ▲/▼ назавжди неактивні.
 *
 * `presenting` зберігаємо ЛИШЕ коли це справді boolean: зіпсоване значення не
 * має ні вмикати режим показу, ні псувати решту стану (сторінки важливіші).
 */
export function parseRemoteCards(raw: any): RemoteStateDetail['cards'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  return {
    count: Number(raw.count) || 0,
    answer: typeof raw.answer === 'boolean' ? raw.answer : null,
    solution: typeof raw.solution === 'boolean' ? raw.solution : null,
    ...(typeof raw.presenting === 'boolean' ? { presenting: raw.presenting } : {}),
  }
}

export type RemoteVideoPlayState = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'blocked' | 'error'
export type RemoteVideoError = 'not_found' | 'not_embeddable' | 'playback'
const VIDEO_STATES = new Set<RemoteVideoPlayState>(['idle', 'loading', 'playing', 'paused', 'ended', 'blocked', 'error'])
const VIDEO_ERRORS = new Set<RemoteVideoError>(['not_found', 'not_embeddable', 'playback'])

/** Відео з пульта (V1): відео поточної сторінки ноутбука. Зіпсоване — відкидаємо. */
export function parseRemoteVideos(raw: any): RemoteStateDetail['videos'] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: NonNullable<RemoteStateDetail['videos']> = []
  for (const v of raw) {
    if (!v || typeof v.object_id !== 'string' || !v.object_id || !VIDEO_STATES.has(v.state)) return undefined
    const item: NonNullable<RemoteStateDetail['videos']>[number] = {
      objectId: v.object_id, title: typeof v.title === 'string' ? v.title : '', state: v.state,
    }
    if (v.state === 'error' && VIDEO_ERRORS.has(v.error)) item.error = v.error
    out.push(item)
  }
  return out
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
  /** Сесія, до якої канал підключений зараз (для UI і для перепідключення) */
  const sessionId = ref<string | null>(null)

  let ws: WebSocket | null = null
  let manualClose = false
  let attempts = 0
  let everOpened = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  }

  function setError(code: string) {
    lastError.value = code
    opts.onError?.(code)
  }

  async function connect(sid: string): Promise<void> {
    sessionId.value = sid
    manualClose = false
    everOpened = false
    clearTimer()

    if (!isPresenceAvailable()) {
      state.value = 'unavailable'
      return
    }
    const token = await _getFreshTokenAsync()
    if (!token) {
      state.value = 'disconnected'
      setError('no_token')
      return
    }
    if (ws) { try { ws.close() } catch { /* noop */ } ws = null }

    state.value = attempts > 0 ? 'reconnecting' : 'connecting'
    // `client=remote` — мітка для телеметрії: дошка й пульт ходять в один
    // endpoint з роллю `owner`, і в розборі уроку 2026-09-03 їх неможливо було
    // розрізнити. Сервер бере мітку лише в лог (білий список board|remote),
    // на поведінку вона не впливає.
    const url = `${getWsBaseUrl()}/ws/winterboard/${sid}/?token=${encodeURIComponent(token)}&client=remote`
    let socket: WebSocket
    try {
      socket = new WebSocket(url)
    } catch (err) {
      console.error(LOG_PREFIX, 'WebSocket create failed', err)
      state.value = 'disconnected'
      setError('ws_create_failed')
      return
    }
    ws = socket

    socket.onopen = () => {
      if (ws !== socket) return
      attempts = 0
      everOpened = true
      state.value = 'connected'
      lastError.value = null
    }
    socket.onmessage = (ev) => {
      if (ws !== socket) return
      let msg: any
      try { msg = JSON.parse(ev.data) } catch { return }
      if (msg?.type === 'remote.state') {
        const detail: RemoteStateDetail = {
          pair: String(msg.pair ?? ''),
          clientId: String(msg.client_id ?? ''),
          pageIndex: Number(msg.page_index),
          pageCount: Number(msg.page_count),
        }
        if (typeof msg.zoom === 'number') detail.zoom = msg.zoom
        if (typeof msg.frozen === 'boolean') detail.frozen = msg.frozen
        const assistant = parseRemoteAssistant(msg.assistant)
        if (assistant) detail.assistant = assistant
        const cards = parseRemoteCards(msg.cards)
        if (cards) detail.cards = cards
        const videos = parseRemoteVideos(msg.videos)
        if (videos) detail.videos = videos
        opts.onState(detail)
      } else if (msg?.type === 'error') {
        // forbidden (не власник дошки) / invalid_message / rate_limit — показати, не ковтати
        setError(String(msg.code ?? 'error'))
      }
      // решта типів (presence.*, ops.applied, stroke.broadcast…) пульту не потрібні
    }
    socket.onclose = (ev) => {
      if (ws !== socket) return   // late close від попереднього сокета (INV-WS-1)
      ws = null
      if (manualClose) { state.value = 'disconnected'; return }
      // 4401/4403/4008 — відмова сервера ПІСЛЯ accept: не крутити reconnect
      if (ev.code === 4401 || ev.code === 4403 || ev.code === 4008) {
        state.value = 'disconnected'
        setError(`ws_${ev.code}`)
        return
      }
      // Закрився, так і не відкрившись (1006 на handshake) = сервер відхилив
      // до accept: ліміт з'єднань на акаунт (2) або auth. Reconnect не допоможе.
      if (!everOpened && ev.code === 1006) {
        state.value = 'disconnected'
        setError('ws_rejected')
        return
      }
      scheduleReconnect()
    }
    socket.onerror = () => { /* onclose прийде слідом */ }
  }

  function scheduleReconnect() {
    if (!sessionId.value || manualClose) return
    if (attempts >= MAX_RECONNECT) {
      state.value = 'disconnected'
      setError('reconnect_exhausted')
      return
    }
    attempts += 1
    state.value = 'reconnecting'
    const delay = jitter(RECONNECT_BASE_MS * Math.pow(2, attempts - 1))
    clearTimer()
    reconnectTimer = setTimeout(() => { if (sessionId.value) void connect(sessionId.value) }, delay)
  }

  /** Явна повторна спроба з UI після вичерпаних reconnect. */
  function retry(): void {
    attempts = 0
    if (sessionId.value) void connect(sessionId.value)
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

  return { state, lastError, sessionId, connect, disconnect, retry, send }
}
