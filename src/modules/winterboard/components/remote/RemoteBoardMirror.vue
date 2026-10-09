<template>
  <!-- «Дзеркало дошки» (проба 2026-10-09): телефон стоїть і дивиться на шкільну дошку; коли перед
       дошкою ніхто не рухається і написане змінилось — вирівняний знімок лягає фоном сторінки
       наявною командою photo.background (LAW §9 v1.19). Учитель лише ставить телефон і 4 кути.
       Екран (ТЗ «швидше, без учителя, зручні кути» 2026-10-09 §3): кадр камери — на весь екран, крім
       вузької колонки кнопок (праворуч горизонтально, знизу вертикально), тож кнопки не лягають на кути;
       стан і підказки — однією напівпрозорою смужкою поверх кадру. -->
  <div class="wb-mirror" data-testid="board-mirror" :data-phase="phase">
    <div ref="stageEl" class="wb-mirror__stage" data-testid="mirror-stage">
      <video ref="videoEl" class="wb-mirror__video" playsinline muted autoplay data-testid="mirror-video" @loadedmetadata="measure" @resize="measure" />
      <svg v-if="box" class="wb-mirror__quad" :viewBox="`0 0 ${box.cw} ${box.ch}`" aria-hidden="true">
        <polygon :points="polyPoints" :class="{ 'is-bad': !usable }" />
        <!-- Боки дошки за кадром — червоним (урок 2, 09.10: верх обрізано, а рамка виглядала добре) -->
        <line
          v-for="e in clippedEdges"
          :key="e.side"
          class="is-clipped"
          :data-testid="`mirror-edge-${e.side}`"
          :x1="e.x1" :y1="e.y1" :x2="e.x2" :y2="e.y2"
        />
      </svg>

      <!-- Одна смужка поверх кадру: стан і коротке попередження. Торкання проходять крізь неї до кутів. -->
      <div class="wb-mirror__strip" role="status" data-testid="mirror-strip">
        <template v-if="phase === 'calibrate'">
          <!-- Поки ставлять кути — одне найважливіше: переплутано → бік за кадром → що знайшла → «Поставте кути» -->
          <p v-if="!usable" class="wb-mirror__line is-warn" data-testid="mirror-bad-quad">{{ t('winterboard.remote.mirror.badQuad') }}</p>
          <template v-else-if="clipped.length">
            <p v-for="s in clipped" :key="s" class="wb-mirror__line is-warn" :data-testid="`mirror-clipped-${s}`">
              {{ t(`winterboard.remote.mirror.clipped.${s}`) }}
            </p>
          </template>
          <p v-else-if="findNote" class="wb-mirror__line" :class="findNote === 'found' ? 'is-ok' : 'is-warn'" data-testid="mirror-find-note">
            {{ t(`winterboard.remote.mirror.find.${findNote}`) }}
          </p>
          <p v-else class="wb-mirror__line" data-testid="mirror-status">{{ statusText }}</p>
        </template>
        <template v-else>
          <p class="wb-mirror__line" :class="`is-${statusTone}`" data-testid="mirror-status">{{ statusText }}</p>
          <template v-if="phase === 'running' || phase === 'paused'">
            <p v-if="saveWaiting" class="wb-mirror__line" data-testid="mirror-save-waiting">{{ t('winterboard.remote.mirror.saveWaiting') }}</p>
            <p v-if="boardLost" class="wb-mirror__line is-warn" data-testid="mirror-save-lost">{{ t('winterboard.remote.mirror.saveLost') }}</p>
            <!-- Кути переїхали на дошку, що впирається в край кадру, — бік словами -->
            <p v-for="s in clipped" :key="s" class="wb-mirror__line is-warn" :data-testid="`mirror-clipped-${s}`">
              {{ t(`winterboard.remote.mirror.clipped.${s}`) }}
            </p>
            <p v-if="phase === 'running' && !wakeLockOk" class="wb-mirror__line is-note" data-testid="mirror-no-wakelock">
              {{ t('winterboard.remote.mirror.noWakeLock') }}
            </p>
          </template>
        </template>
      </div>

      <template v-if="phase === 'calibrate' && box">
        <!-- Передперегляд «так побачить ноутбук» — маленьке вікно в тому куті кадру, де немає кружечків;
             торкнутись — сховати (кадр дошки видно цілком), «👁» — показати знову -->
        <figure
          v-show="previewShown"
          class="wb-mirror__preview"
          :style="previewStyle"
          role="button"
          tabindex="0"
          data-testid="mirror-preview-box"
          @click="previewShown = false"
          @keydown.enter="previewShown = false"
        >
          <canvas ref="previewEl" :width="PREVIEW_W" :height="PREVIEW_H" data-testid="mirror-preview" />
          <figcaption>{{ t('winterboard.remote.mirror.preview') }}</figcaption>
        </figure>
        <button
          v-if="!previewShown"
          type="button"
          class="wb-mirror__preview-show"
          :style="previewStyle"
          data-testid="mirror-preview-show"
          :aria-label="t('winterboard.remote.mirror.preview')"
          @click="previewShown = true"
        >👁</button>

        <button
          v-for="(_, i) in corners"
          :key="i"
          type="button"
          class="wb-mirror__handle"
          :class="{ 'is-drag': dragIdx === i }"
          :data-testid="`mirror-corner-${i}`"
          :style="handleStyle(i)"
          :aria-label="t('winterboard.remote.mirror.corner', { n: i + 1 })"
          @pointerdown="onHandleDown(i, $event)"
          @pointermove="onHandleMove(i, $event)"
          @pointerup="onHandleUp(i, $event)"
          @pointercancel="onHandleUp(i, $event)"
        >{{ i + 1 }}</button>
      </template>

      <!-- Лупа над пальцем, поки тягнуть кружечок: місце під КУТОМ ×2,5 з перехрестям — палець кут не закриває -->
      <div v-if="phase === 'calibrate'" v-show="loupe" class="wb-mirror__loupe" :style="loupeStyle" data-testid="mirror-loupe" aria-hidden="true">
        <canvas ref="loupeEl" :width="LOUPE_RES" :height="LOUPE_RES" />
      </div>

      <!-- Довга підказка — лише за «?» -->
      <div v-if="phase === 'calibrate' && helpOpen" class="wb-mirror__card" data-testid="mirror-help" @click="helpOpen = false">
        <p class="wb-mirror__hint">{{ t('winterboard.remote.mirror.calibrateHint', { page: (pageIndex ?? 0) + 1 }) }}</p>
      </div>

      <div v-if="phase === 'stopped'" class="wb-mirror__card" data-testid="mirror-summary">
        <p class="wb-mirror__summary">{{ summaryText }}</p>
      </div>

      <!-- Журнал — висувна панель за кнопкою «Журнал»; v-show: записи не губляться, поки панель закрита -->
      <section v-show="journalOpen" class="wb-mirror__journal" data-testid="mirror-journal">
        <div class="wb-mirror__journal-top">
          <span>{{ t('winterboard.remote.mirror.journal') }}</span>
          <button type="button" class="wb-mirror__copy" data-testid="mirror-copy-log" @click="copyLog">
            {{ copied ? t('winterboard.remote.mirror.copied') : t('winterboard.remote.mirror.copyLog') }}
          </button>
          <button type="button" class="wb-mirror__copy" data-testid="mirror-journal-close" :aria-label="t('winterboard.remote.close')" @click="journalOpen = false">✕</button>
        </div>
        <ol class="wb-mirror__log" data-testid="mirror-log">
          <li v-for="e in shownLog" :key="e.n" :data-kind="e.kind">
            <span class="wb-mirror__time">{{ hms(e.at) }}</span> {{ e.text }}
          </li>
        </ol>
      </section>
    </div>

    <!-- Колонка кнопок — поза кадром: кути лежать лише на кадрі, тож кнопки їх не закривають -->
    <nav class="wb-mirror__rail" data-testid="mirror-rail" :aria-label="t('winterboard.remote.mirror.title')">
      <template v-if="phase === 'calibrate'">
        <!-- «Почати» — перша й найбільша -->
        <button type="button" class="wb-mirror__btn is-on is-main" data-testid="mirror-start" :disabled="!usable || !ready" @click="start">
          <span class="wb-mirror__ic" aria-hidden="true">▶</span><span>{{ t('winterboard.remote.mirror.start') }}</span>
        </button>
        <button type="button" class="wb-mirror__btn" data-testid="mirror-find" :disabled="!ready" @click="findBoard">
          <span class="wb-mirror__ic" aria-hidden="true">🔍</span><span>{{ t('winterboard.remote.mirror.find.button') }}</span>
        </button>
        <button type="button" class="wb-mirror__btn" data-testid="mirror-help-toggle" :aria-expanded="helpOpen" @click="helpOpen = !helpOpen">
          <span class="wb-mirror__ic" aria-hidden="true">?</span><span>{{ t('winterboard.remote.mirror.help') }}</span>
        </button>
      </template>

      <template v-else-if="phase === 'running' || phase === 'paused'">
        <button
          type="button" class="wb-mirror__btn is-on" data-testid="mirror-save-now"
          :disabled="saving || saveWaiting || boardLost || !ready" @click="saveNow"
        >
          <span class="wb-mirror__ic" aria-hidden="true">📸</span><span>{{ t('winterboard.remote.mirror.saveNow') }}</span>
        </button>
        <button type="button" class="wb-mirror__btn" data-testid="mirror-pause" @click="togglePause">
          <span class="wb-mirror__ic" aria-hidden="true">{{ phase === 'paused' ? '▶' : '⏸' }}</span>
          <span>{{ phase === 'paused' ? t('winterboard.remote.mirror.resume') : t('winterboard.remote.mirror.pause') }}</span>
        </button>
        <button type="button" class="wb-mirror__btn" data-testid="mirror-recalibrate" @click="recalibrate">
          <span class="wb-mirror__ic" aria-hidden="true">⌖</span><span>{{ t('winterboard.remote.mirror.corners') }}</span>
        </button>
        <button type="button" class="wb-mirror__btn" data-testid="mirror-journal-toggle" :aria-expanded="journalOpen" @click="journalOpen = !journalOpen">
          <span class="wb-mirror__ic" aria-hidden="true">📋</span><span>{{ t('winterboard.remote.mirror.journal') }}</span>
        </button>
        <button type="button" class="wb-mirror__btn" data-testid="mirror-stop" @click="stop('user')">
          <span class="wb-mirror__ic" aria-hidden="true">⏹</span><span>{{ t('winterboard.remote.mirror.stop') }}</span>
        </button>
      </template>

      <template v-else-if="phase === 'stopped'">
        <button type="button" class="wb-mirror__btn is-on is-main" data-testid="mirror-again" @click="again">
          <span class="wb-mirror__ic" aria-hidden="true">↻</span><span>{{ t('winterboard.remote.mirror.again') }}</span>
        </button>
        <button type="button" class="wb-mirror__btn" data-testid="mirror-journal-toggle" :aria-expanded="journalOpen" @click="journalOpen = !journalOpen">
          <span class="wb-mirror__ic" aria-hidden="true">📋</span><span>{{ t('winterboard.remote.mirror.journal') }}</span>
        </button>
      </template>

      <template v-else-if="phase === 'camera_error'">
        <button type="button" class="wb-mirror__btn is-on is-main" data-testid="mirror-camera-retry" @click="openCamera">
          <span class="wb-mirror__ic" aria-hidden="true">↻</span><span>{{ t('winterboard.remote.photo.retry') }}</span>
        </button>
      </template>

      <button type="button" class="wb-mirror__btn is-close" data-testid="mirror-close" :aria-label="t('winterboard.remote.close')" @click="close">
        <span class="wb-mirror__ic" aria-hidden="true">✕</span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
/**
 * «Дзеркало дошки» на пульті — проба «Операція Дзеркало» для уроку власника 2026-10-09.
 *
 * Що робить телефон (ноутбук і протокол — без змін, LAW §9 v1.19 `photo.background`):
 *  1. камера (задня) → учитель ставить 4 кути дошки на кадрі (кути запам'ятовуються на пристрої);
 *  2. 4 рази на секунду — зменшений сірий кадр дошки, пошук змін (`boardMirror.ts`);
 *  3. дошка завмерла ≥ 0,8 с і написане змінилось → знімок 1600×900 (дошка вписана з полями) →
 *     «Матеріали» (REST, `purpose=remote_photo`) → `photo.background` на сторінку, з якої почали;
 *     перед дошкою людина, а нове — поза нею → знімок одразу, закрите людиною — з попереднього
 *     знімка («склейка», ТЗ «швидше, без учителя» 2026-10-09 §2);
 *  4. одна спроба на одну зміну: не вдалося — наступна лише з наступною зміною чи «Зберегти зараз»;
 *     три невдачі поспіль, скінчилось місце чи стеля знімків — зупинка з причиною словами;
 *  5. телефон зрушив (урок 2, 09.10) — кути самі переїжджають разом із дошкою; дошки не видно —
 *     нічого не надсилається, доки її не знайде знову (`createShiftWatch`).
 *
 * Журнал (кнопка «Журнал», «Копіювати журнал») — для порівняння після уроку: кожна відправка й
 * кожне відкидання з часом, причиною й часткою змін; та сама подія — у телеметрію пульта.
 */
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { uploadAsset } from '../../api/library'
import { PHOTO_UPLOAD_PURPOSE, newRequestId, type RemotePhotoResult } from '../../remote/photoContract'
import { photoUploadError } from '../../remote/photoUploadError'
import {
  DETECT_W, MIRROR_TUNING, OUT_W, OUT_H, OUT_JPEG_QUALITY, SAMPLE_MS,
  analyzeFrame, boardAspect, boardFill, clippedSides, createMirrorDecider, createShiftWatch, defaultQuad,
  detectBoardQuad, fitRect, parseQuad, patchCovered, quadToPixels, quadUsable, sideEdge, warpBoard,
  type MirrorFrame, type Pixels, type Pt, type Quad, type ShiftWatch,
} from '../../remote/boardMirror'

const props = defineProps<{
  /** Пульт на зв'язку з дошкою й знає її поточну сторінку */
  ready: boolean
  pageIndex: number | null
  /** Останній `remote.state.photo` від ноутбука */
  result: RemotePhotoResult | null
  /** Надіслати photo.background; false — канал не відправив */
  sendBackground: (args: { library_asset_id: number; request_id: string; page_index: number }) => boolean
  tel?: (event: string, ctx?: Record<string, unknown>) => void
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

type Phase = 'starting' | 'camera_error' | 'calibrate' | 'running' | 'paused' | 'stopped'
type StopReason = 'user' | 'camera' | 'failures' | 'quota' | 'cap'
type CameraError = 'denied' | 'none' | 'insecure' | 'failed'
type SendWhy = 'first' | 'change' | 'after_wait' | 'covered' | 'manual'
/** Що відправити: причина, частка змін, коли нове помітили; склейка — які клітинки з попереднього знімка */
interface SendArgs { why: SendWhy; change: number; since: number; cover?: Uint8Array; covered?: number }

/** Скільки чекати відповіді ноутбука (як у «Фото на дошку») */
const ACK_TIMEOUT_MS = 15_000
const MAX_FAILS = 3
/** Рух у кадрі не вщухає: стільки — і рядок стану каже це словами; стільки — і запис у журнал */
const MOTION_NOTE_MS = 20_000
const MOTION_LOG_MS = 60_000
const SAMPLE_W = 640
/** Пошук дошки — через стільки після ввімкнення камери (експозиція встигає вирівнятись) */
const FIND_DELAY_MS = 500
const QUAD_KEY = 'wb.mirror.quad'
const LOG_MAX = 300
/** Передперегляд «так побачить ноутбук» поки ставлять кути: пропорції знімка (16:9), ~2 рази на секунду */
const PREVIEW_W = 320
const PREVIEW_H = 180
const PREVIEW_MS = 500
/** На екрані передперегляд — віконце 160×90 у куті кадру (ТЗ §3), відступ від країв кадру */
const PREVIEW_CSS_W = 160
const PREVIEW_CSS_H = 90
const PREVIEW_GAP = 8
/** Смужка стану вгорі кадру (приблизно): передперегляд згори кладемо нижче за неї */
const STRIP_H = 44
/** Кружечок кута — радіус із запасом: передперегляд не має лягати на нього */
const HANDLE_R = 26
/** Лупа (ТЗ §3): кругле вікно ~110 px, ×2,5 до кадру на екрані; полотно — удвічі щільніше, щоб не мило */
const LOUPE_PX = 110
const LOUPE_ZOOM = 2.5
const LOUPE_RES = 220
/** Лупа — над пальцем на такій відстані (палець і ніготь її не закривають) */
const LOUPE_GAP = 36
/** «Зберегти зараз» чекає тихого кадру (рука прибрана, телефон заспокоївся) не довше за це */
const SAVE_WAIT_MS = 3000

const { t } = useI18n()
const phase = ref<Phase>('starting')
const cameraError = ref<CameraError>('failed')
const stopReason = ref<StopReason>('user')
const videoEl = ref<HTMLVideoElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const corners = ref<Quad>(loadQuad())
const usable = computed(() => quadUsable(corners.value))
/** Боки дошки за кадром — за поточними кутами (і знайденими, і поставленими рукою) */
const clipped = computed(() => clippedSides(corners.value))
const wakeLockOk = ref(true)
const saving = ref(false)
const copied = ref(false)
/** Довга підказка (за «?») і журнал (за «Журнал») — поверх кадру, лише коли попросили */
const helpOpen = ref(false)
const journalOpen = ref(false)
/** Сторінка, на яку кладе дзеркало: та, що була на ноутбуці при «Почати» */
const mirrorPage = ref<number | null>(null)
/** Перед дошкою, схоже, людина — чекаємо */
const personNow = ref(false)
/** У кадрі давно не тихо (люди, голови учнів, мерехтіння ламп) — знімка немає, кажемо чому */
const motionLong = ref(false)
let movingSince: number | null = null
let movingMax = 0
let motionLogged = false
/** «Змінилось світло — не надсилаю» вже в журналі для цього проміжку */
let lightLogged = false
/** Сторож зсуву телефона — з «Почати» до зупинки / нових кутів */
let shiftWatch: ShiftWatch | null = null
/** Дошки не видно — нічого не надсилаємо, доки не знайдеться */
const boardLost = ref(false)
/** Кути щойно переставились самі — у рядку стану до наступного знімка на дошці */
const movedNote = ref(false)
/** «Зберегти зараз» натиснуто — знімок на першому тихому кадрі */
const saveWaiting = ref(false)
let saveAskedAt = 0
/** Що заважає відправці зараз: немає зв'язку / ноутбук на іншій сторінці */
const blockedBy = computed<'' | 'offline' | 'page'>(() => {
  if (phase.value !== 'running') return ''
  if (!props.ready) return 'offline'
  return props.pageIndex !== mirrorPage.value ? 'page' : ''
})

interface LogEntry { n: number; at: number; kind: string; text: string }
const log = ref<LogEntry[]>([])
const shownLog = computed(() => [...log.value].reverse())
let logN = 0

const stats = reactive({
  startedAt: 0, stoppedAt: 0, sends: 0, placed: 0, failed: 0, person: 0, delaySum: 0, moved: 0, lost: 0,
  batteryStart: null as number | null, batteryEnd: null as number | null, lastPlacedAt: null as number | null,
})

let stream: MediaStream | null = null
let timer: ReturnType<typeof setInterval> | null = null
let ackTimer: ReturnType<typeof setTimeout> | null = null
let wakeLock: { release: () => Promise<void>; addEventListener: (t: string, f: () => void) => void } | null = null
let decider = createMirrorDecider()
let consecutiveFails = 0
let dims = ''
let sampleCanvas: HTMLCanvasElement | null = null
/**
 * Полотна знімка — постійні, не нове на кожен знімок: Safari на iPhone звільняє пам'ять полотен
 * ліниво, і сотня полотен 1920×1080 за урок впирається в його ліміт. При закритті — розмір 0.
 */
let fullCanvas: HTMLCanvasElement | null = null
let outCanvas: HTMLCanvasElement | null = null
/**
 * Склейка (ТЗ «без учителя» §2): пікселі останнього надісланого знімка 1600×900 (≈5,8 МБ) — закрите
 * людиною береться звідси; `prevShotKey` — геометрія, з якою його зроблено (кути й розмір кадру).
 * Другий буфер — робочий, щоб кожен знімок не виділяв ще 5,8 МБ. Обидва відпускаються при зупинці,
 * закритті й нових кутах: геометрія інша — склеювати нема з чим.
 */
let prevShot: ImageData | null = null
let workShot: ImageData | null = null
let prevShotKey = ''
let resizeObs: ResizeObserver | null = null
let unmounted = false
/** Відправка, що чекає відповіді ноутбука */
let pending: { rid: string; since: number; sentAt: number } | null = null

function tel(event: string, ctx: Record<string, unknown> = {}): void {
  props.tel?.(`mirror_${event}`, ctx)
}

function add(kind: string, text: string): void {
  log.value.push({ n: ++logN, at: Date.now(), kind, text })
  if (log.value.length > LOG_MAX) log.value.splice(0, log.value.length - LOG_MAX)
}

function hms(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const pct = (x: number) => (Math.round(x * 1000) / 10).toString()
const pageNo = () => (mirrorPage.value ?? props.pageIndex ?? 0) + 1
const batteryText = (b: number | null) => (b === null ? '—' : `${b}%`)

function loadQuad(): Quad {
  try {
    const raw = localStorage.getItem(QUAD_KEY)
    return (raw && parseQuad(JSON.parse(raw))) || defaultQuad()
  } catch {
    return defaultQuad()   // приватний режим / зіпсоване — кути за замовчуванням
  }
}

function saveQuad(): void {
  try { localStorage.setItem(QUAD_KEY, JSON.stringify(corners.value)) } catch { /* кути лишаться лише до закриття */ }
}

async function battery(): Promise<number | null> {
  const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number }> }
  if (!nav.getBattery) return null   // iPhone не дає рівня батареї
  try {
    return Math.round((await nav.getBattery()).level * 100)
  } catch {
    return null
  }
}

// ── Камера ──────────────────────────────────────────────────────────────────────
/** Увімкнути камеру й показати кадр. Повертає код помилки або null. */
async function acquire(): Promise<CameraError | null> {
  if (!window.isSecureContext) return 'insecure'
  if (!navigator.mediaDevices?.getUserMedia) return 'none'
  let s: MediaStream
  try {
    s = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    })
  } catch (e) {
    const name = (e as { name?: string } | null)?.name
    tel('camera_error', { name: name ?? 'unknown' })
    return name === 'NotAllowedError' || name === 'SecurityError' ? 'denied'
      : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'none' : 'failed'
  }
  if (unmounted) { s.getTracks().forEach((tr) => tr.stop()); return null }
  stream = s
  s.getVideoTracks()[0]?.addEventListener('ended', onTrackEnded)
  const v = videoEl.value
  if (v) {
    v.muted = true
    v.srcObject = s
    await v.play().catch(() => undefined)   // muted + playsinline — автозапуск дозволено; ні — кадр усе одно йде
    await waitForDims(v)
  }
  dims = videoDims()
  measure()
  return null
}

/** Перше ввімкнення (і «Повторити» після помилки) → кути */
async function openCamera(): Promise<void> {
  phase.value = 'starting'
  const err = await acquire()
  if (err) {
    cameraError.value = err
    phase.value = 'camera_error'
    return
  }
  if (phase.value === 'starting') {
    phase.value = 'calibrate'
    findBoardSoon()
  }
}

function waitForDims(v: HTMLVideoElement): Promise<void> {
  if (v.videoWidth > 0) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => { v.removeEventListener('loadedmetadata', done); resolve() }
    v.addEventListener('loadedmetadata', done)
    setTimeout(done, 3000)
  })
}

function videoDims(): string {
  const v = videoEl.value
  return v && v.videoWidth ? `${v.videoWidth}x${v.videoHeight}` : ''
}

function stopTracks(): void {
  stream?.getTracks().forEach((tr) => {
    tr.removeEventListener('ended', onTrackEnded)
    tr.stop()
  })
  stream = null
  if (videoEl.value) videoEl.value.srcObject = null
}

function onTrackEnded(): void {
  if (phase.value !== 'running' && phase.value !== 'paused') return
  if (document.visibilityState === 'hidden') return   // спробуємо ввімкнути, коли екран увімкнуть
  add('camera', t('winterboard.remote.mirror.log.cameraEnded'))
  void stop('camera')
}

// ── Кути на кадрі ────────────────────────────────────────────────────────────────
/** Де саме на сцені видно кадр (object-fit: contain) */
const box = ref<{ cw: number; ch: number; ox: number; oy: number; dw: number; dh: number } | null>(null)

function measure(): void {
  const v = videoEl.value
  const el = stageEl.value
  if (!v || !el || !v.videoWidth || !v.videoHeight) { box.value = null; return }
  const cw = el.clientWidth
  const ch = el.clientHeight
  const s = Math.min(cw / v.videoWidth, ch / v.videoHeight)
  const dw = v.videoWidth * s
  const dh = v.videoHeight * s
  box.value = { cw, ch, ox: (cw - dw) / 2, oy: (ch - dh) / 2, dw, dh }
  // Телефон повернули, поки ставлять кути: новий розмір кадру — одразу «свій» і дошку шукаємо
  // під нову орієнтацію. Інакше перший tick після «Почати» бачив старий розмір, вирішував
  // «телефон повернули» і повертав до кутів — «Почати» доводилось тиснути двічі (уроки 09.10).
  const d = videoDims()
  if (d && d !== dims && (phase.value === 'calibrate' || phase.value === 'starting')) {
    const wasKnown = dims !== ''
    dims = d
    if (wasKnown && phase.value === 'calibrate') findBoardSoon()
  }
}

/** Кут (частки кадру) → точка на сцені */
function toStage(p: Pt): Pt {
  const b = box.value!
  return { x: b.ox + p.x * b.dw, y: b.oy + p.y * b.dh }
}

const polyPoints = computed(() => {
  if (!box.value) return ''
  return corners.value.map((p) => { const s = toStage(p); return `${s.x},${s.y}` }).join(' ')
})

/** Сторони рамки при краях кадру — червоні поверх рамки (поки ставлять кути і в роботі) */
const clippedEdges = computed(() => {
  const b = box.value
  if (!b || (phase.value !== 'calibrate' && phase.value !== 'running' && phase.value !== 'paused')) return []
  const q = corners.value
  return clipped.value.map((side) => {
    const i = sideEdge(q, side)
    const p1 = toStage(q[i])
    const p2 = toStage(q[(i + 1) % 4])
    return { side, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }
  })
})

function handleStyle(i: number): Record<string, string> {
  if (!box.value) return {}
  const s = toStage(corners.value[i])
  return { left: `${s.x}px`, top: `${s.y}px` }
}

/**
 * Перетягування кута (ТЗ §3): кружечок не стрибає під палець — кут рухається на стільки, на скільки
 * зрушив палець від місця, де кружечок узяли. Поки тягнуть — лупа над пальцем.
 */
const dragIdx = ref<number | null>(null)
let dragFrom: { px: number; py: number; start: Pt } | null = null

function onHandleDown(i: number, e: PointerEvent): void {
  dragIdx.value = i
  dragFrom = { px: e.clientX, py: e.clientY, start: { ...corners.value[i] } }
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  e.preventDefault()
  showLoupe(i, e)
}
function onHandleMove(i: number, e: PointerEvent): void {
  const b = box.value
  if (dragIdx.value !== i || !dragFrom || !b || !b.dw || !b.dh) return
  const x = Math.min(1, Math.max(0, dragFrom.start.x + (e.clientX - dragFrom.px) / b.dw))
  const y = Math.min(1, Math.max(0, dragFrom.start.y + (e.clientY - dragFrom.py) / b.dh))
  const next = corners.value.slice() as Quad
  next[i] = { x, y }
  corners.value = next
  showLoupe(i, e)
}
function onHandleUp(i: number, _e: PointerEvent): void {
  if (dragIdx.value !== i) return
  dragIdx.value = null
  dragFrom = null
  loupe.value = null
  saveQuad()
}

// ── Лупа над пальцем ───────────────────────────────────────────────────────────────
const loupeEl = ref<HTMLCanvasElement | null>(null)
/** Центр лупи на сцені; null — сховано (кружечок відпустили) */
const loupe = ref<Pt | null>(null)
const loupeStyle = computed(() => (loupe.value
  ? { left: `${loupe.value.x - LOUPE_PX / 2}px`, top: `${loupe.value.y - LOUPE_PX / 2}px`, width: `${LOUPE_PX}px`, height: `${LOUPE_PX}px` }
  : {}))

/**
 * Лупа: над пальцем (згори бракує місця — під ним), у межах сцени; у ній — копія кадру з відео навколо
 * КУТА `i` (не пальця), збільшена ×LOUPE_ZOOM проти кадру на екрані, перехрестя — стилем поверх.
 */
function showLoupe(i: number, e: PointerEvent): void {
  const b = box.value
  const v = videoEl.value
  const st = stageEl.value
  if (!b || !v || !st || !v.videoWidth || !b.dw) return
  const r = st.getBoundingClientRect()
  const fx = e.clientX - r.left
  const fy = e.clientY - r.top
  const half = LOUPE_PX / 2
  let y = fy - LOUPE_GAP - half
  if (y - half < 0) y = fy + LOUPE_GAP + half
  const x = Math.min(Math.max(fx, half), Math.max(half, b.cw - half))
  loupe.value = { x, y }
  const ctx = loupeEl.value?.getContext('2d')
  if (!ctx) return
  const p = corners.value[i]
  // Скільки пікселів кадру камери видно в лупі: LOUPE_PX екранних пікселів ÷ збільшення ÷ (екранних пікселів на піксель кадру)
  const src = LOUPE_PX / LOUPE_ZOOM / (b.dw / v.videoWidth)
  ctx.clearRect(0, 0, LOUPE_RES, LOUPE_RES)
  // Частина вікна за краєм кадру — браузер обрізає джерело й ціль пропорційно; там лишається чорне тло лупи
  ctx.drawImage(v, p.x * v.videoWidth - src / 2, p.y * v.videoHeight - src / 2, src, src, 0, 0, LOUPE_RES, LOUPE_RES)
}

// ── Робота ───────────────────────────────────────────────────────────────────────
async function holdScreen(): Promise<void> {
  const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<typeof wakeLock> } }
  if (!nav.wakeLock) { wakeLockOk.value = false; return }
  try {
    wakeLock = await nav.wakeLock.request('screen')
    wakeLockOk.value = true
    wakeLock?.addEventListener('release', () => { wakeLockOk.value = false })
  } catch (e) {
    wakeLockOk.value = false
    tel('wake_lock_failed', { name: (e as { name?: string } | null)?.name ?? 'unknown' })
  }
}

function releaseScreen(): void {
  const wl = wakeLock
  wakeLock = null
  if (wl) void wl.release().catch(() => undefined)   // уже відпущено системою — нічого робити
}

async function start(): Promise<void> {
  if (!usable.value || props.pageIndex === null) return
  saveQuad()
  dims = videoDims()   // точка відліку повороту — кадр саме зараз, коли тиснуть «Почати»
  mirrorPage.value = props.pageIndex
  decider = createMirrorDecider()
  dropShots()
  consecutiveFails = 0
  Object.assign(stats, {
    startedAt: Date.now(), stoppedAt: 0, sends: 0, placed: 0, failed: 0, person: 0, delaySum: 0, moved: 0, lost: 0,
    batteryEnd: null, lastPlacedAt: null,
  })
  personNow.value = false
  motionLong.value = false
  movingSince = null
  helpOpen.value = false
  // Сторож зсуву: де дошка зараз (свіжий пошук — кути могли підтягнути вже після автопошуку, а
  // телефон — поправити) і скільки кольору дошки в кутах. Не знайшла — кути вчителя самі по собі.
  const px = grabDetect()
  const found = px ? detectBoardQuad(px) : null
  const base = px ? boardFill(px, corners.value) : 0
  shiftWatch = createShiftWatch({ base, found: found?.quad ?? null })
  boardLost.value = false
  movedNote.value = false
  saveWaiting.value = false
  phase.value = 'running'
  stats.batteryStart = await battery()
  await holdScreen()
  add('start', t('winterboard.remote.mirror.log.start', {
    page: pageNo(), battery: batteryText(stats.batteryStart), size: videoDims(),
  }))
  tel('start', {
    page: mirrorPage.value, battery: stats.batteryStart, size: videoDims(), wake_lock: wakeLockOk.value,
    board_found: !!found, board_fill: Math.round(base * 100) / 100,
  })
  startTimer()
}

function startTimer(): void {
  stopTimer()
  timer = setInterval(tick, SAMPLE_MS)
}
function stopTimer(): void {
  if (timer) { clearInterval(timer); timer = null }
}

/** Кадр камери, зменшений до SAMPLE_W, — для аналізу й для передперегляду */
function grabSample(): Pixels | null {
  const v = videoEl.value
  if (!v || !v.videoWidth || !v.videoHeight || v.readyState < 2) return null
  const sw = SAMPLE_W
  const sh = Math.round((SAMPLE_W * v.videoHeight) / v.videoWidth)
  sampleCanvas ??= document.createElement('canvas')
  if (sampleCanvas.width !== sw || sampleCanvas.height !== sh) { sampleCanvas.width = sw; sampleCanvas.height = sh }
  const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(v, 0, 0, sw, sh)
  return ctx.getImageData(0, 0, sw, sh)
}

/** Зменшений кадр для аналізу */
function sampleFrame(): MirrorFrame | null {
  const img = grabSample()
  return img ? analyzeFrame(img, quadToPixels(corners.value, img.width, img.height)) : null
}

// ── Передперегляд «так побачить ноутбук» (урок 2, 09.10: верх дошки обрізано — не помітили) ──
const previewEl = ref<HTMLCanvasElement | null>(null)
let previewTimer: ReturnType<typeof setInterval> | null = null
/** Пікселі передперегляду — одні на весь час, а не нові двічі на секунду */
let previewImg: ImageData | null = null
/** Віконце передперегляду показане; торкнулись — сховане (кадр видно цілком) */
const previewShown = ref(true)
/** Де віконце: у куті кадру, де немає кружечків (рахується, коли кути не тягнуть — не стрибає під пальцем) */
const previewAt = ref<Pt | null>(null)
const previewStyle = computed(() => (previewAt.value ? { left: `${previewAt.value.x}px`, top: `${previewAt.value.y}px` } : {}))

/**
 * Де віконце передперегляду: кут кадру, де не лежить жоден кружечок (спершу нижні — згори смужка
 * стану). Дошка на весь кадр — кружечки біля всіх чотирьох кутів кадру: тоді посередині нижнього чи
 * верхнього краю (там бік дошки, а не кут), а якщо й там тісно — де до найближчого кружечка найдалі.
 */
function placePreview(): void {
  const b = box.value
  if (!b) { previewAt.value = null; return }
  const pts = corners.value.map(toStage)
  const left = b.ox + PREVIEW_GAP
  const right = b.ox + b.dw - PREVIEW_GAP - PREVIEW_CSS_W
  const mid = b.ox + (b.dw - PREVIEW_CSS_W) / 2
  const top = Math.max(b.oy + PREVIEW_GAP, STRIP_H)
  const bottom = b.oy + b.dh - PREVIEW_GAP - PREVIEW_CSS_H
  const spots: Pt[] = [
    { x: left, y: bottom }, { x: right, y: bottom }, { x: left, y: top }, { x: right, y: top },
    { x: mid, y: bottom }, { x: mid, y: top },
  ]
  /** Відстань від кружечка до віконця (0 — кружечок на ньому) */
  const gap = (s: Pt, p: Pt) => Math.hypot(
    Math.max(s.x - p.x, 0, p.x - (s.x + PREVIEW_CSS_W)),
    Math.max(s.y - p.y, 0, p.y - (s.y + PREVIEW_CSS_H)),
  )
  const room = (s: Pt) => Math.min(...pts.map((p) => gap(s, p)))
  previewAt.value = spots.find((s) => room(s) > HANDLE_R)
    ?? spots.reduce((best, s) => (room(s) > room(best) ? s : best))
}

watch([box, corners, dragIdx], () => { if (dragIdx.value === null) placePreview() })

/** Вирівняна дошка з кадру аналізу (не з повної роздільності), вписана з полями, як у знімку */
function drawPreview(): void {
  const c = previewEl.value
  if (unmounted || phase.value !== 'calibrate' || !c || !previewShown.value) return
  const img = grabSample()
  if (!img) return
  const ctx = c.getContext('2d')
  if (!ctx) return
  const quadPx = quadToPixels(corners.value, img.width, img.height)
  previewImg ??= ctx.createImageData(PREVIEW_W, PREVIEW_H)
  if (usable.value && warpBoard(img, quadPx, previewImg, fitRect(boardAspect(quadPx), PREVIEW_W, PREVIEW_H))) {
    ctx.putImageData(previewImg, 0, 0)
  } else {
    ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H)   // кути переплутані — ноутбук такого знімка не отримає
  }
}

function startPreview(): void {
  stopPreview()
  previewTimer = setInterval(drawPreview, PREVIEW_MS)
}
function stopPreview(): void {
  if (previewTimer) { clearInterval(previewTimer); previewTimer = null }
}

// Передперегляд живе лише поки ставлять кути: поза ними — ні таймера, ні читання кадру
watch(phase, (p) => {
  if (p === 'calibrate') startPreview()
  else stopPreview()
})

// Зв'язок і сторінка — у журнал лише зміни стану, не кожен кадр
watch(blockedBy, (b, was) => {
  if (b === 'page') add('hold', t('winterboard.remote.mirror.log.waitPage', { page: pageNo() }))
  else if (b === 'offline') add('hold', t('winterboard.remote.mirror.log.waitOnline'))
  else if (was && phase.value === 'running') add('hold', t('winterboard.remote.mirror.log.unblocked'))
})

// ── Склейка: геометрія попереднього знімка ──────────────────────────────────────────
/** Кути й розмір кадру — склеювати можна лише знімки, зроблені з тією самою геометрією */
function geomKey(): string {
  return `${videoDims()}|${corners.value.map((p) => `${p.x.toFixed(5)},${p.y.toFixed(5)}`).join(';')}`
}
/** Пульт тримає попередній знімок тієї самої геометрії — склейка можлива */
function canPatch(): boolean {
  return prevShot !== null && prevShotKey === geomKey()
}
/** Відпустити пікселі знімків (≈2 × 5,8 МБ): зупинка, закриття, нові кути */
function dropShots(): void {
  prevShot = null
  workShot = null
  prevShotKey = ''
}

function tick(): void {
  const forSave = saveWaiting.value
  if (phase.value !== 'running' && !(phase.value === 'paused' && forSave)) return
  // Телефон повернули — кути вже не там
  const d = videoDims()
  if (d && dims && d !== dims) {
    dims = d
    add('rotated', t('winterboard.remote.mirror.log.rotated'))
    tel('rotated', { size: d })
    recalibrate()
    findBoardSoon()
    return
  }
  const frame = sampleFrame()
  if (!frame) return
  const now = Date.now()
  const dec = decider.step(frame, now, canPatch())
  // Телефон не зрушив? Лише на тихому кадрі (SHIFT_TUNING — чому рідко); перед відправкою — свіжа перевірка
  const still = dec.kind !== 'moving' && dec.kind !== 'settling'
  const hold = still && watchShift(now, forSave || (dec.kind === 'send' && !blockedBy.value))
  if (forSave) {
    // Чекаю тихого кадру — через той самий tick, не довше SAVE_WAIT_MS; кути переїхали — наступним кадром
    if (!hold && !boardLost.value && (still || now - saveAskedAt >= SAVE_WAIT_MS)) finishSave(frame)
    return
  }
  if (hold) return   // дошки не видно / кути щойно переїхали / підозра — цей кадр не знімаємо
  if (dec.kind === 'person') {
    personNow.value = true
    if (dec.first) {
      stats.person++
      add('person', t('winterboard.remote.mirror.log.person', { change: pct(dec.change) }))
      tel('skip', { why: 'person', change: dec.change })
    }
    return
  }
  if (dec.kind === 'moving') {
    movingSince ??= now
    movingMax = Math.max(movingMax, dec.cells)
    if (now - movingSince >= MOTION_NOTE_MS) motionLong.value = true
    if (!motionLogged && now - movingSince >= MOTION_LOG_MS) {
      motionLogged = true
      add('motion', t('winterboard.remote.mirror.log.motion', { sec: Math.round((now - movingSince) / 1000), cells: movingMax }))
      tel('motion', { ms: now - movingSince, max_cells: movingMax })
    }
  } else if (dec.kind !== 'settling') {
    movingSince = null
    movingMax = 0
    motionLogged = false
    motionLong.value = false
  }
  if (dec.kind !== 'settling') personNow.value = false
  // Світло змінилось, а крейда ні (Б-176) — один рядок у журнал на кожен такий проміжок
  if (dec.kind === 'same' && dec.light) {
    if (!lightLogged) { lightLogged = true; add('light', t('winterboard.remote.mirror.log.light')); tel('skip', { why: 'light' }) }
  } else if (dec.kind === 'send') lightLogged = false
  if (dec.kind === 'wait' && dec.why === 'cap') { void stop('cap'); return }
  if (dec.kind !== 'send' || blockedBy.value) return
  void commit(frame, dec)
}

/**
 * Повнорозмірний вирівняний знімок → JPEG. `cover` — склейка: ці клітинки з попереднього знімка
 * (геометрію звірено перед викликом, `canPatch`). Знімок стає новим «попереднім».
 */
async function snapshot(cover: Uint8Array | null): Promise<{ file: File; warpMs: number } | null> {
  const v = videoEl.value
  if (!v || !v.videoWidth) return null
  const t0 = performance.now()
  const vw = v.videoWidth
  const vh = v.videoHeight
  fullCanvas ??= document.createElement('canvas')
  outCanvas ??= document.createElement('canvas')
  const full = fullCanvas
  const out = outCanvas
  if (full.width !== vw || full.height !== vh) { full.width = vw; full.height = vh }
  if (out.width !== OUT_W || out.height !== OUT_H) { out.width = OUT_W; out.height = OUT_H }
  const fctx = full.getContext('2d', { willReadFrequently: true })
  const octx = out.getContext('2d')
  if (!fctx || !octx) return null
  fctx.drawImage(v, 0, 0, vw, vh)
  const quadPx = quadToPixels(corners.value, vw, vh)
  const rect = fitRect(boardAspect(quadPx), OUT_W, OUT_H)
  const key = geomKey()
  const img = workShot ?? octx.createImageData(OUT_W, OUT_H)
  workShot = null
  if (!warpBoard(fctx.getImageData(0, 0, vw, vh), quadPx, img, rect)) { dropShots(); return null }
  if (cover && prevShot && prevShotKey === key) patchCovered(img, prevShot, rect, cover)
  octx.putImageData(img, 0, 0)
  // Цей знімок — новий «попередній» для наступної склейки; старий попередній — робочий буфер наступного
  workShot = prevShot
  prevShot = img
  prevShotKey = key
  const blob = await new Promise<Blob | null>((res) => out.toBlob(res, 'image/jpeg', OUT_JPEG_QUALITY))
  if (!blob) return null
  const p = (n: number) => String(n).padStart(2, '0')
  const d = new Date()
  const name = `board-mirror-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.jpg`
  return { file: new File([blob], name, { type: 'image/jpeg' }), warpMs: Math.round(performance.now() - t0) }
}

function failed(kind: string, text: string, ctx: Record<string, unknown>): void {
  stats.failed++
  consecutiveFails++
  add(kind, text)
  tel('failed', { kind, ...ctx })
  if (consecutiveFails >= MAX_FAILS) void stop('failures')
}

async function commit(frame: MirrorFrame, s: SendArgs): Promise<void> {
  const page = mirrorPage.value
  if (page === null || saving.value) return
  // Склейка — лише з тим попереднім знімком, що лежить зараз (та сама геометрія); ні — кадр цілком.
  // Рішення тут, до `sent`: точка відліку й знімок мають показувати те саме.
  const cover = s.cover && canPatch() ? s.cover : null
  const why: SendWhy = s.why === 'covered' && !cover ? 'change' : s.why
  decider.sent(frame, Date.now(), cover)
  saving.value = true
  stats.sends++
  try {
    const shot = await snapshot(cover)
    if (!shot) { failed('snapshot', t('winterboard.remote.mirror.log.snapshotFailed'), {}); return }
    const tUp = performance.now()
    let assetId: number
    try {
      assetId = (await uploadAsset(shot.file, null, { purpose: PHOTO_UPLOAD_PURPOSE })).id
    } catch (err) {
      const info = photoUploadError(err)
      failed('upload_error', t('winterboard.remote.mirror.log.uploadFailed', {
        reason: t(`winterboard.remote.photo.uploadError.${info.key}`, info.params),
      }), { code: info.key })
      if (info.key === 'quota') void stop('quota')
      return
    }
    if (phase.value === 'stopped' || unmounted) return
    const uploadMs = Math.round(performance.now() - tUp)
    const kb = Math.round(shot.file.size / 1024)
    const rid = newRequestId()
    const covered = cover ? s.covered ?? 0 : 0
    add('sent', t(`winterboard.remote.mirror.log.sent.${why}`, {
      change: pct(s.change), covered: pct(covered), kb, ms: shot.warpMs + uploadMs,
      sec: Math.round(MIRROR_TUNING.personAcceptMs / 1000),
    }))
    tel('send', {
      why, change: s.change, kb, warp_ms: shot.warpMs, upload_ms: uploadMs, n: stats.sends,
      ...(cover ? { covered: Math.round(covered * 1000) / 1000 } : {}),
    })
    pending = { rid, since: s.since, sentAt: Date.now() }
    if (!props.sendBackground({ library_asset_id: assetId, request_id: rid, page_index: page })) {
      pending = null
      failed('not_sent', t('winterboard.remote.mirror.log.notSent'), {})
      return
    }
    await waitResult(rid)
  } finally {
    saving.value = false
    decider.settled()
  }
}

let resolveWait: (() => void) | null = null
function waitResult(rid: string): Promise<void> {
  return new Promise((resolve) => {
    resolveWait = resolve
    clearAck()
    ackTimer = setTimeout(() => {
      ackTimer = null
      if (pending?.rid !== rid) return
      pending = null
      failed('unconfirmed', t('winterboard.remote.mirror.log.unconfirmed'), {})
      finishWait()
    }, ACK_TIMEOUT_MS)
  })
}
function finishWait(): void {
  const r = resolveWait
  resolveWait = null
  r?.()
}
function clearAck(): void {
  if (ackTimer) { clearTimeout(ackTimer); ackTimer = null }
}

watch(() => props.result, (r) => {
  if (!r || !pending || r.request_id !== pending.rid) return
  const p = pending
  pending = null
  clearAck()
  if (r.status === 'placed') {
    consecutiveFails = 0
    stats.placed++
    const now = Date.now()
    const delay = (now - p.since) / 1000
    stats.delaySum += delay
    stats.lastPlacedAt = now
    movedNote.value = false
    add('placed', t('winterboard.remote.mirror.log.placed', { sec: delay.toFixed(1) }))
    tel('placed', { delay_ms: now - p.since, ack_ms: now - p.sentAt })
  } else {
    failed('rejected', t('winterboard.remote.mirror.log.rejected', {
      reason: t(`winterboard.remote.photo.reason.${r.reason}`, { page: pageNo() }),
    }), { reason: r.reason })
  }
  finishWait()
})

/**
 * Сторож зсуву на тихому кадрі. true — цей кадр не знімати: дошки не видно, кути щойно переїхали
 * (порівнювати з нуля) або підозра чекає другої перевірки.
 */
function watchShift(now: number, beforeSend: boolean): boolean {
  const w = shiftWatch
  if (!w) return false
  if (!w.due(now, beforeSend)) return w.lost || w.pending
  const px = grabDetect()
  if (!px) return w.lost || w.pending
  const r = w.check(px, corners.value, now)
  const fill = Math.round(r.fill * 100) / 100
  switch (r.kind) {
    case 'ok':
      return false
    case 'pending':
      return true
    case 'back':
      boardLost.value = false
      add('back', t('winterboard.remote.mirror.log.boardBack'))
      tel('board_back', { fill })
      return false
    case 'lost':
      if (r.first) {
        boardLost.value = true
        movedNote.value = false
        stats.lost++
        cancelSave()
        add('lost', t('winterboard.remote.mirror.log.lost'))
        tel('board_lost', { fill })
      }
      return true
    case 'moved':
      corners.value = r.quad
      saveQuad()
      decider.reset()   // кути нові — порівнювати з нуля, перший тихий кадр піде знімком
      dropShots()       // і склеювати нема з чим: попередній знімок — з іншими кутами
      boardLost.value = false
      movedNote.value = true
      stats.moved++
      add('moved', t('winterboard.remote.mirror.log.moved', { shift: pct(r.shift) }))
      tel('moved', { shift: Math.round(r.shift * 1000) / 1000, by_ref: r.byRef, clipped: r.clipped, fill })
      return true
  }
}

/**
 * «Зберегти зараз» — без порогу змін, але не одразу: щойно кадр знову тихий (рука, що натиснула,
 * прибрана, телефон заспокоївся), не довше SAVE_WAIT_MS; зрушив телефон — спершу кути.
 */
function saveNow(): void {
  if (saving.value || saveWaiting.value || boardLost.value || blockedBy.value) return
  if (phase.value !== 'running' && phase.value !== 'paused') return
  saveWaiting.value = true
  saveAskedAt = Date.now()
  if (phase.value === 'paused') startTimer()   // на паузі кадри не аналізуються — лише на час чекання
}

function cancelSave(): void {
  if (!saveWaiting.value) return
  saveWaiting.value = false
  if (phase.value === 'paused') stopTimer()
}

function finishSave(frame: MirrorFrame): void {
  cancelSave()
  if (blockedBy.value) return   // за ці секунди зник зв'язок чи ноутбук пішов на іншу сторінку
  void commit(frame, { why: 'manual', change: 0, since: Date.now() })
}

function togglePause(): void {
  cancelSave()
  if (phase.value === 'paused') {
    phase.value = 'running'
    decider.reset()   // за паузу дошка могла змінитись — перший стабільний кадр піде знімком
    add('resume', t('winterboard.remote.mirror.log.resume'))
    tel('resume')
    startTimer()
  } else if (phase.value === 'running') {
    phase.value = 'paused'
    stopTimer()
    add('pause', t('winterboard.remote.mirror.log.pause'))
    tel('pause')
  }
}

// ── Сама знаходить дошку (ТЗ 2026-10-09 §2) ─────────────────────────────────────────
/** Що сказати над кадром після пошуку: знайшла / не вся в кадрі / не знайшла */
const findNote = ref<'' | 'found' | 'clipped' | 'notFound'>('')
let detectCanvas: HTMLCanvasElement | null = null
let findTimer: ReturnType<typeof setTimeout> | null = null

/** Пошук за пів секунди — камера встигає виставити експозицію */
function findBoardSoon(): void {
  if (findTimer) clearTimeout(findTimer)
  findTimer = setTimeout(() => { findTimer = null; findBoard() }, FIND_DELAY_MS)
}

/** Кадр для пошуку дошки (DETECT_W px) — і для автопошуку, і для сторожа зсуву */
function grabDetect(): Pixels | null {
  const v = videoEl.value
  if (unmounted || !v || !v.videoWidth || !v.videoHeight) return null
  const w = DETECT_W
  const h = Math.round((DETECT_W * v.videoHeight) / v.videoWidth)
  detectCanvas ??= document.createElement('canvas')
  if (detectCanvas.width !== w || detectCanvas.height !== h) { detectCanvas.width = w; detectCanvas.height = h }
  const ctx = detectCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(v, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}

/** Один кадр → кути дошки. Не знайшла — кути лишаються ті, що були (з минулого разу чи стандартні). */
function findBoard(): void {
  if (phase.value !== 'calibrate') return
  const px = grabDetect()
  if (!px) return
  const t0 = performance.now()
  const found = detectBoardQuad(px)
  const ms = Math.round(performance.now() - t0)
  if (found) {
    corners.value = found.quad
    findNote.value = found.clipped ? 'clipped' : 'found'
  } else {
    findNote.value = 'notFound'
  }
  add('find', t(`winterboard.remote.mirror.find.${findNote.value}`))
  tel('find', { result: findNote.value, ms, size: videoDims() })
}

/** Сторож зсуву й «Зберегти зараз» — до нових кутів / зупинки */
function dropWatch(): void {
  cancelSave()
  shiftWatch = null
  boardLost.value = false
  movedNote.value = false
}

function recalibrate(): void {
  stopTimer()
  dropWatch()
  decider.reset()
  dropShots()
  journalOpen.value = false
  phase.value = 'calibrate'
}

async function stop(reason: StopReason): Promise<void> {
  if (phase.value === 'stopped') return
  const wasActive = phase.value === 'running' || phase.value === 'paused'
  stopTimer()
  dropWatch()
  dropShots()
  releaseScreen()
  stopTracks()   // зупинено — камера не гріє телефон; «Почати знову» вмикає її знову
  stopReason.value = reason
  stats.stoppedAt = Date.now()
  phase.value = 'stopped'
  if (!wasActive) return
  stats.batteryEnd = await battery()
  add('stop', t(`winterboard.remote.mirror.log.stop.${reason}`, { battery: batteryText(stats.batteryEnd) }))
  tel('stop', {
    reason, min: Math.round((stats.stoppedAt - stats.startedAt) / 60000), sends: stats.sends, placed: stats.placed,
    failed: stats.failed, person: stats.person, moved: stats.moved, lost: stats.lost,
    battery_start: stats.batteryStart, battery_end: stats.batteryEnd,
    avg_delay_ms: stats.placed ? Math.round((stats.delaySum / stats.placed) * 1000) : null,
  })
}

function again(): void {
  journalOpen.value = false
  void openCamera()
}

function close(): void {
  void stop('user')
  emit('close')
}

async function copyLog(): Promise<void> {
  const text = log.value.map((e) => `${hms(e.at)} ${e.text}`).join('\n')
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch (e) {
    tel('copy_failed', { name: (e as { name?: string } | null)?.name ?? 'unknown' })
  }
}

// ── Стан словами ─────────────────────────────────────────────────────────────────
const statusTone = computed<'ok' | 'warn' | 'busy' | 'idle'>(() => {
  switch (phase.value) {
    case 'running': return blockedBy.value || boardLost.value || movedNote.value || personNow.value || motionLong.value ? 'warn' : 'ok'
    case 'camera_error': return 'warn'
    case 'stopped': return stopReason.value === 'user' ? 'idle' : 'warn'
    case 'starting': return 'busy'
    default: return 'idle'
  }
})

const statusText = computed(() => {
  switch (phase.value) {
    case 'starting': return t('winterboard.remote.mirror.status.starting')
    case 'camera_error': return t(`winterboard.remote.mirror.cameraError.${cameraError.value}`)
    case 'calibrate': return t('winterboard.remote.mirror.status.calibrate')
    case 'paused': return t('winterboard.remote.mirror.status.paused')
    case 'stopped': return t(`winterboard.remote.mirror.stopReason.${stopReason.value}`)
    case 'running':
      if (blockedBy.value === 'page') return t('winterboard.remote.mirror.status.waitPage', { page: pageNo() })
      if (blockedBy.value === 'offline') return t('winterboard.remote.mirror.status.waitOnline')
      if (boardLost.value) return t('winterboard.remote.mirror.status.lost')
      if (movedNote.value) return t('winterboard.remote.mirror.status.moved')
      if (personNow.value) return t('winterboard.remote.mirror.status.person')
      if (motionLong.value) return t('winterboard.remote.mirror.status.motion')
      return stats.lastPlacedAt
        ? t('winterboard.remote.mirror.status.running', { n: stats.placed, time: hms(stats.lastPlacedAt), page: pageNo() })
        : t('winterboard.remote.mirror.status.runningFirst', { page: pageNo() })
  }
  return ''
})

const summaryText = computed(() => {
  const min = Math.max(1, Math.round((stats.stoppedAt - stats.startedAt) / 60000))
  const avg = stats.placed ? (stats.delaySum / stats.placed).toFixed(1) : '—'
  const bat = stats.batteryStart !== null && stats.batteryEnd !== null ? `${stats.batteryStart}% → ${stats.batteryEnd}%` : '—'
  return t('winterboard.remote.mirror.summary', {
    min, sent: stats.sends, placed: stats.placed, failed: stats.failed, person: stats.person, avg, battery: bat,
  })
})

// ── Екран гасне / вкладка у фоні ─────────────────────────────────────────────────
async function onVisibility(): Promise<void> {
  if (phase.value !== 'running' && phase.value !== 'paused') return
  if (document.visibilityState === 'hidden') {
    add('hidden', t('winterboard.remote.mirror.log.hidden'))
    tel('hidden')
    return
  }
  add('visible', t('winterboard.remote.mirror.log.visible'))
  tel('visible')
  await holdScreen()
  const track = stream?.getVideoTracks()[0]
  if (track && track.readyState === 'live') {
    void videoEl.value?.play().catch(() => undefined)
    return
  }
  // Камеру зупинила система (iPhone гасить її разом з екраном) — одне ввімкнення, без повторів
  stopTracks()
  const err = await acquire()
  if (err) {
    add('camera', t('winterboard.remote.mirror.log.cameraEnded'))
    void stop('camera')
    return
  }
  decider.reset()
  dropShots()   // кадр камери після перезапуску може бути іншого розміру — склеювати не з чим
  add('camera', t('winterboard.remote.mirror.log.cameraBack'))
  tel('camera_back')
}

// Кадр на екрані змінив розмір (поворот, панелі) — кути перемалювати
watch(phase, () => { void nextTick(measure) })

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility)
  if (typeof ResizeObserver !== 'undefined' && stageEl.value) {
    resizeObs = new ResizeObserver(() => measure())
    resizeObs.observe(stageEl.value)
  }
  void openCamera()
})

onBeforeUnmount(() => {
  unmounted = true
  document.removeEventListener('visibilitychange', onVisibility)
  resizeObs?.disconnect()
  stopTimer()
  stopPreview()
  clearAck()
  finishWait()
  if (findTimer) { clearTimeout(findTimer); findTimer = null }
  releaseScreen()
  stopTracks()
  for (const c of [sampleCanvas, fullCanvas, outCanvas, detectCanvas, previewEl.value, loupeEl.value]) if (c) { c.width = 0; c.height = 0 }
  sampleCanvas = fullCanvas = outCanvas = detectCanvas = null
  previewImg = null
  dropShots()
})
</script>

<style scoped>
/* Кадр — на весь екран; кнопки — вузькою колонкою поза кадром: знизу вертикально, праворуч горизонтально */
.wb-mirror {
  position: fixed; inset: 0; z-index: 60; display: grid;
  grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto;
  background: #000; color: #f8fafc;
}
.wb-mirror__stage { position: relative; min-width: 0; min-height: 0; overflow: hidden; background: #000; touch-action: none; }
.wb-mirror__rail {
  display: flex; flex-direction: row; gap: 6px; box-sizing: border-box; height: calc(76px + env(safe-area-inset-bottom));
  padding: 6px 8px calc(6px + env(safe-area-inset-bottom)); background: #0b1220;
}
@media (orientation: landscape) {
  .wb-mirror { grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: minmax(0, 1fr); }
  .wb-mirror__rail {
    flex-direction: column; height: auto; width: calc(76px + env(safe-area-inset-right));
    padding: calc(6px + env(safe-area-inset-top)) calc(6px + env(safe-area-inset-right)) calc(6px + env(safe-area-inset-bottom)) 6px;
  }
}
.wb-mirror__video { width: 100%; height: 100%; object-fit: contain; display: block; }
.wb-mirror__quad { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; }
.wb-mirror__quad polygon { fill: rgba(16, 185, 129, .12); stroke: #10b981; stroke-width: 3; }
.wb-mirror__quad polygon.is-bad { fill: rgba(239, 68, 68, .15); stroke: #ef4444; }
.wb-mirror__quad line.is-clipped { stroke: #ef4444; stroke-width: 6; stroke-linecap: round; }

/* Смужка стану — поверх кадру, торкання проходять крізь неї до кружечків */
.wb-mirror__strip {
  position: absolute; top: 0; left: 0; right: 0; z-index: 2; pointer-events: none;
  padding: calc(6px + env(safe-area-inset-top)) 12px 6px; background: rgba(2, 6, 23, .6);
  display: flex; flex-direction: column; gap: 2px; text-align: center;
}
.wb-mirror__line { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.3; }
.wb-mirror__line.is-ok { color: #6ee7b7; }
.wb-mirror__line.is-warn { color: #fcd34d; }
.wb-mirror__line.is-note { font-size: 12px; font-weight: 500; color: #fcd34d; }

.wb-mirror__preview {
  position: absolute; z-index: 3; margin: 0; width: 160px; border: 2px solid rgba(255, 255, 255, .75); border-radius: 8px;
  overflow: hidden; background: #0f172a; cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.wb-mirror__preview canvas { display: block; width: 160px; height: 90px; }
.wb-mirror__preview figcaption {
  position: absolute; left: 0; right: 0; bottom: 0; padding: 1px 4px; font-size: 10px; text-align: center;
  color: #e2e8f0; background: rgba(2, 6, 23, .6);
}
.wb-mirror__preview-show {
  position: absolute; z-index: 3; width: 40px; height: 40px; border: 0; border-radius: 10px;
  background: rgba(2, 6, 23, .7); color: #f8fafc; font-size: 18px;
}

.wb-mirror__handle {
  position: absolute; z-index: 4; width: 44px; height: 44px; margin: -22px 0 0 -22px; border: 3px solid #fff; border-radius: 50%;
  background: rgba(16, 185, 129, .85); color: #fff; font-weight: 800; font-size: 16px; touch-action: none;
  -webkit-tap-highlight-color: transparent;
}
/* Поки тягнуть — кружечок прозорий: видно кадр під ним (точне місце — у лупі) */
.wb-mirror__handle.is-drag { background: rgba(16, 185, 129, .25); }

.wb-mirror__loupe {
  position: absolute; z-index: 5; pointer-events: none; box-sizing: border-box; border-radius: 50%; overflow: hidden;
  border: 3px solid #fff; box-shadow: 0 2px 12px rgba(0, 0, 0, .6); background: #000;
}
.wb-mirror__loupe canvas { display: block; width: 100%; height: 100%; }
/* Перехрестя — точно в центрі лупи, де кут */
.wb-mirror__loupe::before, .wb-mirror__loupe::after { content: ''; position: absolute; background: #f43f5e; }
.wb-mirror__loupe::before { left: 50%; top: 18%; bottom: 18%; width: 2px; margin-left: -1px; }
.wb-mirror__loupe::after { top: 50%; left: 18%; right: 18%; height: 2px; margin-top: -1px; }

.wb-mirror__card {
  position: absolute; z-index: 5; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(420px, calc(100% - 32px));
  max-height: calc(100% - 32px); overflow-y: auto; padding: 14px; border-radius: 14px; background: rgba(15, 23, 42, .94);
}
.wb-mirror__hint { margin: 0; font-size: 15px; line-height: 1.45; }
.wb-mirror__summary { margin: 0; font-size: 15px; line-height: 1.5; white-space: pre-line; }

.wb-mirror__journal {
  position: absolute; z-index: 6; top: 0; right: 0; bottom: 0; width: min(380px, 88%); box-sizing: border-box;
  display: flex; flex-direction: column; gap: 6px; padding: 10px; overflow-y: auto; background: rgba(2, 6, 23, .94);
}
@media (orientation: portrait) {
  .wb-mirror__journal { top: auto; left: 0; width: auto; height: 62%; }
}
.wb-mirror__journal-top { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #94a3b8; }
.wb-mirror__journal-top > span { flex: 1; }
.wb-mirror__copy { border: 0; border-radius: 10px; padding: 8px 12px; background: #1e293b; color: #e2e8f0; font-size: 13px; }
.wb-mirror__log { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 13px; line-height: 1.35; color: #cbd5e1; }
.wb-mirror__log li[data-kind="placed"] { color: #6ee7b7; }
.wb-mirror__log li[data-kind="person"], .wb-mirror__log li[data-kind="rejected"], .wb-mirror__log li[data-kind="upload_error"],
.wb-mirror__log li[data-kind="unconfirmed"], .wb-mirror__log li[data-kind="not_sent"],
.wb-mirror__log li[data-kind="lost"], .wb-mirror__log li[data-kind="moved"] { color: #fcd34d; }
.wb-mirror__time { color: #64748b; font-variant-numeric: tabular-nums; }

/* Кнопки колонки: значок і коротке слово; «Почати» — удвічі більша, «✕» — найменша */
.wb-mirror__btn {
  flex: 1 1 0; min-width: 0; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px; padding: 4px 2px; border: 0; border-radius: 12px; background: #1e293b; color: #f8fafc;
  font-size: 11px; font-weight: 600; line-height: 1.15; text-align: center; overflow: hidden; -webkit-tap-highlight-color: transparent;
}
.wb-mirror__ic { font-size: 20px; line-height: 1; }
.wb-mirror__btn.is-main { flex-grow: 2; font-size: 14px; }
.wb-mirror__btn.is-on { background: #0f766e; }
.wb-mirror__btn.is-close { flex: 0 0 48px; background: #334155; }
.wb-mirror__btn:disabled { opacity: .35; }
</style>
