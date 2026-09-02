<template>
  <div class="wb-remote" :data-state="channel.state.value">
    <!-- Шапка: статус зв'язку + вихід -->
    <header class="wb-remote__top">
      <span class="wb-remote__status" :class="`wb-remote__status--${channel.state.value}`">
        <span class="wb-remote__dot" aria-hidden="true" />
        {{ statusLabel }}
      </span>
      <button type="button" class="wb-remote__exit" @click="exit">{{ t('winterboard.remote.exit') }}</button>
    </header>

    <!-- Без pair у посиланні пульт не працює: показати чому -->
    <div v-if="!pair" class="wb-remote__block wb-remote__block--warn">
      {{ t('winterboard.remote.pairMissing') }}
    </div>

    <template v-else>
      <!-- Сторінка -->
      <div class="wb-remote__page" aria-live="polite">
        <template v-if="pageIndex !== null && pageCount !== null">
          <span class="wb-remote__page-cur">{{ pageIndex + 1 }}</span>
          <span class="wb-remote__page-sep">/</span>
          <span class="wb-remote__page-total">{{ pageCount }}</span>
        </template>
        <span v-else class="wb-remote__page-wait">{{ t('winterboard.remote.waitingBoard') }}</span>
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
        <button type="button" class="wb-remote__btn" :disabled="!isOnline" @click="sendCmd('page.new')">
          <span class="wb-remote__btn-icon" aria-hidden="true">＋</span>
          <span class="wb-remote__btn-label">{{ t('winterboard.remote.newPage') }}</span>
        </button>
        <button type="button" class="wb-remote__btn" :disabled="!isOnline" @click="sendCmd('undo')">
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
        :disabled="!isOnline"
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

      <!-- Зв'язок вичерпано → явна кнопка, не петля -->
      <button
        v-if="channel.state.value === 'disconnected'"
        type="button"
        class="wb-remote__reconnect"
        @click="channel.retry()"
      >
        {{ t('winterboard.remote.reconnect') }}
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Пульт на телефоні (CLASSROOM_REMOTE_VISION крок 5–7; LAW §9 «Remote control»).
 *
 * Без екрана дошки й без лазера (власник: «я дивлюся на стіну»). Чотири кнопки
 * й «Говорю» під пальцем. Команди абсолютні: індекс рахується тут з останнього
 * remote.state, тож подвійний тап або загублене повідомлення не зсуває на дві
 * сторінки. Канал lossy — загублену команду вчитель тисне ще раз (без retry).
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useRemoteChannel } from '../composables/useRemoteChannel'
import { usePushToTalk } from '../composables/usePushToTalk'
import { matchRemotePhrase } from '../remote/remoteGrammar'

const props = defineProps<{ id: string }>()
const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()

const pair = computed(() => String(route.query.pair ?? '').trim())
const clientId = (() => {
  try { return crypto.randomUUID() } catch { return `p-${Date.now().toString(36)}` }
})()

const pageIndex = ref<number | null>(null)
const pageCount = ref<number | null>(null)
const lastPhrase = ref('')

const channel = useRemoteChannel({
  onState(s) {
    if (s.pair !== pair.value) return   // стан для іншого пульта/старої вкладки
    pageIndex.value = s.pageIndex
    pageCount.value = s.pageCount
    vibrate(15)
  },
})

const isOnline = computed(() => channel.state.value === 'connected')
const canPrev = computed(() => isOnline.value && pageIndex.value !== null && pageIndex.value > 0)
const canNext = computed(() =>
  isOnline.value && pageIndex.value !== null && pageCount.value !== null && pageIndex.value < pageCount.value - 1,
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
  const ok = channel.send({ type: 'remote.command', pair: pair.value, client_id: clientId, cmd, args })
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
    if (cmd === 'page.next') return goRel(1)
    if (cmd === 'page.prev') return goRel(-1)
    if (cmd === 'page.new') return void sendCmd('page.new')
    if (cmd === 'undo') return void sendCmd('undo')
    sendCmd('phrase', { text })
  },
})

// ── Екран телефона не засинає, поки пульт відкритий
let wakeLock: any = null
async function requestWakeLock() {
  try { wakeLock = await (navigator as any).wakeLock?.request?.('screen') } catch { wakeLock = null }
}
function onVisibility() {
  if (document.visibilityState === 'visible' && !wakeLock) void requestWakeLock()
}

// Після підключення — привітатись, щоб ноутбук надіслав стан
let helloTimer: ReturnType<typeof setInterval> | null = null
function helloUntilState() {
  if (helloTimer) clearInterval(helloTimer)
  let tries = 0
  helloTimer = setInterval(() => {
    tries += 1
    if (pageIndex.value !== null || tries > 5 || channel.state.value !== 'connected') {
      if (helloTimer) { clearInterval(helloTimer); helloTimer = null }
      return
    }
    sendCmd('hello')
  }, 800)
}

let stopWatch: (() => void) | null = null
onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibility)
  void requestWakeLock()
  if (!pair.value) return
  await channel.connect(props.id)
  // стан каналу міняється асинхронно — вітаємось щоразу, коли стаємо connected
  const { watch } = await import('vue')
  stopWatch = watch(channel.state, (s) => {
    if (s === 'connected') {
      pageIndex.value = null
      pageCount.value = null
      sendCmd('hello')
      helloUntilState()
    }
  }, { immediate: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  if (helloTimer) clearInterval(helloTimer)
  stopWatch?.()
  try { wakeLock?.release?.() } catch { /* noop */ }
})

function exit() {
  channel.disconnect()
  router.push({ name: 'winterboard-boards' })
}
</script>

<style scoped>
.wb-remote {
  min-height: 100dvh; background: #0f172a; color: #f8fafc;
  display: flex; flex-direction: column; gap: 18px;
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
.wb-remote__exit { background: transparent; color: #94a3b8; border: 1px solid #334155; border-radius: 10px; padding: 8px 14px; font-size: 14px; }

.wb-remote__block { padding: 16px; border-radius: 12px; background: #1e293b; font-size: 15px; line-height: 1.4; }
.wb-remote__block--warn { border: 1px solid #f59e0b; }

.wb-remote__page { text-align: center; padding: 12px 0 4px; min-height: 84px; }
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
.wb-remote__reconnect { border: 1px solid #f59e0b; background: transparent; color: #fbbf24; border-radius: 12px; padding: 12px; font-size: 15px; }
</style>
