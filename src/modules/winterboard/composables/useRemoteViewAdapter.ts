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

import { useTutorRevealGate } from './useStudentTutor'
import { NMT_PRESENTATION_SCALE, normalizeNmtPresentationScale } from '../types/nmtTask'
import { getNmtPresentationScale, setNmtPresentationScale } from './useNmtPresentationScale'

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
}

export interface RemoteCardsSummary {
  count: number
  answer: boolean | null
  solution: boolean | null
  /** Пульт відкрив одну з карток на весь доступний простір. */
  presenting: boolean
}

export const TASK_ASSET_TYPE = 'nmt_task'
export const SCROLL_FRACTION = 0.4

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
   * «Задача на екран»: локально розгортає картку на весь доступний простір
   * полотна. Це не змінює її геометрію в уроці й не потрапляє в реплей.
   * Повторний виклик циклює по картках сторінки. Повертає індекс або -1.
   */
  function fitTask(): number {
    const cards = taskCards()
    if (!cards.length) { focusIndex = -1; return -1 }
    const nextIndex = (focusIndex + 1) % cards.length
    const asset = cards[nextIndex]
    focusIndex = nextIndex
    store.expandedAssetId = asset.id
    scrollTaskBody(asset.id, -1)
    return focusIndex
  }

  /**
   * A−/A+: змінюють РОЗМІР СИМВОЛІВ у поточній картці, а не масштаб дошки.
   *
   * Власник з уроку 2026-09-04: збільшення рамки не робить текст читабельним.
   * Кадрування картки лишається окремою дією «Задача на екран» (fitTask).
   */
  function changeTextScale(delta: number): number {
    const cards = taskCards()
    const asset = cards[focusIndex] ?? cards[0]
    const steps = Math.max(-3, Math.min(3, Math.trunc(delta)))
    if (!asset || steps === 0) return 1
    // A+ — лише локальний вигляд проєктора. Не створює asset_update, не
    // торкається сервера та не потрапляє в реплей уроку.
    const current = getNmtPresentationScale(asset.id)
    const rawNext = current * Math.pow(NMT_PRESENTATION_SCALE.STEP, steps)
    const next = Math.round(
      Math.min(NMT_PRESENTATION_SCALE.MAX, Math.max(NMT_PRESENTATION_SCALE.MIN, rawNext)) * 100,
    ) / 100
    setNmtPresentationScale(asset.id, next)
    if (focusIndex < 0) focusIndex = 0
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

  /** Сторінка змінилась — повертаємо звичайний вигляд, фокус скидається. */
  function resetFocus(): void {
    focusIndex = -1
    store.expandedAssetId = null
  }

  return { fitTask, changeTextScale, scrollBy, reveal, summary, resetFocus, taskCards }
}

export type RemoteViewAdapter = ReturnType<typeof createRemoteViewAdapter>
