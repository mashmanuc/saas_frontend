<template>
  <div class="wb-remote" :data-state="channel.state.value">
    <!-- Шапка: статус зв'язку + хто ти + що керуєш -->
    <header class="wb-remote__top">
      <!-- Вихід із пульта. Пульт — повноекранний режим, а на телефоні, доданому
           на головний екран, браузерної «назад» немає взагалі: без цієї кнопки
           з пульта нікуди не вийти (власник 2026-09-22). -->
      <RouterLink to="/winterboard/boards" class="wb-remote__home" :aria-label="t('winterboard.remote.exitToBoards')">
        <span aria-hidden="true">⌂</span>
      </RouterLink>
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
      <!-- Мультимедійна дошка в класі часто під ШКІЛЬНИМ акаунтом, а телефон —
           під особистим. Активна дошка шукається по акаунту, тож пульт чесно
           каже «дошок нема». Власник на уроці 2026-09-04: «треба мати
           можливість пультові швидко змінювати акаунт». -->
      <button
        v-if="accountEmail"
        type="button"
        class="wb-remote__switch"
        :disabled="switching"
        @click="switchAccount"
      >
        {{ t('winterboard.remote.switchAccount') }}
      </button>
    </p>

    <!-- Після ПЕРШОГО підключення на цьому пристрої — три рядки, один раз
         (TZ_REMOTE_DESKTOP_CONNECT §2.4). -->
    <div v-if="showFirstTip" class="wb-remote__tip" role="note">
      <p class="wb-remote__tip-title">{{ t('winterboard.remote.firstTip.title') }}</p>
      <ul class="wb-remote__tip-list">
        <li>{{ t('winterboard.remote.firstTip.line1') }}</li>
        <li>{{ t('winterboard.remote.firstTip.line2') }}</li>
        <li>{{ t('winterboard.remote.firstTip.line3') }}</li>
      </ul>
      <button type="button" class="wb-remote__tip-ok" @click="dismissFirstTip">
        {{ t('winterboard.remote.firstTip.ok') }}
      </button>
    </div>

    <!-- Причина, чому пульт не керує — ЗАВЖДИ словами, ніколи мовчки -->
    <div v-if="reason" class="wb-remote__block" :class="`wb-remote__block--${reason.tone}`" role="status">
      <p class="wb-remote__reason">{{ reason.text }}</p>
      <p v-if="reason.hint" class="wb-remote__hint">{{ reason.hint }}</p>
      <button type="button" class="wb-remote__refresh" @click="refreshBoard">
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

    <!-- v1.2 — вигляд для учнів і картки задач (з уроку власника 2026-09-03) -->
    <div class="wb-remote__row">
      <button type="button" class="wb-remote__mini wb-remote__mini--wide" :disabled="!isReady || !hasCards" @click="sendCmd('view.fit')">
        {{ t('winterboard.remote.fitTask') }}
      </button>
      <button type="button" class="wb-remote__mini" :disabled="!isReady" :aria-label="t('winterboard.remote.fontDown')" @click="sendCmd('view.zoom', { delta: -1 })">A−</button>
      <button type="button" class="wb-remote__mini" :disabled="!isReady" :aria-label="t('winterboard.remote.fontUp')" @click="sendCmd('view.zoom', { delta: 1 })">A+</button>
    </div>
    <div class="wb-remote__row">
      <button type="button" class="wb-remote__mini" :disabled="!isReady || !isPresentingTask" :aria-label="t('winterboard.remote.scrollUp')" @click="sendCmd('view.scroll', { dir: -1 })">▲</button>
      <button type="button" class="wb-remote__mini" :disabled="!isReady || !isPresentingTask" :aria-label="t('winterboard.remote.scrollDown')" @click="sendCmd('view.scroll', { dir: 1 })">▼</button>
      <button type="button" class="wb-remote__mini wb-remote__mini--wide" :class="{ 'is-on': cards?.answer }" :disabled="!isReady || !hasCards" @click="sendCmd('card.reveal', { what: 'answer' })">
        {{ cards?.answer ? t('winterboard.remote.hideAnswer') : t('winterboard.remote.showAnswer') }}
      </button>
      <button type="button" class="wb-remote__mini wb-remote__mini--wide" :class="{ 'is-on': cards?.solution }" :disabled="!isReady || !hasCards" @click="sendCmd('card.reveal', { what: 'solution' })">
        {{ cards?.solution ? t('winterboard.remote.hideSolution') : t('winterboard.remote.showSolution') }}
      </button>
    </div>
    <p v-if="isReady && cards && cards.count === 0" class="wb-remote__note">{{ t('winterboard.remote.noCards') }}</p>

    <!-- Прототип «відео з пульта» (2026-09-25): пошук → вибір → підтвердження →
         картку ставить ноутбук; ▶/⏸ — лише коли на поточній сторінці є відео. -->
    <section v-if="isReady" class="wb-remote__video">
      <div v-if="videos.length" class="wb-remote__video-ctl">
        <select
          v-if="videos.length > 1"
          v-model="activeVideoId"
          class="wb-remote__video-pick"
          :aria-label="t('winterboard.remote.video.pick')"
        >
          <option v-for="v in videos" :key="v.objectId" :value="v.objectId">
            {{ v.title || t('winterboard.remote.video.untitled') }}
          </option>
        </select>
        <p v-else class="wb-remote__video-name">{{ activeVideo?.title || t('winterboard.remote.video.untitled') }}</p>
        <div class="wb-remote__row">
          <button type="button" class="wb-remote__mini wb-remote__mini--wide" :disabled="!activeVideo" @click="sendCmd('video.play', { object_id: activeVideoId })">
            ▶ {{ t('winterboard.remote.video.play') }}
          </button>
          <button type="button" class="wb-remote__mini wb-remote__mini--wide" :disabled="!activeVideo" @click="sendCmd('video.pause', { object_id: activeVideoId })">
            ⏸ {{ t('winterboard.remote.video.pause') }}
          </button>
        </div>
        <p v-if="activeVideo?.state === 'blocked'" class="wb-remote__video-blocked" role="status">
          {{ t('winterboard.remote.video.blocked') }}
        </p>
        <p v-else-if="activeVideo?.state === 'error'" class="wb-remote__video-blocked" role="status">
          {{ t(`winterboard.remote.video.playerError.${activeVideo.error ?? 'playback'}`) }}
        </p>
        <p v-else-if="activeVideo" class="wb-remote__note">{{ t(`winterboard.remote.video.state.${activeVideo.state}`) }}</p>
      </div>

      <form class="wb-remote__video-search" @submit.prevent="runVideoSearch()">
        <input
          v-model="videoQuery"
          type="search"
          class="wb-remote__video-input"
          enterkeyhint="search"
          :placeholder="t('winterboard.remote.video.placeholder')"
          :aria-label="t('winterboard.remote.video.placeholder')"
        >
        <button type="submit" class="wb-remote__mini" :disabled="videoSearching || !videoQuery.trim()">
          {{ videoSearching ? '…' : t('winterboard.remote.video.search') }}
        </button>
      </form>
      <!-- Запасний шлях: посилання, яке вчитель знайшов сам (або вичерпано квоту пошуку) -->
      <form class="wb-remote__video-link" @submit.prevent="runVideoLookup()">
        <input
          v-model="videoLink"
          type="url"
          inputmode="url"
          class="wb-remote__video-input"
          :placeholder="t('winterboard.remote.video.linkPlaceholder')"
          :aria-label="t('winterboard.remote.video.linkPlaceholder')"
        >
        <div class="wb-remote__row">
          <button v-if="canReadClipboard" type="button" class="wb-remote__mini wb-remote__mini--wide" :disabled="videoLooking" @click="pasteVideoLink">
            {{ t('winterboard.remote.video.paste') }}
          </button>
          <button type="submit" class="wb-remote__mini wb-remote__mini--wide" :disabled="videoLooking || !videoLink.trim()">
            {{ videoLooking ? '…' : t('winterboard.remote.video.check') }}
          </button>
        </div>
      </form>

      <p v-if="videoError" class="wb-remote__note">{{ videoError }}</p>

      <div v-if="videoPick" class="wb-remote__video-confirm">
        <!-- Прев'ю перед додаванням — однакове для пошуку й посилання -->
        <div class="wb-remote__video-item wb-remote__video-item--preview">
          <span class="wb-remote__video-thumb">
            <img :src="videoPick.thumbnail" alt="" loading="lazy">
            <span v-if="videoPick.duration_s != null" class="wb-remote__video-dur">{{ fmtDuration(videoPick.duration_s) }}</span>
          </span>
          <span class="wb-remote__video-meta">
            <span class="wb-remote__video-title">{{ videoPick.title }}</span>
            <span class="wb-remote__video-channel">{{ videoPick.channel }}</span>
            <span v-if="languageBadge(videoPick)" class="wb-remote__video-lang">{{ languageBadge(videoPick) }}</span>
          </span>
        </div>
        <p class="wb-remote__video-confirm-text">{{ t('winterboard.remote.video.confirm', { title: videoPick.title }) }}</p>
        <div class="wb-remote__row">
          <button type="button" class="wb-remote__mini wb-remote__mini--wide is-on" @click="confirmVideoPick">
            {{ t('winterboard.remote.video.add') }}
          </button>
          <button type="button" class="wb-remote__mini wb-remote__mini--wide" @click="videoPick = null">
            {{ t('winterboard.remote.video.cancel') }}
          </button>
        </div>
      </div>
      <ul v-else-if="videoResults.length" class="wb-remote__video-results">
        <li v-for="r in videoResults" :key="r.ref.id">
          <button type="button" class="wb-remote__video-item" @click="videoPick = r">
            <span class="wb-remote__video-thumb">
              <img :src="r.thumbnail" alt="" loading="lazy">
              <span v-if="r.duration_s != null" class="wb-remote__video-dur">{{ fmtDuration(r.duration_s) }}</span>
            </span>
            <span class="wb-remote__video-meta">
              <span class="wb-remote__video-title">{{ r.title }}</span>
              <span class="wb-remote__video-channel">{{ r.channel }}</span>
              <span v-if="languageBadge(r)" class="wb-remote__video-lang">{{ languageBadge(r) }}</span>
            </span>
          </button>
        </li>
      </ul>
    </section>

    <!-- v1.6 (LAW §9): предмет і мова матеріалу Інтегралика — той самий селектор і той
         самий реєстр, що в палітрі на ноутбуці. Пульт шле лише намір; пише ноутбук. -->
    <CorridorSelector
      v-if="corridorRegistry && assistantView"
      class="wb-remote__corridor"
      compact
      :registry="corridorRegistry"
      :subject="assistantView.subject"
      :language="assistantView.language"
      :disabled="!isReady"
      @select-subject="onRemoteSubject"
      @select-language="onRemoteLanguage"
    />

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
import authApi from '@/modules/auth/api/authApi'
import { trackEvent } from '@/utils/telemetryAgent'
import { winterboardApi, type VideoCandidate } from '../api/winterboardApi'
import { matchVideoSearchPhrase } from '../remote/videoSearchPhrase'
import { useRemoteChannel } from '../composables/useRemoteChannel'
import { usePushToTalk } from '../composables/usePushToTalk'
import { matchRemotePhrase } from '../remote/remoteGrammar'
import { derivePair } from '../remote/remotePair'
import { firstTipSeen, markFirstTipSeen } from '../remote/remoteEntry'
import CorridorSelector from '@/modules/intent/corridors/CorridorSelector.vue'
import { fetchCorridorRegistry } from '@/modules/intent/corridors/corridorApi'
import type { RemoteStateDetail } from '../composables/useRemoteChannel'

const props = defineProps<{ id?: string }>()
const { t, locale } = useI18n()
const authStore = useAuthStore()

const accountEmail = computed(() => authStore.user?.email ?? '')

// Швидка зміна акаунта прямо з пульта (власник на уроці 2026-09-04).
// Чому окремо, а не `authStore.logout()`: той жорстко веде на ЛЕНДІНГ
// (`/start`), а з телефона це зайвий екран — та сама причина, через яку
// маршрут пульта позначено `meta.loginDirect`. Тут ведемо одразу на вхід і
// повертаємось на пульт.
const switching = ref(false)
async function switchAccount(): Promise<void> {
  if (switching.value) return
  switching.value = true
  trackEvent('wb.remote.switch_account', {})
  try {
    await authApi.logout()
  } catch {
    // Мережа могла впасти — локальний стан однаково чистимо нижче,
    // інакше пульт лишиться з чужим токеном в пам'яті.
  }
  try {
    await authStore.forceLogout('manual_logout')
  } finally {
    window.location.href = `/auth/login?redirect=${encodeURIComponent('/remote')}`
  }
}
const clientId = (() => {
  try { return crypto.randomUUID() } catch { return `p-${Date.now().toString(36)}` }
})()

const boardId = ref<string | null>(null)
const boardName = ref('')
const pair = computed(() => (boardId.value ? derivePair(boardId.value) : ''))

const pageIndex = ref<number | null>(null)
const pageCount = ref<number | null>(null)
const lastPhrase = ref('')
/** v1.2 — картки задач на поточній сторінці (з remote.state ноутбука) */
const cards = ref<{ count: number; answer: boolean | null; solution: boolean | null; presenting?: boolean } | null>(null)
const hasCards = computed(() => !!cards.value && cards.value.count > 0)
/** ▲/▼ мають сенс лише коли «Задача на екран» відкрила довгу картку. */
const isPresentingTask = computed(() => !!cards.value?.presenting)

// ── Прототип «відео з пульта» (2026-09-25) ─────────────────────────────────
/** YouTube-картки поточної сторінки ноутбука (з remote.state) */
const videos = ref<NonNullable<RemoteStateDetail['videos']>>([])
const activeVideoId = ref('')
// Кілька відео — за замовчуванням останнє (щойно додане); зникло — беремо інше
watch(videos, (list) => {
  if (!list.some((v) => v.objectId === activeVideoId.value)) activeVideoId.value = list[list.length - 1]?.objectId ?? ''
})
const activeVideo = computed(() => videos.value.find((v) => v.objectId === activeVideoId.value) ?? null)

const videoQuery = ref('')
const videoSearching = ref(false)
const videoError = ref('')
const videoResults = ref<VideoCandidate[]>([])
/** Обране, але ще не підтверджене — дошка до «Додати» не змінюється */
const videoPick = ref<VideoCandidate | null>(null)

function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`
}

async function runVideoSearch(q?: string): Promise<void> {
  const query = (q ?? videoQuery.value).trim()
  if (!query || videoSearching.value) return
  videoQuery.value = query
  videoSearching.value = true
  videoError.value = ''
  videoResults.value = []
  videoPick.value = null
  tel('video_search', { len: query.length })
  try {
    const res = await winterboardApi.searchVideos(query)
    videoResults.value = res.items ?? []
    if (!videoResults.value.length) videoError.value = t('winterboard.remote.video.empty')
    tel('video_results', { n: videoResults.value.length, pool: res.pool, took: res.took_ms, dropped: res.dropped })
  } catch (e: any) {
    const code = errorCode(e)
    videoError.value = code === 'video_search_quota'
      ? t('winterboard.remote.video.quota')
      : code === 'video_search_user_limit'
        ? t('winterboard.remote.video.userLimit')
        : code === 'video_search_disabled'
          ? t('winterboard.remote.video.disabled')
          : t('winterboard.remote.video.failed')
    tel('video_search_error', { code: code || 'unknown' })
  } finally {
    videoSearching.value = false
  }
}

function errorCode(e: any): string {
  const raw = e?.response?.data?.error ?? e?.data?.error ?? e?.error ?? ''
  return typeof raw === 'string' ? raw : String(raw?.code ?? '')
}

/** Мова звуку: українську не підписуємо; невідому НЕ називаємо українською. */
function languageBadge(v: VideoCandidate): string {
  if (!v.audio_language || v.audio_language === 'uk') return ''
  if (v.audio_language === 'unknown') return t('winterboard.remote.video.langUnknown')
  return v.audio_language.toUpperCase()
}

// ── Запасний шлях: «Вставити посилання» ─────────────────────────────────────
const videoLink = ref('')
const videoLooking = ref(false)
const canReadClipboard = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText
const LOOKUP_ERRORS = new Set(['invalid_link', 'not_found', 'not_embeddable', 'private', 'live', 'age_restricted',
  'region_blocked', 'russian', 'user_limit', 'quota', 'disabled'])

async function runVideoLookup(): Promise<void> {
  const url = videoLink.value.trim()
  if (!url || videoLooking.value) return
  videoLooking.value = true
  videoError.value = ''
  videoResults.value = []
  videoPick.value = null
  tel('video_lookup', {})
  try {
    videoPick.value = await winterboardApi.lookupVideo(url)   // прев'ю + «Додати» — як у пошуку
    tel('video_lookup_ok', { lang: videoPick.value.audio_language })
  } catch (e: any) {
    const code = errorCode(e).replace(/^video_lookup_/, '')
    videoError.value = t(`winterboard.remote.video.lookupError.${LOOKUP_ERRORS.has(code) ? code : 'failed'}`)
    tel('video_lookup_error', { code: code || 'unknown' })
  } finally {
    videoLooking.value = false
  }
}

/** Вставити з буфера (жест кнопки; iOS ще спитає своє «Вставити») і одразу перевірити. */
async function pasteVideoLink(): Promise<void> {
  try {
    const text = (await navigator.clipboard.readText()).trim()
    if (!text) return
    videoLink.value = text
    await runVideoLookup()
  } catch {
    videoError.value = t('winterboard.remote.video.pasteDenied')
  }
}

function confirmVideoPick(): void {
  const pick = videoPick.value
  if (!pick) return
  if (sendCmd('video.add', { ref: pick.ref, title: pick.title.slice(0, 200) })) {
    videoPick.value = null
    videoResults.value = []
    videoQuery.value = ''
    videoLink.value = ''
  }
}

/** v1.6 — предмет і мова матеріалу з ноутбука; реєстр — той самий, що в палітрі. */
const assistant = ref<RemoteStateDetail['assistant'] | null>(null)
const corridorRegistry = ref<any>(null)
const assistantView = computed(() => {
  const a = assistant.value
  if (!a) return null
  return {
    subject: { mode: a.subjectMode, resolved: a.subject, locked: a.subjectMode === 'locked' ? a.subject : null, source: a.subjectSource },
    language: { mode: a.languageMode, content: a.contentLanguage, locked: a.languageMode === 'locked' ? a.contentLanguage : null, source: '' },
  }
})
function onRemoteSubject(value: string) {
  if (value === 'auto') sendCmd('subject.auto')
  else sendCmd('subject.set', { subject: value })
}
function onRemoteLanguage(value: string) {
  if (value === 'auto') sendCmd('language.auto')
  else sendCmd('language.set', { language: value })
}
onMounted(() => {
  // 404 — коридори цьому акаунту не ввімкнено: селектора на пульті немає.
  fetchCorridorRegistry(locale.value === 'en' ? 'en' : 'uk')
    .then((reg: any) => { corridorRegistry.value = reg?.enabled ? reg : null })
    .catch(() => { corridorRegistry.value = null })
})

/** Причина, чому пульт не керує (null = усе гаразд або ще шукаємо) */
type ReasonKey = 'noActiveBoard' | 'wrongAccount' | 'tooManyConnections' | 'boardNotAnswering' | 'noToken' | 'serverRejected' | 'unavailable' | 'boardFrozen'
const reasonKey = ref<ReasonKey | null>(null)
const reasonCode = ref('')

// 2026-09-03, власник: «постав телеметрію, щоб ти бачив, як я підключаюсь
// або намагаюсь». Без тексту фраз — лише події, причини, коди, довжини.
let firstStateSeen = false

/** Підказка після першого підключення — раз на пристрій (localStorage). */
const showFirstTip = ref(false)
function dismissFirstTip(): void {
  markFirstTipSeen()
  showFirstTip.value = false
}
function tel(event: string, ctx: Record<string, unknown> = {}) {
  try { trackEvent(`wb.remote.${event}`, { board: boardId.value ?? null, ...ctx }) } catch { /* noop */ }
}

/**
 * id з URL (/winterboard/:id/remote) відхилено сервером як чужий — далі
 * шукаємо дошку ноутбука по акаунту, як універсальний /remote.
 */
let routeIdRejected = false

const channel = useRemoteChannel({
  onState(s) {
    if (s.pair !== pair.value) { tel('state_foreign'); return }   // стан для іншої дошки / старої вкладки
    pageIndex.value = s.pageIndex
    pageCount.value = s.pageCount
    cards.value = s.cards ?? null
    assistant.value = s.assistant ?? null
    videos.value = s.videos ?? []
    // заморожена дошка — не помилка зв'язку, а стан: показуємо як причину, кнопки лишаємо
    reasonKey.value = s.frozen ? 'boardFrozen' : null
    if (s.frozen) reasonCode.value = 'REPLAY_FROZEN_NO_WRITE'
    if (!firstStateSeen) {
      firstStateSeen = true
      tel('state_first', { pages: s.pageCount, cards: s.cards?.count ?? null })
      if (!firstTipSeen()) showFirstTip.value = true
    }
    vibrate(15)
  },
  onError(code) {
    // Стара адреса з id чужої дошки (живий урок 2026-09-06: телефон тримав
    // /winterboard/<id>/remote від дошки іншого акаунта, а «Оновити» брав той
    // самий id знову і знову). Один раз — без петлі (LAW §12) — перепитуємо,
    // яка дошка відкрита на ноутбуці ПІД ЦИМ акаунтом, і йдемо туди.
    if (code === 'forbidden' && props.id && !routeIdRejected) {
      routeIdRejected = true
      tel('fallback', { from: 'route_id', code })
      channel.disconnect()
      void resolveAndConnect()
      return
    }
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
  const tone = k === 'boardNotAnswering' || k === 'noActiveBoard' || k === 'boardFrozen' ? 'warn' : 'error'
  switch (k) {
    case 'boardFrozen':
      return { tone, text: t('winterboard.remote.boardFrozen'), hint: t('winterboard.remote.boardFrozenHint') }
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

type RemoteCmd = 'hello' | 'page.goto' | 'page.new' | 'undo' | 'phrase' | 'view.fit' | 'view.zoom' | 'view.scroll' | 'card.reveal'
  | 'subject.set' | 'subject.auto' | 'language.set' | 'language.auto'
  | 'video.add' | 'video.play' | 'video.pause'
function sendCmd(cmd: RemoteCmd, args: Record<string, unknown> = {}) {
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
    // «Знайди відео про …» — пошук тут, на пульті (вибір і підтвердження — теж тут)
    const videoQ = matchVideoSearchPhrase(text)
    if (videoQ) {
      tel('ptt', { route: 'video', len: text.length })
      void runVideoSearch(videoQ)
      return
    }
    const cmd = matchRemotePhrase(text)
    tel('ptt', { route: cmd ? 'grammar' : 'ai', grammar: cmd ?? null, len: text.length })
    if (cmd === 'page.next') return goRel(1)
    if (cmd === 'page.prev') return goRel(-1)
    if (cmd === 'page.new') return void sendCmd('page.new')
    if (cmd === 'undo') return void sendCmd('undo')
    if (cmd === 'view.fit') return void sendCmd('view.fit')
    if (cmd === 'view.zoom.in') return void sendCmd('view.zoom', { delta: 1 })
    if (cmd === 'view.zoom.out') return void sendCmd('view.zoom', { delta: -1 })
    if (cmd === 'view.scroll.up') return void sendCmd('view.scroll', { dir: -1 })
    if (cmd === 'view.scroll.down') return void sendCmd('view.scroll', { dir: 1 })
    if (cmd === 'card.answer') return void sendCmd('card.reveal', { what: 'answer' })
    if (cmd === 'card.solution') return void sendCmd('card.reveal', { what: 'solution' })
    sendCmd('phrase', { text })
  },
})

// ── Знайти дошку і підключитись ─────────────────────────────────────────
async function resolveBoard(): Promise<string | null> {
  if (props.id && !routeIdRejected) {
    boardId.value = props.id
    return props.id
  }
  try {
    const r = await winterboardApi.getActiveRemoteSession()
    boardId.value = r.session_id
    boardName.value = r.name || ''
    tel('resolve', { found: true, via: 'api', after_route_id: routeIdRejected })
    if (routeIdRejected && r.session_id !== props.id) {
      // Старий id не має пережити перезавантаження сторінки: адреса стає
      // універсальною. Без роутера — сторінка та сама, лише URL.
      try { window.history.replaceState(null, '', '/remote') } catch { /* noop */ }
    }
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

/** «Оновити» у блоці причини: на id-адресі це означає «знайди дошку ноутбука». */
function refreshBoard(): void {
  if (props.id) routeIdRejected = true
  void resolveAndConnect()
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
.wb-remote__top { display: flex; align-items: center; gap: 10px; justify-content: space-between; }
.wb-remote__home {
  flex: none; width: 34px; height: 34px; border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  background: #1e293b; color: #cbd5e1; font-size: 18px; text-decoration: none;
}
.wb-remote__status { margin-right: auto; }
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
/* Зміна акаунта — поруч із поштою, але окремою кнопкою: палець має влучати
   (44px за гайдлайном тач-цілі, як у решти пульта), а не в текстовий рядок. */
.wb-remote__switch { display: inline-block; margin-left: 8px; background: #334155; color: #f8fafc; border: 0; border-radius: 10px; padding: 8px 14px; font-size: 13px; min-height: 44px; }
.wb-remote__switch:disabled { opacity: 0.6; }

.wb-remote__tip { padding: 14px 16px; border-radius: 12px; background: #064e3b; color: #ecfdf5; font-size: 15px; line-height: 1.4; }
.wb-remote__tip-title { margin: 0 0 6px; font-weight: 700; }
.wb-remote__tip-list { margin: 0 0 10px; padding-left: 20px; list-style: disc; }
.wb-remote__tip-ok { border: 0; border-radius: 10px; padding: 8px 18px; font-size: 15px; font-weight: 600; background: #ecfdf5; color: #064e3b; cursor: pointer; }
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

/* v1.2 — другий ряд: вигляд і картки */
.wb-remote__row { display: flex; gap: 10px; }
.wb-remote__mini {
  flex: 1; min-height: 56px; border: 0; border-radius: 14px; background: #1e293b; color: #f8fafc;
  font-size: 16px; font-weight: 600; cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.wb-remote__mini--wide { flex: 2; font-size: 14px; }
.wb-remote__mini.is-on { background: #0f766e; }
.wb-remote__mini:active { background: #334155; }
.wb-remote__mini:disabled { opacity: .35; }

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

/* Прототип «відео з пульта» */
.wb-remote__video { display: flex; flex-direction: column; gap: 10px; }
.wb-remote__video-ctl { display: flex; flex-direction: column; gap: 8px; }
.wb-remote__video-name { margin: 0; font-size: 14px; font-weight: 600; text-align: center; }
.wb-remote__video-pick { min-height: 44px; border-radius: 12px; background: #1e293b; color: #f8fafc; border: 1px solid #334155; padding: 0 10px; font-size: 14px; }
.wb-remote__video-blocked { margin: 0; padding: 10px 12px; border-radius: 12px; background: #b45309; color: #fff; font-weight: 600; text-align: center; }
.wb-remote__video-search { display: flex; gap: 8px; }
.wb-remote__video-input {
  flex: 3; min-height: 48px; border-radius: 12px; border: 1px solid #334155; background: #0b1222; color: #f8fafc;
  padding: 0 12px; font-size: 16px; user-select: text; -webkit-user-select: text;
}
.wb-remote__video-results { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.wb-remote__video-item {
  width: 100%; display: flex; gap: 10px; align-items: flex-start; padding: 6px; border: 0; border-radius: 12px;
  background: #1e293b; color: #f8fafc; text-align: left; cursor: pointer;
}
.wb-remote__video-thumb { position: relative; flex: 0 0 128px; }
.wb-remote__video-thumb img { width: 128px; height: 72px; object-fit: cover; border-radius: 8px; display: block; }
.wb-remote__video-dur { position: absolute; right: 4px; bottom: 4px; background: rgba(0, 0, 0, .8); font-size: 11px; padding: 1px 4px; border-radius: 4px; }
.wb-remote__video-meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.wb-remote__video-title { font-size: 14px; line-height: 1.25; max-height: 3.75em; overflow: hidden; }
.wb-remote__video-channel { font-size: 12px; color: #94a3b8; }
.wb-remote__video-confirm { padding: 12px; border-radius: 14px; background: #1e293b; display: flex; flex-direction: column; gap: 8px; }
.wb-remote__video-item--preview { background: #0b1222; cursor: default; }
.wb-remote__video-lang { align-self: flex-start; font-size: 11px; padding: 1px 6px; border-radius: 6px; background: #475569; color: #f8fafc; }
.wb-remote__video-link { display: flex; flex-direction: column; gap: 8px; }
.wb-remote__video-confirm-text { margin: 0; font-size: 15px; line-height: 1.35; }
</style>
