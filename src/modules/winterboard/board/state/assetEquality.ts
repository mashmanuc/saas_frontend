/**
 * Phase 1A (Plan v1.1): Asset equality check для Layer A filter у boardStore.updateAsset().
 *
 * Plan ref: saas_docs/plans/classroom/CORE_UPDATEASSET_STABILIZATION_PLAN_2026-05-04.md §3.2 Layer A
 *
 * INVARIANT (architect-approved):
 *   Whitelist comparison ТІЛЬКИ — не deep-equal.
 *   Поля поза whitelist вважаються UI hints, не op-relevant.
 *
 * Чому НЕ deep-equal:
 *   1. Може schопнути unknown fields → втрата ops для legitimate updates
 *   2. Vue reactive Symbols + Konva node refs створюють шум у deep traversal
 *   3. Whitelist = single source of truth у коді (легко audit + extend)
 *
 * Якщо додається нове ops-relevant поле у WBAsset → MUST бути додане сюди.
 * Без додавання filter ризикує skipnut op (false-positive equality).
 *
 * INV-13 enforcement: ця функція робить filter "1 user action = 1 op" для
 * випадків коли handler emit'ить identical asset (typical Konva side effect).
 *
 * ## Додавання нового типу з versioned data
 *
 * Якщо новий тип має flat `data` (НЕ вкладений `data.state` як у geometry_solid):
 *   1. Додай тип рядком у FLAT_DATA_ASSET_TYPES нижче.
 *   2. Більше нічого не треба — JSON.stringify шлях підхопить автоматично.
 *
 * Якщо новий тип має вкладений `data.state` (як geometry_solid):
 *   1. Додай ключі стану у окремий KEYS масив.
 *   2. Додай гілку у секцію "Nested-state types" нижче.
 */
import type { WBAsset } from '../../types/winterboard'

/**
 * Top-level fields які впливають на op semantics.
 * Беруться з WBAsset interface (types/winterboard.ts:182-270) — підмножина яка персиститься
 * у БД через `_emitOperation('asset_update')` payload.
 *
 * Excluded (FE-only, NOT persisted per types/winterboard.ts comments):
 *   - status: 'uploading'|'ready'|'error' (line 243 — strip-нуто recorder.ts)
 *   - errorMessage (line 245 — FE-only)
 *   - pages: WBViewerPage[] (line 253-254 — hydrated from API, NOT in WS/state)
 *
 * Note: 'id' навмисно не у списку — comparison ВСЕГДА між asset.id === current.id
 * (filter спрацьовує лише після lookup за id у `boardStore.updateAsset`).
 */
const TOP_LEVEL_FIELDS: readonly (keyof WBAsset)[] = [
  'type',
  'src',
  'x',
  'y',
  'w',
  'h',
  'rotation',
  'locked',
  'lockedBy',
  // Sticky / text formatting
  'text',
  'bgColor',
  'textColor',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'fontStyle',
  'textAlign',
  // Audio/video/youtube
  'title',
  'duration',
  'thumbnail',
  'youtubeUrl',
  'audioUrl',
  'audioDuration',
  // Object link attachment (Phase Link, 2026-05-14): mirror audio pattern.
  'linkUrl',
  'linkTitle',
  // Image properties (Phase 35)
  'opacity',
  'borderRadius',
  // DocumentViewer (PLAN_v4)
  'currentPage',
  'totalPages',
  'viewerMode',
] as const

/**
 * Nested paths які впливають на op semantics. Compared field-by-field
 * (без deep traversal на full object — щоб уникнути Vue reactivity noise).
 *
 * Per types/winterboard.ts:117-120 — WBContentRef має тільки content_id + content_type.
 * (content_version згадується у PLAN_v4 docs але НЕ у поточному interface — якщо буде
 * додано — додати сюди.)
 */
const NESTED_CONTENT_REF_FIELDS = ['content_id', 'content_type'] as const

/**
 * SolidAsset.data.state ключі (per types/winterboard.ts:154-171 SolidAssetState).
 * `building` навмисно EXCLUDED per SSOT §3.7.1 — animation runtime, NOT persisted.
 */
const SOLID_STATE_KEYS = [
  'showFaces',
  'showEdges',
  'showVertices',
  'transparent',
  'showNet',
  'showCut',
  'cutHeight',
  'autoRotate',
] as const

/**
 * Asset types whose `data` envelope is a flat versioned object (NO nested `state` field).
 * Equality is determined by JSON.stringify of the full data envelope.
 *
 * WHY a Set instead of per-type if-chains:
 *   - Previous pattern required a new `if (a.type === 'X' || b.type === 'X')` block per type.
 *   - Easy to forget → silent Layer-A false-positive equality → ops never recorded.
 *   - Bug hit us: trig_circle + helix were missing → theta/toggle changes lost from replay log.
 *   - Set: adding a new flat-data type = ONE line here. Impossible to partially forget.
 *
 * FLAT = НЕ має вкладеного `data.state` (як geometry_solid).
 * Всі поля даних знаходяться безпосередньо у `data.*`.
 *
 * Types with nested `data.state` (geometry_solid) — handled separately below.
 *
 * ⚠️ NEW TYPE CHECKLIST: якщо додаєш новий asset type з versioned `data`:
 *   - flat data (like TrigCircleData, HelixData, CalculusData) → add here
 *   - nested state (like SolidAssetData.state) → add SOLID_STATE_KEYS + branch below
 */
const FLAT_DATA_ASSET_TYPES = new Set<WBAsset['type']>([
  'graph_calculator',  // §3.7.2 — state+meta envelope, meta.last_snapshot_seq relevant
  'geometry_2d_v2',   // §3.7.3 — preset, toggles, pointsSnapshot, options
  'calculus_card',     // §3.7.4 — mode, expr, x0/a/b/riemann/N/showF/viewport
  'trig_circle',       // §3.7.5 — theta, showSin/Cos/Tan/Cot, snapPi12, speed, ...
  'helix',             // §3.7.6 — theta, phi, pitch, showHelix/Sin/Cos/Circle, ...
  'trig_solver',       // §3.7.7 — mode, func, sign, value, showInfo
  'nmt3d',            // §3.7.8 — templateKey, mode ('adapt'|'draw')
  'nmt_task',         // §3.7.9 — taskType, question, options/pairs/correctAnswer, showAnswer/showSolution
  'quadratic_card',   // §3.7.10 — a, b, c, showVertex/Axis/Roots, viewport
  'formula_card',     // §3.7.11 — formula (LaTeX), fontSize, color, bg
  'theory_card',      // §3.7.12 — title, body, hint, formulaTitle, formulas[]
  'mash_scene',       // §3.7.13 — app, sceneFormat, scene (envelope as-is), title
  'geomash_scene',    // §3.7.14 — scene {objects, cs} (жива GeoMASH-геометрія)
])

/**
 * Compare 2 WBAsset objects on ops-relevant fields ONLY.
 *
 * @returns `true` if assets are equal for ops purposes (caller can skip emit op)
 *          `false` if any ops-relevant field differs (caller MUST proceed з emit)
 *
 * **Safety:** при будь-якому doubt повертає `false` (proceed) — fail-safe бік
 * "не втратити op". False-positive equality (skip правильний op) — гірше ніж
 * false-negative (емітити redundant op).
 *
 * **Performance:** O(N) де N ≈ 30 (constant). Безпечно у 60 FPS hot path.
 */
export function assetsEqualByOpsFields(a: WBAsset, b: WBAsset): boolean {
  // Top-level primitive fields
  for (const field of TOP_LEVEL_FIELDS) {
    if (a[field] !== b[field]) return false
  }

  // content_ref nested
  const aRef = a.content_ref
  const bRef = b.content_ref
  if (aRef !== bRef) {
    // Different references — compare field-by-field
    if (!aRef || !bRef) return false  // one is undefined, other is set
    for (const f of NESTED_CONTENT_REF_FIELDS) {
      if ((aRef as unknown as Record<string, unknown>)[f] !== (bRef as unknown as Record<string, unknown>)[f]) {
        return false
      }
    }
  }

  // data envelope
  const aData = a.data
  const bData = b.data
  if (aData !== bData) {
    if (!aData || !bData) return false  // one is undefined, other is set
    if (aData.version !== bData.version) return false

    // ── Flat-data types (no nested `state`) ─────────────────────────────────
    // JSON.stringify covers ALL fields in one shot — no per-field maintenance.
    // Adding a new flat-data type = add ONE entry to FLAT_DATA_ASSET_TYPES above.
    if (FLAT_DATA_ASSET_TYPES.has(a.type) || FLAT_DATA_ASSET_TYPES.has(b.type)) {
      try {
        return JSON.stringify(aData) === JSON.stringify(bData)
      } catch {
        return false  // fail-safe: treat as unequal → emit op
      }
    }

    // ── Nested-state types (geometry_solid) ──────────────────────────────────
    // data.state is an object with known primitive keys (per SSOT §3.7.1).
    // Iterate whitelist to avoid Vue reactivity symbols in deep traversal.
    const aState = (aData as { state: unknown }).state
    const bState = (bData as { state: unknown }).state
    if (aState !== bState) {
      if (!aState || !bState) return false
      for (const k of SOLID_STATE_KEYS) {
        const av = (aState as unknown as Record<string, unknown>)[k]
        const bv = (bState as unknown as Record<string, unknown>)[k]
        if (av !== bv) return false
      }
    }
  }

  return true
}

/**
 * Exposed for tests + observability.
 * Снапшот whitelist — для verify у tests що нові WBAsset поля не пропущені
 * автоматично (нове поле → треба явно вирішити: ops-relevant чи UI hint).
 */
export const __OPS_RELEVANT_FIELDS_INTERNAL__ = {
  TOP_LEVEL: TOP_LEVEL_FIELDS,
  CONTENT_REF: NESTED_CONTENT_REF_FIELDS,
  SOLID_STATE: SOLID_STATE_KEYS,
  FLAT_DATA_TYPES: FLAT_DATA_ASSET_TYPES,
} as const
