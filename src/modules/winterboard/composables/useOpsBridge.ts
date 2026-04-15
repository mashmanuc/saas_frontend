// Phase 4a: Bridge — boardStore operation events → WBDiffOp → autosave.queueDiffOp
//
// @deprecated Phase ops-only (2026-04-15): цей bridge створював DUAL-WRITE проблему.
//
// Кожен stroke letify:
//   - useReplayRecorder  → POST /replay/batch/  (primary ops log)
//   - useOpsBridge       → autosave.queueDiffOp → PATCH /diff/  (redundant)
//
// На backend обидва шляхи робили `select_for_update(skip_locked=True)` на тій
// самій WBSession → один отримує lock, інший 409 session_locked → retry storm.
//
// ФІКС: bridge — no-op. Source of truth — `/replay/batch/`. `queueDiffOp` залишається
// як API для legacy caller-ів (якщо з'являться); `diff` endpoint — тільки як
// manual/emergency fallback.
//
// Old implementation збережено нижче як backup для rollback (закоментовано).
// TODO: видалити файл цілком після 2 тижнів у prod без regressions.

import type { RecordOperationRequest } from '../types/replay'
import type { WBDiffOp } from '../api/winterboardApi'
import type { AutosaveReturn } from './useAutosave'
import { useWBStore } from '../board/state/boardStore'

// ── Mapper ──────────────────────────────────────────────────────────────

/**
 * @deprecated Historical mapper: RecordOperationRequest → WBDiffOp.
 * Not called from runtime after ops-only migration. Exported to keep
 * the mapping logic visible for potential rollback / diagnostics.
 */
export function mapToDiffOp(recordOp: RecordOperationRequest): WBDiffOp | null {
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
        value: { type: 'page_delete', page_id: page_id ?? '' },
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
 * @deprecated Phase ops-only (2026-04-15). No-op implementation.
 *
 * Раніше цей bridge дублював ops у `queueDiffOp` → `/diff/` endpoint.
 * Тепер ops ідуть ТІЛЬКИ через `useReplayRecorder` → `/replay/batch/`.
 *
 * Call-sites залишились (WBSoloRoom/WBClassroomRoom) для сумісності, але
 * результат — noop `destroy()`. Жодної підписки на store не створюється.
 *
 * Якщо потрібен був би rollback: див. historical implementation у git blame
 * або PR що запроваджував цей фікс.
 */
export function useOpsBridge(_autosave: AutosaveReturn) {
  // Інтентний no-op: зберігаємо сигнатуру для backward-compat call-sites.
  // Явна підписка на store видалена — useReplayRecorder є єдиним listener.
  void _autosave
  return {
    destroy: () => {
      /* noop — жодна підписка не створювалась */
    },
  }
}
