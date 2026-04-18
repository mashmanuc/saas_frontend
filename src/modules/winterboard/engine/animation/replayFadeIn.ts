/**
 * replayFadeIn — smooth appearance of newly added elements during replay.
 *
 * Previously only `stroke_add` / `asset_add` got fade-in. Batch ops
 * (`strokes_add_batch`, `assets_add_batch`) emitted by paste/duplicate
 * appeared INSTANTLY — reading as a harsh "poof" especially for
 * multi-object pastes (e.g. 6 cubes = 48 strokes in one op).
 *
 * This helper handles both single and batch appearance ops uniformly:
 * every newly added node fades from opacity 0 → 1 over FADE_DURATION_MS,
 * triggered after Vue's next tick (so vue-konva has mounted the nodes).
 *
 * ── Why batch fade-in is SIMULTANEOUS, not staggered ──
 * A paste is ONE user action. Users perceive the batch as a single
 * "appearance event". Staggering would lengthen the visible event and
 * introduce a waterfall read that doesn't match the user's mental model
 * ("6 cubes appeared together"). Cost stays bounded: each node is a
 * cheap Konva tween, and batches are capped at reasonable sizes
 * (paste_batch is clipboard-bounded).
 *
 * ── Reduced motion ──
 * Callers may skip this helper when prefers-reduced-motion is set.
 * Decision lives at call site for consistency with MoveAnimator guards.
 */
import type { BoardOperation } from '../../types/replay'

const FADE_DURATION_MS = 250
const FADE_DURATION_S = FADE_DURATION_MS / 1000

// Minimal Konva shapes we interact with. Keeping this narrow avoids
// pulling in a full Konva typing dependency here.
interface KonvaNodeLite {
  opacity: (v: number) => void
  to: (cfg: { opacity: number; duration: number }) => void
}
interface KonvaStageLite {
  findOne: (selector: string) => KonvaNodeLite | null | undefined
  batchDraw: () => void
}

/**
 * Extract the IDs of newly added elements from a replay op.
 * Returns empty array for non-appearance ops.
 *
 * Covered op types:
 *   - stroke_add          → [stroke.id]
 *   - asset_add           → [asset.id]
 *   - strokes_add_batch   → strokes[].id (paste/duplicate strokes)
 *   - assets_add_batch    → assets[].id  (paste/duplicate assets)
 */
export function collectNewIdsFromOp(op: BoardOperation): string[] {
  const payload = (op.payload ?? {}) as Record<string, unknown>
  switch (op.op_type) {
    case 'stroke_add': {
      const id = (payload.stroke as { id?: string } | undefined)?.id
      return typeof id === 'string' && id.length > 0 ? [id] : []
    }
    case 'asset_add': {
      const id = (payload.asset as { id?: string } | undefined)?.id
      return typeof id === 'string' && id.length > 0 ? [id] : []
    }
    case 'strokes_add_batch': {
      const arr = payload.strokes as Array<{ id?: string }> | undefined
      if (!Array.isArray(arr)) return []
      return arr
        .map((s) => s?.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    }
    case 'assets_add_batch': {
      const arr = payload.assets as Array<{ id?: string }> | undefined
      if (!Array.isArray(arr)) return []
      return arr.map((a) => a?.id).filter((id): id is string => typeof id === 'string')
    }
    default:
      return []
  }
}

/**
 * Fade-in all nodes that correspond to `ids` on the given Konva stage.
 * Must be called after Vue has mounted the new nodes (typically inside
 * a `nextTick` callback).
 *
 * Nodes not found on the stage are silently skipped — this can happen
 * legitimately when a seek/reset races with a batch op (the stage may
 * have already moved on), and we don't want to throw in that case.
 */
export function applyAppearanceFadeIn(
  stage: KonvaStageLite | null | undefined,
  ids: string[],
): void {
  if (!stage || ids.length === 0) return
  for (const id of ids) {
    const node = stage.findOne(`#${id}`)
    if (!node) continue
    node.opacity(0)
    node.to({ opacity: 1, duration: FADE_DURATION_S })
  }
  stage.batchDraw()
}
