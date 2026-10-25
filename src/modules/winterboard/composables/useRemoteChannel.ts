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
//
// v1.16 (Б-120): `presence.join` — сигнал «дошка (пере)підключилась» (F5 ноутбука, мережа).
// Канал лише передає його пульту (`onBoardJoin`); що робити — вирішує пульт.

import { ref, onUnmounted, type Ref } from 'vue'
import { getWsBaseUrl, isPresenceAvailable, _getFreshTokenAsync } from './usePresence'
import { parseRemotePhoto, type RemotePhotoResult } from '../remote/photoContract'
import { parseRemoteDictation, type RemoteDictationResult } from '../remote/dictationContract'
import { parseRemoteSentence, parseSentenceResult, type RemoteSentence, type SentenceResult } from '../remote/dictationLineContract'
import {
  parseRemoteRecording, parseRemoteRecordingResult, type RemoteRecordingInfo, type RemoteRecordingResult,
} from '../remote/recordingContract'

export type RemoteChannelState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'unavailable'

/**
 * v1.12 (пульт v2, LAW §9): що ноутбук у цій кімнаті вміє понад навігацію. Закритий набір.
 * v1.15: 'scenario' — кнопка «📋 Сценарій» (адаптер лише в уроці).
 * v1.35: 'objects' — у перемикачі поточного об'єкта всі види «Сценарію» (етап 2): відео, аудіо, документи,
 * картки, картинки; «випадайку» відео замінює перемикач, дотик у «Сценарії» обирає об'єкт.
 */
export type RemoteCap = 'photo' | 'video' | 'scenario' | 'objects' | 'dictation' | 'dictation_center' | 'dictation_line_v1' | 'dictation_analysis_v1'
export const REMOTE_CAPS: readonly RemoteCap[] = ['photo', 'video', 'scenario', 'objects', 'dictation', 'dictation_center', 'dictation_line_v1', 'dictation_analysis_v1']
const REMOTE_CAPS_MAX = 8

/** v1.15 «Сценарій»: наш вид об'єкта (не провайдер). v1.25: + картка й картинка (лише сторінка на екрані). */
export type RemoteScenarioKind = 'video' | 'audio' | 'presentation' | 'pdf' | 'document' | 'card' | 'image'
export interface RemoteScenarioItem {
  objectId: string
  kind: RemoteScenarioKind
  title: string
  pageIndex: number
  minimized: boolean
  /** Лише для об'єктів сторінки, що на екрані (відео/аудіо) */
  state?: RemoteVideoPlayState
  error?: RemoteVideoError
  /** Чутна гучність 0…100; немає — плеєр ще не завантажився */
  volume?: number
  /** Лише для документів сторінки, що на екрані: 0 ≤ docPage < docPages */
  docPage?: number
  docPages?: number
}

export interface RemoteStateDetail {
  pair: string
  clientId: string
  pageIndex: number
  pageCount: number
  /** v1.2 — масштаб полотна на ноутбуці (для інформації) */
  zoom?: number
  /** v1.2 — картки задач поточної сторінки: скільки, чи показано відповідь/розбір усім */
  cards?: { count: number; answer: boolean | null; solution: boolean | null; presenting?: boolean }
  /** v1.23 — питання до обговорення поточної сторінки: скільки й чи відкрито відповіді */
  questions?: { count: number; answer: boolean | null }
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
  /** v1.9 — результат останньої спроби «фото на дошку» (LAW §9) */
  photo?: RemotePhotoResult
  /** v1.49: відповідь ноутбука на останнє речення диктанту. */
  dictation?: RemoteDictationResult
  sentence?: RemoteSentence
  sentence_result?: SentenceResult
  /**
   * v1.12 — можливості ноутбука (пульт v2): ряд «+ Фото / + Відео» лише за цим полем.
   * Немає поля (старий ноутбук у кеші) — пульт показує все, як до v2.
   */
  caps?: RemoteCap[]
  /** v1.15 — «Сценарій»: відео, аудіо й документи дошки; `focusId` — об'єкт «на весь екран» */
  scenario?: { focusId: string | null; items: RemoteScenarioItem[] }
  /**
   * v1.18 — ноутбук на 1–3 с не пише в дошку (зберігає шаблон): пульт показує причину й
   * вимикає кнопки дошки. Немає поля — дошка пише, як завжди.
   */
  busy?: 'saving_template'
  /** v1.19 — на поточній сторінці фото-фон: у аркуші «Фото» є «Прибрати фон сторінки» */
  bgPhoto?: boolean
  /**
   * v1.26 — вікно Інтегралика відкрите на ноутбуці: лише тоді на пульті «– Згорнути вікно
   * Інтегралика». Немає поля (старий ноутбук у кеші) — кнопка стоїть, як до v1.26.
   */
  assistantOpen?: boolean
  /** v1.20 — остання відповідь Інтегралика на запит із пульта (діалог пульт складає сам) */
  assistantReply?: RemoteAssistantReplyDetail
  /**
   * v1.28 — запис уроку на ноутбуці й чий це запуск Дзеркала. Немає поля (старий ноутбук у кеші) —
   * Дзеркало команд запису не шле й підказує оновити сторінку дошки.
   */
  recording?: RemoteRecordingInfo
  /** v1.28 — відповідь на останню команду запису від Дзеркала */
  recordingResult?: RemoteRecordingResult
  /** v1.32 — покрокове письмо: «Крок N з M» і стан (закриті набори, як на сервері). */
  handwriteStep?: RemoteHandwriteStep
  /**
   * v1.34 — об'єкти поточної сторінки, з якими працює пульт (маніфест пульта П2). Є поле — пульт показує
   * перемикач і кнопки за видом поточного об'єкта; немає (старий ноутбук) — як до v1.34.
   */
  objects?: RemoteObject[]
  /** v1.34 — поточний об'єкт пульта (один з `objects`). */
  currentId?: string
  /** v1.34 — чому ноутбук не виконав останню дію над об'єктом. */
  objectNotice?: RemoteObjectNotice
}

/**
 * v1.34: вид об'єкта для пульта — наш закритий набір (як на сервері). v1.35: ще картинка (`image`; `cut` — та сама
 * картинка від ноутбука v1.34) і види «Сценарію».
 */
export type RemoteObjectKind = 'task' | 'cut' | 'card' | 'image' | 'video' | 'audio' | 'presentation' | 'pdf' | 'document'
export interface RemoteObject {
  id: string
  kind: RemoteObjectKind
  /** Номер серед об'єктів цього виду на сторінці (з 1). */
  n: number
  /** ✍ доступний для цього об'єкта. */
  hw?: boolean
  answer?: boolean
  solution?: boolean
  /** Цей об'єкт зараз «на екрані» (розгорнутий / збільшений). */
  presenting?: boolean
  /** v1.35: згорнуто в трей — на пульті лишається з «Повернути». */
  minimized?: boolean
}
export type RemoteObjectNotice = 'gone' | 'unsupported'

const OBJECT_KINDS = new Set(['task', 'cut', 'card', 'image', 'video', 'audio', 'presentation', 'pdf', 'document'])
const OBJECT_FLAGS = ['hw', 'answer', 'solution', 'presenting', 'minimized'] as const

/** v1.34: `objects` — ті самі правила, що на сервері; зіпсоване поле — поля немає (разом із `current_id`). */
export function parseRemoteObjects(raw: unknown): RemoteObject[] | undefined {
  if (!Array.isArray(raw) || raw.length > 50) return undefined
  const out: RemoteObject[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined
    const v = item as Record<string, unknown>
    if (typeof v.id !== 'string' || !v.id || v.id.length > 64) return undefined
    if (!OBJECT_KINDS.has(String(v.kind))) return undefined
    if (typeof v.n !== 'number' || !Number.isInteger(v.n) || v.n < 1 || v.n > 99) return undefined
    const obj: RemoteObject = { id: v.id, kind: v.kind as RemoteObjectKind, n: v.n }
    for (const flag of OBJECT_FLAGS) {
      if (flag in v) {
        if (typeof v[flag] !== 'boolean') return undefined
        obj[flag] = v[flag] as boolean
      }
    }
    out.push(obj)
  }
  return out
}

export function parseRemoteObjectNotice(raw: unknown): RemoteObjectNotice | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const reason = (raw as Record<string, unknown>).reason
  return reason === 'gone' || reason === 'unsupported' ? reason : undefined
}

export type RemoteAssistantReplyStatus = 'thinking' | 'reply' | 'confirm' | 'done' | 'error' | 'cancelled'
export interface RemoteAssistantReplyDetail {
  requestId: string
  status: RemoteAssistantReplyStatus
  text?: string
  /** лише в done — куди лягло (поточний номер підготовчої сторінки на ноутбуці) */
  pageIndex?: number
}

const ASSISTANT_REPLY_STATUSES: readonly RemoteAssistantReplyStatus[] = ['thinking', 'reply', 'confirm', 'done', 'error', 'cancelled']

/** v1.20: закритий набір, як на сервері; зіпсоване поле відкидаємо цілим, стан лишається валідним. */
export function parseRemoteAssistantReply(raw: any): RemoteAssistantReplyDetail | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  if (typeof raw.request_id !== 'string' || !raw.request_id) return undefined
  if (!ASSISTANT_REPLY_STATUSES.includes(raw.status)) return undefined
  const out: RemoteAssistantReplyDetail = { requestId: raw.request_id, status: raw.status }
  if (typeof raw.text === 'string' && raw.text) out.text = raw.text
  if (raw.status === 'done' && Number.isInteger(raw.page_index) && raw.page_index >= 0) out.pageIndex = raw.page_index
  return out
}

/** v1.18: закритий набір, як на сервері; інше — поля немає. */
/** v1.32: стан покрокового письма розв'язку на ноутбуці. */
export interface RemoteHandwriteStep {
  status: 'idle' | 'preparing' | 'writing' | 'done' | 'refused'
  written: number
  total: number
  reason?: string
  /** Є що писати наступним натиском (на сторінці без карток задач — виділена вирізка з PDF тощо). */
  target?: boolean
}

const HANDWRITE_STEP_STATUSES = new Set(['idle', 'preparing', 'writing', 'done', 'refused'])
const HANDWRITE_STEP_REASONS = new Set([
  'no_task', 'many_tasks', 'unsure', 'mismatch', 'not_readable', 'unsupported', 'solver_unavailable', 'no_space',
  'blocked', 'no_solution', 'elsewhere', 'error',
])

/** v1.32: `handwrite_step` — ті самі правила, що на сервері; зіпсоване — поля немає. */
export function parseRemoteHandwriteStep(raw: unknown): RemoteHandwriteStep | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const v = raw as Record<string, unknown>
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 99
  if (!HANDWRITE_STEP_STATUSES.has(String(v.status)) || !ok(v.written) || !ok(v.total) || v.written > v.total) return undefined
  const out: RemoteHandwriteStep = { status: v.status as RemoteHandwriteStep['status'], written: v.written, total: v.total }
  if (typeof v.target === 'boolean') out.target = v.target
  if (v.status === 'refused') {
    if (!HANDWRITE_STEP_REASONS.has(String(v.reason))) return undefined
    out.reason = String(v.reason)
  }
  return out
}

export function parseRemoteBusy(raw: unknown): 'saving_template' | undefined {
  return raw === 'saving_template' ? 'saving_template' : undefined
}

/** v1.26: вікно Інтегралика на ноутбуці — лише справжній boolean (як на сервері). */
export function parseRemoteAssistantOpen(raw: unknown): boolean | undefined {
  return typeof raw === 'boolean' ? raw : undefined
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

/**
 * v1.23 (2026-10-06): питання до обговорення. Поле живе лише з цілою кількістю > 0 —
 * зіпсоване чи порожнє не вмикає кнопку «❓ Показати відповідь» (як `presenting` вище:
 * поганий шматок стану не має ламати решту).
 */
export function parseRemoteQuestions(raw: any): RemoteStateDetail['questions'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const count = raw.count
  if (typeof count !== 'number' || !Number.isInteger(count) || count <= 0) return undefined
  return { count, answer: typeof raw.answer === 'boolean' ? raw.answer : null }
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

const SCENARIO_KINDS = new Set<RemoteScenarioKind>(['video', 'audio', 'presentation', 'pdf', 'document', 'card', 'image'])
const SCENARIO_ITEMS_MAX = 50
const SCENARIO_ID_MAX = 64
const SCENARIO_TITLE_MAX = 200
const SCENARIO_PAGE_INDEX_MAX = 10000
const SCENARIO_DOC_PAGES_MAX = 10000
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

/**
 * v1.15 «Сценарій»: `scenario` з `remote.state`. Дзеркало `_validate_remote_scenario` на
 * сервері: будь-яке порушення — поле відкидаємо ЦІЛИМ (`undefined`), стан лишається
 * валідним — сторінки важливіші за сценарій. Поля відтворення — лише у відео й аудіо,
 * сторінка документа — лише в документах.
 */
export function parseRemoteScenario(raw: any): RemoteStateDetail['scenario'] | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const focus = raw.focus_id
  if (focus != null && (typeof focus !== 'string' || focus.length < 1 || focus.length > SCENARIO_ID_MAX)) return undefined
  if (!Array.isArray(raw.items) || raw.items.length > SCENARIO_ITEMS_MAX) return undefined
  const items: RemoteScenarioItem[] = []
  for (const it of raw.items) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) return undefined
    const { object_id: id, kind, page_index: pageIndex, minimized } = it
    const title = it.title === undefined ? '' : it.title
    if (typeof id !== 'string' || id.length < 1 || id.length > SCENARIO_ID_MAX) return undefined
    if (!SCENARIO_KINDS.has(kind) || typeof title !== 'string') return undefined
    if (!isInt(pageIndex) || pageIndex < 0 || pageIndex > SCENARIO_PAGE_INDEX_MAX) return undefined
    if (typeof minimized !== 'boolean') return undefined
    const item: RemoteScenarioItem = { objectId: id, kind, title: title.slice(0, SCENARIO_TITLE_MAX), pageIndex, minimized }
    // Необов'язкові поля: null = немає, як `is not None` на сервері
    const { state, error, volume, doc_page: docPage, doc_pages: docPages } = it
    if (kind === 'video' || kind === 'audio') {
      if (docPage != null || docPages != null) return undefined
      if (state != null) {
        if (!VIDEO_STATES.has(state)) return undefined
        item.state = state
      }
      if (error != null) {
        if (state !== 'error' || !VIDEO_ERRORS.has(error)) return undefined
        item.error = error
      }
      if (volume != null) {
        if (!isInt(volume) || volume < 0 || volume > 100) return undefined
        item.volume = volume
      }
    } else {
      if (state != null || error != null || volume != null) return undefined
      // v1.25: у картки й картинки сторінок документа немає
      if ((kind === 'card' || kind === 'image') && (docPage != null || docPages != null)) return undefined
      if (docPage != null || docPages != null) {
        if (!isInt(docPage) || !isInt(docPages)) return undefined
        if (docPages < 1 || docPages > SCENARIO_DOC_PAGES_MAX || docPage < 0 || docPage >= docPages) return undefined
        item.docPage = docPage
        item.docPages = docPages
      }
    }
    items.push(item)
  }
  return { focusId: focus ?? null, items }
}

const LOG_PREFIX = '[WB:remote]'
const MAX_RECONNECT = 5
const RECONNECT_BASE_MS = 1000

function jitter(ms: number): number {
  const j = ms * 0.2
  return Math.max(0, Math.round(ms + (Math.random() * 2 - 1) * j))
}

/**
 * v1.12: `caps` з `remote.state`. Зіпсоване поле (не список, не рядки, задовге) відкидаємо
 * цілим → `undefined` (пульт поводиться як зі старим ноутбуком); невідомі значення —
 * поодинці, без повторів. Дзеркало `_validate_remote_caps` на сервері.
 */
export function parseRemoteCaps(raw: any): RemoteCap[] | undefined {
  if (!Array.isArray(raw) || raw.length > REMOTE_CAPS_MAX) return undefined
  const out: RemoteCap[] = []
  for (const item of raw) {
    if (typeof item !== 'string') return undefined
    if ((REMOTE_CAPS as readonly string[]).includes(item) && !out.includes(item as RemoteCap)) out.push(item as RemoteCap)
  }
  return out
}

export function useRemoteChannel(opts: {
  onState: (s: RemoteStateDetail) => void
  onError?: (code: string) => void
  /** v1.16 (Б-120): хтось приєднався до кімнати дошки — `userId` з `presence.join` */
  onBoardJoin?: (userId: string) => void
}) {
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
        const questions = parseRemoteQuestions(msg.questions)
        if (questions) detail.questions = questions
        const videos = parseRemoteVideos(msg.videos)
        if (videos) detail.videos = videos
        const photo = parseRemotePhoto(msg.photo)
        if (photo) detail.photo = photo
        const dictation = parseRemoteDictation(msg.dictation)
        if (dictation) detail.dictation = dictation
        const sentence = parseRemoteSentence(msg.sentence)
        if (sentence) detail.sentence = sentence
        const sentenceResult = parseSentenceResult(msg.sentence_result)
        if (sentenceResult) detail.sentence_result = sentenceResult
        const caps = parseRemoteCaps(msg.caps)
        if (caps) detail.caps = caps
        const scenario = parseRemoteScenario(msg.scenario)
        if (scenario) detail.scenario = scenario
        const busy = parseRemoteBusy(msg.busy)
        if (busy) detail.busy = busy
        // v1.19: лише справжній boolean, як і на сервері
        if (typeof msg.bg_photo === 'boolean') detail.bgPhoto = msg.bg_photo
        // v1.26: так само — лише справжній boolean
        const assistantOpen = parseRemoteAssistantOpen(msg.assistant_open)
        if (assistantOpen !== undefined) detail.assistantOpen = assistantOpen
        const assistantReply = parseRemoteAssistantReply(msg.assistant_reply)
        if (assistantReply) detail.assistantReply = assistantReply
        // v1.28: закриті набори, як на сервері; зіпсоване поле — поля немає
        const recording = parseRemoteRecording(msg)
        if (recording) detail.recording = recording
        const recordingResult = parseRemoteRecordingResult(msg.recording_result)
        if (recordingResult) detail.recordingResult = recordingResult
        const handwriteStep = parseRemoteHandwriteStep(msg.handwrite_step)
        if (handwriteStep) detail.handwriteStep = handwriteStep
        // v1.34: поточний об'єкт — лише якщо він серед `objects`, як на сервері
        const objects = parseRemoteObjects(msg.objects)
        if (objects) {
          detail.objects = objects
          if (typeof msg.current_id === 'string' && objects.some((o) => o.id === msg.current_id)) detail.currentId = msg.current_id
        }
        const objectNotice = parseRemoteObjectNotice(msg.object_notice)
        if (objectNotice) detail.objectNotice = objectNotice
        opts.onState(detail)
      } else if (msg?.type === 'error') {
        // forbidden (не власник дошки) / invalid_message / rate_limit — показати, не ковтати
        setError(String(msg.code ?? 'error'))
      } else if (msg?.type === 'presence.join') {
        // v1.16 (Б-120): дошка (пере)підключилась — після F5 ноутбук пульт «забуває»
        // і мовчить, доки пульт не привітається знову
        opts.onBoardJoin?.(String(msg.userId ?? ''))
      }
      // решта типів (presence.leave, ops.applied, stroke.broadcast…) пульту не потрібні
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
