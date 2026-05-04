/**
 * Phase 1B (Plan v1.1): Layer B — per-asset_id RAF coalesce для boardStore.updateAsset.
 *
 * Plan ref: saas_docs/plans/classroom/CORE_UPDATEASSET_STABILIZATION_PLAN_2026-05-04.md §3.2 Layer B
 *
 * INVARIANT (architect-approved):
 *   - Per-asset_id RAF lanes (НЕ глобально) — окремі assets не блокують одне одного.
 *   - Last-wins merge у buffer на frame.
 *   - Drag-end природно проходить через last-wins (без intent flag) — pointermove
 *     передує pointerup за Konva contract → drag-end values перекривають prior pointermoves.
 *
 * ВЗАЄМОДІЯ З Layer A (assetEquality.ts):
 *   Layer A → early return при whitelist-equal (filter ДО batcher)
 *   Layer B → batch consecutive different updates на той самий asset_id у 16ms frame
 *
 * LAW §12 compliance:
 *   RAF batching (16ms) — perf optimization, не "debounce-as-fix" (per Phase O R4 spec
 *   + Phase S PR-3 stroke coalescer pattern review-approved).
 *
 * Replay determinism (INV-9 INV-REBUILD):
 *   Last-wins merge гарантує final state == per-frame state.
 *   Replay player apply'ить ops по seq → bit-equal.
 */
import type { WBAsset } from '../../types/winterboard'

/** Apply callback — викликає реальну mutation + emit op у boardStore. */
export interface UpdateAssetOpts {
  skipHistory?: boolean
}
type ApplyFn = (asset: WBAsset, opts?: UpdateAssetOpts) => void

interface BufferEntry {
  asset: WBAsset
  opts: UpdateAssetOpts | undefined
  apply: ApplyFn
}

/** Per-asset_id buffer (last-wins). Map.set перезаписує entry для того ж id. */
const _buffer = new Map<string, BufferEntry>()

/** Per-asset_id RAF handle. null/undefined = ні scheduled flush. */
const _rafHandles = new Map<string, number>()

/**
 * Schedule RAF flush для конкретного asset_id (one frame ≈ 16ms).
 * Subsequent calls у тому ж frame перезаписують buffer (last-wins) — нова RAF
 * не schedule'иться доки попередня не виконалась.
 *
 * @param asset Incoming asset (after Layer A whitelist check).
 * @param opts updateAsset options (skipHistory, etc.) — last-wins per asset_id.
 * @param applyFn Callback що буде викликаний на flush з final merged asset + final opts.
 *
 * Performance: O(1) для buffer.set + Map.has check. Hot path safe (60 FPS drag).
 */
export function scheduleBufferedUpdate(
  asset: WBAsset,
  opts: UpdateAssetOpts | undefined,
  applyFn: ApplyFn,
): void {
  const id = asset.id
  // Last-wins у frame: новий incoming повністю замінює buffered.
  _buffer.set(id, { asset, opts, apply: applyFn })

  if (_rafHandles.has(id)) {
    // RAF вже scheduled — flush підбере updated buffer.
    return
  }

  const handle = requestAnimationFrame(() => _flushAsset(id))
  _rafHandles.set(id, handle)
}

/**
 * Flush ОДНОГО asset_id — викликається з RAF callback.
 * Видаляє запис з buffer + handles, викликає apply callback з final merged asset.
 */
function _flushAsset(id: string): void {
  const entry = _buffer.get(id)
  // Cleanup ПЕРЕД apply (apply може throw — не залишаємо stale state).
  _buffer.delete(id)
  _rafHandles.delete(id)

  if (entry) {
    try {
      entry.apply(entry.asset, entry.opts)
    } catch (err) {
      console.error('[assetUpdateBatcher] apply callback threw:', err)
    }
  }
}

/**
 * Synchronous flush ВСІХ pending updates. Використовується для:
 *  - cleanup на unmount/route-leave (щоб не втратити last update)
 *  - test setup (deterministic state без RAF wait)
 *  - emergency commit перед navigation
 *
 * Cancels pending RAF handles.
 */
export function flushPendingUpdates(): void {
  // Snapshot ids (бо _flushAsset мутує мapи під час iteration)
  const ids = Array.from(_buffer.keys())
  for (const id of ids) {
    const handle = _rafHandles.get(id)
    if (handle !== undefined) {
      cancelAnimationFrame(handle)
    }
    _flushAsset(id)
  }
}

/**
 * Cancel ВСІХ pending updates без apply (drop). Використовується для:
 *  - replay mode entry (skip pending edit-mode ops)
 *  - test isolation (clear state between tests)
 *  - DESYNC mode entry (per LAW §4 — record() NO-OP, flush() THROW;
 *    pending ops dropped per INV-16)
 */
export function cancelPendingUpdates(): void {
  for (const handle of _rafHandles.values()) {
    cancelAnimationFrame(handle)
  }
  _buffer.clear()
  _rafHandles.clear()
}

/**
 * Test introspection — return current buffer size (number of pending asset_ids).
 * NOT for production use — exposed for tests + observability.
 */
export function _pendingCountForTests(): number {
  return _buffer.size
}

/**
 * Test introspection — check if specific asset_id has pending update.
 */
export function _hasPendingForTests(assetId: string): boolean {
  return _buffer.has(assetId)
}
