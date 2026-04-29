/**
 * Phase O PR-O4: Single canonical source for default geometry_solid state.
 *
 * Refs:
 *  - saas_docs/domains/winterboard/phase_O_solid_objects/PLAN.md PR-O4
 *  - saas_docs/domains/winterboard/WINTERBOARD_SSOT.md §3.7.1
 *
 * Used by:
 *   - useContentDrop.ts (drop handler builds asset з цим default state)
 *   - SolidsTray.vue + tests (tray emits payload з src; default state inflated тут)
 *   - PR-O5 replay defaults / migration шар (майбутні versions hydrate fields що відсутні)
 *
 * HARD INVARIANT (CHECKPOINT 4):
 *   - DEFAULT_SOLID_STATE визначений ТУТ і ТІЛЬКИ ТУТ.
 *   - НЕ дублювати literals у drop handler / tests / SolidsTray.
 *   - НЕ читати з SolidCard widget runtime — runtime ≠ persisted contract.
 *   - SolidsTray.vue MUST_NOT inline state; передає тільки `src`. Drop handler
 *     hydrates `data.state` через цей export.
 *
 * Schema version: 1 (per SolidAssetData у types/winterboard.ts).
 * 'building' field intentionally omitted — ephemeral animation runtime,
 * НЕ persisted (per SSOT §3.7.1).
 */
import type { SolidAssetState, SolidType } from '../types/winterboard'

export const DEFAULT_SOLID_STATE: Readonly<SolidAssetState> = Object.freeze({
  showFaces: true,
  showEdges: true,
  showVertices: false,
  transparent: false,
  showNet: false,
  showCut: false,
  cutHeight: 0.5,
  autoRotate: true,
})

/** Default canvas size (px) для нової фігури при drop. Quadratic — 3D widget natural aspect. */
export const DEFAULT_SOLID_W = 280
export const DEFAULT_SOLID_H = 280

/** Custom MIME type для drag з SolidsTray → WBCanvas drop handler. */
export const SOLID_DRAG_MIME = 'application/x-solid'

/**
 * 10 fixed solid types per SSOT §3.7.1 — UI label mapping для tray buttons.
 * Locked list — no custom shapes у Phase O.
 */
export const SOLID_TYPES: ReadonlyArray<{ type: SolidType; label: string }> = Object.freeze([
  { type: 'cube', label: 'Куб' },
  { type: 'cuboid', label: 'Паралелепіпед' },
  { type: 'sphere', label: 'Сфера' },
  { type: 'cylinder', label: 'Циліндр' },
  { type: 'cone', label: 'Конус' },
  { type: 'tetrahedron', label: 'Тетраедр' },
  { type: 'pyramid3', label: 'Піраміда 3' },
  { type: 'pyramid4', label: 'Піраміда 4' },
  { type: 'prism3', label: 'Призма 3' },
  { type: 'prism6', label: 'Призма 6' },
])

/**
 * Drag payload для 'application/x-solid' MIME — тільки src.
 * State не передається — drop handler сам інфлейтить DEFAULT_SOLID_STATE
 * (single source of truth invariant).
 */
export interface SolidDragPayload {
  src: SolidType
}
