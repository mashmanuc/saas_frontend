/**
 * Креслярські інструменти поруч із лінійкою — транспортир (`protractor`), косинець (`set_square`) і циркуль (`compass`):
 * розміри, межі й будівники нових асетів.
 *
 * Власник 22.10.2026, після знімка дошки конкурента з транспортиром, косинцем і циркулем: «Роби всі… А всі інші
 * подібно до лінійки. А циркуля треба зробити не похожого, як в них. А щоб був похожий на реальний».
 *
 * МАСШТАБ — той самий, що в лінійки (`rulerPxPerCm`): 1 клітинка сітки = 5 мм. Він не зберігається в асеті — кожен
 * екран рахує його з `gridSize` дошки. ДАНИХ ПОНАД ГЕОМЕТРІЮ НЕМАЄ: `x, y, w, h, rotation, locked`; створення —
 * штатний `asset_add`, зміни — штатний `asset_update`.
 *   — транспортир: `w` = діаметр шкали, `h` = радіус + смужка основи;
 *   — косинець: `w` = `h` = довжина катета;
 *   — циркуль: `w` = відстань від голки до грифеля (радіус), `h` — від ручки до кінчиків ніжок (випливає з `w`).
 */
import type { WBAsset } from '../types/winterboard'
import { rulerPxPerCm } from './rulerDefaults'

export const PROTRACTOR_DRAG_MIME = 'application/x-m4sh-protractor'
export const SET_SQUARE_DRAG_MIME = 'application/x-m4sh-set-square'
export const COMPASS_DRAG_MIME = 'application/x-m4sh-compass'

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function centered(type: string, pos: { x: number; y: number }, w: number, h: number, id: string): WBAsset {
  return { id, type, src: '', x: pos.x - w / 2, y: pos.y - h / 2, w, h, rotation: 0, locked: false } as WBAsset
}

/**
 * Новий інструмент — цілком на аркуші. Вставляють у центр видимої частини, а він буває біля краю аркуша; лінійка
 * низька, а косинець (10 см) і циркуль (≈ 14 см заввишки) вилазили б за край. Більший за аркуш — від верхнього лівого кута.
 */
export function placeInsidePage<A extends { x: number; y: number; w: number; h: number }>(a: A, pageW: number, pageH: number): A {
  const x = Math.max(0, Math.min(a.x, pageW - a.w))
  const y = Math.max(0, Math.min(a.y, pageH - a.h))
  return { ...a, x, y }
}

// ─── Транспортир ─────────────────────────────────────────────────────────────

/** Радіус шкали нового транспортира (шкільний — близько 12 см у діаметрі). */
export const PROTRACTOR_DEFAULT_R_CM = 6
export const PROTRACTOR_MIN_R_CM = 3
export const PROTRACTOR_MAX_R_CM = 15
/** Смужка під діаметром (на ній центр і нульова лінія). */
export const PROTRACTOR_BASE_CM = 0.8

/** Радіус шкали в px аркуша: межі 3…15 см; нечисловий — як у нового. */
export function clampProtractorRadius(r: unknown, gridSize: unknown): number {
  const pxPerCm = rulerPxPerCm(gridSize)
  if (typeof r !== 'number' || !Number.isFinite(r)) return PROTRACTOR_DEFAULT_R_CM * pxPerCm
  return Math.min(PROTRACTOR_MAX_R_CM * pxPerCm, Math.max(PROTRACTOR_MIN_R_CM * pxPerCm, r))
}

/** Рамка транспортира з радіусом шкали `r`: ширина — діаметр, висота — радіус + смужка основи. */
export function protractorSize(r: number, gridSize: unknown): { w: number; h: number } {
  return { w: Math.round(2 * r), h: Math.round(r + PROTRACTOR_BASE_CM * rulerPxPerCm(gridSize)) }
}

export function buildProtractorAsset(pos: { x: number; y: number }, gridSize: unknown, id = newId('protractor')): WBAsset {
  const { w, h } = protractorSize(PROTRACTOR_DEFAULT_R_CM * rulerPxPerCm(gridSize), gridSize)
  return centered('protractor', pos, w, h, id)
}

// ─── Косинець 45° ────────────────────────────────────────────────────────────

export const SET_SQUARE_DEFAULT_CM = 10
export const SET_SQUARE_MIN_CM = 5
export const SET_SQUARE_MAX_CM = 30

/** Довжина катета в px аркуша: межі 5…30 см; нечислова — як у нового. */
export function clampSetSquareLeg(leg: unknown, gridSize: unknown): number {
  const pxPerCm = rulerPxPerCm(gridSize)
  if (typeof leg !== 'number' || !Number.isFinite(leg)) return SET_SQUARE_DEFAULT_CM * pxPerCm
  return Math.round(Math.min(SET_SQUARE_MAX_CM * pxPerCm, Math.max(SET_SQUARE_MIN_CM * pxPerCm, leg)))
}

export function buildSetSquareAsset(pos: { x: number; y: number }, gridSize: unknown, id = newId('set-square')): WBAsset {
  const leg = SET_SQUARE_DEFAULT_CM * rulerPxPerCm(gridSize)
  return centered('set_square', pos, leg, leg, id)
}

// ─── Циркуль ─────────────────────────────────────────────────────────────────

/** Довжина ніжки від шарніра до кінчика (справжній шкільний циркуль — 12–14 см). */
export const COMPASS_LEG_CM = 12
export const COMPASS_DEFAULT_R_CM = 4
export const COMPASS_MIN_R_CM = 0.5
export const COMPASS_MAX_R_CM = 20
/** Ручка над шарніром і радіус самого шарніра. */
export const COMPASS_KNOB_CM = 1.6
export const COMPASS_HEAD_CM = 0.45

/** Радіус у px аркуша: межі 0,5…20 см, з кроком 1 мм (як на справжній шкалі); нечисловий — як у нового. */
export function clampCompassRadius(r: unknown, gridSize: unknown): number {
  const pxPerCm = rulerPxPerCm(gridSize)
  if (typeof r !== 'number' || !Number.isFinite(r)) return COMPASS_DEFAULT_R_CM * pxPerCm
  const mm = Math.round((r / pxPerCm) * 10)
  return (Math.min(COMPASS_MAX_R_CM * 10, Math.max(COMPASS_MIN_R_CM * 10, mm)) / 10) * pxPerCm
}

/** Висота шарніра над кінчиками при розведенні `r`: ніжки сталої довжини, тож що ширше — то нижче. */
export function compassHingeDrop(r: number, gridSize: unknown): number {
  const leg = COMPASS_LEG_CM * rulerPxPerCm(gridSize)
  const half = Math.min(r / 2, leg * 0.995)
  return Math.sqrt(leg * leg - half * half)
}

/** Рамка циркуля: ширина — радіус, висота — ручка + шарнір + висота шарніра над кінчиками. */
export function compassSize(r: number, gridSize: unknown): { w: number; h: number } {
  const pxPerCm = rulerPxPerCm(gridSize)
  return { w: r, h: Math.round((COMPASS_KNOB_CM + COMPASS_HEAD_CM) * pxPerCm + compassHingeDrop(r, gridSize)) }
}

export function buildCompassAsset(pos: { x: number; y: number }, gridSize: unknown, id = newId('compass')): WBAsset {
  const { w, h } = compassSize(COMPASS_DEFAULT_R_CM * rulerPxPerCm(gridSize), gridSize)
  return centered('compass', pos, w, h, id)
}
