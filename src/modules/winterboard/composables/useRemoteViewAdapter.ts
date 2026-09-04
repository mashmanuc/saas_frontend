// WB Remote v1.2: дії над ВИГЛЯДОМ дошки на ноутбуці за командами пульта.
// Ref: LAW §9 «Remote control» (v1.2 cmds), CLASSROOM_REMOTE_VISION §7-bis.
//
// Власник з уроку 2026-09-03: «тексти задач учням не видно на дошці; я мушу
// бігти до ноута збільшувати сторінку; завдання має бути повністю видно,
// підганятись на ширину, без горизонтального скролу; відповідь/розбір —
// з пульта». Рішення: НЕ чіпати рендерер картки, а керувати масштабом і
// скролом полотна так, щоб картка задачі заповнила ширину екрана (це і є
// «збільшити умову»), і перемикати showAnswer/showSolution через штатний
// updateAsset (персистується як звичайна дія на ноутбуці).
//
// Геометрія (boardStore getters): екранна позиція точки сторінки =
//   base(zoom) + scroll + p*zoom, де base = max(0, (container - page*zoom)/2).
// Звідси scroll для «ліва/верхня грань картки на відступі m»:
//   scroll = m - base(zoom) - a*zoom.

import { useTutorRevealGate } from './useStudentTutor'

export interface RemoteViewStore {
  containerWidth: number
  containerHeight: number
  pageWidth: number
  pageHeight: number
  zoom: number
  scrollX: number
  scrollY: number
  currentPageIndex: number
  pages: Array<{ assets: Array<any> }>
  setZoom: (z: number) => void
  setScroll: (x: number, y: number) => void
  updateAsset: (asset: any, opts?: { skipHistory?: boolean }) => void
}

export interface RemoteCardsSummary {
  count: number
  answer: boolean | null
  solution: boolean | null
}

export const TASK_ASSET_TYPE = 'nmt_task'
export const FIT_MARGIN_PX = 16
export const ZOOM_STEP = 1.15
export const SCROLL_FRACTION = 0.4
const ZOOM_MIN = 0.1
const ZOOM_MAX = 5

function base(container: number, page: number, zoom: number): number {
  return Math.max(0, (container - page * zoom) / 2)
}

export function createRemoteViewAdapter(store: RemoteViewStore) {
  /** Індекс картки, на яку востаннє «наводили» (для циклу по картках і для A−/A+) */
  let focusIndex = -1

  function taskCards(): any[] {
    const page = store.pages[store.currentPageIndex]
    if (!page) return []
    return page.assets
      .filter((a) => a && a.type === TASK_ASSET_TYPE)
      .slice()
      .sort((a, b) => (a.y - b.y) || (a.x - b.x))
  }

  /**
   * Масштаб, за якого картка займає ширину контейнера мінус відступи.
   *
   * Повертає **0 = «не знаю»**, якщо ширину екрана ще не виміряно. Це не
   * педантизм: до 2026-09-04 тут при `containerWidth = 0` виходило
   * `(0 − 32) / w < 0` → `Math.max(ZOOM_MIN, …)` = **0.1**, і ця «стеля»
   * кидала дошку в 10%. Власник спіймав живцем на уроці: натиснув A+, а
   * дошка зменшилась. Той самий guard уже є у `WBAssetItem.vue:83`.
   */
  function fitZoomFor(asset: any): number {
    const w = Math.max(1, Number(asset?.w) || 1)
    const cw = Number(store.containerWidth) || 0
    if (!(cw > 2 * FIT_MARGIN_PX)) return 0
    const target = (cw - 2 * FIT_MARGIN_PX) / w
    if (!Number.isFinite(target) || target <= 0) return 0
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, target))
  }

  function placeAssetTopLeft(asset: any, zoom: number): void {
    store.setZoom(zoom)
    const z = store.zoom   // після clamp у сторі
    const sx = FIT_MARGIN_PX - base(store.containerWidth, store.pageWidth, z) - asset.x * z
    const sy = FIT_MARGIN_PX - base(store.containerHeight, store.pageHeight, z) - asset.y * z
    store.setScroll(sx, sy)
  }

  /**
   * «Задача на екран»: картка заповнює ширину, її верх — угорі екрана.
   * Повторний виклик циклює по картках сторінки. Повертає індекс або -1.
   */
  function fitTask(): number {
    const cards = taskCards()
    if (!cards.length) { focusIndex = -1; return -1 }
    const nextIndex = (focusIndex + 1) % cards.length
    const asset = cards[nextIndex]
    const fit = fitZoomFor(asset)
    // Ширину екрана ще не виміряно — краще НЕ рухати дошку взагалі, ніж
    // «підігнати» її в 10% (борг 2026-09-04). Фокус теж не зсуваємо.
    if (!fit) return -1
    focusIndex = nextIndex
    placeAssetTopLeft(asset, fit)
    return focusIndex
  }

  /**
   * A−/A+: масштаб кроком, але НЕ більше за fit-масштаб картки у фокусі
   * (щоб картка ніколи не виходила за ширину → без горизонтального скролу).
   * Картка лишається притиснутою до верху-ліва.
   */
  function zoomBy(delta: number): number {
    const cards = taskCards()
    const asset = cards[focusIndex] ?? cards[0]
    const steps = Math.max(-3, Math.min(3, Math.trunc(delta)))
    const cur = store.zoom
    let next = cur * Math.pow(ZOOM_STEP, steps)
    if (asset) {
      const fit = fitZoomFor(asset)
      // Стеля проти горизонтального виїзду картки застосовується ЛИШЕ вгору і
      // лише коли ширину екрана виміряно (fit > 0). Раніше `Math.min(next, fit)`
      // стояв беззастережно, тому A+ ЗМЕНШУВАВ масштаб, щойно вчитель був
      // крупніше за fit, а при невиміряному екрані кидав дошку в 10%.
      if (fit) next = Math.min(next, Math.max(fit, cur))
      if (focusIndex < 0) focusIndex = 0
    }
    // Напрямок кнопки — святий: A+ ніколи не зменшує, A− ніколи не збільшує.
    if (steps > 0) next = Math.max(next, cur)
    if (steps < 0) next = Math.min(next, cur)
    if (asset) placeAssetTopLeft(asset, next)
    else store.setZoom(next)
    return store.zoom
  }

  /** ▲/▼: вертикальний скрол на частку висоти екрана; горизонталь не чіпаємо. */
  function scrollBy(dir: number): number {
    const d = dir < 0 ? -1 : 1
    const dy = -d * store.containerHeight * SCROLL_FRACTION   // ▼ (dir=+1) = контент угору
    store.setScroll(store.scrollX, store.scrollY + dy)
    return store.scrollY
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
    if (!cards.length) return { count: 0, answer: null, solution: null, zoom: store.zoom }
    return {
      count: cards.length,
      answer: cards.every((a) => !!a.data?.showAnswer),
      solution: cards.every((a) => !!a.data?.showSolution),
      zoom: store.zoom,
    }
  }

  /** Сторінка змінилась — фокус скидається (інша сторінка, інші картки) */
  function resetFocus(): void { focusIndex = -1 }

  return { fitTask, zoomBy, scrollBy, reveal, summary, resetFocus, taskCards }
}

export type RemoteViewAdapter = ReturnType<typeof createRemoteViewAdapter>
