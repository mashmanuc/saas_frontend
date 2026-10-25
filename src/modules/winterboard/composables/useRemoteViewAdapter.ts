// WB Remote v1.2: дії над ВИГЛЯДОМ дошки на ноутбуці за командами пульта.
// Ref: LAW §9 «Remote control» (v1.2 cmds), CLASSROOM_REMOTE_VISION §7-bis.
//
// Власник з уроку 2026-09-03: «тексти задач учням не видно на дошці; я мушу
// бігти до ноута збільшувати сторінку; завдання має бути повністю видно,
// підганятись на ширину, без горизонтального скролу; відповідь/розбір —
// з пульта». Рішення: «Задача на екран» локально розгортає картку на весь
// доступний простір полотна; A+/A− змінюють лише її типографіку, а стрілки
// гортають тіло розгорнутої картки. Геометрія уроку та реплей не змінюються.
// Відповідь і розбір перемикаються штатним updateAsset як звичайна дія
// на ноутбуці.
//   base(zoom) + scroll + p*zoom, де base = max(0, (container - page*zoom)/2).
// Звідси scroll для «ліва/верхня грань картки на відступі m»:
//   scroll = m - base(zoom) - a*zoom.

//
// v1.13 (Б-109, рішення власника 2026-09-27 «Б-109 а»): A−/A+ поза показом — ті самі
// A−/A+, що на картці (спільний масштаб §9.C, одна операція на команду); у показі —
// локальний множник лише розгорнутої картки, який скидається з кінцем показу.
//
// v1.15 «Сценарій» (ТЗ TZ_REMOTE_SCENARIO §4.3): «На весь екран» для відео й документа —
// збільшення полотна ЦЬОГО екрана до об'єкта (у цих типів немає власного розгортання).
// ⚠️ Формула вище — з v1.2. З 2026-09-23 (FIRST USER GATE) у кімнаті уроку аркуш
// зсувається на −scroll (`boardStore.stageOrigin`: center − scroll, центр = 0, коли
// стор не знає розміру поля). Тому тут: екран = center(zoom) − scroll + p·zoom.
//
// v1.34 (2026-10-19, власник: «згоден з усіма чотирма, роби»; маніфест пульта П2, ТЗ
// TZ_REMOTE_CURRENT_OBJECT_2026-10-19): ПОТОЧНИЙ ОБ'ЄКТ замість прихованого «у фокусі, інакше перша».
// Урок 19.10: A+ збільшував першу задачу, а ✍ писав виділену другу. Тепер: розгорнутий → виділений на
// дошці → останній обраний → перший (згори вниз, зліва направо); дія з адресою (`object_id`) — рівно
// той об'єкт, якщо він є на поточній сторінці, інакше нічого й причина (`objectNotice`).

import { useTutorRevealGate } from './useStudentTutor'
import { hasHandwritableSolution, isIntegralykSolvable } from '../board/handwriteSolution'
import { NMT_PRESENTATION_SCALE, normalizeNmtPresentationScale } from '../types/nmtTask'
import { getNmtPresentationScale, resetNmtPresentationScales, setNmtPresentationScale } from './useNmtPresentationScale'
import { closeMediaShow, isMediaShowType, mediaShow, openMediaShow } from '../board/mediaShow'
import { setShowMode, showMode } from '../board/showMode'
import { isMinimizedOnBoard } from '../board/objectStandard'
import { currentPageKind, scenarioKind } from '../remote/remoteScenarioAdapter'
import {
  hasSharedTextScale, nextPresentationScale, presentationScaleOf, withPresentationScale,
} from '../board/cardPresentation'

export interface RemoteViewStore {
  containerWidth: number
  containerHeight: number
  pageWidth: number
  pageHeight: number
  zoom: number
  scrollX: number
  scrollY: number
  currentPageIndex: number
  /** Локальний режим показу оверлею на весь робочий простір. Не пишеться в ops/replay. */
  expandedAssetId: string | null
  pages: Array<{ assets: Array<any> }>
  setZoom: (z: number) => void
  setScroll: (x: number, y: number) => void
  updateAsset: (asset: any, opts?: { skipHistory?: boolean }) => void
  /** Прокрутка зсуває аркуш (кімната уроку). Без цього «На весь екран» не має куди вести. */
  stageFollowsScroll?: boolean
  /** v1.34: виділення на дошці — поточний об'єкт пульта (Р1: в обидва боки). */
  selectedIds?: string[]
  selectItems?: (ids: string[]) => void
}

/** v1.15: як кімната дає розмір поля й застосовує вигляд (той самий шлях, що Ctrl+колесо). */
export interface RemoteViewOptions {
  /** Видима частина полотна, px (DOM). Без нього — `store.containerWidth/Height`. */
  viewportSize?: () => { width: number; height: number } | null
  /** Застосувати масштаб і прокрутку. Без нього — `store.setZoom` / `store.setScroll`. */
  applyView?: (zoom: number, scrollX: number, scrollY: number) => void
  /**
   * v1.34: кімната дала право Інтегралика (`canSolveHandwrite`) — ✍ на вирізці з PDF, картинці, картці й задачі
   * без розв'язку. Без нього пульт працює лише з задачами (✍ — лише з готовим розв'язком).
   */
  canSolve?: () => boolean
  /**
   * v1.35 (етап 2): кімната має «Сценарій» — у поточному об'єкті всі його види: відео, аудіо, документи, картки й
   * картинки сторінки, що на екрані (кнопки — ті самі, що в «Сценарії»). Без нього (класна кімната) — як v1.34.
   */
  allKinds?: () => boolean
}

/**
 * v1.34: вид об'єкта для пульта — наш закритий набір (як на сервері, `REMOTE_OBJECT_KINDS`). v1.35: картинка —
 * `image` (v1.34 слав `cut`), і види «Сценарію».
 */
export type RemoteObjectKind = 'task' | 'image' | 'card' | 'video' | 'audio' | 'presentation' | 'pdf' | 'document'
/** v1.34: об'єкт поточної сторінки для `remote.state.objects` — без тексту, лише вид, номер і прапорці. */
export interface RemoteBoardObject {
  id: string
  kind: RemoteObjectKind
  n: number
  hw: boolean
  answer?: boolean
  solution?: boolean
  presenting: boolean
  /** v1.35: згорнуто в трей — на пульті лишається з «Повернути». */
  minimized?: boolean
}
/** v1.34: чому дію над об'єктом не виконано — його вже немає на сторінці / цей вид так не вміє. */
export type RemoteObjectNotice = 'gone' | 'unsupported'

/** v1.34: стеля `objects` — як на сервері (`REMOTE_OBJECTS_MAX`). */
export const REMOTE_OBJECTS_MAX = 50

/** Відступ об'єкта від країв видимої частини в «На весь екран» (ТЗ §4.3). */
export const FOCUS_MARGIN_PX = 24
/** Дозволений масштаб полотна (`boardStore.setZoom`, LAW-20). */
export const FOCUS_ZOOM_MIN = 0.1
export const FOCUS_ZOOM_MAX = 5

export interface RemoteCardsSummary {
  count: number
  answer: boolean | null
  solution: boolean | null
  /** Пульт відкрив одну з карток на весь доступний простір. */
  presenting: boolean
}

export const TASK_ASSET_TYPE = 'nmt_task'
/** v1.23 (2026-10-06): питання до обговорення — «❓ Показати відповідь» на пульті. */
export const QUESTION_ASSET_TYPE = 'discussion_question'

export interface RemoteQuestionsSummary {
  count: number
  /** Усі відповіді сторінки відкриті (true), усі закриті чи частково (false). */
  answer: boolean
}
export const SCROLL_FRACTION = 0.4

export function createRemoteViewAdapter(store: RemoteViewStore, opts: RemoteViewOptions = {}) {
  /** Індекс картки, на яку востаннє «наводили» (для циклу по картках і для A−/A+) */
  let focusIndex = -1
  /** v1.15: об'єкт «на весь екран» і вигляд до ПЕРШОГО показу (його повертає «Уся сторінка»). */
  let objectFocus: string | null = null
  let savedView: { zoom: number; scrollX: number; scrollY: number } | null = null
  /** v1.34: останній обраний (пультом чи виділенням на дошці) — поки він на поточній сторінці. */
  let chosenId: string | null = null
  /** v1.34: чому не виконано останню дію над об'єктом; скидається наступною вдалою дією чи іншою сторінкою. */
  let notice: RemoteObjectNotice | null = null

  function applyView(zoom: number, scrollX: number, scrollY: number): void {
    if (opts.applyView) opts.applyView(zoom, scrollX, scrollY)
    else { store.setZoom(zoom); store.setScroll(scrollX, scrollY) }
  }

  /** Кінець «Задачі на екран»: картку згорнуто, фокус і локальний множник A± скинуто. */
  function endTaskPresentation(): void {
    focusIndex = -1
    store.expandedAssetId = null
    resetNmtPresentationScales()
  }

  /** Кінець «На весь екран»: масштаб і прокрутка — як до першого показу; відео — з показу. */
  function endObjectFocus(): void {
    if (savedView) applyView(savedView.zoom, savedView.scrollX, savedView.scrollY)
    savedView = null
    objectFocus = null
    closeMediaShow()
  }

  /**
   * v1.15 «На весь екран»: полотно цього екрана так, щоб об'єкт поточної сторінки зайняв
   * видиму частину з відступом 24 px, у межах дозволеного масштабу. Лише вигляд — без ops,
   * запису й Replay (як `view.fit` v1.2). Показ один за раз: знімає «Задачу на екран».
   */
  function focusObject(assetId: string): boolean {
    const page = store.pages[store.currentPageIndex]
    const asset = page?.assets.find((a) => a && a.id === assetId)
    if (!asset) return false
    // Власник 2026-09-28 («так»): відео — не масштаб полотна, а показ на весь екран, як
    // презентація (`board/mediaShow.ts`). Той самий програвач, лише вигляд цього екрана.
    if (isMediaShowType(asset.type)) {
      if (store.expandedAssetId) endTaskPresentation()
      if (savedView) endObjectFocus()
      openMediaShow(assetId)
      objectFocus = assetId
      return true
    }
    if (!viewportFor(asset)) return false
    if (store.expandedAssetId) endTaskPresentation()
    zoomTo(asset)
    objectFocus = assetId
    // v1.56: картинка чи документ на весь екран — режим показу, що переживає зміну сторінки (`board/showMode.ts`)
    setShowMode(true)
    return true
  }

  /**
   * Полотно так, щоб прямокутник аркуша (об'єкт чи вся сторінка) зайняв видиму частину з відступом 24 px.
   * Вигляд до першого показу запам'ятовується — його повертає «Уся сторінка». Показ відео закривається.
   */
  function viewportFor(rect: { w: number; h: number }): { width: number; height: number } | null {
    if (store.stageFollowsScroll === false) return null
    if (!(rect.w > 0) || !(rect.h > 0)) return null
    const vp = opts.viewportSize?.() ?? { width: store.containerWidth, height: store.containerHeight }
    return vp && vp.width > 0 && vp.height > 0 ? vp : null
  }

  function zoomTo(rect: { x: number; y: number; w: number; h: number }): boolean {
    const vp = viewportFor(rect)
    if (!vp) return false
    if (!savedView) savedView = { zoom: store.zoom, scrollX: store.scrollX, scrollY: store.scrollY }
    const m = FOCUS_MARGIN_PX
    const fit = Math.min((vp.width - 2 * m) / rect.w, (vp.height - 2 * m) / rect.h)
    const zoom = Math.max(FOCUS_ZOOM_MIN, Math.min(FOCUS_ZOOM_MAX, fit))
    // Де стоїть аркуш при цьому масштабі (boardStore.stageOrigin): центр поля або 0.
    const centerX = store.containerWidth > 0 ? Math.max(0, (store.containerWidth - store.pageWidth * zoom) / 2) : 0
    const centerY = store.containerHeight > 0 ? Math.max(0, (store.containerHeight - store.pageHeight * zoom) / 2) : 0
    // Прямокутник — посередині видимої частини: center − scroll + p·zoom = target.
    const targetX = (vp.width - rect.w * zoom) / 2
    const targetY = (vp.height - rect.h * zoom) / 2
    // Показ відео (якщо був) закриваємо: показ один за раз
    closeMediaShow()
    applyView(zoom, centerX + rect.x * zoom - targetX, centerY + rect.y * zoom - targetY)
    return true
  }

  /** v1.56: у показі на весь екран іде картинка чи документ (не програвач, не картка, не задача). */
  function isShowPicture(asset: any): boolean {
    // Вид — як у «Сценарії», без права Інтегралика: показ не залежить від ✍ (`kindOf` без «Сценарію» його вимагає)
    const kind = asset?.type === 'image' ? 'image' : (scenarioKind(asset) ?? currentPageKind(asset))
    return (kind === 'image' || kind === 'pdf' || kind === 'presentation' || kind === 'document')
      && !isMinimizedOnBoard(asset) && asset.w > 0 && asset.h > 0
  }

  /**
   * v1.56 режим показу: нова сторінка — одразу на весь екран її головна картинка (найбільша; рівні — та, що
   * вище й лівіше), без картинки — уся сторінка. true — вигляд застосовано; false — сторінка ще порожня
   * (об'єкти догружаються), тоді `retryShow` повторить, щойно вони з'являться.
   */
  let showPending = false
  function showCurrentPage(): boolean {
    const page = store.pages[store.currentPageIndex]
    const assets = (page?.assets ?? []).filter(Boolean)
    const pictures = assets.filter(isShowPicture)
      .sort((a, b) => b.w * b.h - a.w * a.h || a.y - b.y || a.x - b.x)
    const main = pictures[0]
    if (main && zoomTo(main)) {
      objectFocus = main.id
      showPending = false
      return true
    }
    objectFocus = null
    showPending = assets.length === 0
    if (!showPending) zoomTo({ x: 0, y: 0, w: store.pageWidth, h: store.pageHeight })
    return !showPending
  }

  /** Зміна сторінки: у режимі показу — нова сторінка на весь екран; інакше — звичайний вигляд, як і було. */
  function pageChanged(): void {
    if (!showMode.active) return resetFocus()
    endTaskPresentation()
    notice = null
    showCurrentPage()
  }

  /** Скільки об'єктів на поточній сторінці (реактивно) — за ним `useBoardRemote` кличе `retryShow`. */
  function pageAssetCount(): number {
    return store.pages[store.currentPageIndex]?.assets?.length ?? 0
  }

  /** Об'єкти сторінки догрузились після переходу — показати її в режимі показу. */
  function retryShow(): void {
    if (showMode.active && showPending) showCurrentPage()
  }

  /**
   * Об'єкт «на весь екран», поки він є на поточній сторінці (поле `scenario.focus_id`).
   * Відео в показі вчитель може закрити й на ноутбуці (× чи Esc) — тоді показу вже немає:
   * читаємо реактивний `mediaShow`, тож пульт отримає новий стан сам.
   */
  function objectFocusId(): string | null {
    const showId = mediaShow.id
    if (!objectFocus) return null
    const page = store.pages[store.currentPageIndex]
    const asset = page?.assets.find((a) => a && a.id === objectFocus)
    if (!asset) return null
    if (isMediaShowType(asset.type) && showId !== objectFocus) return null
    return objectFocus
  }

  /** v1.34: вид об'єкта для пульта або null — пульт із ним не працює (маніфест П1). */
  function kindOf(asset: any): RemoteObjectKind | null {
    if (!asset) return null
    if (asset.type === TASK_ASSET_TYPE) return 'task'
    // Речення можна вибрати з пульта і без права на платний AI.
    if (asset.type === 'dictation_line') return 'card'
    // v1.35: є «Сценарій» — усі його види сторінки, що на екрані (ті самі, що в його списку).
    if (opts.allKinds?.() === true) {
      const kind = scenarioKind(asset) ?? currentPageKind(asset)
      if (kind) return kind
    }
    // Картинка й картка без «Сценарію» — лише коли є що робити: ✍ (право Інтегралика).
    if (!(opts.canSolve?.() === true && isIntegralykSolvable(asset))) return null
    if (asset.type === 'image') return 'image'
    if (asset.type === 'theory_card') return 'card'
    return null
  }

  /** v1.35: ноутбук кладе в `objects` усі види «Сценарію» — телефон знає це з `caps ∋ 'objects'`. */
  function listsAllKinds(): boolean {
    return opts.allKinds?.() === true
  }

  /** v1.34: ✍ для цього об'єкта — як у групі дій на дошці (`cardWindowActions`) і reveal-гейт банку. */
  function hwFor(asset: any): boolean {
    // Згорнутий лежить у треї: писати поруч нема біля чого — на пульті лише «Повернути» (v1.35)
    if (!asset || isMinimizedOnBoard(asset)) return false
    if (asset.type === TASK_ASSET_TYPE && hasHandwritableSolution(asset)) {
      return useTutorRevealGate(() => String(asset.data?.externalId ?? '')).value
    }
    return opts.canSolve?.() === true && isIntegralykSolvable(asset)
  }

  /** v1.34: об'єкти поточної сторінки, з якими працює пульт, — згори вниз, потім зліва направо. */
  function objectAssets(): any[] {
    const page = store.pages[store.currentPageIndex]
    if (!page) return []
    // Стеля протоколу — 50 (`REMOTE_OBJECTS_MAX`): більше сервер відкинув би весь список (v1.35: картинок буває багато)
    return page.assets
      .filter((a) => a && kindOf(a) !== null)
      .slice()
      .sort((a, b) => (a.y - b.y) || (a.x - b.x))
      .slice(0, REMOTE_OBJECTS_MAX)
  }

  /**
   * v1.34 поточний об'єкт: розгорнутий («Задача на екран») → виділений на дошці (Р1) → останній обраний →
   * перший. Автовибір (інша сторінка, об'єкт зник) — видимий: пульт показує, який саме (маніфест П2).
   */
  function currentAsset(): any | null {
    const list = objectAssets()
    if (!list.length) return null
    const find = (id: string | null) => (id ? list.find((a) => a.id === id) ?? null : null)
    const expanded = find(store.expandedAssetId)
    if (expanded) return expanded
    const sel = store.selectedIds ?? []
    const selected = sel.length === 1 ? find(sel[0]) : null
    if (selected) {
      chosenId = selected.id
      return selected
    }
    // Автовибір — перший незгорнутий: згорнутий лежить у треї, на дошці його не видно (v1.35)
    return find(chosenId) ?? list.find((a) => !isMinimizedOnBoard(a)) ?? list[0]
  }

  function currentObjectId(): string | null {
    return currentAsset()?.id ?? null
  }

  function objects(): RemoteBoardObject[] {
    const counts: Record<string, number> = {}
    return objectAssets().map((a) => {
      const kind = kindOf(a) as RemoteObjectKind
      counts[kind] = (counts[kind] ?? 0) + 1
      const obj: RemoteBoardObject = {
        id: a.id, kind, n: counts[kind], hw: hwFor(a),
        presenting: store.expandedAssetId === a.id || objectFocusId() === a.id,
      }
      if (isMinimizedOnBoard(a)) obj.minimized = true
      if (kind === 'task') {
        obj.answer = !!a.data?.showAnswer
        obj.solution = !!a.data?.showSolution
      }
      return obj
    })
  }

  function objectNotice(): RemoteObjectNotice | null {
    return notice
  }

  /**
   * v1.34: об'єкт для дії. З адресою — рівно він, якщо є серед об'єктів поточної сторінки (інакше null і
   * `gone`: швидкий натиск після перемикання не піде «не туди»). Без адреси (старий телефон) — поточний.
   * Знайдений стає поточним і виділяється на дошці (Р1).
   */
  function resolve(objectId?: string | null): any | null {
    const asset = objectId ? objectAssets().find((a) => a.id === objectId) ?? null : currentAsset()
    if (!asset) {
      if (objectId) notice = 'gone'
      return null
    }
    adopt(asset)
    return asset
  }

  function adopt(asset: any): void {
    chosenId = asset.id
    notice = null
    // Згорнутий лежить у треї — виділяти на дошці нічого (v1.35)
    if (isMinimizedOnBoard(asset)) return
    const sel = store.selectedIds ?? []
    if (store.selectItems && !(sel.length === 1 && sel[0] === asset.id)) store.selectItems([asset.id])
  }

  /**
   * v1.35: дія «Сценарію» над об'єктом поточної сторінки (▶, гучність, сторінка документа, «на весь екран»,
   * «повернути») робить його поточним — один поточний об'єкт для перемикача, «Сценарію» й дошки (Е2-1).
   * Показ не чіпає: це робить сама дія.
   */
  function adoptObject(objectId: string): void {
    const asset = objectAssets().find((a) => a.id === objectId)
    if (asset) adopt(asset)
  }

  /** v1.34 `object.select`: поточним стає цей об'єкт; показ іде за ним (задача — розгорнута, інше — закрито). */
  function selectObject(objectId: string): boolean {
    const asset = objectAssets().find((a) => a.id === objectId)
    if (!asset) {
      notice = 'gone'
      return false
    }
    const presentingTask = !!store.expandedAssetId
    adopt(asset)
    if (presentingTask && asset.id !== store.expandedAssetId) {
      if (kindOf(asset) === 'task') present(asset)
      else endTaskPresentation()
    }
    // v1.56: у показі інша картинка стає на весь екран, а мелодія чи відео (щоб «Грати») повного екрана не знімають
    if (showMode.active) {
      if (asset.id !== objectFocus && isShowPicture(asset) && zoomTo(asset)) objectFocus = asset.id
      return true
    }
    if (objectFocus && objectFocus !== asset.id) endObjectFocus()
    return true
  }

  function unsupported(): null {
    notice = 'unsupported'
    return null
  }

  /** v1.34: «Задача на екран» саме для цієї задачі (з адресою). */
  function present(asset: any): void {
    if (savedView || objectFocus) endObjectFocus()
    focusIndex = taskCards().findIndex((a) => a.id === asset.id)
    store.expandedAssetId = asset.id
    scrollTaskBody(asset.id, -1)
  }

  function presentObject(objectId: string): boolean {
    const asset = resolve(objectId)
    if (!asset) return false
    if (kindOf(asset) !== 'task') return !!unsupported()
    present(asset)
    return true
  }

  function taskCards(): any[] {
    const page = store.pages[store.currentPageIndex]
    if (!page) return []
    return page.assets
      .filter((a) => a && a.type === TASK_ASSET_TYPE)
      .slice()
      .sort((a, b) => (a.y - b.y) || (a.x - b.x))
  }

  /** v1.23: питання до обговорення поточної сторінки, у яких є що відкривати. */
  function questionCards(): any[] {
    const page = store.pages[store.currentPageIndex]
    if (!page) return []
    return page.assets.filter((a) => a && a.type === QUESTION_ASSET_TYPE
      && typeof a.data?.answer === 'string' && a.data.answer.trim() !== '')
  }

  /**
   * v1.23 «❓ Показати відповідь»: та сама дія, що кнопка під питанням, — `showAnswer`
   * штатним `updateAsset` (як `reveal` задач). Одна команда — один стан для всіх питань
   * сторінки: якщо хоч одне закрите — відкриває всі, інакше закриває всі.
   * Повертає кількість змінених карток.
   */
  function revealQuestions(): number {
    const cards = questionCards()
    if (!cards.length) return 0
    const target = !cards.every((a) => a.data?.showAnswer === true)
    let changed = 0
    for (const asset of cards) {
      if ((asset.data?.showAnswer === true) === target) continue
      store.updateAsset({ ...asset, data: { ...(asset.data || {}), showAnswer: target } })
      changed += 1
    }
    return changed
  }

  /** v1.23: для `remote.state.questions`; `null` — питань на сторінці немає (поле не шлемо). */
  function questionsSummary(): RemoteQuestionsSummary | null {
    const cards = questionCards()
    if (!cards.length) return null
    return { count: cards.length, answer: cards.every((a) => a.data?.showAnswer === true) }
  }

  /**
   * «Задача на екран»: локально розгортає картку на весь доступний простір
   * полотна. Це не змінює її геометрію в уроці й не потрапляє в реплей.
   * Повторний виклик циклює по картках сторінки. Повертає індекс або -1.
   */
  function fitTask(): number {
    const cards = taskCards()
    if (!cards.length) { focusIndex = -1; return -1 }
    // Показ один за раз (v1.15): «Задача на екран» знімає «На весь екран» об'єкта.
    if (savedView || objectFocus) endObjectFocus()
    // По колу гортаємо лише з уже розгорнутої картки. Поза показом фокус міг поставити
    // A−/A+ (Б-106: вони тепер і поза показом) — тоді на екран іде саме збільшена картка,
    // а не наступна за нею.
    const presenting = focusIndex >= 0 && store.expandedAssetId === cards[focusIndex]?.id
    const nextIndex = presenting ? (focusIndex + 1) % cards.length : Math.min(Math.max(focusIndex, 0), cards.length - 1)
    const asset = cards[nextIndex]
    focusIndex = nextIndex
    store.expandedAssetId = asset.id
    scrollTaskBody(asset.id, -1)
    return focusIndex
  }

  /**
   * A−/A+: змінюють РОЗМІР СИМВОЛІВ картки, а не масштаб дошки (власник з уроку
   * 2026-09-04: збільшення рамки не робить текст читабельним). LAW §9.C v1.13:
   *
   *  • у показі (картка розгорнута «Задача на екран») — локальний множник саме
   *    розгорнутої картки: лише цей екран, без операції, сервера й реплею;
   *    скидається з кінцем показу (`resetFocus`);
   *  • у звичайному вигляді — ті самі A−/A+, що на верхній панелі картки: крок
   *    спільного `data.presentationScale`, рівно один штатний asset_update на
   *    команду, на межі кроків — жодного. Клас, учень і Replay бачать те саме,
   *    висоту переміряє сама картка (INV-25).
   *
   * Картка — з адресою рівно вона, інакше поточний об'єкт (v1.34). Повертає масштаб після команди.
   */
  function changeTextScale(delta: number, objectId?: string | null): number {
    const cards = taskCards()
    const steps = Math.max(-3, Math.min(3, Math.trunc(delta)))
    if (steps === 0) return 1
    // v1.34: з адресою — рівно ця задача; без (старий телефон) — поточний об'єкт. Не задача — не вміє.
    const asset = resolve(objectId)
    if (!asset) return 1
    if (kindOf(asset) !== 'task') { unsupported(); return 1 }
    const expanded = store.expandedAssetId === asset.id ? asset : null
    focusIndex = cards.findIndex((a) => a.id === asset.id)
    if (expanded) {
      const current = getNmtPresentationScale(asset.id)
      const rawNext = current * Math.pow(NMT_PRESENTATION_SCALE.STEP, steps)
      const next = Math.round(
        Math.min(NMT_PRESENTATION_SCALE.MAX, Math.max(NMT_PRESENTATION_SCALE.MIN, rawNext)) * 100,
      ) / 100
      return setNmtPresentationScale(asset.id, next)
    }
    // Команду виконує лише ноутбук учителя-власника (`enabled` у useBoardRemote),
    // тож це та сама дія, що кнопка на картці (`cardWindowActions().scale`).
    if (!hasSharedTextScale(asset.type)) return 1
    const current = presentationScaleOf(asset)
    let next = current
    for (let i = 0; i < Math.abs(steps); i++) {
      const step = nextPresentationScale(next, steps > 0 ? 1 : -1)
      if (step === null) break
      next = step
    }
    if (next !== current) store.updateAsset(withPresentationScale(asset, next))
    return next
  }

  /** ▲/▼: гортання довгої картки, відкритої через «Задача на екран». */
  function scrollBy(dir: number): number {
    const asset = taskCards()[focusIndex]
    if (!asset || store.expandedAssetId !== asset.id) return 0
    return scrollTaskBody(asset.id, dir)
  }

  function scrollTaskBody(assetId: string, dir: number): number {
    if (typeof document === 'undefined') return 0
    const body = document.querySelector(
      `[data-testid="nmt-task-${assetId}"] .nmt-task__body`,
    ) as HTMLElement | null
    if (!body) return 0
    if (dir < 0) {
      body.scrollTop = 0
    } else {
      body.scrollTop = Math.min(body.scrollHeight, body.scrollTop + body.clientHeight * SCROLL_FRACTION)
    }
    return body.scrollTop
  }

  /**
   * «Відповідь»/«Розбір» поточної задачі (v1.34; до того — усіх задач сторінки разом). Шанує reveal-гейт
   * (8b-2). Повертає кількість змінених карток (0 або 1).
   */
  function reveal(what: 'answer' | 'solution', objectId?: string | null): number {
    // v1.34 (маніфест П2): кнопка діє на поточну задачу — з адресою рівно на неї, без (старий телефон) — на
    // поточний об'єкт. До v1.34 перемикала всі задачі сторінки разом.
    const asset = resolve(objectId)
    if (!asset) return 0
    if (kindOf(asset) !== 'task') { unsupported(); return 0 }
    const key = what === 'answer' ? 'showAnswer' : 'showSolution'
    if (!useTutorRevealGate(() => String(asset.data?.externalId ?? '')).value) return 0
    store.updateAsset({ ...asset, data: { ...(asset.data || {}), [key]: !asset.data?.[key] } })
    return 1
  }

  /**
   * v1.29 «✍️ Розв'язок рукою»: що писати. v1.34: з адресою — рівно цей об'єкт; без — поточний об'єкт
   * (розгорнутий → виділений → обраний → перший), якщо ✍ йому доступний.
   */
  function handwriteTarget(objectId?: string | null): any | null {
    // v1.34: з адресою — рівно цей об'єкт (задача, вирізка, картка); ✍ йому недоступний — не вміє.
    if (objectId) {
      const asset = resolve(objectId)
      if (!asset) return null
      return hwFor(asset) ? asset : unsupported()
    }
    const asset = currentAsset()
    return asset && hwFor(asset) ? asset : null
  }

  function summary(): RemoteCardsSummary & { zoom: number } {
    const cards = taskCards()
    if (!cards.length) return { count: 0, answer: null, solution: null, presenting: false, zoom: store.zoom }
    return {
      count: cards.length,
      answer: cards.every((a) => !!a.data?.showAnswer),
      solution: cards.every((a) => !!a.data?.showSolution),
      presenting: focusIndex >= 0 && store.expandedAssetId === cards[focusIndex]?.id,
      zoom: store.zoom,
    }
  }

  /**
   * Кінець показу («Уся сторінка» або інша сторінка): звичайний вигляд, фокус скидається,
   * локальний множник A± теж (§9.C v1.13) — він живе лише в показі. v1.15: і «На весь
   * екран» об'єкта — масштаб і прокрутка повертаються такими, як були до показу.
   */
  function resetFocus(): void {
    endTaskPresentation()
    if (savedView || objectFocus) endObjectFocus()
    notice = null
    // v1.56: «Уся сторінка» (і все, що знімає показ явно) — кінець режиму показу
    showPending = false
    setShowMode(false)
  }

  return {
    fitTask, changeTextScale, scrollBy, reveal, summary, resetFocus, taskCards, focusObject, objectFocusId,
    pageChanged, retryShow, pageAssetCount,
    listsAllKinds, adoptObject,
    handwriteTarget,
    questionCards, revealQuestions, questionsSummary,
    // v1.34 поточний об'єкт
    objects, currentObjectId, objectNotice, selectObject, presentObject,
  }
}

export type RemoteViewAdapter = ReturnType<typeof createRemoteViewAdapter>
