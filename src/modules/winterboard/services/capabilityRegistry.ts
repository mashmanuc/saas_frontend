/**
 * CapabilityRegistry — маппінг semantic intent → список renderer-ів.
 *
 * INV-CAP-1: Цей файл — ЄДИНЕ місце де intents прив'язуються до renderer-ів.
 *            Ніде у codebase не повинно бути прямого маппінгу intent → WBAsset type.
 * INV-CAP-2: При додаванні нового renderer — оновлювати тільки цей файл:
 *            1) Додати у AVAILABLE_RENDERERS
 *            2) Додати у INTENT_TO_RENDERERS (ліворуч = вищий пріоритет)
 *            3. Більше нічого. Задачі не змінюються. Міграцій немає.
 * INV-CAP-3: NmtTaskData НІКОЛИ не містить WBAsset type напряму.
 *            Тільки fingerprint.intents[].
 *
 * Ref: saas_docs/domains/LESSON_CONSTRUCTOR/COMPANION_PARSING_ALGORITHMS_2026-05-25.md §2
 *      saas_docs/domains/LESSON_CONSTRUCTOR/EDUCATIONAL_COMPANION_SPAWN_2026-05-25.md
 */

// ── Renderer resolution result ────────────────────────────────────────────────

export interface CompanionResolution {
  /** WBAsset.type — який renderer spawn-ити. */
  rendererType: string
  /** Первинний intent що викликав цей renderer. */
  intent: string
  /** extracted_data з fingerprint — передається у WBAsset.data через buildCompanionAsset(). */
  data: Record<string, unknown>
}

// ── Intent → Renderers mapping ────────────────────────────────────────────────
//
// Порядок в масиві = пріоритет (перший доступний вибирається).
// Завтра: show_graph: ['animated_graph_v2', 'graph_calculator']
// → animated_graph_v2 буде перевірятись першим; якщо недоступний — fallback.

export const INTENT_TO_RENDERERS: Record<string, string[]> = {
  // ── Graph / functions ──────────────────────────────────────────────────────
  show_graph:         ['graph_calculator'],
  show_roots:         ['graph_calculator'],
  show_vertex:        ['graph_calculator'],
  show_asymptotes:    ['graph_calculator'],
  show_intersection:  ['graph_calculator'],
  show_domain_range:  ['graph_calculator'],
  show_trig_graph:    ['graph_calculator'],

  // ── Calculus ───────────────────────────────────────────────────────────────
  // rendererType = WBAsset.type (must match exactly)
  show_derivative:    ['calculus_card'],
  show_integral_area: ['calculus_card'],
  show_tangent:       ['calculus_card'],
  show_extrema:       ['calculus_card'],

  // ── Quadratic ──────────────────────────────────────────────────────────────
  show_discriminant:  ['quadratic_card'],
  show_parabola:      ['quadratic_card'],
  show_quadratic_roots: ['quadratic_card'],

  // ── 3D Geometry ────────────────────────────────────────────────────────────
  show_3d_solid:      ['nmt3d'],
  show_cross_section: ['nmt3d'],
  animate_rotation:   ['nmt3d'],
  show_vectors_3d:    ['nmt3d'],

  // ── 2D Geometry ────────────────────────────────────────────────────────────
  show_2d_shape:          ['geometry_2d_v2'],
  show_angles:            ['geometry_2d_v2'],
  show_height:            ['geometry_2d_v2'],
  show_diagonals:         ['geometry_2d_v2'],
  show_median:            ['geometry_2d_v2'],
  show_bisector:          ['geometry_2d_v2'],
  show_circumscribed_circle: ['geometry_2d_v2'],
  show_vectors_2d:        ['geometry_2d_v2'],
  show_vector_sum:        ['geometry_2d_v2'],

  // ── Trigonometry ───────────────────────────────────────────────────────────
  show_unit_circle:   ['trig_circle'],
  show_trig_values:   ['trig_circle'],
}

// ── Available renderers (runtime set) ─────────────────────────────────────────
//
// Тільки renderer-и що реально зареєстровані у WBCanvas (KONVA_PROXY_TYPES
// або overlay-only, але мають WBAsset type).
// Якщо renderer недоступний → він пропускається у resolveCompanions().

// rendererType values MUST match WBAsset.type exactly (see winterboard.ts).
export const AVAILABLE_RENDERERS = new Set<string>([
  'graph_calculator',
  'calculus_card',
  'nmt3d',
  'geometry_2d_v2',
  'trig_circle',
  'trig_solver',
  'quadratic_card',
])

// ── Default sizes per renderer ─────────────────────────────────────────────────

export const RENDERER_DEFAULTS: Record<string, { w: number; h: number }> = {
  graph_calculator: { w: 640, h: 520 },
  calculus_card:    { w: 480, h: 360 },
  nmt3d:            { w: 680, h: 500 },
  geometry_2d_v2:   { w: 520, h: 440 },
  trig_circle:      { w: 640, h: 360 },
  trig_solver:      { w: 520, h: 480 },
  quadratic_card:   { w: 480, h: 380 },
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Для списку intents → повертає список CompanionResolution для spawn.
 *
 * Логіка:
 * - Обходимо intents у порядку пріоритету
 * - Для кожного intent — перший доступний renderer з INTENT_TO_RENDERERS
 * - Дедублікуємо: якщо два intents → один renderer → тільки перший intent spawn-ить
 * - Max 2 companions одночасно (щоб не переповнювати дошку)
 *
 * @param intents        fingerprint.intents[] — порядок = пріоритет
 * @param extractedData  fingerprint.extracted_data — передається у companion WBAsset.data
 */
// ── Renderer guards ───────────────────────────────────────────────────────────
// graph_calculator / calculus мають сенс ТІЛЬКИ якщо є реальні рівняння.
// Без них кнопка "Побудувати" прихована навіть якщо intent є.
// Приклад: "y = f(x) на множині {-8;-5;0;3}" → intent show_graph є, equations [] → hidden.

function hasEquations(data: Record<string, unknown>): boolean {
  const eqs = data.equations as unknown[] | undefined
  return Array.isArray(eqs) && eqs.length > 0
}

// quadratic_card має сенс лише з реальними коефіцієнтами (backend extract_quadratic).
// Без них (generic парабола) кнопка прихована — функція піде у graph_calculator.
function hasQuadratic(data: Record<string, unknown>): boolean {
  const q = data.quadratic as { a?: unknown } | undefined
  return !!q && typeof q.a === 'number'
}

const RENDERER_REQUIRES_DATA: Record<string, (d: Record<string, unknown>) => boolean> = {
  graph_calculator: hasEquations,
  calculus_card:    hasEquations,   // FIX: було 'calculus' (стара назва) → guard не діяв
  quadratic_card:   hasQuadratic,
}

export function resolveCompanions(
  intents: string[],
  extractedData: Record<string, unknown>,
): CompanionResolution[] {
  const seen = new Set<string>()
  const result: CompanionResolution[] = []

  for (const intent of intents) {
    const candidates = INTENT_TO_RENDERERS[intent] ?? []

    for (const renderer of candidates) {
      if (!AVAILABLE_RENDERERS.has(renderer) || seen.has(renderer)) continue

      // Перевіряємо чи є необхідні дані для цього renderer-а
      const guard = RENDERER_REQUIRES_DATA[renderer]
      if (guard && !guard(extractedData)) continue  // немає даних → skip

      seen.add(renderer)
      result.push({ rendererType: renderer, intent, data: extractedData })
      break
    }

    if (result.length >= 2) break
  }

  return result
}

/**
 * Перевіряє чи є хоч один доступний companion для даного fingerprint.
 * Використовується для показу/приховування кнопки "Побудувати".
 */
export function hasAvailableCompanions(
  intents: string[],
  extractedData: Record<string, unknown>,
): boolean {
  return resolveCompanions(intents, extractedData).length > 0
}
