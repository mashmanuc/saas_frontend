<template>
  <div class="wb-remote" :data-state="channel.state.value">
    <!-- Шапка: статус зв'язку + хто ти + що керуєш -->
    <header class="wb-remote__top">
      <span class="wb-remote__status" :class="`wb-remote__status--${channel.state.value}`">
        <span class="wb-remote__dot" aria-hidden="true" />
        {{ statusLabel }}
      </span>
      <button
        v-if="channel.state.value === 'connected' || channel.state.value === 'connecting' || channel.state.value === 'reconnecting'"
        type="button"
        class="wb-remote__exit"
        @click="disconnect"
      >{{ t('winterboard.remote.disconnect') }}</button>
      <button v-else type="button" class="wb-remote__exit wb-remote__exit--primary" @click="resolveAndConnect">
        {{ t('winterboard.remote.connect') }}
      </button>
    </header>

    <p class="wb-remote__who">
      <span v-if="accountEmail">{{ t('winterboard.remote.loggedInAs') }} <strong>{{ accountEmail }}</strong></span>
      <span v-if="boardName"> · {{ t('winterboard.remote.board') }}: <strong>{{ boardName }}</strong></span>
    </p>

    <!-- Причина, чому пульт не керує — ЗАВЖДИ словами, ніколи мовчки -->
    <div v-if="reason" class="wb-remote__block" :class="`wb-remote__block--${reason.tone}`" role="status">
      <p class="wb-remote__reason">{{ reason.text }}</p>
      <p v-if="reason.hint" class="wb-remote__hint">{{ reason.hint }}</p>
      <button type="button" class="wb-remote__refresh" @click="resolveAndConnect">
        {{ t('winterboard.remote.refresh') }}
      </button>
    </div>

    <!-- Сторінка -->
    <div class="wb-remote__page" aria-live="polite">
      <template v-if="pageIndex !== null && pageCount !== null">
        <span class="wb-remote__page-cur">{{ pageIndex + 1 }}</span>
        <span class="wb-remote__page-sep">/</span>
        <span class="wb-remote__page-total">{{ pageCount }}</span>
      </template>
      <span v-else-if="!reason" class="wb-remote__page-wait">{{ t('winterboard.remote.waitingBoard') }}</span>
    </div>

    <!-- Кнопки -->
    <div class="wb-remote__grid">
      <button type="button" class="wb-remote__btn" :disabled="!canPrev" @click="goRel(-1)">
        <span class="wb-remote__btn-icon" aria-hidden="true">◀</span>
        <span class="wb-remote__btn-label">{{ t('winterboard.remote.prev') }}</span>
      </button>
      <button type="button" class="wb-remote__btn" :disabled="!canNext" @click="goRel(1)">
        <span class="wb-remote__btn-icon" aria-hidden="true">▶</span>
        <span class="wb-remote__btn-label">{{ t('winterboard.remote.next') }}</span>
      </button>
      <button type="button" class="wb-remote__btn" :disabled="!isReady" @click="sendCmd('page.new')">
        <span class="wb-remote__btn-icon" aria-hidden="true">＋</span>
        <span class="wb-remote__btn-label">{{ t('winterboard.remote.newPage') }}</span>
      </button>
      <button type="button" class="wb-remote__btn" :disabled="!isReady" @click="sendCmd('undo')">
        <span class="wb-remote__btn-icon" aria-hidden="true">↶</span>
        <span class="wb-remote__btn-label">{{ t('winterboard.remote.undo') }}</span>
      </button>
    </div>

    <!-- Говорю (тримати) -->
    <button
      v-if="ptt.supported"
      type="button"
      class="wb-remote__talk"
      :class="{ 'wb-remote__talk--on': ptt.listening.value }"
      :disabled="!isReady"
      @pointerdown.prevent="ptt.press()"
      @pointerup.prevent="ptt.release()"
      @pointercancel.prevent="ptt.release()"
      @pointerleave="ptt.release()"
      @contextmenu.prevent
    >
      <span class="wb-remote__talk-icon" aria-hidden="true">🎙</span>
      {{ ptt.listening.value ? t('winterboard.remote.listening') : t('winterboard.remote.holdToTalk') }}
    </button>
    <p v-else class="wb-remote__note">{{ t('winterboard.remote.voiceUnsupported') }}</p>

    <p v-if="lastPhrase" class="wb-remote__last">{{ lastPhrase }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * Пульт на телефоні (LAW §9 «Remote control», CLASSROOM_REMOTE_VISION крок 5–7).
 *
 * v1.1 (2026-09-02, після живого тесту власника):
 *  - /remote БЕЗ id: пульт сам питає бекенд, яку дошку зараз відкрито на
 *    ноутбуці (GET /winterboard/remote/active/). Один пульт на всі уроки.
 *    /winterboard/:id/remote лишається як прямий вхід (QR старого зразка).
 *  - Код зв'язки стабільний (derivePair з id дошки) — нічого не протухає.
 *  - «Вийти» більше нема: є «Відключити» / «Підключити», сторінка лишається.
 *  - Ніякого мовчазного «Чекаю дошку…»: кожна причина названа словами
 *    (дошка не відкрита / інший акаунт / забагато з'єднань / стара збірка).
 *
 * Команди абсолютні: індекс рахується тут з останнього remote.state, тож
 * подвійний тап або загублене повідомлення не зсуває на дві сторінки.
 * Канал lossy — загублену команду вчитель тисне ще раз (без retry).
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { trackEvent } from '@/utils/telemetryAgent'
import { winterboardApi } from '../api/winterboardApi'
import { useRemoteChannel } from '../composables/useRemoteChannel'
import { usePushToTalk } from '../composables/usePushToTalk'
import { matchRemotePhrase } from '../remote/remoteGrammar'
import { derivePair } from '../remote/remotePair'

const props = defineProps<{ id?: string }>()
const { t, locale } = useI18n()
const authStore = useAuthStore()

const accountEmail = computed(() => authStore.user?.email ?? '')
const clientId = (() => {
  try { return crypto.randomUUID() } catch { return `p-${Date.now().toString(36)}` }
})()

const boardId = ref<string | null>(null)
const boardName = ref('')
const pair = computed(() => (boardId.value ? derivePair(boardId.value) : ''))

const pageIndex = ref<number | null>(null)
const pageCount = ref<number | null>(null)
const lastPhrase = ref('')

/** Причина, чому пульт не керує (null = усе гаразд або ще шукаємо) */
type ReasonKey = 'noActiveBoard' | 'wrongAccount' | 'tooManyConnections' | 'boardNotAnswering' | 'noToken' | 'serverRejected' | 'unavailable'
const reasonKey = ref<ReasonKey | null>(null)
const reasonCode = ref('')

// 2026-09-03, власник: «постав телеметрію, щоб ти бачив, як я підключаюсь
// або намагаюсь». Без тексту фраз — лише події, причини, коди, довжини.
let firstStateSeen = false
function tel(event: string, ctx: Record<string, unknown> = {}) {
  try { trackEvent(`wb.remote.${event}`, { board: boardId.value ?? null, ...ctx }) } catch { /* noop */ }
}

const channel = useRemoteChannel({
  onState(s) {
    if (s.pair !== pair.value) { tel('state_foreign'); return }   // стан для іншої дошки / старої вкладки
    pageIndex.value = s.pageIndex
    pageCount.value = s.pageCount
    reasonKey.value = null
    if (!firstStateSeen) { firstStateSeen = true; tel('state_first', { pages: s.pageCount }) }
    vibrate(15)
  },
  onError(code) {
    reasonCode.value = code
    if (code === 'forbidden') reasonKey.value = 'wrongAccount'
    else if (code === 'ws_4008' || code === 'ws_rejected') reasonKey.value = 'tooManyConnections'
    else if (code === 'no_token' || code === 'ws_4401' || code === 'ws_4403') reasonKey.value = 'noToken'
    else reasonKey.value = 'serverRejected'
    tel('reason', { reason: reasonKey.value, code })
  },
})

const reason = computed(() => {
  const k = reasonKey.value
  if (!k) return null
  const tone = k === 'boardNotAnswering' || k === 'noActiveBoard' ? 'warn' : 'error'
  switch (k) {
    case 'noActiveBoard':
      return { tone, text: t('winterboard.remote.noActiveBoard'), hint: t('winterboard.remote.noActiveBoardHint') }
    case 'wrongAccount':
      return { tone, text: t('winterboard.remote.wrongAccount'), hint: t('winterboard.remote.wrongAccountHint', { email: accountEmail.value }) }
    case 'tooManyConnections':
      return { tone, text: t('winterboard.remote.tooManyConnections'), hint: t('winterboard.remote.tooManyConnectionsHint') }
    case 'boardNotAnswering':
      return { tone, text: t('winterboard.remote.boardNotAnswering'), hint: t('winterboard.remote.boardNotAnsweringHint') }
    case 'noToken':
      return { tone, text: t('winterboard.remote.noToken'), hint: '' }
    case 'unavailable':
      return { tone, text: t('winterboard.remote.unavailable'), hint: '' }
    default:
      return { tone, text: t('winterboard.remote.serverRejected', { code: reasonCode.value }), hint: '' }
  }
})

const isOnline = computed(() => channel.state.value === 'connected')
const isReady = computed(() => isOnline.value && pageIndex.value !== null)
const canPrev = computed(() => isReady.value && (pageIndex.value ?? 0) > 0)
const canNext = computed(() =>
  isReady.value && pageIndex.value !== null && pageCount.value !== null && pageIndex.value < pageCount.value - 1,
)

const statusLabel = computed(() => {
  switch (channel.state.value) {
    case 'connected': return t('winterboard.remote.connected')
    case 'connecting':
    case 'reconnecting': return t('winterboard.remote.connecting')
    case 'unavailable': return t('winterboard.remote.unavailable')
    default: return t('winterboard.remote.disconnected')
  }
})

function vibrate(ms: number) {
  try { navigator.vibrate?.(ms) } catch { /* noop */ }
}

function sendCmd(cmd: 'hello' | 'page.goto' | 'page.new' | 'undo' | 'phrase', args: Record<string, unknown> = {}) {
  if (!pair.value) return false
  const ok = channel.send({ type: 'remote.command', pair: pair.value, client_id: clientId, cmd, args })
  if (cmd !== 'hello') tel('cmd', { cmd, sent: ok, len: cmd === 'phrase' ? String(args.text ?? '').length : undefined })
  if (ok) vibrate(8)
  return ok
}

function goRel(delta: 1 | -1) {
  if (pageIndex.value === null || pageCount.value === null) { sendCmd('hello'); return }
  const target = pageIndex.value + delta
  if (target < 0 || target >= pageCount.value) return
  sendCmd('page.goto', { index: target })
}

// ── Голос: коротка граматика → команда; інакше → фраза Інтегралику на ноутбуці
const ptt = usePushToTalk({
  lang: locale.value === 'en' ? 'en-US' : 'uk-UA',
  onFinal(text) {
    lastPhrase.value = `«${text}»`
    const cmd = matchRemotePhrase(text)
    tel('ptt', { route: cmd ? 'grammar' : 'ai', grammar: cmd ?? null, len: text.length })
    if (cmd === 'page.next') return goRel(1)
    if (cmd === 'page.prev') return goRel(-1)
    if (cmd === 'page.new') return void sendCmd('page.new')
    if (cmd === 'undo') return void sendCmd('undo')
    sendCmd('phrase', { text })
  },
})

// ── Знайти дошку і підключитись ─────────────────────────────────────────
async function resolveBoard(): Promise<string | null> {
  if (props.id) {
    boardId.value = props.id
    return props.id
  }
  try {
    const r = await winterboardApi.getActiveRemoteSession()
    boardId.value = r.session_id
    boardName.value = r.name || ''
    tel('resolve', { found: true, via: 'api' })
    return r.session_id
  } catch (err: any) {
    const status = err?.response?.status ?? err?.status
    boardId.value = null
    boardName.value = ''
    reasonKey.value = status === 404 ? 'noActiveBoard' : 'serverRejected'
    reasonCode.value = status ? `http_${status}` : 'network'
    tel('resolve', { found: false, via: 'api', status: status ?? 'network' })
    return null
  }
}

async function resolveAndConnect() {
  pageIndex.value = null
  pageCount.value = null
  reasonKey.value = null
  reasonCode.value = ''
  firstStateSeen = false
  const sid = await resolveBoard()
  if (!sid) return
  await channel.connect(sid)
}

function disconnect() {
  channel.disconnect()
  pageIndex.value = null
  pageCount.value = null
}

// Після підключення — привітатись; якщо дошка мовчить, назвати це словами
let helloTimer: ReturnType<typeof setInterval> | null = null
function helloUntilState() {
  if (helloTimer) clearInterval(helloTimer)
  let tries = 0
  helloTimer = setInterval(() => {
    if (pageIndex.value !== null || reasonKey.value || channel.state.value !== 'connected') {
      if (helloTimer) { clearInterval(helloTimer); helloTimer = null }
      return
    }
    tries += 1
    if (tries > 5) {
      if (helloTimer) { clearInterval(helloTimer); helloTimer = null }
      // 6 hello за ~5 с без жодного remote.state і без error від сервера:
      // ноутбук у кімнаті, але не слухає (стара збірка) або не власник
      reasonKey.value = 'boardNotAnswering'
      tel('reason', { reason: 'boardNotAnswering', code: 'no_state_after_hello' })
      return
    }
    sendCmd('hello')
  }, 800)
}

const stopStateWatch = watch(channel.state, (s) => {
  tel('channel', { state: s })
  if (s === 'connected') {
    pageIndex.value = null
    pageCount.value = null
    sendCmd('hello')
    helloUntilState()
  } else if (s === 'unavailable') {
    reasonKey.value = 'unavailable'
  }
})

// ── Екран телефона не засинає, поки пульт відкритий
let wakeLock: any = null
async function requestWakeLock() {
  try { wakeLock = await (navigator as any).wakeLock?.request?.('screen') } catch { wakeLock = null }
}
function onVisibility() {
  if (document.visibilityState === 'visible') {
    if (!wakeLock) void requestWakeLock()
    // повернулись у вкладку після паузи — дошка могла змінитись; перепитати
    if (channel.state.value === 'connected' && pageIndex.value === null) sendCmd('hello')
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility)
  void requestWakeLock()
  void resolveAndConnect()
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  if (helloTimer) clearInterval(helloTimer)
  stopStateWatch()
  try { wakeLock?.release?.() } catch { /* noop */ }
})
</script>

<style scoped>
.wb-remote {
  min-height: 100dvh; background: #0f172a; color: #f8fafc;
  display: flex; flex-direction: column; gap: 14px;
  padding: max(12px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
  user-select: none; -webkit-user-select: none; touch-action: manipulation;
}
.wb-remote__top { display: flex; align-items: center; justify-content: space-between; }
.wb-remote__status { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: #cbd5e1; }
.wb-remote__dot { width: 10px; height: 10px; border-radius: 50%; background: #64748b; }
.wb-remote__status--connected .wb-remote__dot { background: #22c55e; }
.wb-remote__status--connecting .wb-remote__dot,
.wb-remote__status--reconnecting .wb-remote__dot { background: #f59e0b; }
.wb-remote__status--disconnected .wb-remote__dot,
.wb-remote__status--unavailable .wb-remote__dot { background: #ef4444; }
.wb-remote__exit { background: transparent; color: #94a3b8; border: 1px solid #334155; border-radius: 10px; padding: 8px 14px; font-size: 14px; min-height: 44px; }
.wb-remote__exit--primary { background: #2563eb; color: #fff; border-color: #2563eb; }

.wb-remote__who { margin: 0; font-size: 12px; color: #94a3b8; word-break: break-all; }
.wb-remote__who strong { color: #cbd5e1; font-weight: 600; }

.wb-remote__block { padding: 14px 16px; border-radius: 12px; background: #1e293b; font-size: 15px; line-height: 1.4; display: flex; flex-direction: column; gap: 8px; }
.wb-remote__block--warn { border: 1px solid #f59e0b; }
.wb-remote__block--error { border: 1px solid #ef4444; }
.wb-remote__reason { margin: 0; font-weight: 600; }
.wb-remote__hint { margin: 0; font-size: 13px; color: #cbd5e1; }
.wb-remote__refresh { align-self: flex-start; background: #334155; color: #f8fafc; border: 0; border-radius: 10px; padding: 10px 16px; font-size: 14px; min-height: 44px; }

.wb-remote__page { text-align: center; padding: 8px 0 0; min-height: 84px; }
.wb-remote__page-cur { font-size: 64px; font-weight: 800; line-height: 1; }
.wb-remote__page-sep { font-size: 32px; color: #64748b; margin: 0 8px; }
.wb-remote__page-total { font-size: 32px; color: #94a3b8; }
.wb-remote__page-wait { font-size: 15px; color: #94a3b8; }

.wb-remote__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.wb-remote__btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  min-height: 108px; border: 0; border-radius: 18px; background: #1e293b; color: #f8fafc;
  font-size: 15px; cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.wb-remote__btn:active { background: #334155; transform: scale(.98); }
.wb-remote__btn:disabled { opacity: .35; }
.wb-remote__btn-icon { font-size: 34px; line-height: 1; }
.wb-remote__btn-label { font-size: 14px; color: #cbd5e1; }

.wb-remote__talk {
  margin-top: auto; min-height: 96px; border: 0; border-radius: 22px;
  background: #2563eb; color: #fff; font-size: 18px; font-weight: 600;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  -webkit-tap-highlight-color: transparent; touch-action: none;
}
.wb-remote__talk--on { background: #dc2626; }
.wb-remote__talk:disabled { opacity: .35; }
.wb-remote__talk-icon { font-size: 26px; }
.wb-remote__note, .wb-remote__last { text-align: center; color: #94a3b8; font-size: 13px; margin: 0; }
</style>
