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

  // data envelope (Phase O SolidAssetData / Phase G GraphCalculatorData)
  const aData = a.data
  const bData = b.data
  if (aData !== bData) {
    if (!aData || !bData) return false  // one is undefined, other is set
    if (aData.version !== bData.version) return false
    // Phase G: graph_calculator state shape ≠ SolidAssetState. Diff via
    // JSON stringify (state ≤ 64KB per inv-21 constraints, ≤ 32 expressions,
    // ≤ 16 params — cheap enough; no false-positive risk per fail-safe contract).
    if (a.type === 'graph_calculator' || b.type === 'graph_calculator') {
      try {
        // Compare full data (state + meta) bo meta.last_snapshot_seq teж relevant.
        return JSON.stringify(aData) === JSON.stringify(bData)
      } catch {
        return false
      }
    }
    // Phase G v2: geometry_2d_v2 data envelope не має поля 'state' — JSON-diff.
    if (a.type === 'geometry_2d_v2' || b.type === 'geometry_2d_v2') {
      try { return JSON.stringify(aData) === JSON.stringify(bData) } catch { return false }
    }
    // Solid path: ABi data is SolidAssetData з полем 'state'.
    const aState = (aData as { state: unknown }).state
    const bState = (bData as { state: unknown }).state
    if (aState !== bState) {
      if (!aState || !bState) return false
      // Iterate ALL known SolidAssetState keys (primitive contract per SSOT §3.7.1)
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
} as const
