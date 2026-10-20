/**
 * «Наочна сцена» (власник 2026-10-20: «одну річ замість сімнадцяти», «поки будемо включати його для ID40») —
 * тип асета `math_scene`: готова жива сцена з `public/scenes/{uk|en}/{id}.html` у вікні на дошці.
 *
 * Дані — лише ЯКА сцена. Те, що вчитель натискає всередині сцени, — вигляд цього екрана: не ops, не запис уроку,
 * учень онлайн бачить сцену на початку (погоджено власником: «для уроку в класі достатньо»).
 * Мова сцени — мова сайту в того, хто дивиться (en → англійська, решта → українська); вигляд маскота — його помічника.
 */
import type { WBAsset } from './winterboard'

export const MATH_SCENE_IDS = [
  'fractions', 'percent', 'decimals', 'frac-mul', 'frac-div', 'lcm', 'negatives', 'equation',
  'square-sum', 'proportion', 'pythagoras', 'angles', 'symmetry', 'areas', 'probability', 'mean', 'vectors',
] as const

export type MathSceneId = typeof MATH_SCENE_IDS[number]

export interface MathSceneData {
  version: 1
  sceneId: MathSceneId
}

export interface MathSceneAsset extends WBAsset {
  type: 'math_scene'
  src: ''
  data: MathSceneData
}

/** MIME для «Інструменти» → дошка (drag і click); payload — `{"sceneId": "…"}`. */
export const MATH_SCENE_DRAG_MIME = 'application/x-m4sh-math-scene'

export function isMathSceneId(value: unknown): value is MathSceneId {
  return typeof value === 'string' && (MATH_SCENE_IDS as readonly string[]).includes(value)
}

/** Мова сцени: англійська лише для англійського сайту; решта (uk, ru) — українська. */
export function mathSceneLang(locale: string | undefined | null): 'uk' | 'en' {
  return locale === 'en' ? 'en' : 'uk'
}

/** Адреса сцени. Невідомий id — `null` (картка покаже «сцени немає», а не порожнє вікно). */
export function mathSceneSrc(sceneId: unknown, locale: string | undefined | null,
  look: 'integralyk' | 'integralka'): string | null {
  if (!isMathSceneId(sceneId)) return null
  return `/scenes/${mathSceneLang(locale)}/${sceneId}.html?look=${look}`
}
