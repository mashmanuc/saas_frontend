/**
 * TLV2-05C · масштаб подання картки уроку — `asset.data.presentationScale`.
 *
 * Норматив: SYSTEM_LAW §9.C, OPS_SYNC_SSOT INV-25.
 *   • частина подання уроку: учитель змінює, учень бачить те саме, переживає reload/replay/клон;
 *   • лише для типів із `textScale: 'teacher-shared'` у стандарті об'єктів;
 *   • кроки фіксовані; відсутнє або невалідне значення → 1 (старі картки без змін);
 *   • запис — штатний `asset_update` через host, один клік = одна операція.
 */
import type { WBAsset } from '../types/winterboard'
import { assetCapabilities } from './objectStandard'

export const PRESENTATION_SCALE_STEPS = [0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2] as const

export const DEFAULT_PRESENTATION_SCALE = 1

/** CSS-змінна, якою картка масштабує ВСЮ свою типографіку. */
export const CARD_TEXT_SCALE_VAR = '--wb-card-text-scale'

const STEP_EPS = 1e-6

function stepIndex(value: number): number {
  return PRESENTATION_SCALE_STEPS.findIndex(step => Math.abs(step - value) < STEP_EPS)
}

/** Лише значення з кроків; усе інше (відсутнє, рядок, 1.25, NaN) → 1. */
export function normalizePresentationScale(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_PRESENTATION_SCALE
  const i = stepIndex(value)
  return i === -1 ? DEFAULT_PRESENTATION_SCALE : PRESENTATION_SCALE_STEPS[i]
}

/** Чи має тип спільний учительський масштаб тексту. Невідомий тип — ні. */
export function hasSharedTextScale(type: string | undefined | null): boolean {
  return assetCapabilities(type).textScale === 'teacher-shared'
}

/** Масштаб картки для рендеру: для типів без спільного масштабу завжди 1. */
export function presentationScaleOf(asset: WBAsset | null | undefined): number {
  if (!asset || !hasSharedTextScale(asset.type)) return DEFAULT_PRESENTATION_SCALE
  const data = (asset.data ?? {}) as Record<string, unknown>
  return normalizePresentationScale(data.presentationScale)
}

/**
 * Наступний крок: `-1` — A−, `+1` — A+, `0` — «100%».
 * `null` — змінювати нічого (межа або вже 100%): операції не буде.
 */
export function nextPresentationScale(current: number, direction: -1 | 0 | 1): number | null {
  const now = normalizePresentationScale(current)
  if (direction === 0) return now === DEFAULT_PRESENTATION_SCALE ? null : DEFAULT_PRESENTATION_SCALE
  const next = PRESENTATION_SCALE_STEPS[stepIndex(now) + direction]
  return next === undefined ? null : next
}

/** Той самий асет із новим масштабом; решта даних і геометрія — без змін. */
export function withPresentationScale(asset: WBAsset, scale: number): WBAsset {
  const data = (asset.data ?? {}) as Record<string, unknown>
  return {
    ...asset,
    data: { ...data, presentationScale: normalizePresentationScale(scale) } as unknown as WBAsset['data'],
  }
}

/** Підпис на кнопці скидання: «115%». */
export function presentationScaleLabel(scale: number): string {
  return `${Math.round(normalizePresentationScale(scale) * 100)}%`
}

/** Style-об'єкт для кореня картки: одна змінна на всю типографіку. */
export function cardTextScaleStyle(asset: WBAsset | null | undefined): Record<string, string> {
  return { [CARD_TEXT_SCALE_VAR]: String(presentationScaleOf(asset)) }
}
