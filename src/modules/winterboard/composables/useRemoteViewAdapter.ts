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

import { useTutorRevealGate } from './useStudentTutor'
import { NMT_PRESENTATION_SCALE, normalizeNmtPresentationScale } from '../types/nmtTask'
import { getNmtPresentationScale, resetNmtPresentationScales, setNmtPresentationScale } from './useNmtPresentationScale'
import { closeMediaShow, isMediaShowType, mediaShow, openMediaShow } from '../board/mediaShow'
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
}

/** v1.15: як кімната дає розмір поля й застосовує вигляд (той самий шлях, що Ctrl+колесо). */
export interface RemoteViewOptions {
  /** Видима частина полотна, px (DOM). Без нього — `store.containerWidth/Height`. */
  viewportSize?: () => { width: number; height: number } | null
  /** Застосувати масштаб і прокрутку. Без нього — `store.setZoom` / `store.setScroll`. */
  applyView?: (zoom: number, scrollX: number, scrollY: number) => void
}

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
    if (store.stageFollowsScroll === false) return false
    if (!(asset.w > 0) || !(asset.h > 0)) return false
    const vp = opts.viewportSize?.() ?? { width: store.containerWidth, height: store.containerHeight }
    if (!vp || !(vp.width > 0) || !(vp.height > 0)) return false
    if (store.expandedAssetId) endTaskPresentation()
    if (!savedView) savedView = { zoom: store.zoom, scrollX: store.scrollX, scrollY: store.scrollY }
    const m = FOCUS_MARGIN_PX
    const fit = Math.min((vp.width - 2 * m) / asset.w, (vp.height - 2 * m) / asset.h)
    const zoom = Math.max(FOCUS_ZOOM_MIN, Math.min(FOCUS_ZOOM_MAX, fit))
    // Де стоїть аркуш при цьому масштабі (boardStore.stageOrigin): центр поля або 0.
    const centerX = store.containerWidth > 0 ? Math.max(0, (store.containerWidth - store.pageWidth * zoom) / 2) : 0
    const centerY = store.containerHeight > 0 ? Math.max(0, (store.containerHeight - store.pageHeight * zoom) / 2) : 0
    // Об'єкт — посередині видимої частини: center − scroll + p·zoom = target.
    const targetX = (vp.width - asset.w * zoom) / 2
    const targetY = (vp.height - asset.h * zoom) / 2
    // Показ відео (якщо був) закриваємо: показ один за раз
    closeMediaShow()
    applyView(zoom, centerX + asset.x * zoom - targetX, centerY + asset.y * zoom - targetY)
    objectFocus = assetId
    return true
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
   * Картка — розгорнута, інакше у фокусі, інакше перша. Повертає масштаб після команди.
   */
  function changeTextScale(delta: number): number {
    const cards = taskCards()
    const expanded = cards.find((a) => a.id === store.expandedAssetId)
    const asset = expanded ?? cards[focusIndex] ?? cards[0]
    const steps = Math.max(-3, Math.min(3, Math.trunc(delta)))
    if (!asset || steps === 0) return 1
    focusIndex = cards.indexOf(asset)
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
   * «Відповідь»/«Розбір»: перемикає на ВСІХ картках задач поточної сторінки
   * (v1: одна команда — один стан для всієї сторінки; якщо вже частково
   * показано — показує всім). Шанує reveal-гейт (8b-2) кожної картки.
   * Повертає кількість змінених карток.
   */
  function reveal(what: 'answer' | 'solution'): number {
    const cards = taskCards()
    if (!cards.length) return 0
    const key = what === 'answer' ? 'showAnswer' : 'showSolution'
    const allShown = cards.every((a) => !!a.data?.[key])
    const target = !allShown
    let changed = 0
    for (const asset of cards) {
      const allowed = useTutorRevealGate(() => String(asset.data?.externalId ?? '')).value
      if (!allowed) continue
      if (!!asset.data?.[key] === target) continue
      store.updateAsset({ ...asset, data: { ...(asset.data || {}), [key]: target } })
      changed += 1
    }
    return changed
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
  }

  return {
    fitTask, changeTextScale, scrollBy, reveal, summary, resetFocus, taskCards, focusObject, objectFocusId,
    questionCards, revealQuestions, questionsSummary,
  }
}

export type RemoteViewAdapter = ReturnType<typeof createRemoteViewAdapter>
