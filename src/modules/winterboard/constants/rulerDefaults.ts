/**
 * Екранна лінійка (`ruler`) — масштаб, розміри й будівник нового асета.
 *
 * Власник 22.10.2026 (після дошки конкурента з лінійкою в сантиметрах): «ми зараз робимо лінійку, циркуль
 * реальний… Куди ми положимо лінійку і циркуля? Це буде все в геометрії жити».
 *
 * МАСШТАБ «ЯК У ЗОШИТІ»: одна клітинка сітки дошки = 5 мм, тобто 1 см = 2 клітинки = `2 × gridSize` пікселів
 * аркуша (за замовчуванням `gridSize` = 20 → 40 px на сантиметр). Масштаб не зберігається в асеті — його
 * рахує кожен екран з `gridSize` дошки, тож у вчителя, учня й запису він однаковий.
 *
 * ДАНИХ ПОНАД ГЕОМЕТРІЮ НЕМАЄ: `x, y, w, h, rotation, locked`. Скільки сантиметрів на лінійці — випливає з
 * довжини `w` (поля по 0,5 см з боків). Створення — штатний `asset_add`, зміни — штатний `asset_update`.
 */
import type { WBAsset } from '../types/winterboard'

export const RULER_DRAG_MIME = 'application/x-m4sh-ruler'

/** Скільки міліметрів в одній клітинці сітки (зошит у клітинку). */
export const RULER_MM_PER_GRID_CELL = 5

/** `boardStore.gridSize` за замовчуванням і його межі (`setGridSize`: 10–100). */
const DEFAULT_GRID_SIZE = 20
const MIN_GRID_SIZE = 10
const MAX_GRID_SIZE = 100

/** Поділки нової лінійки: 0…15 см. */
export const RULER_DEFAULT_CM = 15
/** Поле без поділок з кожного боку («0» — на відступі від лівого краю). */
export const RULER_MARGIN_CM = 0.5
/** Висота тіла лінійки. Змінити її не можна — Transformer тягне лише за бокові ручки. */
export const RULER_HEIGHT_CM = 1.6
/** Найкоротша й найдовша шкала, до якої можна розтягнути лінійку. */
export const RULER_MIN_CM = 3
export const RULER_MAX_CM = 50

function sanitizeGridSize(gridSize: unknown): number {
  if (typeof gridSize !== 'number' || !Number.isFinite(gridSize) || gridSize <= 0) return DEFAULT_GRID_SIZE
  return Math.min(MAX_GRID_SIZE, Math.max(MIN_GRID_SIZE, gridSize))
}

/** Пікселів аркуша на 1 см: 10 мм / 5 мм = 2 клітинки. */
export function rulerPxPerCm(gridSize: unknown): number {
  return (10 / RULER_MM_PER_GRID_CELL) * sanitizeGridSize(gridSize)
}

/** Поле без поділок (px аркуша) з кожного боку. */
export function rulerMarginPx(gridSize: unknown): number {
  return RULER_MARGIN_CM * rulerPxPerCm(gridSize)
}

/** Висота лінійки (px аркуша). */
export function rulerHeightPx(gridSize: unknown): number {
  return Math.round(RULER_HEIGHT_CM * rulerPxPerCm(gridSize))
}

/** Повна довжина лінійки зі шкалою `cm` сантиметрів (поля входять). */
export function rulerWidthForCm(cm: number, gridSize: unknown): number {
  return Math.round((cm + 2 * RULER_MARGIN_CM) * rulerPxPerCm(gridSize))
}

export function rulerMinWidthPx(gridSize: unknown): number {
  return rulerWidthForCm(RULER_MIN_CM, gridSize)
}

export function rulerMaxWidthPx(gridSize: unknown): number {
  return rulerWidthForCm(RULER_MAX_CM, gridSize)
}

/** Довжина в межах мін/макс; нечислова — довжина нової лінійки. */
export function clampRulerWidth(w: unknown, gridSize: unknown): number {
  if (typeof w !== 'number' || !Number.isFinite(w)) return rulerWidthForCm(RULER_DEFAULT_CM, gridSize)
  return Math.round(Math.min(rulerMaxWidthPx(gridSize), Math.max(rulerMinWidthPx(gridSize), w)))
}

/** Скільки міліметрових поділок уміщається між полями при `pxPerCm` (рахуємо від «0»). */
export function rulerMmCountAt(w: number, pxPerCm: number): number {
  if (!(pxPerCm > 0)) return 0
  const usable = w - 2 * RULER_MARGIN_CM * pxPerCm
  if (!Number.isFinite(usable) || usable <= 0) return 0
  // +1e-6: ціла кількість міліметрів не губиться через похибку ділення
  return Math.floor(usable / (pxPerCm / 10) + 1e-6)
}

/** Скільки міліметрових поділок уміщається між полями (рахуємо від «0»). */
export function rulerMmCount(w: number, gridSize: unknown): number {
  return rulerMmCountAt(w, rulerPxPerCm(gridSize))
}

/** Скільки сантиметрів на шкалі: floor((w − поля) / px на см). */
export function rulerCmCount(w: number, gridSize: unknown): number {
  return Math.floor(rulerMmCount(w, gridSize) / 10)
}

/** Нова лінійка з центром у `pos`, розмір — від `gridSize` поточної дошки. */
export function buildRulerAsset(
  pos: { x: number; y: number },
  gridSize: unknown,
  id: string = `ruler-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
): WBAsset {
  const w = rulerWidthForCm(RULER_DEFAULT_CM, gridSize)
  const h = rulerHeightPx(gridSize)
  return {
    id,
    type: 'ruler',
    src: '',
    x: pos.x - w / 2,
    y: pos.y - h / 2,
    w,
    h,
    rotation: 0,
    locked: false,
  }
}
