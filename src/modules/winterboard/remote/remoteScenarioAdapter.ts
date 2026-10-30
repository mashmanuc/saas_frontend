/**
 * Пульт «📋 Сценарій» — ноутбук (LAW §9 v1.15, ТЗ TZ_REMOTE_SCENARIO_2026-09-28 §3–§4).
 *
 * Сценарій — це сама дошка: відео, аудіо й документи сторінок у їхньому порядку. Нової
 * сутності немає. Адаптер лише:
 *   • складає список для пульта (`state()` → поле `remote.state.scenario`);
 *   • виконує наміри телефона ТИМИ САМИМИ шляхами, що кнопки на дошці: ▶/⏸ і гучність —
 *     програвач цього ноутбука (ефемерно, без ops); «Згорнути» / «Повернути» / сторінка
 *     документа — один штатний `asset_update` (`updateAsset` кімнати); «На весь екран» —
 *     вигляд полотна цього екрана (`useRemoteViewAdapter.focusObject`).
 *
 * Правила для всіх команд (ТЗ §3): лише об'єкт ПОТОЧНОЇ сторінки зі списку сценарію; для
 * запису — ті самі умови, що на дошці (учитель, режим редагування; `canMinimize`, умови
 * трею), і запис має бути можливим (`canWrite`: не DESYNC / BOOTSTRAP / inputLocked).
 * Інакше команда ігнорується без повторів кодом (LAW §12): справжній стан пульт побачить
 * з наступного `remote.state`. «Схований на пульті ≠ дозволений на ноутбуці» (v1.12).
 *
 * v1.25 (власник 2026-10-06: «дати можливість вчителю на пультові згортати, розгортати»):
 * ще картки уроку (`card`) і картинки (`image`) — ЛИШЕ сторінки, що на екрані: кнопки однаково
 * діють тільки там, а медіа інших сторінок не випадають зі списку через стелю 50. Картка —
 * «Згорнути / Повернути»; картинка — ще «На весь екран». Задачі НМТ тут не з'являються: у них
 * свій блок пульта («Задача на екран», «Відповідь», «Розбір»).
 *
 * v1.75 (власник 2026-10-29: «Розгортати на цілий екран. Переключати події. Або вмикати. Або ставити на паузу»):
 * шкала подій — картка з подіями. У стані — скільки подій, яка відкрита і її назва, чи «по черзі»; дії — ті самі,
 * що кнопки картки: крок — один `asset_update` `active_event_id` (з картою — ще її підсвітка, як на картці),
 * «по черзі» — той самий ▶ (`board/timelinePlayback`), «На весь екран» — те саме «на всю дошку», що ⛶ на картці.
 *
 * v1.77 (2026-10-30, макет дизайнера «Пульт»): історична карта (`map_card` з `borders`) — так само. У стані — наш id
 * набору, його версія і рік (решту телефон рахує сам із того самого набору); крок — один `asset_update` `borders.year`
 * на сусідній рік зміни меж, як ←/→ картки; «по черзі» — той самий ▶ картки; «На весь екран» — її ⛶.
 */
import type { WBAsset } from '../types/winterboard'
import { canMinimize, canShowTray, minimizedAsset, restoredAsset, type TrayViewer } from '../board/boardTray'
import { isMinimizableAsset, isMinimizedOnBoard } from '../board/objectStandard'
import { linkedEvidenceUpdate, linkedHistoricalMapUpdates } from '../board/evidenceLinkage'
import { isTimelinePlaying, setTimelinePlaying } from '../board/timelinePlayback'
import { BORDER_DATASETS, bordersYears, clampYear, loadBordersFor, mapBordersOf, snapshotYears, stepYear } from '../board/historicalBorders'
import {
  changeVideoVolume, pauseVideo, playVideo, videoTime, ytPlayErrors, ytPlayStates, ytTimeMarks, ytVolumes,
} from '../board/youtubeRemoteControl'
import {
  changeMediaVolume, mediaPlayErrors, mediaPlayStates, mediaTime, mediaTimeMarks, mediaVolumes, pauseMedia, playMedia,
} from '../board/htmlMediaRemoteControl'

export type ScenarioKind = 'video' | 'audio' | 'presentation' | 'pdf' | 'document' | 'card' | 'image'
export type ScenarioPlayState = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'blocked' | 'error'

export interface RemoteScenarioItem {
  object_id: string
  kind: ScenarioKind
  title: string
  page_index: number
  minimized: boolean
  state?: ScenarioPlayState
  error?: 'not_found' | 'not_embeddable' | 'playback'
  volume?: number
  /** v1.57: де зараз і скільки всього, секунди (лише відео/аудіо сторінки, що на екрані) */
  pos?: number
  dur?: number
  doc_page?: number
  doc_pages?: number
  /** v1.75: шкала подій сторінки, що на екрані — скільки подій, відкрита (немає — жодна), її назва, «по черзі». */
  event_count?: number
  event_index?: number
  event_title?: string
  playing?: boolean
  /** v1.77: історична карта сторінки, що на екрані — наш id набору, версія, рік (три разом); `playing` — «по черзі». */
  map_dataset?: string
  map_version?: string
  map_year?: number
}

export interface RemoteScenarioState {
  focus_id: string | null
  items: RemoteScenarioItem[]
}

/** Межі протоколу (сервер відкидає поле цілим, якщо їх перейти). */
export const SCENARIO_ITEMS_MAX = 50
export const SCENARIO_OBJECT_ID_MAX = 64
export const SCENARIO_TITLE_MAX = 200
/** v1.75: стеля подій шкали в стані пульта (сервер — `REMOTE_TIMELINE_EVENTS_MAX`). */
export const TIMELINE_EVENTS_MAX = 100
export const TIMELINE_ASSET_TYPE = 'timeline_card'

/** v1.74/v1.77: картки з власним «на всю дошку» (board-expand) — шкала подій і історична карта з кордонами. */
export function isBoardExpandCard(asset: { type?: string | null; data?: unknown }): boolean {
  return asset.type === TIMELINE_ASSET_TYPE || mapBordersOf(asset) !== null
}

export interface RemoteScenarioView {
  focusObject: (id: string) => boolean
  objectFocusId: () => string | null
  resetFocus: () => void
}

export interface RemoteScenarioDeps {
  pages: () => ReadonlyArray<{ assets: ReadonlyArray<WBAsset> }>
  currentPageIndex: () => number
  /** Хто дивиться і в якому режимі дошка — як у віконних дій картки. */
  viewer: () => TrayViewer
  /** Запис можливий: не DESYNC / BOOTSTRAP, не inputLocked (як фото з пульта, v1.9). */
  canWrite: () => boolean
  /** Той самий шлях, що кнопки дошки: кімната → `store.updateAsset` → один asset_update. */
  updateAsset: (asset: WBAsset) => void
  view: RemoteScenarioView
}

/** Наш вид об'єкта, а не провайдер (CLAUDE_RULES «зовнішні контракти»). */
export function scenarioKind(asset: { type?: string | null; content_ref?: { content_type?: string } }): ScenarioKind | null {
  switch (asset.type) {
    case 'youtube_player':
    case 'video_player':
      return 'video'
    case 'audio_player':
      return 'audio'
    case 'document_viewer': {
      const ct = asset.content_ref?.content_type
      return ct === 'presentation' ? 'presentation' : ct === 'pdf' ? 'pdf' : 'document'
    }
    default:
      return null
  }
}

/** v1.25: текстові картки уроку. Задачі НМТ (`nmt_task`) — свій блок пульта, тут їх немає. */
const CARD_TYPES = new Set(['theory_card', 'history_card', 'timeline_card', 'map_card', 'discussion_question'])

/**
 * v1.25: картка чи картинка СТОРІНКИ, ЩО НА ЕКРАНІ. Лише те, що дошка вміє згорнути в треї
 * (`isMinimizableAsset`, fail-closed): тип без цієї можливості в список не потрапить.
 */
export function currentPageKind(asset: { type?: string | null }): 'card' | 'image' | null {
  const type = asset.type ?? ''
  if (!isMinimizableAsset(type)) return null
  if (type === 'image') return 'image'
  return CARD_TYPES.has(type) ? 'card' : null
}

/** Назва в списку пульта: медіа — `title`; картка — заголовок (питання — текст питання); картинка — підпис. */
function scenarioTitle(asset: WBAsset, kind: ScenarioKind): string {
  const data = ((asset as { data?: unknown }).data ?? {}) as Record<string, unknown>
  const text = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')
  let title: string
  if (kind === 'card') {
    title = asset.type === 'discussion_question' ? text(data.question) : (text(data.title) || text(data.body))
    // v1.77: історична карта без власної назви — назва набору («Східна Європа»), як у шапці картки
    const borders = mapBordersOf(asset)
    if (!title && borders) title = BORDER_DATASETS[borders.dataset]?.title[data.content_language === 'en' ? 'en' : 'uk'] ?? ''
  } else if (kind === 'image') {
    title = text(data.caption) || text(data.title)
  } else {
    title = text((asset as { title?: unknown }).title)
    // v1.59 (власник 25.10: «назва файла має бути»): мелодія чи відео з файлу без назви — ім'я файла
    if (!title && (asset.type === 'audio_player' || asset.type === 'video_player')) title = fileTitle(asset.src)
  }
  return title.slice(0, SCENARIO_TITLE_MAX)
}

/**
 * Ім'я файла з адреси, як його назвав учитель: без теки, `?…`, службового префікса сховища (`0b14f74a_`) і розширення.
 * Лише файли дошки (не YouTube: id провайдера не розбираємо — CLAUDE_RULES «зовнішні контракти»).
 */
export function fileTitle(src: unknown): string {
  if (typeof src !== 'string' || !src) return ''
  let name = src.split(/[?#]/)[0].split('/').pop() ?? ''
  try { name = decodeURIComponent(name) } catch { /* зіпсоване %-кодування — лишаємо як є */ }
  return name.replace(/^[0-9a-f]{8}_/i, '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_\s]+/g, ' ').trim()
}

const isDocKind = (k: ScenarioKind) => k === 'presentation' || k === 'pdf' || k === 'document'

function playbackFields(asset: WBAsset): Pick<RemoteScenarioItem, 'state' | 'error' | 'volume' | 'pos' | 'dur'> {
  const yt = asset.type === 'youtube_player'
  const state = ((yt ? ytPlayStates[asset.id] : mediaPlayStates[asset.id]) ?? 'idle') as ScenarioPlayState
  const error = yt ? ytPlayErrors[asset.id] : mediaPlayErrors[asset.id]
  const volume = yt ? ytVolumes[asset.id] : mediaVolumes[asset.id]
  // v1.57: місце читаємо, коли стан і так перераховується (грає/пауза/кінець, перемотали, стала відома тривалість) —
  // мітка робить ці моменти реактивними; між ними смужку на телефоні рухає сам телефон
  void (yt ? ytTimeMarks[asset.id] : mediaTimeMarks[asset.id])
  const time = yt ? videoTime(asset.id) : mediaTime(asset.id)
  return {
    state,
    ...(state === 'error' && error ? { error } : {}),
    // YouTube ще не готовий / елемента нема — поля немає (пульт: «Гучність — щойно…»)
    ...(typeof volume === 'number' ? { volume } : {}),
    ...(time ? { pos: round1(time.dur ? Math.min(time.pos, time.dur) : time.pos) } : {}),
    ...(time?.dur ? { dur: round1(time.dur) } : {}),
  }
}

/** Секунди до 0,1 — як округлює сервер; без зайвих змін стану через мікросекунди. */
function round1(seconds: number): number {
  return Math.round(seconds * 10) / 10
}

type TimelineEventLike = { id?: unknown; label?: unknown; place_ids?: unknown }

/** Події шкали в порядку картки (той самий масив, що гортають її кнопки). */
function timelineEvents(asset: WBAsset): TimelineEventLike[] {
  const events = ((asset as { data?: { events?: unknown } }).data ?? {}).events
  return Array.isArray(events) ? events : []
}

function activeEventIndex(asset: WBAsset, events: TimelineEventLike[]): number {
  const activeId = ((asset as { data?: { active_event_id?: unknown } }).data ?? {}).active_event_id
  return activeId ? events.findIndex((e) => e?.id === activeId) : -1
}

/** v1.75: поля шкали для пульта. «По черзі» — лише шкала з віссю (v1.71): у старого списку цієї кнопки немає. */
function timelineFields(asset: WBAsset): Pick<RemoteScenarioItem, 'event_count' | 'event_index' | 'event_title' | 'playing'> {
  const events = timelineEvents(asset)
  if (!events.length || events.length > TIMELINE_EVENTS_MAX) return {}
  const index = activeEventIndex(asset, events)
  const label = index >= 0 ? events[index]?.label : ''
  return {
    event_count: events.length,
    ...(index >= 0
      ? { event_index: index, event_title: (typeof label === 'string' ? label.replace(/\s+/g, ' ').trim() : '').slice(0, SCENARIO_TITLE_MAX) }
      : {}),
    ...((asset as { data?: { view?: unknown } }).data?.view === 'axis' ? { playing: isTimelinePlaying(asset.id) } : {}),
  }
}

/** v1.77: поля карти для пульта. Межі протоколу (сервер відкидає `scenario` цілим) — тут же: краще без кнопок. */
function mapFields(asset: WBAsset): Pick<RemoteScenarioItem, 'map_dataset' | 'map_version' | 'map_year' | 'playing'> {
  const b = mapBordersOf(asset)
  if (!b || !/^[a-z0-9-]{1,64}$/.test(b.dataset) || !/^[A-Za-z0-9._-]{1,32}$/.test(b.version)) return {}
  if (b.year < -5000 || b.year > 2100) return {}
  return { map_dataset: b.dataset, map_version: b.version, map_year: b.year, playing: isTimelinePlaying(asset.id) }
}

function docFields(asset: WBAsset): Pick<RemoteScenarioItem, 'doc_page' | 'doc_pages'> {
  const total = Math.trunc(Number(asset.totalPages ?? 0))
  if (!(total >= 1)) return {}
  const page = Math.min(Math.max(0, Math.trunc(Number(asset.currentPage ?? 0))), total - 1)
  return { doc_page: page, doc_pages: total }
}

export function createRemoteScenarioAdapter(deps: RemoteScenarioDeps) {
  /** Об'єкт поточної сторінки, який є в списку сценарію (інакше команду ігноруємо). */
  function findCurrent(id: string): { asset: WBAsset; kind: ScenarioKind } | null {
    const page = deps.pages()[deps.currentPageIndex()]
    const asset = page?.assets.find((a) => a.id === id)
    if (!asset || id.length > SCENARIO_OBJECT_ID_MAX) return null
    // Сторінка тут завжди поточна — тож і картки з картинками (v1.25)
    const kind = scenarioKind(asset) ?? currentPageKind(asset)
    return kind ? { asset, kind } : null
  }

  function canEditBoard(): boolean {
    const v = deps.viewer()
    return v.isTutor && v.mode === 'edit' && deps.canWrite()
  }

  function state(): RemoteScenarioState {
    const pages = deps.pages()
    const current = deps.currentPageIndex()
    const items: RemoteScenarioItem[] = []
    for (let p = 0; p < pages.length && items.length < SCENARIO_ITEMS_MAX; p++) {
      // Медіа — усіх сторінок; картки й картинки — лише сторінки, що на екрані (v1.25)
      const kindOf = (a: WBAsset): ScenarioKind | null =>
        scenarioKind(a) ?? (p === current ? currentPageKind(a) : null)
      // Згори вниз, потім зліва направо — те саме сортування, що «Задача на екран»
      const media = pages[p].assets
        .filter((a) => kindOf(a) && a.id && a.id.length <= SCENARIO_OBJECT_ID_MAX)
        .slice()
        .sort((a, b) => (a.y - b.y) || (a.x - b.x))
      for (const asset of media) {
        if (items.length >= SCENARIO_ITEMS_MAX) break
        const kind = kindOf(asset) as ScenarioKind
        const item: RemoteScenarioItem = {
          object_id: asset.id,
          kind,
          title: scenarioTitle(asset, kind),
          page_index: p,
          minimized: asset.minimized === true,
        }
        if (p === current) {
          if (kind === 'video' || kind === 'audio') Object.assign(item, playbackFields(asset))
          else if (isDocKind(kind)) Object.assign(item, docFields(asset))
          else if (asset.type === TIMELINE_ASSET_TYPE) Object.assign(item, timelineFields(asset))
          else if (asset.type === 'map_card') Object.assign(item, mapFields(asset))
        }
        items.push(item)
      }
    }
    return { focus_id: deps.view.objectFocusId(), items }
  }

  /** ▶ — лише незгорнутий програвач (згорнутий мовчить, §4.1). */
  function play(id: string): void {
    const found = findCurrent(id)
    if (!found || (found.kind !== 'video' && found.kind !== 'audio') || isMinimizedOnBoard(found.asset)) return
    if (found.asset.type === 'youtube_player') playVideo(id)
    else playMedia(id)
  }

  function pause(id: string): void {
    const found = findCurrent(id)
    if (!found || (found.kind !== 'video' && found.kind !== 'audio')) return
    if (found.asset.type === 'youtube_player') pauseVideo(id)
    else pauseMedia(id)
  }

  /** 🔉/🔊 — гучність програвача цього ноутбука; у стан дошки не йде. */
  function volume(id: string, delta: -1 | 1): void {
    const found = findCurrent(id)
    if (!found || (found.kind !== 'video' && found.kind !== 'audio')) return
    if (found.asset.type === 'youtube_player') changeVideoVolume(id, delta)
    else changeMediaVolume(id, delta)
  }

  /**
   * ⛶ — полотно цього екрана до об'єкта; в аудіо цієї кнопки немає. У картці теж (v1.25):
   * текст картки не росте з полотном (§9.C), «на весь екран» дав би велику рамку з дрібним текстом.
   * v1.75: крім шкали подій — у неї своє «на всю дошку» зі шрифтом за шириною (v1.74), його й вмикає вигляд.
   * v1.77: і історичної карти — її ⛶ «на весь екран» за макетом.
   */
  function focus(id: string): void {
    const found = findCurrent(id)
    if (!found || found.kind === 'audio' || isMinimizedOnBoard(found.asset)) return
    if (found.kind === 'card' && !isBoardExpandCard(found.asset)) return
    deps.view.focusObject(id)
  }

  /** v1.75: шкала подій поточної сторінки, з якою можна працювати як на дошці (учитель, редагування, запис). */
  function editableTimeline(id: string): WBAsset | null {
    const found = findCurrent(id)
    if (!found || found.asset.type !== TIMELINE_ASSET_TYPE || isMinimizedOnBoard(found.asset) || !canEditBoard()) return null
    return timelineEvents(found.asset).length ? found.asset : null
  }

  /**
   * v1.75 ◀/▶ події — те саме, що кнопки картки (`TimelineCardRenderer.step`): жодна не відкрита — «Наступна» відкриває
   * першу, «Попередня» — останню; на межі нічого. Один `asset_update`; з картою того самого набору — ще її підсвітка.
   */
  function timelineStep(id: string, dir: -1 | 1): void {
    const asset = editableTimeline(id)
    if (!asset) return
    const events = timelineEvents(asset)
    const current = activeEventIndex(asset, events)
    const i = current < 0 ? (dir > 0 ? -1 : events.length) : current
    const target = events[i + dir]
    if (!target || typeof target.id !== 'string') return
    const data = ((asset as unknown as { data?: Record<string, unknown> }).data ?? {})
    const next = { ...asset, data: { ...data, active_event_id: target.id } } as WBAsset
    deps.updateAsset(next)
    const places = Array.isArray(target.place_ids) ? (target.place_ids as string[]) : []
    if (places.length) {
      const linked = linkedEvidenceUpdate([...(deps.pages()[deps.currentPageIndex()]?.assets ?? [])], next, places)
      if (linked) deps.updateAsset(linked)
    }
    // v1.79: рік історичної карти сторінки — за подією (той самий запис, що з кнопок картки)
    for (const map of linkedHistoricalMapUpdates([...(deps.pages()[deps.currentPageIndex()]?.assets ?? [])], next, bordersYears)) {
      deps.updateAsset(map)
    }
  }

  /** v1.75 «▶ По черзі» / «❚❚ Зупинити» — той самий ▶ картки (таймер у картці, кожен крок — її запис). */
  function timelinePlay(id: string): void {
    const asset = editableTimeline(id)
    if (!asset || (asset as { data?: { view?: unknown } }).data?.view !== 'axis') return
    setTimelinePlaying(asset.id, true)
  }

  function timelinePause(id: string): void {
    const found = findCurrent(id)
    // Зупинити можна завжди — зупинка нічого не пише
    if (found?.asset.type === TIMELINE_ASSET_TYPE) setTimelinePlaying(id, false)
  }

  /** v1.77: історична карта поточної сторінки, з якою можна працювати як на дошці (учитель, редагування, запис). */
  function editableMap(id: string): WBAsset | null {
    const found = findCurrent(id)
    if (!found || !mapBordersOf(found.asset) || isMinimizedOnBoard(found.asset) || !canEditBoard()) return null
    return found.asset
  }

  /**
   * v1.77 ← / → — те саме, що стрілки картки (`HistoricalMapCard.step`): сусідній рік зміни меж; на межі нічого.
   * Набір той самий, що вже намалювала картка (кеш `loadBorders`); перед записом карту беремо наново — за час
   * завантаження її могли змінити чи згорнути.
   */
  function mapStep(id: string, dir: -1 | 1): void {
    const asset = editableMap(id)
    const b = asset && mapBordersOf(asset)
    if (!b) return
    void loadBordersFor(b).then((data) => {
      const now = data && editableMap(id)
      const cur = now && mapBordersOf(now)
      if (!data || !now || !cur || cur.dataset !== b.dataset || cur.version !== b.version) return
      const target = stepYear(data, snapshotYears(data, clampYear(data, cur.year)).snapshot, dir)
      if (target === cur.year) return
      const d = ((now as unknown as { data?: Record<string, unknown> }).data ?? {})
      deps.updateAsset({ ...now, data: { ...d, borders: { ...(d.borders as object), year: target } } } as WBAsset)
    })
  }

  /** v1.77 «▶ По черзі» / «❚❚ Пауза» — той самий ▶ картки (таймер у картці, кожен крок — її запис). */
  function mapPlay(id: string): void {
    const asset = editableMap(id)
    if (asset) setTimelinePlaying(asset.id, true)
  }

  function mapPause(id: string): void {
    const found = findCurrent(id)
    // Зупинити можна завжди — зупинка нічого не пише
    if (found && mapBordersOf(found.asset)) setTimelinePlaying(id, false)
  }

  /** «— Згорнути» — те саме, що на картці: програвач спершу на паузу, потім asset_update. */
  function minimize(id: string): void {
    const found = findCurrent(id)
    if (!found || !deps.canWrite() || !canMinimize(found.asset, deps.viewer())) return
    // Об'єкт «на весь екран» — спершу «Уся сторінка» (ТЗ §3)
    if (deps.view.objectFocusId() === id) deps.view.resetFocus()
    if (found.kind === 'video' || found.kind === 'audio') pause(id)
    deps.updateAsset(minimizedAsset(found.asset))
  }

  /** «↩ Повернути» — те саме, що «Повернути на дошку» в треї. */
  function restore(id: string): void {
    const found = findCurrent(id)
    if (!found || !deps.canWrite() || !isMinimizedOnBoard(found.asset)) return
    if (!canShowTray(deps.viewer(), 1)) return
    deps.updateAsset(restoredAsset(found.asset))
  }

  /** ◀/▶ документа — те саме, що стрілки на картці: новий currentPage у межах; на межі нічого. */
  function docPage(id: string, dir: -1 | 1): void {
    const found = findCurrent(id)
    if (!found || !isDocKind(found.kind) || isMinimizedOnBoard(found.asset) || !canEditBoard()) return
    const total = Math.trunc(Number(found.asset.totalPages ?? 0))
    if (!(total >= 1)) return
    const current = Math.min(Math.max(0, Math.trunc(Number(found.asset.currentPage ?? 0))), total - 1)
    const next = Math.max(0, Math.min(total - 1, current + dir))
    if (next === current) return
    deps.updateAsset({ ...found.asset, currentPage: next })
  }

  return {
    state, play, pause, volume, focus, minimize, restore, docPage, timelineStep, timelinePlay, timelinePause,
    mapStep, mapPlay, mapPause,
  }
}

export type RemoteScenarioAdapter = ReturnType<typeof createRemoteScenarioAdapter>
