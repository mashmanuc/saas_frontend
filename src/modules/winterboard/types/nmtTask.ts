/**
 * nmt_task asset type — interactive NMT task card for Lesson Constructor.
 *
 * Three task types:
 *   'single_choice'   — question + A/B/C/D options grid + "Show answer" button
 *   'multiple_select' — те саме, але правильних відповідей кілька (selectCount)
 *   'matching'      — question + left/right pairs + "Show answer" button
 *   'open_answer'   — question + text/number input + "Show answer" button
 *
 * All types share: solution block (show/hide) + externalId (NMTProblem ref).
 *
 * Companion spawn: якщо присутній `fingerprint` з непорожнім `intents[]` —
 * NmtTaskRenderer показує кнопку "Побудувати". CapabilityRegistry вирішує
 * які renderer-и spawn-ити (НІКОЛИ не хардкодиться тут).
 *
 * Asset pattern: HTML overlay + invisible Konva proxy (KONVA_PROXY_TYPES §3.7.9).
 * Renderer: components/board/objects/NmtTaskRenderer.vue
 * Ref: saas_docs/domains/LESSON_CONSTRUCTOR/LESSON_CONSTRUCTOR_SSOT_2026-05-25.md
 *      saas_docs/domains/LESSON_CONSTRUCTOR/COMPANION_PARSING_ALGORITHMS_2026-05-25.md
 */
import type { WBAsset } from './winterboard'

// ⚠️ `multiple_select` додано 2026-08-26. До того типу тут не було, а BE
// такі задачі віддавав — 2 045 карток приїжджали на дошку БЕЗ ЖОДНОГО
// варіанта відповіді, і мовчки: помилки не було, просто нічого не рендерилось.
export type NmtTaskType =
  | 'single_choice'
  | 'multiple_select'
  | 'matching'
  | 'open_answer'

/** One selectable option in a single_choice task. */
export interface NmtTaskOption {
  id: string
  /** Display letter: А, Б, В, Г, … */
  letter: string
  /** Option text — LaTeX-compatible. */
  text: string
  /** Whether this option is the correct answer. */
  isCorrect: boolean
}

/** One left↔right pair in a matching task. */
export interface NmtTaskPair {
  id: string
  /** Left side text — LaTeX-compatible. */
  left: string
  /** Right side text (the correct match for left) — LaTeX-compatible. */
  right: string
}

/**
 * Semantic fingerprint — визначає що ПОКАЗАТИ учню, не який renderer використати.
 *
 * INV-SEM-1: НІКОЛИ не містить renderer_type або WBAsset type напряму.
 * INV-SEM-2: intents[] — стабільний словник. Нові intents тільки додаються.
 * Ref: saas_docs/domains/LESSON_CONSTRUCTOR/COMPANION_PARSING_ALGORITHMS_2026-05-25.md
 */
export interface NmtTaskFingerprint {
  version: number
  /** Математичні домени: 'functions' | 'geometry_2d' | 'geometry_3d' | … */
  domains: string[]
  /** Математичні об'єкти: 'quadratic_function' | 'prism' | 'triangle' | … */
  entities: string[]
  /**
   * Що потрібно ПОКАЗАТИ — порядок = пріоритет.
   * Стабільний словник: 'show_graph' | 'show_3d_solid' | 'show_2d_shape' | …
   * CapabilityRegistry.resolveCompanions() вирішує які renderers spawn-ити.
   */
  intents: string[]
  /**
   * Витягнуті числові/символьні дані (MathJS format, не LaTeX).
   * equations[], x_range, shape, base_shape, dimensions, points, тощо.
   */
  extracted_data: Record<string, unknown>
}

/**
 * Persisted data envelope for nmt_task (version 1).
 *
 * All fields are flat — registered in FLAT_DATA_ASSET_TYPES in assetEquality.ts.
 */
export interface NmtTaskData {
  version: 1
  /** Determines which content fields are populated. */
  taskType: NmtTaskType
  /** Question / task statement text — LaTeX-compatible. */
  question: string
  /** Populated for taskType === 'single_choice' | 'multiple_select'. */
  options?: NmtTaskOption[]
  /**
   * Скільки варіантів треба вибрати (лише 'multiple_select').
   * Без цього числа учень не бачить, що правильна відповідь не одна.
   */
  selectCount?: number
  /** Populated for taskType === 'matching'. */
  pairs?: NmtTaskPair[]
  /** Populated for taskType === 'open_answer'. */
  correctAnswer?: string
  /** Input hint for open_answer ('text' | 'number'). */
  inputType?: 'text' | 'number'
  /** Full solution / explanation — LaTeX-compatible. Present in all types. */
  solution?: string
  /** NMTProblem.id for traceability back to the source problem. */
  externalId?: string
  /**
   * Ілюстрації задачі (2026-07-31). BE віддає лише refs, для яких знайдено файл,
   * тому кожен елемент має `url` (INV-RES-5: медіа посиланням, не інлайном).
   * role: 'QUESTION_IMAGE' — під умовою; 'OPTION_IMAGE' — до варіанта за order.
   */
  resourceRefs?: Array<{ resource_id: string; role?: string; order?: number; url: string }>
  /** Persisted toggle: whether the "correct answer" highlight is visible. */
  showAnswer: boolean
  /** Persisted toggle: whether the solution/explanation block is visible. */
  showSolution: boolean
  /**
   * Масштаб тексту саме цієї картки для показу класу.
   *
   * Це НЕ масштаб полотна: A−/A+ на пульті змінюють символи, формули та
   * текст у картці, а не її рамку і не всю дошку. Відсутнє значення = 1.
   */
  presentationScale?: number
  /**
   * Semantic fingerprint — optional. Присутній якщо NMTProblem вже збагачений.
   * Якщо `fingerprint.intents[]` непорожній — NmtTaskRenderer показує "🔗 Побудувати".
   * null / undefined → кнопка не показується.
   */
  fingerprint?: NmtTaskFingerprint
}

export const NMT_PRESENTATION_SCALE = {
  DEFAULT: 1,
  MIN: 0.8,
  MAX: 2,
  STEP: 1.25,
} as const

/** Безпечний масштаб для старих карток і пошкоджених значень у даних. */
export function normalizeNmtPresentationScale(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return NMT_PRESENTATION_SCALE.DEFAULT
  return Math.min(NMT_PRESENTATION_SCALE.MAX, Math.max(NMT_PRESENTATION_SCALE.MIN, numeric))
}

/** Typed alias — nmt_task assets always carry NmtTaskData. */
export type NmtTaskAsset = WBAsset & {
  type: 'nmt_task'
  data: NmtTaskData
}
