/**
 * LAW §9 v1.29 · розв'язок задачі рукою — чиста логіка без стору й мережі.
 *
 *   • відповідь для рядка «Відповідь: …» з даних картки задачі;
 *   • зайняті прямокутники сторінки — об'єкти І штрихи (рукопис не лягає на написане пером);
 *   • вільна область біля задачі: праворуч, інакше під нею, у межах сторінки.
 *
 * Штрихи обчислює сервер (`/v1/handwriting/solution/`) під розмір області; кладе їх
 * `useHandwriteSolution` штатними `stroke_add`.
 */
import { isSafeBackgroundUrl } from './pageBackground'

export interface Rect { x: number; y: number; w: number; h: number }

export const HANDWRITE_MARGIN = 40
export const HANDWRITE_GAP = 40
/** Вужчої області немає сенсу: рядок формули не влізе навіть дрібним почерком. */
export const HANDWRITE_MIN_W = 420
export const HANDWRITE_MIN_H = 110
/** `boardStore.canAddObject` — 600 об'єктів на сторінку. */
export const PAGE_OBJECT_LIMIT = 600
export const HANDWRITE_INK = '#1e3a8a'

interface TaskData {
  solution?: unknown
  options?: Array<{ letter?: unknown; text?: unknown; isCorrect?: unknown }>
  pairs?: Array<{ left?: unknown; right?: unknown }>
  correctAnswer?: unknown
}

/** Чи є що писати: розв'язок картки задачі не порожній. */
export function hasHandwritableSolution(asset: { type?: string; data?: unknown } | null | undefined): boolean {
  if (!asset || asset.type !== 'nmt_task') return false
  const sol = (asset.data as TaskData | undefined)?.solution
  return typeof sol === 'string' && sol.trim().length > 0
}

/**
 * Етап 1 (власник 18.10: «має бути виділена картка і інтегралик розв'язує… і тоді він це вже пише»):
 * що може розв'язати Інтегралик, щоб написати рукою, — задача (без розв'язку в даних), картка,
 * картинка (зокрема вирізка з PDF). Картинку сервер читає за адресою: `data:`/`blob:` (ще вантажиться)
 * він не прочитає — як і коректор прочитаного (`imageReadingTarget`).
 */
export function isIntegralykSolvable(
  asset: { type?: string; src?: unknown } | null | undefined,
): boolean {
  if (!asset) return false
  if (asset.type === 'image') return isSafeBackgroundUrl(asset.src)
  return asset.type === 'nmt_task' || asset.type === 'theory_card'
}

/**
 * «Б» / «А, В» для варіантів; рядок відповіді для відкритої; для відповідності — пари «ліве — праве»
 * через «;» (картка показує пари вже зіставленими, окремих літер правого стовпця в даних немає);
 * інакше порожньо (без рядка).
 */
export function answerTextOf(data: TaskData | undefined): string {
  if (!data) return ''
  const correct = (data.options ?? []).filter((o) => o && o.isCorrect === true)
  if (correct.length) {
    const letters = correct.map((o) => String(o.letter ?? '').trim()).filter(Boolean)
    return letters.join(', ')
  }
  const pairs = (data.pairs ?? []).filter((p) => p && p.left != null && p.right != null)
  if (pairs.length) {
    return pairs.map((p) => `${String(p.left).trim()} — ${String(p.right).trim()}`).join('; ').slice(0, 600)
  }
  const ca = data.correctAnswer
  if (typeof ca === 'string' || typeof ca === 'number') return String(ca).trim().slice(0, 600)
  return ''
}

interface PageLike {
  assets?: Array<{ x?: number; y?: number; w?: number; h?: number }>
  strokes?: Array<{ points?: Array<{ x: number; y: number }>; size?: number }>
}

/** Зайняті прямокутники: об'єкти й обриси штрихів поточної сторінки. */
export function occupiedRects(page: PageLike | null | undefined): Rect[] {
  const out: Rect[] = []
  for (const a of page?.assets ?? []) {
    if (a && Number(a.w) > 0 && Number(a.h) > 0) {
      out.push({ x: Number(a.x) || 0, y: Number(a.y) || 0, w: Number(a.w), h: Number(a.h) })
    }
  }
  for (const s of page?.strokes ?? []) {
    const pts = s?.points ?? []
    if (!pts.length) continue
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const p of pts) {
      if (p.x < x0) x0 = p.x
      if (p.y < y0) y0 = p.y
      if (p.x > x1) x1 = p.x
      if (p.y > y1) y1 = p.y
    }
    const pad = (Number(s.size) || 2) / 2
    out.push({ x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad })
  }
  return out
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/**
 * Найбільша вільна область із лівим верхнім кутом у (x, y): спершу до країв сторінки,
 * далі кожну перешкоду обрізаємо або справа, або знизу — як лишається більша площа.
 * Перешкода, що накриває сам кут, — області немає.
 */
export function freeAreaFrom(x: number, y: number, rects: Rect[], pageW: number, pageH: number): Rect | null {
  const area: Rect = { x, y, w: pageW - HANDWRITE_MARGIN - x, h: pageH - HANDWRITE_MARGIN - y }
  if (area.w < HANDWRITE_MIN_W || area.h < HANDWRITE_MIN_H) return null
  for (let guard = 0; guard < 500; guard++) {
    const hit = rects.find((r) => overlaps(area, r))
    if (!hit) return area
    const byWidth = hit.x - HANDWRITE_GAP - area.x
    const byHeight = hit.y - HANDWRITE_GAP - area.y
    const optW = byWidth >= HANDWRITE_MIN_W ? byWidth * area.h : -1
    const optH = byHeight >= HANDWRITE_MIN_H ? byHeight * area.w : -1
    if (optW < 0 && optH < 0) return null
    if (optW >= optH) area.w = byWidth
    else area.h = byHeight
  }
  return null
}

/** Області біля задачі за перевагою: праворуч (діти бачать умову й розв'язок поруч), під задачею. */
export function writingAreasNear(task: Rect, rects: Rect[], pageW: number, pageH: number): Rect[] {
  const right = freeAreaFrom(task.x + task.w + HANDWRITE_GAP, Math.max(HANDWRITE_MARGIN, task.y), rects, pageW, pageH)
  const below = freeAreaFrom(Math.max(HANDWRITE_MARGIN, task.x), task.y + task.h + HANDWRITE_GAP, rects, pageW, pageH)
  return [right, below].filter((a): a is Rect => a !== null)
}

/** Уся сторінка без полів — для нової сторінки. */
export function wholePageArea(pageW: number, pageH: number): Rect {
  return { x: HANDWRITE_MARGIN, y: HANDWRITE_MARGIN, w: pageW - 2 * HANDWRITE_MARGIN, h: pageH - 2 * HANDWRITE_MARGIN }
}
