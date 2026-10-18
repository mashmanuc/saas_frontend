/**
 * LAW §9 v1.32 · покрокове письмо розв'язку з пульта — чиста логіка без стору й мережі.
 * ТЗ: saas_docs/plans/north_ship/TZ_HANDWRITE_STEP_BY_STEP_PULT_2026-10-18.md (власник 18.10: «згоден з усіма
 * чотирма, роби»).
 *
 *   • І1 — прогрес на дошці, не в пам'яті: кожен штрих кроку має id-позначку «об'єкт · текст · крок з усіх ·
 *     розмір · стовпчик». Що написано — видно зі штрихів сторінки: перезавантаження, інша сторінка й повернення,
 *     інший ноутбук продовжують із наступного кроку. Нового стану в дошці немає.
 *   • І3 — ніколи поверх: місце кроку — у стовпчику розв'язку під попереднім кроком, а якщо там уже щось є
 *     (письмо вчителя чи учня, об'єкт) — нижче за перешкоду.
 *   • Наступний крок — після найбільшого написаного: скасований останній крок пишеться знову; стертий гумкою
 *     (гумка видаляє штрихи цілком) не переписується.
 */
import { HANDWRITE_MARGIN, occupiedRects, type Rect } from './handwriteSolution'

/** Розміри почерку — ті самі, що на сервері (`apps/handwriting/fit.py`, `SCALES`). */
export const STEP_SCALES: readonly number[] = [46, 40, 34, 30, 26]

/** Позначка штриха кроку. */
export interface StepMark {
  /** Відбиток id об'єкта (задачі, картинки, картки), до якого пишеться розв'язок. */
  obj: string
  /** Відбиток тексту розв'язку: інший текст — інший розв'язок (Р3: не змішувати). */
  text: string
  /** Номер кроку з 1. */
  step: number
  total: number
  /** Розмір почерку — індекс у `STEP_SCALES` (І4: один на весь розв'язок). */
  k: number
  /** Стовпчик розв'язку на сторінці. */
  x: number
  w: number
  /** Позначка одного натиску — щоб переписаний після «Скасувати» крок не повторював id видалених штрихів. */
  nonce: string
  /** Номер штриха в кроці. */
  n: number
}

const STEP_ID_RE = /^hw-([0-9a-z]{6})-([0-9a-z]{6})-(\d{1,2})-(\d{1,2})-([0-4])-(\d{1,4})-(\d{1,4})-([0-9a-z]{2})-(\d{1,4})$/
/** Копія задачі на новій сторінці продовження: `tsk-hw-<відбиток об'єкта>-…` — з неї знаходимо оригінал. */
const STEP_COPY_RE = /^tsk-hw-([0-9a-z]{6})-/

/** Короткий відбиток рядка (FNV-1a, 32 біти, base36, 6 знаків). */
export function shortHash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  // 36⁶ — рівно 6 знаків base36 (32 біти дають до 7).
  return ((h >>> 0) % 2176782336).toString(36).padStart(6, '0')
}

export function stepStrokeId(m: StepMark): string {
  return `hw-${m.obj}-${m.text}-${m.step}-${m.total}-${m.k}-${Math.round(m.x)}-${Math.round(m.w)}-${m.nonce}-${m.n}`
}

export function parseStepId(id: unknown): StepMark | null {
  const m = typeof id === 'string' ? STEP_ID_RE.exec(id) : null
  if (!m) return null
  const [, obj, text, step, total, k, x, w, nonce, n] = m
  const mark = { obj, text, step: +step, total: +total, k: +k, x: +x, w: +w, nonce, n: +n }
  return mark.step >= 1 && mark.step <= mark.total ? mark : null
}

export function stepCopyId(obj: string): string {
  return `tsk-hw-${obj}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
}

/** Відбиток оригіналу, якщо це копія задачі зі сторінки продовження; інакше null. */
export function originalOfCopy(id: unknown): string | null {
  const m = typeof id === 'string' ? STEP_COPY_RE.exec(id) : null
  return m ? m[1] : null
}

/** Покроковий розв'язок на сторінці — зібраний зі штрихів. */
export interface StepSession {
  obj: string
  text: string
  total: number
  k: number
  x: number
  w: number
  /** Найбільший написаний крок (≥1). */
  written: number
  /** Низ написаного (найбільше y штрихів розв'язку). */
  bottom: number
  /** Позиція останнього штриха розв'язку серед штрихів сторінки — що свіже. */
  last: number
}

interface PageLike {
  strokes?: Array<{ id?: unknown; points?: Array<{ x: number; y: number }> }>
  assets?: Array<{ x?: number; y?: number; w?: number; h?: number }>
}

export function stepSessions(page: PageLike | null | undefined): StepSession[] {
  const byKey = new Map<string, StepSession>()
  ;(page?.strokes ?? []).forEach((s, idx) => {
    const m = parseStepId(s?.id)
    if (!m) return
    const key = `${m.obj}:${m.text}`
    const bottom = Math.max(...(s.points ?? []).map((p) => p.y), -Infinity)
    const cur = byKey.get(key)
    if (!cur) {
      byKey.set(key, { obj: m.obj, text: m.text, total: m.total, k: m.k, x: m.x, w: m.w, written: m.step, bottom, last: idx })
    } else {
      cur.written = Math.max(cur.written, m.step)
      cur.bottom = Math.max(cur.bottom, bottom)
      cur.last = Math.max(cur.last, idx)
    }
  })
  return [...byKey.values()]
}

/** Незавершений розв'язок на сторінці (Р1, перше правило): найсвіжіший, якщо їх кілька. */
export function unfinishedSession(page: PageLike | null | undefined): StepSession | null {
  const open = stepSessions(page).filter((s) => s.written < s.total)
  return open.sort((a, b) => b.last - a.last)[0] ?? null
}

export function sessionOf(page: PageLike | null | undefined, obj: string, text: string): StepSession | null {
  return stepSessions(page).find((s) => s.obj === obj && s.text === text) ?? null
}

/** Відстань між кроками — як між рядками звичайного запису (`latex.layout_card`: 0.36·s і запас на виносні). */
export function stepGap(scale: number): number {
  return Math.round(0.45 * scale)
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/**
 * І3: верх кроку розміром `size` у стовпчику з лівим краєм `x`, не вище `fromY`, так, щоб не зачепити нічого на
 * сторінці (і вже запланованого `extra`). Перешкода — крок іде нижче за неї. Не влазить до низу — null (нова сторінка).
 */
export function placeStep(
  page: PageLike | null | undefined, x: number, fromY: number, size: { w: number; h: number }, pageH: number,
  gap: number, extra: Rect[] = [],
): number | null {
  const rects = [...occupiedRects(page as any), ...extra]
  let y = fromY
  for (let guard = 0; guard < 500; guard++) {
    if (y + size.h > pageH - HANDWRITE_MARGIN) return null
    const box: Rect = { x, y, w: size.w, h: size.h }
    const hits = rects.filter((r) => overlaps(box, r))
    if (!hits.length) return y
    y = Math.max(...hits.map((r) => r.y + r.h)) + gap
  }
  return null
}
