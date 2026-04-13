// Phase 4a: Bridge — boardStore operation events → WBDiffOp → autosave.queueDiffOp
//
// Subscribes to store.onOperation() (Phase 20 listener pattern) and converts
// RecordOperationRequest → WBDiffOp for ops-based persistence.
//
// This allows all board mutations to generate diff ops WITHOUT modifying
// every mutation call site — we hook into the existing event emitter.

import type { RecordOperationRequest } from '../types/replay'
import type { WBDiffOp } from '../api/winterboardApi'
import type { AutosaveReturn } from './useAutosave'
import { useWBStore } from '../board/state/boardStore'

// ── Mapper ──────────────────────────────────────────────────────────────

function mapToDiffOp(recordOp: RecordOperationRequest): WBDiffOp | null {
  const { op_type, page_id, payload } = recordOp

  switch (op_type) {
    // ── Strokes ──────────────────────────────────
    case 'stroke_add':
      return {
        op: 'add',
        kind: 'stroke',
        page_id: page_id ?? '',
        id: (payload?.stroke as any)?.id,
        value: payload?.stroke as Record<string, unknown>,
      }
    case 'stroke_update':
      return {
        op: 'update',
        kind: 'stroke',
        page_id: page_id ?? '',
        id: (payload?.stroke as any)?.id,
        value: payload?.stroke as Record<string, unknown>,
      }
    case 'stroke_delete':
      return {
        op: 'remove',
        kind: 'stroke',
        page_id: page_id ?? '',
        id: payload?.stroke_id as string,
      }

    // ── Assets ───────────────────────────────────
    case 'asset_add':
      return {
        op: 'add',
        kind: 'asset',
        page_id: page_id ?? '',
        id: (payload?.asset as any)?.id,
        value: payload?.asset as Record<string, unknown>,
      }
    case 'asset_update':
      return {
        op: 'update',
        kind: 'asset',
        page_id: page_id ?? '',
        id: (payload?.asset as any)?.id,
        value: payload?.asset as Record<string, unknown>,
      }
    case 'asset_delete':
      return {
        op: 'remove',
        kind: 'asset',
        page_id: page_id ?? '',
        id: payload?.asset_id as string,
      }

    // ── Pages (meta) ─────────────────────────────
    case 'page_add':
      return {
        op: 'add',
        kind: 'meta',
        page_id: page_id ?? '',
        id: page_id ?? (payload as any)?.page_id,
        value: { type: 'page_add', ...(payload ?? {}) },
      }
    case 'page_delete':
      return {
        op: 'remove',
        kind: 'meta',
        page_id: page_id ?? '',
        id: (payload as any)?.page_id ?? page_id,
      }
    case 'clear_page':
      return {
        op: 'update',
        kind: 'meta',
        page_id: page_id ?? '',
        id: page_id ?? '',
        value: { type: 'clear_page' },
      }

    // ── Grid & Background ────────────────────────
    case 'grid_update':
      return {
        op: 'update',
        kind: 'meta',
        page_id: page_id ?? '',
        id: page_id ?? '',
        value: { type: 'grid_update', ...(payload ?? {}) },
      }
    case 'background_update':
      return {
        op: 'update',
        kind: 'meta',
        page_id: page_id ?? '',
        id: page_id ?? '',
        value: { type: 'background_update', ...(payload ?? {}) },
      }

    // ── Z-order ──────────────────────────────────
    case 'z_order':
      return {
        op: 'update',
        kind: 'meta',
        page_id: page_id ?? '',
        id: (payload as any)?.object_id ?? '',
        value: { type: 'z_order', ...(payload ?? {}) },
      }

    // ── Groups ───────────────────────────────────
    case 'group_create':
      return {
        op: 'add',
        kind: 'meta',
        page_id: page_id ?? '',
        id: (payload as any)?.group_id ?? '',
        value: { type: 'group_create', ...(payload ?? {}) },
      }
    case 'group_delete':
      return {
        op: 'remove',
        kind: 'meta',
        page_id: page_id ?? '',
        id: (payload as any)?.group_id ?? '',
        value: { type: 'group_delete' },
      }

    // ── Locking ──────────────────────────────────
    case 'lock_update':
      return {
        op: 'update',
        kind: 'meta',
        page_id: page_id ?? '',
        id: page_id ?? '',
        value: { type: 'lock_update', ...(payload ?? {}) },
      }

    // ── Move / Align / Batch ─────────────────────
    case 'move':
    case 'align':
    case 'batch_update':
      // These are bulk ops — full state covered by individual object updates
      // Backend applies via full state in stream-save or individual ops
      return {
        op: 'update',
        kind: 'meta',
        page_id: page_id ?? '',
        id: page_id ?? '',
        value: { type: op_type, ...(payload ?? {}) },
      }

    // ── UI-only / lightweight events (skip diff, handled by replay recorder) ──
    case 'page_navigate':
    case 'geometry_vertex_move':
      return null

    default:
      if (import.meta.env?.DEV) {
        console.warn(`[WB:ops-bridge] Unknown op_type: ${op_type}`)
      }
      return null
  }
}

// ── Composable ──────────────────────────────────────────────────────────

/**
 * Bridge: subscribes to boardStore operation events and forwards them
 * as WBDiffOps to autosave.queueDiffOp() for ops-based persistence.
 *
 * Call in WBSoloRoom / WBClassroomRoom after useAutosave() init.
 */
export function useOpsBridge(autosave: AutosaveReturn) {
  const store = useWBStore()

  const unsubscribe = store.onOperation((recordOp: RecordOperationRequest) => {
    const diffOp = mapToDiffOp(recordOp)
    if (diffOp) {
      autosave.queueDiffOp(diffOp)
    }
  })

  return { destroy: unsubscribe }
}
