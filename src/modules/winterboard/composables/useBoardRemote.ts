// WB Remote: НОУТБУК-проєктор приймає команди пульта й виконує ЛОКАЛЬНІ дії.
// Ref: LAW §9 «Remote control», CLASSROOM_REMOTE_VISION_2026-09-02.md крок 5.
//
// Пульт НЕ є писарем: сюди приходить намір («перейди на сторінку 4»), а запис у
// стан і реплей іде штатним шляхом від локальної дії (goToPage → op page_navigate
// через REST, як від кліку). undo — локальний стек. phrase → штатний конвеєр
// Інтегралика (CustomEvent m4sh:integralyk-ask), як від голосу з ноутбука.
//
// v1.1 (2026-09-02): код зв'язки СТАБІЛЬНИЙ — виводиться з id дошки
// (remotePair.derivePair), не випадковий на кожен mount. Пульт відкривається
// універсальною адресою /remote і сам знаходить активну дошку; QR — лише
// зручний спосіб відкрити ту адресу на телефоні.
//
// v1.2 (2026-09-03, з уроку): view.fit / view.zoom / view.scroll / card.reveal
// через RemoteViewAdapter (масштаб і скрол полотна, «відповідь/розбір» на
// картках задач). Стан для пульта доповнено `cards` і `zoom`.
//
// v1.6 (2026-09-17, коридори Інтегралика): subject.set / subject.auto /
// language.set / language.auto — теж лише намір. Ноутбук передає його палітрі
// Інтегралика подією (як `m4sh:integralyk-ask`), а вона записує вибір тим самим
// REST, що й клік. Стан предмета й мови йде на пульт полем `assistant`.
//
// v1.14 (2026-09-28, власник: «кнопка яка буде згортати вікно інтегралика»):
// assistant.minimize — тим самим каналом палітрі; вона робить те саме, що «–» у
// шапці вікна (згорнути в маскота, розмова лишається). Без аргументів, без ops.
//
// v1.15 «📋 Сценарій» (2026-09-28, ТЗ TZ_REMOTE_SCENARIO): відео, аудіо й документи
// дошки з телефона — адаптер `scenario` (лише в уроці, як media і photo). video.play /
// video.pause з v1.15 керують будь-яким програвачем; нові video.volume, view.focus,
// card.minimize, card.restore, doc.page. Стан — поле `scenario`, `caps` += 'scenario'.

import { ref, computed, watch, onUnmounted, type Ref, type ComputedRef } from 'vue'
import { derivePair } from '../remote/remotePair'
import { remoteEntryUrl } from '../remote/remoteEntry'
import { readPhotoRequest, type RemotePhotoResult } from '../remote/photoContract'
import type { RemotePhotoAdapter } from '../remote/remotePhotoAdapter'
import type { RemoteScenarioAdapter } from '../remote/remoteScenarioAdapter'
import type { RemoteViewAdapter } from './useRemoteViewAdapter'

export interface BoardRemoteStore {
  currentPageIndex: number
  pageCount: number
  goToPage: (index: number) => void
  addPage: () => void
}

export interface UseBoardRemoteOptions {
  sessionId: Ref<string | null>
  store: BoardRemoteStore
  undo: () => void
  /** presence.sendMessage — той самий сокет ноутбука */
  sendMessage: (data: Record<string, unknown>) => void
  /** Ноутбук виконує команди лише коли він власник/учитель */
  enabled: Ref<boolean> | ComputedRef<boolean>
  /** v1.2: масштаб/скрол/картки. Необов'язково — без нього v1.2-команди ігноруються. */
  view?: RemoteViewAdapter
  /** Прототип «відео з пульта» (2026-09-25). Без нього video.* ігноруються. */
  media?: RemoteMediaAdapter
  /**
   * v1.9 «фото з телефона» (LAW §9). Без адаптера (класна кімната тощо) ноутбук
   * відповідає `rejected: unsupported`, а не мовчить.
   */
  photo?: RemotePhotoAdapter
  /**
   * v1.15 «Сценарій» (LAW §9). Є адаптер — `caps` отримує 'scenario', у стані поле
   * `scenario`. Без нього (класна кімната) нові команди ігноруються, кнопки на пульті немає.
   */
  scenario?: RemoteScenarioAdapter
}

/** Відео поточної сторінки для ▶/⏸ на пульті (у remote.state — поле `videos`). */
export interface RemoteVideoState {
  object_id: string
  title: string
  state: 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'blocked' | 'error'
  /** Лише при state='error': причина від плеєра YouTube */
  error?: 'not_found' | 'not_embeddable' | 'playback'
}

/**
 * Прототип «відео з пульта»: пульт лише надсилає намір. Картку ставить ноутбук
 * штатним шляхом (як вставка посилання), відтворенням керує ноутбук.
 */
export interface RemoteMediaAdapter {
  list: () => RemoteVideoState[]
  add: (ref: { provider: string; id: string }, title: string) => void
  play: (objectId: string) => void
  pause: (objectId: string) => void
}

export interface RemoteCommandDetail {
  userId: string
  pair: string
  clientId: string
  cmd: 'hello' | 'page.goto' | 'page.new' | 'undo' | 'phrase' | 'view.fit' | 'view.page' | 'view.zoom' | 'view.scroll' | 'card.reveal'
    | 'subject.set' | 'subject.auto' | 'language.set' | 'language.auto' | 'assistant.minimize'
    | 'video.add' | 'video.play' | 'video.pause'
    | 'photo.add'
    | 'video.volume' | 'view.focus' | 'card.minimize' | 'card.restore' | 'doc.page'
  args: {
    index?: number; text?: string; delta?: number; dir?: number; what?: 'answer' | 'solution'; subject?: string; language?: string
    ref?: { provider: string; id: string }; title?: string; object_id?: string
    library_asset_id?: number; request_id?: string; page_index?: number
  }
}

/** v1.6 — предмет і мова матеріалу Інтегралика для підпису на пульті (LAW §9). */
export interface RemoteAssistantState {
  subject_mode: 'auto' | 'locked'
  subject: string
  subject_source: string
  language_mode: 'auto' | 'locked'
  content_language: 'uk' | 'en'
}

/** Події з палітрою Інтегралика (рядки звіряє тест із `intent/corridors/assistantCorridor.js`). */
export const ASSISTANT_COMMAND_EVENT = 'm4sh:assistant-corridor-command'
export const ASSISTANT_STATE_EVENT = 'm4sh:assistant-corridor-state'
export const ASSISTANT_STATE_REQUEST_EVENT = 'm4sh:assistant-corridor-state-request'
const ASSISTANT_CMDS = new Set(['subject.set', 'subject.auto', 'language.set', 'language.auto', 'assistant.minimize'])

/** Мінімальна пауза між remote.state при швидкому гортанні (сервер: 10/с). */
export const REMOTE_STATE_THROTTLE_MS = 150

function randomClientId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch { /* fallthrough */ }
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function useBoardRemote(opts: UseBoardRemoteOptions) {
  /** Стабільний код дошки — той самий після перезавантаження ноутбука */
  const pairCode = computed(() => derivePair(opts.sessionId.value ?? ''))
  const clientId = randomClientId()
  /** Останній hello від пульта (ms) — null = пульт ще не підключався */
  const lastRemoteSeenAt = ref<number | null>(null)
  const remoteConnected = computed(() => lastRemoteSeenAt.value !== null)
  const ignoredCount = ref(0)
  /** v1.6: останній стан предмета/мови від палітри для ЦІЄЇ дошки (null — не показувати) */
  const assistantState = ref<RemoteAssistantState | null>(null)
  /** v1.9: результат останньої спроби photo.add — лише в пам'яті вкладки, іде в кожен remote.state */
  const photoResult = ref<RemotePhotoResult | null>(null)

  /** Універсальна адреса пульта: без id, без коду — сам знайде активну дошку */
  const remoteUrl = computed(() => remoteEntryUrl())

  // ── remote.state → пульт ─────────────────────────────────────────────
  let stateTimer: ReturnType<typeof setTimeout> | null = null
  let lastStateSentAt = 0

  function sendStateNow(): void {
    lastStateSentAt = Date.now()
    const msg: Record<string, unknown> = {
      type: 'remote.state',
      pair: pairCode.value,
      client_id: clientId,
      page_index: opts.store.currentPageIndex,
      page_count: opts.store.pageCount,
    }
    if (opts.view) {
      const s = opts.view.summary()
      msg.zoom = s.zoom
      msg.cards = { count: s.count, answer: s.answer, solution: s.solution, presenting: s.presenting }
    }
    if (assistantState.value) msg.assistant = assistantState.value
    if (opts.media) msg.videos = opts.media.list()
    if (opts.scenario) msg.scenario = opts.scenario.state()
    // v1.12 (пульт v2): що ця кімната вміє понад навігацію — телефон за цим показує або
    // ховає ряд «+ Фото / + Відео» (v1.15: і кнопку «📋 Сценарій»). Лише підказка для UI:
    // команди перевіряються, як і раніше.
    msg.caps = [
      ...(opts.photo ? ['photo'] : []),
      ...(opts.media ? ['video'] : []),
      ...(opts.scenario ? ['scenario'] : []),
    ]
    if (photoResult.value) msg.photo = photoResult.value
    opts.sendMessage(msg)
  }

  function reportPhoto(result: RemotePhotoResult): void {
    photoResult.value = result
    sendState()
  }

  // Відео на сторінці з'явилось/зникло або змінило стан (грає / пауза / заблоковано)
  if (opts.media) {
    const media = opts.media
    watch(
      () => JSON.stringify(media.list()),
      () => { if (remoteConnected.value && opts.enabled.value) sendState() },
    )
  }

  // v1.15: сценарій змінився — об'єкт з'явився/зник, згорнули, сторінка документа, стан
  // програвача чи гучність. Тим самим тротлінгом 150 мс, що й videos.
  if (opts.scenario) {
    const scenario = opts.scenario
    watch(
      () => JSON.stringify(scenario.state()),
      () => { if (remoteConnected.value && opts.enabled.value) sendState() },
    )
  }

  function sendState(): void {
    const since = Date.now() - lastStateSentAt
    if (since >= REMOTE_STATE_THROTTLE_MS) {
      if (stateTimer) { clearTimeout(stateTimer); stateTimer = null }
      sendStateNow()
      return
    }
    if (stateTimer) return
    stateTimer = setTimeout(() => { stateTimer = null; sendStateNow() }, REMOTE_STATE_THROTTLE_MS - since)
  }

  // Пульт підключений → тримати його в курсі, де дошка
  watch(
    () => [opts.store.currentPageIndex, opts.store.pageCount] as const,
    ([idx], [prevIdx]) => {
      if (idx !== prevIdx) opts.view?.resetFocus()
      if (remoteConnected.value && opts.enabled.value) sendState()
    },
  )

  // Сторінка може перемкнутися РАНІШЕ, ніж конструктор уроку догрузить її
  // картки. Якщо стежити лише за індексом сторінки, пульт чесно отримує
  // `cards: { count: 0 }` і назавжди вимикає «Задача на екран» / «Відповідь» /
  // «Розбір», хоча картка вже з'явилась на полотні. summary() читає саме
  // реактивні дані поточної сторінки; тому цей watcher посилає свіжий стан
  // щойно картка з'явилась, зникла або змінила answer/solution.
  watch(
    () => opts.view?.summary(),
    () => {
      if (remoteConnected.value && opts.enabled.value) sendState()
    },
  )

  // v1.6: палітра Інтегралика повідомила новий стан предмета/мови цієї дошки
  function onAssistantState(e: Event): void {
    const d = (e as CustomEvent<{ boardId?: string | null; state?: RemoteAssistantState | null }>).detail
    if (!d || !d.boardId || d.boardId !== opts.sessionId.value) return
    assistantState.value = d.state ?? null
    if (remoteConnected.value && opts.enabled.value) sendState()
  }

  /** Палітра могла опублікувати стан ДО монтування кімнати — попросимо повторити. */
  function requestAssistantState(): void {
    if (!opts.sessionId.value) return
    window.dispatchEvent(new CustomEvent(ASSISTANT_STATE_REQUEST_EVENT, { detail: { boardId: opts.sessionId.value } }))
  }

  // ── remote.command ← пульт ───────────────────────────────────────────
  function onRemoteCommand(e: Event): void {
    const d = (e as CustomEvent<RemoteCommandDetail>).detail
    if (!d || !opts.enabled.value) return
    if (d.pair !== pairCode.value) { ignoredCount.value += 1; return }

    lastRemoteSeenAt.value = Date.now()
    const store = opts.store
    const view = opts.view

    switch (d.cmd) {
      case 'hello':
        requestAssistantState()   // палітра відповість подією; поки що — те, що маємо
        sendStateNow()
        return
      case 'page.goto': {
        const index = d.args?.index
        if (typeof index !== 'number' || !Number.isInteger(index)) return
        if (index < 0 || index >= store.pageCount) return
        if (index !== store.currentPageIndex) store.goToPage(index)
        // стан піде через watch; якщо індекс не змінився — підтвердити явно
        else sendState()
        return
      }
      case 'page.new':
        store.addPage()
        return
      case 'undo':
        opts.undo()
        return
      case 'phrase': {
        const text = String(d.args?.text ?? '').trim()
        if (!text) return
        window.dispatchEvent(new CustomEvent('m4sh:integralyk-ask', { detail: { text } }))
        return
      }
      // v1.2 — вигляд полотна і картки задач; стан підтверджуємо явно, бо
      // watch стежить лише за сторінками
      case 'view.fit':
        if (!view) return
        view.fitTask()
        sendState()
        return
      // v1.10 — з «Задача на екран» назад до звичайного вигляду сторінки
      // (той самий скид, що й при зміні сторінки)
      case 'view.page':
        if (!view) return
        view.resetFocus()
        sendState()
        return
      case 'view.zoom': {
        if (!view) return
        const delta = Number(d.args?.delta)
        if (!Number.isInteger(delta) || delta === 0) return
        view.changeTextScale(delta)
        sendState()
        return
      }
      case 'view.scroll': {
        if (!view) return
        const dir = Number(d.args?.dir)
        if (dir !== 1 && dir !== -1) return
        view.scrollBy(dir)
        return
      }
      case 'card.reveal': {
        if (!view) return
        const what = d.args?.what
        if (what !== 'answer' && what !== 'solution') return
        view.reveal(what)
        sendState()
        return
      }
      // Прототип «відео з пульта»: намір; картку й відтворення робить ноутбук
      case 'video.add': {
        const ref = d.args?.ref
        if (!opts.media || !ref || typeof ref.provider !== 'string' || typeof ref.id !== 'string') return
        opts.media.add({ provider: ref.provider, id: ref.id }, String(d.args?.title ?? ''))
        return   // нова картка → watch надішле стан
      }
      case 'video.play':
      case 'video.pause': {
        const objectId = String(d.args?.object_id ?? '')
        if (!objectId) return
        // v1.15: зі сценарієм — будь-який програвач сторінки (YouTube, файл, аудіо);
        // без нього — як v1.8, лише YouTube через медіа-адаптер.
        const player = opts.scenario ?? opts.media
        if (!player) return
        if (d.cmd === 'video.play') player.play(objectId)
        else player.pause(objectId)
        sendState()
        return
      }
      // v1.15 «Сценарій»: намір — ноутбук робить те саме, що кнопки на дошці
      case 'video.volume': {
        const objectId = String(d.args?.object_id ?? '')
        const delta = d.args?.delta
        if (!opts.scenario || !objectId || (delta !== 1 && delta !== -1)) return
        opts.scenario.volume(objectId, delta as -1 | 1)
        sendState()
        return
      }
      case 'view.focus': {
        const objectId = String(d.args?.object_id ?? '')
        if (!opts.scenario || !objectId) return
        opts.scenario.focus(objectId)
        sendState()   // focus_id не реактивний — підтверджуємо явно
        return
      }
      case 'card.minimize':
      case 'card.restore': {
        const objectId = String(d.args?.object_id ?? '')
        if (!opts.scenario || !objectId) return
        if (d.cmd === 'card.minimize') opts.scenario.minimize(objectId)
        else opts.scenario.restore(objectId)
        sendState()
        return
      }
      case 'doc.page': {
        const objectId = String(d.args?.object_id ?? '')
        const dir = d.args?.dir
        if (!opts.scenario || !objectId || (dir !== 1 && dir !== -1)) return
        opts.scenario.docPage(objectId, dir as -1 | 1)
        return   // новий currentPage → watch надішле стан
      }
      // v1.9: фото вже в «Матеріалах»; перевіряє й кладе ноутбук, пульт лише просить
      case 'photo.add': {
        const req = readPhotoRequest(d.args as Record<string, unknown>)
        if (!req) return
        // Старий результат (зокрема цієї ж спроби) не повинен їхати в наступних
        // станах, поки нова відповідь не готова: телефон прийняв би його за свіжий.
        photoResult.value = null
        if (!opts.photo) {
          reportPhoto({ request_id: req.requestId, status: 'rejected', reason: 'unsupported' })
          return
        }
        opts.photo.add(req).then(
          (outcome) => reportPhoto({ request_id: req.requestId, ...outcome }),
          (err) => {
            console.warn('[WB:remote] photo.add failed:', err)
            reportPhoto({ request_id: req.requestId, status: 'rejected', reason: 'error' })
          },
        )
        return
      }
      default:
        if (ASSISTANT_CMDS.has(d.cmd)) {
          // Пульт не пише: намір — палітрі на ЦЬОМУ ноутбуці. Стан повернеться
          // подією ASSISTANT_STATE_EVENT (і тоді, коли вибір відхилено).
          window.dispatchEvent(new CustomEvent(ASSISTANT_COMMAND_EVENT, {
            detail: { boardId: opts.sessionId.value, cmd: d.cmd, args: { ...(d.args || {}) } },
          }))
        }
        return
    }
  }

  window.addEventListener('wb:remote-command', onRemoteCommand)
  window.addEventListener(ASSISTANT_STATE_EVENT, onAssistantState)
  requestAssistantState()
  onUnmounted(() => {
    window.removeEventListener('wb:remote-command', onRemoteCommand)
    window.removeEventListener(ASSISTANT_STATE_EVENT, onAssistantState)
    if (stateTimer) clearTimeout(stateTimer)
  })

  return { pairCode, clientId, remoteUrl, remoteConnected, lastRemoteSeenAt, ignoredCount, sendState, assistantState, photoResult }
}
