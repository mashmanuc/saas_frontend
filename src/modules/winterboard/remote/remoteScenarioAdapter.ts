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
 */
import type { WBAsset } from '../types/winterboard'
import { canMinimize, canShowTray, minimizedAsset, restoredAsset, type TrayViewer } from '../board/boardTray'
import { isMinimizableAsset, isMinimizedOnBoard } from '../board/objectStandard'
import {
  changeVideoVolume, pauseVideo, playVideo, ytPlayErrors, ytPlayStates, ytVolumes,
} from '../board/youtubeRemoteControl'
import {
  changeMediaVolume, mediaPlayErrors, mediaPlayStates, mediaVolumes, pauseMedia, playMedia,
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
  doc_page?: number
  doc_pages?: number
}

export interface RemoteScenarioState {
  focus_id: string | null
  items: RemoteScenarioItem[]
}

/** Межі протоколу (сервер відкидає поле цілим, якщо їх перейти). */
export const SCENARIO_ITEMS_MAX = 50
export const SCENARIO_OBJECT_ID_MAX = 64
export const SCENARIO_TITLE_MAX = 200

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
  } else if (kind === 'image') {
    title = text(data.caption) || text(data.title)
  } else {
    title = String((asset as { title?: unknown }).title ?? '')
  }
  return title.slice(0, SCENARIO_TITLE_MAX)
}

const isDocKind = (k: ScenarioKind) => k === 'presentation' || k === 'pdf' || k === 'document'

function playbackFields(asset: WBAsset): Pick<RemoteScenarioItem, 'state' | 'error' | 'volume'> {
  const yt = asset.type === 'youtube_player'
  const state = ((yt ? ytPlayStates[asset.id] : mediaPlayStates[asset.id]) ?? 'idle') as ScenarioPlayState
  const error = yt ? ytPlayErrors[asset.id] : mediaPlayErrors[asset.id]
  const volume = yt ? ytVolumes[asset.id] : mediaVolumes[asset.id]
  return {
    state,
    ...(state === 'error' && error ? { error } : {}),
    // YouTube ще не готовий / елемента нема — поля немає (пульт: «Гучність — щойно…»)
    ...(typeof volume === 'number' ? { volume } : {}),
  }
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
   */
  function focus(id: string): void {
    const found = findCurrent(id)
    if (!found || found.kind === 'audio' || found.kind === 'card' || isMinimizedOnBoard(found.asset)) return
    deps.view.focusObject(id)
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

  return { state, play, pause, volume, focus, minimize, restore, docPage }
}

export type RemoteScenarioAdapter = ReturnType<typeof createRemoteScenarioAdapter>
