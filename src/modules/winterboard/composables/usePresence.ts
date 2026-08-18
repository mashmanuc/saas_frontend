// WB: Presence composable — WebSocket cursor sync + online users
// Ref: TASK_BOARD.md A3.2, ManifestWinterboard_v2.md LAW-16
// Protocol: ws/winterboard/{sessionId}/ (AGENT-C C2.3)
// Events: presence.join, presence.leave, cursor.update

import { ref, reactive, computed, onUnmounted, type Ref } from 'vue'
import type { WBRemoteCursor, WBToolType } from '../types/winterboard'
import { registerAuthDeathCleanup, isAuthDead } from '@/core/auth/onAuthDeath'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG_PREFIX = '[WB:Presence]'
// Phase RS PR-RS-C3 (2026-05-01): rAF cursor throttle (INV-INP-15).
// Production observed (2026-04-30 logs): 4429 close cycle —
// `Server error: rate_limited Too many cursor updates` repeating every ~1s.
// Backend `CURSOR_UPDATES_PER_SEC = 20` (consumers.py:58); HARD_CUT_DROPS=200
// → close 4429. Old time-based throttle 50ms === backend ліміт boundary;
// clock jitter / concurrent calls пробивали ліміт → cumulative drops → 4429.
// Fix: rAF batching (natural ~60fps cap) + FPS guard 15 (66.67ms min interval).
// 15fps obrane below backend 20/sec для safety margin (≥25% buffer).
const CURSOR_FPS_CAP = 15
const CURSOR_MIN_INTERVAL_MS = 1000 / CURSOR_FPS_CAP  // ≈66.67ms
const VIEWPORT_THROTTLE_MS = 100     // Max 10 viewport updates/s (A5.2)

// ── ops.applied → INV-24 catchUp (A-T2, 2026-08-09) ──────────────────────────
//
// ⚠️ СТАТУС: НА ВИРІСТ, потреба НЕ підтверджена продуктом (рішення власника
// 2026-08-09). Сьогодні єдиний серверний писець — enrich, і його власна
// вкладка вже бачить картки без цього коду: `EnrichPatchesPreview` кличе
// `catchUp()` одразу після apply. Тут покривається лише випадок «ДРУГА
// вкладка тієї самої дошки», якого в роботі тьютора практично немає
// (enrich узагалі недоступний у classroom).
// Тобто це ЗАДІЛ під наступного серверного писця (петля смаку, intake), а
// НЕ доказ цінності. Не посилатись на цей код як на «зроблену фічу» і не
// добудовувати навколо нього, поки такий писець не з'явиться.
//
// Ціна виклику — головне обмеження тут (зауваження рев'ю). Broadcast має
// дебаунс 50ms і шлеться на КОЖЕН apply, включно зі `stroke_add`. Наївне
// «кожен ops.applied → catchUp()» у classroom, де учень малює, дало б потік
// `GET /state/` (canonical state, 27KB+) з кожної вкладки — на shared-cpu це
// відчутно. Coalescing-мьютекс у catchUp() — НЕ rate-limit: щойно один
// завершився, наступний стартує.
//
// Тому два фільтри:
//   1. ТИП: штрихи вже приходять живо окремим каналом `stroke.broadcast`,
//      для них catchUp зайвий. Кличемо лише коли в пачці є те, чого
//      live-канал не носить (asset_*, page_*, *_update) — саме цей клас і
//      ламався в enrich.
//   2. ЧАС: не частіше ніж раз на 2s, навіть якщо тип підійшов.
const CATCHUP_MIN_INTERVAL_MS = 2000
/**
 * Що live-канал ДОСТАВЛЯЄ сам → catchUp зайвий, хай би який суфікс.
 *
 * Перевіряється ПЕРШИМ і б'є решту правил: `stroke_update` закінчується на
 * `_update` і без цього списку проходив би як «оновлення» — тобто кожен рух
 * пером тягнув би `GET /state/`. Спіймано власним тестом при першому прогоні.
 */
const LIVE_DELIVERED_PREFIXES = ['stroke_'] as const
/** Префікси op_type, яких live-канал НЕ доставляє → потрібен catchUp. */
const CATCHUP_OP_PREFIXES = ['asset_', 'page_'] as const

/**
 * Чи є в пачці ops те, чого live-канал НЕ доставляє.
 *
 * Експортована й чиста НАВМИСНО: це рішення «слати `GET /state/` чи ні», і
 * воно мусить бути перевіряним без мока WebSocket. Порожня/невідома пачка →
 * false: краще пропустити оновлення, ніж гатити canonical state на кожен
 * штрих.
 */
export function needsCatchUp(ops: Array<{ op_type?: string }> | undefined): boolean {
  if (!Array.isArray(ops) || ops.length === 0) return false
  return ops.some((op) => {
    const type = op?.op_type
    if (typeof type !== 'string') return false
    // Deny-list ПЕРШИЙ: те, що вже приходить живо, не тягне state.
    if (LIVE_DELIVERED_PREFIXES.some((prefix) => type.startsWith(prefix))) return false
    return CATCHUP_OP_PREFIXES.some((prefix) => type.startsWith(prefix))
      || type.endsWith('_update')
  })
}
// Phase RS PR-RS-B0 (2026-05-01): adjusted per PLAN.md SECTION B verification.
// Exponential backoff: 1s → 2s → 4s → 8s → 10s (cap) → 10s × N до cap of 10 attempts.
// Total worst-case window: ~80s (sufficient для legitimate transient network blips).
// INV-WS-2: max reconnect rate ≤ 1/30s satisfied (cap=10s × backoff > 1/30s threshold).
const RECONNECT_MAX_ATTEMPTS = 10    // Max auto-reconnect attempts (was 3 — too aggressive give-up)
const RECONNECT_BASE_MS = 1_000      // Exponential backoff base
const RECONNECT_MAX_MS = 10_000      // Max backoff delay (was 8000 — align з PLAN INV-WS-2 cap)
const STALE_CHECK_INTERVAL_MS = 2_000 // Check for stale cursors
const STALE_THRESHOLD_MS = 5_000     // Remove cursors inactive >5s

// ─── Types ──────────────────────────────────────────────────────────────────

export type WBPresenceConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'

export interface WBPresenceUser {
  userId: string
  displayName: string
  color: string
}

/** Server → Client message types from WBPresenceConsumer (camelCase from Django) */
interface WBPresenceJoinMsg {
  type: 'presence.join'
  userId: string
  displayName: string
  color: string
}

interface WBPresenceLeaveMsg {
  type: 'presence.leave'
  userId: string
}

/**
 * Roster уже-присутніх членів, що надсилається СОБІ при власному connect
 * (fix presence-асиметрії 2026-06-13). Без цього учасник, що зайшов ПІСЛЯ
 * інших (напр. student після teacher), їх не бачив — broadcast presence.join
 * отримують лише вже-підписані. Дзеркалить BE `_handle_join` presence.sync.
 */
interface WBPresenceSyncMsg {
  type: 'presence.sync'
  users: Array<{ userId: string; displayName: string; color?: string; role?: string }>
}

interface WBCursorUpdateMsg {
  type: 'cursor.update'
  userId: string
  displayName: string
  color: string
  x: number
  y: number
  pageId: string
  tool: string
  // A5.2: Optional viewport data piggybacked on cursor updates
  scrollX?: number
  scrollY?: number
  zoom?: number
  role?: string
}

/** A5.2: Dedicated viewport update message */
interface WBViewportUpdateMsg {
  type: 'viewport.update'
  userId: string
  displayName: string
  color: string
  scrollX: number
  scrollY: number
  zoom: number
  pageId: string
  role?: string
}

interface WBPresenceErrorMsg {
  type: 'error'
  code: string
  message: string
  retry_after_seconds?: number
}

/** Classroom sync: state was saved by another participant */
interface WBStateUpdateMsg {
  type: 'session.state_update'
  userId: string
  rev: number
  pageIndex: number
  action: string
  ts: number
}

/** Phase 0: Remote stroke from other participant */
interface WBStrokeBroadcastMsg {
  type: 'stroke.broadcast'
  stroke: any
  strokeId?: string
  pageIndex: number
  action: string
  userId: string
  ts: number
}

/** Phase 38: Test session messages */
interface WBTestStartMsg {
  type: 'test.start'
  test_session_id: string
  test_objects: any[]
  test_meta: Record<string, unknown>
  page_id: string
  started_by: string
  ts: number
}

interface WBTestAnswerMsg {
  type: 'test.answer'
  test_session_id: string
  object_id: string
  answer: unknown
  page_id: string
  student_id: string
  student_name: string
}

interface WBTestPhaseMsg {
  type: 'test.phase'
  test_session_id: string
  phase: string
  page_id: string
}

interface WBTestGradeMsg {
  type: 'test.grade'
  test_session_id: string
  results: Record<string, any>
  page_id: string
}

interface WBTestSyncMsg {
  type: 'test.sync'
  test_session_id: string
  test_objects: any[]
  test_meta: Record<string, unknown>
  phase: string
  page_id: string
  started_by?: string
  my_answers?: Record<string, unknown>
  my_result?: any
  all_answers?: Record<string, Record<string, unknown>>
  all_results?: Record<string, any>
}

interface WBTestEndMsg {
  type: 'test.end'
  page_id: string
  ts: number
}

interface WBLaserPointerMsg {
  type: 'laser_pointer'
  user_id: string
  display_name: string
  x: number
  y: number
  active: boolean
  color: string
  page_id: string
}

/** Teacher locked/unlocked student drawing — BE _broadcast_session_event (session.lock). */
interface WBSessionLockMsg {
  type: 'session.lock'
  locked: boolean
  userId: string
  ts: number
}

/**
 * Ops застосовано СЕРВЕРНИМ писцем (enrich, AI-фічі, друга вкладка).
 *
 * BE шле це з `_broadcast_committed` (LAW §8, після commit) — і воно
 * долітало у вкладку ЗАВЖДИ, але `handleMessage` не мав цього типу й не мав
 * `default`, тож повідомлення тихо гинуло (розслідування A-T2 2026-08-09).
 * Наслідок: картки enrich з'являлись лише після F5, а вкладка ловила 409 на
 * власному наступному записі — бо її `localSeq` ніколи не дізнавався про
 * чужі ops.
 */
interface WBOpsAppliedMsg {
  type: 'ops.applied'
  session_id: string
  /** Серіалізовані ops; нас цікавлять лише `op_type` (див. _needsCatchUp). */
  ops: Array<{ op_type?: string }>
  last_seq: number
}

/**
 * 8a-2: шепіт Copilot тьютору. Долітає ЛИШЕ тьютору — BE шле це через
 * `session_targeted` з `target_user_id`, тож учень цього типу не бачить.
 */
interface WBCopilotWhisperMsg {
  type: 'copilot.whisper'
  decision_id: string
  student_id: string
  action: string
  whisper: string
  task_label?: string
  ts: number
}

type WBServerMessage =
  | WBCopilotWhisperMsg
  | WBOpsAppliedMsg
  | WBPresenceJoinMsg
  | WBPresenceLeaveMsg
  | WBPresenceSyncMsg
  | WBCursorUpdateMsg
  | WBViewportUpdateMsg
  | WBPresenceErrorMsg
  | WBStateUpdateMsg
  | WBStrokeBroadcastMsg
  | WBLaserPointerMsg
  | WBSessionLockMsg
  | WBTestStartMsg
  | WBTestAnswerMsg
  | WBTestPhaseMsg
  | WBTestGradeMsg
  | WBTestSyncMsg
  | WBTestEndMsg

// ─── Options ────────────────────────────────────────────────────────────────

export interface UsePresenceOptions {
  /** Session ID to connect to */
  sessionId: Ref<string | null>
  /** Current user ID (to filter own cursor) */
  userId: string
  /** Display name for presence */
  displayName: string
  /** User color for cursor */
  color: string
  /** WebSocket base URL override (default: auto-detect from window.location) */
  wsBaseUrl?: string
  /** Auth token for WS connection */
  token?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getWsBaseUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:8000'
  // In production, use dedicated WS backend if configured
  // Priority 1: explicit base URL
  const wsBaseEnv = import.meta.env.VITE_WS_BASE_URL
  if (wsBaseEnv) return wsBaseEnv.replace(/\/+$/, '')
  // Priority 2: derive base from VITE_WB_WS_URL (strip /ws/winterboard/ suffix)
  const wbWsEnv = import.meta.env.VITE_WB_WS_URL
  if (wbWsEnv) return wbWsEnv.replace(/\/ws\/winterboard\/.*$/, '').replace(/\/+$/, '')
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}`
}

/**
 * Check if WebSocket presence is available.
 * On Cloudflare Pages (static hosting), WS is not available.
 * Returns false if no dedicated WS backend is configured in production.
 */
function isPresenceAvailable(): boolean {
  // Always available in dev (Vite proxy or local backend)
  if (import.meta.env.DEV) return true
  // Available if explicit WS URL is configured (either base or winterboard-specific)
  if (import.meta.env.VITE_WS_BASE_URL || import.meta.env.VITE_WB_WS_URL) return true
  // Not available on static hosting (Cloudflare Pages) without dedicated WS
  return false
}

function jitter(ms: number): number {
  const j = ms * 0.2
  return Math.max(0, Math.round(ms + (Math.random() * 2 - 1) * j))
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Composable ─────────────────────────────────────────────────────────────

/**
 * Get fresh decrypted JWT from authStore at call time (not stale snapshot from mount).
 * Returns null if no real JWT available (e.g. '__cookie__' placeholder or decrypt fail).
 */
/**
 * Перевіряє, чи access token прострочений або скоро протухне.
 * JWT payload містить `exp` (unix seconds).
 * Повертає true якщо лишилось < 60 секунд до expiry.
 */
function _isTokenExpiringSoon(jwt: string): boolean {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]))
    const exp = payload?.exp
    if (typeof exp !== 'number') return true
    const nowSec = Math.floor(Date.now() / 1000)
    return exp - nowSec < 60
  } catch {
    return true
  }
}

async function _getFreshTokenAsync(): Promise<string | null> {
  try {
    const { useAuthStore } = await import('@/modules/auth/store/authStore')
    const authStore = useAuthStore()
    if (!authStore.access || authStore.access === '__cookie__') return null

    let token = await authStore.getDecryptedAccess()

    // P0 FIX (2026-04-08): access token живе 15 хв, proactive refresh — 20 хв,
    // через що ~5 хв кожного циклу токен прострочений і WS reconnect падає
    // у нескінченний 4401 loop (WSREJECT 349× у logs559). Якщо токен скоро
    // протухне — примусово оновлюємо ПЕРЕД використанням у WS URL.
    if (token && _isTokenExpiringSoon(token)) {
      try {
        await authStore.refreshAccess()
        token = await authStore.getDecryptedAccess()
      } catch (err) {
        console.warn('[WB:presence] proactive refresh failed before WS connect:', err)
      }
    }

    return token
  } catch {
    return null
  }
}

export function usePresence(options: UsePresenceOptions) {
  const { userId, displayName, color } = options
  const wsBaseUrl = options.wsBaseUrl ?? getWsBaseUrl()

  // ── Reactive state ──────────────────────────────────────────────────────

  const connectionState = ref<WBPresenceConnectionState>('disconnected')
  const remoteCursors = reactive<Map<string, WBRemoteCursor>>(new Map())
  const onlineUsers = reactive<Map<string, WBPresenceUser>>(new Map())
  const lastError = ref<string | null>(null)

  // ── Internal state ──────────────────────────────────────────────────────

  let ws: WebSocket | null = null
  let reconnectAttempts = 0
  let reconnectAborted = false
  let lastCursorSentAt = 0
  let lastViewportSentAt = 0
  let staleCleanupTimer: ReturnType<typeof setInterval> | null = null
  // 2026-05-13: після 4429 rate-limit disconnect — suppress cursor updates на 5s.
  // Без cooldown: reconnect → presence.join → cursor spam → сервер rate-limit знову.
  // Спостерігалось в real session: 15+ 4429 cycles через immediate reconnect.
  let cursor4429SuppressedUntil = 0

  // Phase RS PR-RS-C3: rAF-based cursor batching state (INV-INP-15).
  // pendingCursor зберігає НАЙСВІЖІШУ позицію — старі drop-нуті природно (overwrite).
  // cursorRAF=0 sentinel індикує що rAF не scheduled.
  let cursorRAF = 0
  let pendingCursor: {
    x: number
    y: number
    pageId: string
    tool: WBToolType
    cursorColor?: string
  } | null = null

  // P0.0: Register cleanup on auth death — disconnect immediately, no reconnect
  const _unregisterAuthDeath = registerAuthDeathCleanup(() => {
    reconnectAborted = true
    disconnect()
  })

  // ── Computed ────────────────────────────────────────────────────────────

  const isConnected = computed(() => connectionState.value === 'connected')

  const onlineUsersList = computed(() => Array.from(onlineUsers.values()))

  const remoteCursorsMap = computed(() => remoteCursors)

  // ── WebSocket connection ────────────────────────────────────────────────

  async function connect(sessionId: string): Promise<void> {
    // P0.0: Don't connect if auth is dead — prevents stale token reconnect storms
    if (isAuthDead()) {
      console.warn(LOG_PREFIX, 'Auth dead, skipping connect')
      connectionState.value = 'disconnected'
      return
    }

    // Skip WS connection if presence is not available (e.g. Cloudflare Pages)
    if (!isPresenceAvailable()) {
      console.info(LOG_PREFIX, 'Presence unavailable (no WS backend configured). Skipping.')
      connectionState.value = 'disconnected'
      return
    }

    // Get fresh decrypted token at connect time (not stale snapshot from mount)
    const token = await _getFreshTokenAsync()
    if (!token) {
      console.warn(LOG_PREFIX, 'No auth token available, deferring connect')
      connectionState.value = 'disconnected'
      return
    }

    // P1.1 FIX: Only reset reconnect state on FRESH connect (user-initiated),
    // not on reconnect from scheduleReconnect(). reconnectAttempts is reset
    // in onopen after successful connection — not here.
    const isReconnecting = connectionState.value === 'reconnecting'
    disconnect()
    reconnectAborted = false
    if (!isReconnecting) {
      reconnectAttempts = 0
    }
    connectionState.value = 'connecting'

    const tokenParam = `?token=${encodeURIComponent(token)}`
    const url = `${wsBaseUrl}/ws/winterboard/${sessionId}/${tokenParam}`

    try {
      ws = new WebSocket(url)
    } catch (err) {
      console.error(LOG_PREFIX, 'Failed to create WebSocket:', err)
      connectionState.value = 'disconnected'
      lastError.value = 'Failed to create WebSocket connection'
      return
    }

    ws.onopen = () => {
      connectionState.value = 'connected'
      reconnectAttempts = 0
      lastError.value = null
      console.info(LOG_PREFIX, 'Connected to', sessionId)

      // Send join message (camelCase — matches BE _handle_join expectation)
      sendMessage({
        type: 'presence.join',
        userId,
        displayName,
        color,
      })

      // Start stale cursor cleanup
      startStaleCleanup()
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as WBServerMessage
        handleMessage(msg)
      } catch (err) {
        console.warn(LOG_PREFIX, 'Failed to parse message:', err)
      }
    }

    ws.onclose = (event: CloseEvent) => {
      connectionState.value = 'disconnected'
      stopStaleCleanup()

      const code = event.code
      console.info(LOG_PREFIX, 'Disconnected, code:', code)

      // 4403 = forbidden — do not reconnect (permanent)
      if (code === 4403) {
        lastError.value = 'Access denied'
        reconnectAborted = true
        return
      }

      // 4401 = auth expired — try to refresh token, then reconnect
      if (code === 4401) {
        console.info(LOG_PREFIX, 'Token expired, attempting refresh before reconnect')
        void (async () => {
          try {
            const { useAuthStore } = await import('@/modules/auth/store/authStore')
            const authStore = useAuthStore()
            await authStore.refreshAccess()
            // After refresh, _getFreshToken() will return new JWT
            if (!reconnectAborted && reconnectAttempts < RECONNECT_MAX_ATTEMPTS) {
              void scheduleReconnect(sessionId)
            }
          } catch {
            lastError.value = 'Session expired'
            reconnectAborted = true
          }
        })()
        return
      }

      // 4008 = per-user or per-room connection limit exceeded (Redis counter)
      // BE: MAX_CONNECTIONS_PER_USER=2, conn_user_key TTL=60s (consumers.py:62,145)
      // Rapid retries (1s, 2s, 4s...) all fail while Redis counter is elevated.
      // Fix: wait 30s before single retry — gives disconnect() handler time to decr counter.
      // Observed: room_37 student got 4008 → 5 failed retries over 31s → success at 31s.
      // With this fix: wait 30s once → success (same total time, zero wasted retries).
      // S7.1 fix (2026-05-14).
      if (code === 4008) {
        console.info(LOG_PREFIX, 'Connection limit (4008) — waiting 30s for Redis counter reset')
        lastError.value = 'Connection limit reached, retrying...'
        void (async () => {
          await sleep(30_000)
          if (!reconnectAborted && reconnectAttempts < RECONNECT_MAX_ATTEMPTS) {
            lastError.value = null
            void scheduleReconnect(sessionId)
          }
        })()
        return
      }

      // 4429 = server rate-limited cursor updates → suppress cursor для 5s після reconnect
      if (code === 4429) {
        cursor4429SuppressedUntil = Date.now() + 5_000
      }

      // Auto-reconnect for other close codes
      if (!reconnectAborted && reconnectAttempts < RECONNECT_MAX_ATTEMPTS) {
        void scheduleReconnect(sessionId)
      }
    }

    ws.onerror = () => {
      console.warn(LOG_PREFIX, 'WebSocket error')
      lastError.value = 'WebSocket connection error'
    }
  }

  function disconnect(): void {
    reconnectAborted = true
    stopStaleCleanup()

    // Phase RS PR-RS-C3: cancel pending rAF щоб не fire після disconnect
    // (ws closed → sendMessage no-op, але cursorRAF leak без cancelAnimationFrame).
    if (cursorRAF) {
      cancelAnimationFrame(cursorRAF)
      cursorRAF = 0
    }
    pendingCursor = null

    if (ws) {
      // Send leave before closing
      if (ws.readyState === WebSocket.OPEN) {
        try {
          sendMessage({
            type: 'presence.leave',
            userId,
          })
        } catch {
          // ignore send errors during disconnect
        }
      }

      try {
        ws.close(1000, 'User disconnected')
      } catch {
        // ignore close errors
      }
      ws = null
    }

    connectionState.value = 'disconnected'
    remoteCursors.clear()
    onlineUsers.clear()
  }

  async function scheduleReconnect(sessionId: string): Promise<void> {
    if (reconnectAborted || isAuthDead()) return
    connectionState.value = 'reconnecting'
    reconnectAttempts++

    // P2.0: Track reconnect attempts for storm detection
    import('@/utils/telemetryAgent').then(
      m => m.trackEvent('ws.reconnect', { type: 'winterboard', sessionId, attempt: reconnectAttempts }),
    ).catch(() => {})

    const delay = jitter(Math.min(
      RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts - 1),
      RECONNECT_MAX_MS,
    ))

    console.info(LOG_PREFIX, `Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${RECONNECT_MAX_ATTEMPTS})`)
    await sleep(delay)

    if (reconnectAborted) return
    connect(sessionId)
  }

  // ── ops.applied → catchUp (A-T2) ────────────────────────────────────────

  let lastCatchUpAt = 0

  async function _catchUpFromBroadcast(lastSeq: number): Promise<void> {
    const now = Date.now()
    if (now - lastCatchUpAt < CATCHUP_MIN_INTERVAL_MS) return
    lastCatchUpAt = now

    try {
      const [{ useOpsSyncStore }, { useWBStore }] = await Promise.all([
        import('../stores/opsSyncStore'),
        import('../board/state/boardStore'),
      ])
      const opsSync = useOpsSyncStore()
      // Лічильник — ЗІ СТОРУ, свій не заводимо: два джерела seq розійдуться.
      if (lastSeq <= opsSync.localSeq) return

      const store = useWBStore()
      const result = await opsSync.catchUp(
        (state: Record<string, unknown>) => store.applyCatchUpState(state),
      )
      // blocked/stale — легітимні стани (DESYNC-recovery / застарілий blob):
      // мовчки нічого не робимо, БЕЗ retry (LAW §12). Наступний broadcast
      // або reconnect повторить.
      console.info(
        LOG_PREFIX,
        `A-T2 catch-up status=${result.status} last_seq=${result.lastSeq}`,
      )
    } catch (err) {
      // Подієва модель без retry — наступний ops.applied спробує знову.
      console.warn(LOG_PREFIX, 'A-T2 catch-up failed:', err)
    }
  }

  // ── Message handling ────────────────────────────────────────────────────

  function handleMessage(msg: WBServerMessage): void {
    switch (msg.type) {
      case 'presence.join': {
        // Skip own join
        if (msg.userId === userId) return

        onlineUsers.set(msg.userId, {
          userId: msg.userId,
          displayName: msg.displayName,
          color: msg.color,
        })
        break
      }

      case 'presence.leave': {
        onlineUsers.delete(msg.userId)
        remoteCursors.delete(msg.userId)
        break
      }

      case 'presence.sync': {
        // Roster уже-присутніх при власному connect (fix presence-асиметрії
        // 2026-06-13). broadcast presence.join отримують лише вже-підписані →
        // хто зайшов раніше (teacher до student), того новий учасник не бачив.
        // Тепер joiner дістає повний roster. color дефолтний — реальний
        // прийде з cursor.update; для «online»-індикатора достатньо.
        for (const u of msg.users ?? []) {
          if (u.userId === userId) continue
          onlineUsers.set(u.userId, {
            userId: u.userId,
            displayName: u.displayName,
            color: u.color ?? '#3b82f6',
          })
        }
        break
      }

      case 'cursor.update': {
        // Skip own cursor
        if (msg.userId === userId) return

        const existing = remoteCursors.get(msg.userId)
        remoteCursors.set(msg.userId, {
          userId: msg.userId,
          displayName: msg.displayName,
          color: msg.color,
          x: msg.x,
          y: msg.y,
          pageId: msg.pageId,
          tool: msg.tool as WBToolType,
          lastUpdate: Date.now(),
          // A5.2: Preserve viewport data from cursor updates or keep existing
          scrollX: msg.scrollX ?? existing?.scrollX,
          scrollY: msg.scrollY ?? existing?.scrollY,
          zoom: msg.zoom ?? existing?.zoom,
          role: msg.role ?? existing?.role,
        })

        // Also update presence
        if (!onlineUsers.has(msg.userId)) {
          onlineUsers.set(msg.userId, {
            userId: msg.userId,
            displayName: msg.displayName,
            color: msg.color,
          })
        }
        break
      }

      // A5.2: Dedicated viewport update
      case 'viewport.update': {
        if (msg.userId === userId) return

        const cur = remoteCursors.get(msg.userId)
        if (cur) {
          cur.scrollX = msg.scrollX
          cur.scrollY = msg.scrollY
          cur.zoom = msg.zoom
          cur.pageId = msg.pageId
          cur.role = msg.role
          cur.lastUpdate = Date.now()
        } else {
          // Create cursor entry with viewport data (no x/y yet)
          remoteCursors.set(msg.userId, {
            userId: msg.userId,
            displayName: msg.displayName,
            color: msg.color,
            x: 0,
            y: 0,
            pageId: msg.pageId,
            tool: 'pen' as WBToolType,
            lastUpdate: Date.now(),
            scrollX: msg.scrollX,
            scrollY: msg.scrollY,
            zoom: msg.zoom,
            role: msg.role,
          })
        }

        if (!onlineUsers.has(msg.userId)) {
          onlineUsers.set(msg.userId, {
            userId: msg.userId,
            displayName: msg.displayName,
            color: msg.color,
          })
        }
        break
      }

      case 'error': {
        console.warn(LOG_PREFIX, 'Server error:', msg.code, msg.message)
        lastError.value = msg.message
        break
      }

      // Classroom sync: another participant saved state → emit custom event for refetch
      case 'session.state_update': {
        if (msg.userId === userId) return // Ignore own saves
        window.dispatchEvent(new CustomEvent('wb:remote-state-update', {
          detail: { rev: msg.rev, pageIndex: msg.pageIndex, action: msg.action },
        }))
        break
      }

      // Teacher locked/unlocked student drawing → emit so WBClassroomRoom calls setLocked.
      // BE broadcasts session.lock to the room; without this the student ignored it and
      // could keep drawing while locked (lock applied only to the teacher who toggled it).
      case 'session.lock': {
        window.dispatchEvent(new CustomEvent('wb:session-lock', {
          detail: { locked: msg.locked, userId: msg.userId },
        }))
        break
      }

      // A-T2 (2026-08-09): чужий писець застосував ops — звіряємось із
      // сервером штатним INV-24 catchUp. Ops із повідомлення НЕ
      // застосовуються напряму: другий apply-канал поруч із catchUp дав би
      // два read-шляхи (порядок, дублі, конфлікт із власними in-flight).
      case 'ops.applied': {
        if (!needsCatchUp(msg.ops)) return        // самі штрихи → live-канал
        if (msg.last_seq === undefined) return
        void _catchUpFromBroadcast(msg.last_seq)
        break
      }

      // Phase 0: Receive remote stroke from other participant
      case 'stroke.broadcast': {
        if (msg.userId === userId) return // Ignore own strokes
        window.dispatchEvent(new CustomEvent('wb:remote-stroke', {
          detail: {
            stroke: msg.stroke,
            strokeId: msg.strokeId,
            pageIndex: msg.pageIndex,
            action: msg.action,
            userId: msg.userId,
          },
        }))
        break
      }

      // Laser pointer from other participant
      case 'laser_pointer': {
        if (msg.user_id === userId) return
        window.dispatchEvent(new CustomEvent('wb:remote-laser', {
          detail: {
            userId: msg.user_id,
            displayName: msg.display_name,
            x: msg.x,
            y: msg.y,
            active: msg.active,
            color: msg.color,
            pageId: msg.page_id,
          },
        }))
        break
      }

      // Phase 38: Test session messages
      case 'test.start': {
        window.dispatchEvent(new CustomEvent('wb:test-start', { detail: msg }))
        break
      }

      case 'test.answer': {
        window.dispatchEvent(new CustomEvent('wb:test-answer', { detail: msg }))
        break
      }

      case 'test.phase': {
        window.dispatchEvent(new CustomEvent('wb:test-phase', { detail: msg }))
        break
      }

      case 'test.grade': {
        window.dispatchEvent(new CustomEvent('wb:test-grade', { detail: msg }))
        break
      }

      case 'test.sync': {
        window.dispatchEvent(new CustomEvent('wb:test-sync', { detail: msg }))
        break
      }

      // 8a-2: шепіт Copilot. Прилітає ЛИШЕ тьютору (session_targeted на BE),
      // тож тут не треба перевіряти роль — учневі це повідомлення не надсилають.
      case 'copilot.whisper': {
        window.dispatchEvent(new CustomEvent('wb:copilot-whisper', { detail: msg }))
        break
      }

      case 'test.end': {
        window.dispatchEvent(new CustomEvent('wb:test-end', { detail: msg }))
        break
      }
    }
  }

  // ── Send helpers ────────────────────────────────────────────────────────

  function sendMessage(data: Record<string, unknown>): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    try {
      ws.send(JSON.stringify(data))
    } catch (err) {
      console.warn(LOG_PREFIX, 'Send failed:', err)
    }
  }

  /**
   * Phase RS PR-RS-C3 (INV-INP-15): rAF-batched cursor send.
   *
   * Архітектура:
   *   1. pointermove (від canvas) → pendingCursor = latest position (overwrite)
   *   2. Перший виклик scheduleses requestAnimationFrame(flushPendingCursor)
   *   3. На rAF tick: перевірка FPS guard (≥66.67ms since last) → flush або re-schedule
   *   4. Природний 60fps rAF cap + 15fps explicit guard = ≤15 events/sec
   *
   * Backend ліміт CURSOR_UPDATES_PER_SEC=20 → 15fps дає 25% буфер під clock jitter.
   * Stale positions автоматично drop-аються (overwrite у pendingCursor).
   *
   * NO debounce (ламає UX), NO timer-based throttle (clock jitter), NO lodash.
   * Cleanup: cancel rAF у disconnect() (auth death + onUnmounted lifecycle).
   */
  function _flushPendingCursor(): void {
    cursorRAF = 0
    if (!pendingCursor) return

    const now = performance.now()
    if (now - lastCursorSentAt < CURSOR_MIN_INTERVAL_MS) {
      // Under FPS cap — re-schedule next rAF, keep latest pendingCursor.
      // Defensive guard: re-check pendingCursor (can be nulled by disconnect()
      // race чи зовнішнім cleanup) — без guard ризикуємо infinite rAF loop
      // без реального send (переплановуємо кадр коли нічого не змінилось).
      if (!pendingCursor) {
        return
      }
      cursorRAF = requestAnimationFrame(_flushPendingCursor)
      return
    }

    lastCursorSentAt = now
    const c = pendingCursor
    pendingCursor = null

    if (import.meta.env.DEV) {
      console.log('[cursor]', c.x, c.y)
    }

    sendMessage({
      type: 'cursor.update',
      userId,
      displayName,
      color: c.cursorColor ?? color,
      x: Math.round(c.x * 10) / 10, // 1 decimal precision
      y: Math.round(c.y * 10) / 10,
      pageId: c.pageId,
      tool: c.tool,
    })
  }

  function sendCursor(
    x: number,
    y: number,
    pageId: string,
    tool: WBToolType,
    cursorColor?: string,
  ): void {
    // 4429 cooldown: після rate-limit disconnect не спамити cursor відразу після reconnect
    if (Date.now() < cursor4429SuppressedUntil) return
    pendingCursor = { x, y, pageId, tool, cursorColor }
    if (cursorRAF) return
    cursorRAF = requestAnimationFrame(_flushPendingCursor)
  }

  /**
   * A5.2: Send viewport state (scroll + zoom) — throttled to 100ms / 10 updates per second.
   * Separate throttle from cursor to avoid viewport updates being dropped.
   */
  function sendViewport(
    scrollX: number,
    scrollY: number,
    zoom: number,
    pageId: string,
    role?: string,
  ): void {
    const now = performance.now()
    if (now - lastViewportSentAt < VIEWPORT_THROTTLE_MS) return
    lastViewportSentAt = now

    sendMessage({
      type: 'viewport.update',
      userId,
      displayName,
      color,
      scrollX: Math.round(scrollX),
      scrollY: Math.round(scrollY),
      zoom: Math.round(zoom * 100) / 100, // 2 decimal precision
      pageId,
      role,
    })
  }

  // ── Stale cursor cleanup ────────────────────────────────────────────────

  function startStaleCleanup(): void {
    stopStaleCleanup()
    staleCleanupTimer = setInterval(() => {
      const threshold = Date.now() - STALE_THRESHOLD_MS
      for (const [uid, cursor] of remoteCursors) {
        if (cursor.lastUpdate < threshold) {
          remoteCursors.delete(uid)
        }
      }
    }, STALE_CHECK_INTERVAL_MS)
  }

  function stopStaleCleanup(): void {
    if (staleCleanupTimer !== null) {
      clearInterval(staleCleanupTimer)
      staleCleanupTimer = null
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  onUnmounted(() => {
    disconnect()
    _unregisterAuthDeath()
  })

  // ── Return ────────────────────────────────────────────────────────────

  return {
    // State
    connectionState,
    isConnected,
    remoteCursors: remoteCursorsMap,
    onlineUsers: onlineUsersList,
    lastError,

    // Actions
    connect,
    disconnect,
    sendCursor,
    sendViewport,
    sendMessage,
  }
}

export default usePresence
