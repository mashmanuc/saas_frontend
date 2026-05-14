/**
 * Apply a single replay operation to the board store.
 * Shared between WBSoloRoom, WBClassroomRoom, and WBPublicView.
 *
 * Phase 19 R5 — DRY extraction.
 * P0 FIX (2026-04-09): Instance-scoped via createReplayApplier() factory.
 * Previous global _ensuredPageIds leaked state between concurrent replay instances.
 *
 * All operations are applied with { skipHistory: true } because
 * replay operations are not undoable.
 *
 * === REPLAY INVARIANTS ===
 *
 * 1. DETERMINISTIC: same ops sequence → same final state.
 *    Adding non-determinism (Math.random, Date.now) in apply() WILL break replay.
 *
 * 2. ORDER-SENSITIVE: ops MUST be applied in seq order.
 *    Changing order → invalid state transitions → visual corruption.
 *
 * 3. NO MISSING OPS: skipping ops causes state divergence.
 *    Every recorded op MUST be applied during replay (unknown ops → console.debug, not throw).
 *
 * 4. NO SIDE EFFECTS: apply() must only mutate store state via store methods.
 *    Emitting new ops from apply() → infinite loop (use { silent: true } pattern).
 *
 * 5. NO PAGE RESOLUTION CHANGES without E2E replay testing.
 *    _resolvePageId is the most fragile part — any "cleanup" breaks multi-page replay.
 */
import type { BoardOperation } from '../types/replay'
import type { WBStroke, WBAsset, WBPageBackground, WBPageGridSettings } from '../types/winterboard'
import {
  createSimpleMoveAnimator,
  prefersReducedMotion,
  type MoveAnimator,
  type MoveItem,
} from './animation/MoveAnimator'

// ─── Move animation guards (live in applier, not animator) ─────────────────
// Relax only after careful perf testing. These rules prevent the Option A
// regression (N parallel rAF × per-object mutations) from re-emerging under
// group moves (e.g. 6 cubes = 48 strokes / many assets in a burst).
const MOVE_ANIMATION_MAX_ITEMS = 20
const MOVE_ANIMATION_DURATION_MS = 220

export interface ReplayStoreApi {
  addStroke: (s: WBStroke, opts?: { skipHistory?: boolean }) => void
  updateStroke: (s: WBStroke, opts?: { skipHistory?: boolean }) => void
  deleteStroke: (id: string, opts?: { skipHistory?: boolean }) => void
  // TASK 1 (2026-04-29): pageId required — replay applier passes op.page_id.
  addAsset: (a: WBAsset, pageId: string, opts?: { skipHistory?: boolean }) => void
  updateAsset: (a: WBAsset, opts?: { skipHistory?: boolean }) => void
  deleteAsset: (id: string, opts?: { skipHistory?: boolean }) => void
  addPage: (opts?: {
    name?: string
    background?: WBPageBackground
    backgroundColor?: string
    width?: number
    height?: number
  }) => void
  goToPage: (index: number) => void
  deletePage: (index: number) => void
  clearPage: () => void
  // Phase 20+ board meta ops
  setGridSize: (size: number) => void
  updateCurrentPageGrid: (updates: Partial<WBPageGridSettings>) => void
  setBackgroundColor: (color: string, pageId?: string) => void
  createGroup: (itemIds: string[]) => unknown
  deleteGroup: (groupId: string) => void
  lockItems: (ids: string[]) => void
  unlockItems: (ids: string[]) => void
  bringForward: (id: string) => void
  sendBackward: (id: string) => void
  bringToFront: (id: string) => void
  sendToBack: (id: string) => void
  // Text annotation on objects (interaction layer, not rendering)
  setObjectText: (objectId: string, text: string | undefined, opts?: { silent?: boolean }) => void
  // Replay animation batch write (no emit, no history) — used by MoveAnimator
  applyTransientPositions?: (items: Array<{ id: string; x: number; y: number }>) => void
  currentPageIndex: number
  pages: Array<{ id: string }>
}

/**
 * Optional factory options. `animator` lets callers inject a custom
 * MoveAnimator (e.g. Phase 2 KonvaLayerAnimator). Default is the Phase 1
 * SimpleMoveAnimator (batch rAF against store.applyTransientPositions).
 */
export interface ReplayApplierOptions {
  animator?: MoveAnimator
}

/**
 * Factory: creates an instance-scoped replay applier.
 * Each replay session gets its own page-tracking state — no global leaks.
 *
 * Usage:
 *   const applier = createReplayApplier()
 *   applier.apply(store, op)
 *   applier.markPagesEnsured(pageIds)
 *   applier.reset()
 */
// DEV mode detection — Vite injects import.meta.env.DEV at build time.
// In tests (vitest) DEV is true unless explicitly overridden.
const __DEV__: boolean = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true

// Op types що ОБОВ'ЯЗКОВО потребують op.page_id у новій моделі (per TASK 1+2+4
// hardening 2026-04-29). Якщо op цього типу прийде без page_id у DEV — throw,
// щоб баг ловився одразу під час розробки/тестів. У production — skip+log.
const REQUIRES_PAGE_ID = new Set<string>([
  'asset_add', 'asset_update', 'asset_delete',
  'stroke_add', 'stroke_update', 'stroke_delete',
  'background_update', 'grid_update', 'clear_page',
  'object_update', 'objects_move', 'object_text_update',
  'assets_add_batch', 'strokes_add_batch',
  'page_delete',
  'lock_update', 'group_create', 'group_delete', 'z_order',
])

// Усі op_types які applyReplayOperation реально handle. Якщо BE/FE додасть
// новий op_type і забуде update applier → DEV throw, production console.warn.
// Це catch'не drift "новий op live → ops збережено у DB → replay silently
// skip → user бачить порожній replay".
// Включає легасі diff-format op_types ('add'/'update'/'remove').
const KNOWN_OP_TYPES = new Set<string>([
  ...REQUIRES_PAGE_ID,
  'page_add', 'page_navigate', 'page_change', 'page_reorder',
  'pdf_import', 'geometry_vertex_move',
  // Phase G (2026-05-06): graph_calculator high-frequency param delta (INV-21)
  'graph_param_set',
  // Phase G2 (2026-05-06): interactive points (granular drag only;
  // add/delete = snapshot via asset_update)
  'graph_point_set',
  // Legacy diff-format
  'add', 'update', 'remove',
])

/**
 * Phase G inv-21.12: embed `last_snapshot_seq` у asset.data.meta перед
 * `store.addAsset/updateAsset`. Mutating asset payload IN PLACE гарантує що
 * stamp survive RAF batch flush (post-add stamp губився би на replace).
 *
 * Monotonic: never decreases.
 */
function stampGraphCalculatorMeta(asset: WBAsset, seq: number | null | undefined): void {
  if (asset.type !== 'graph_calculator') return
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq <= 0) return
  const data = (asset.data ?? {}) as { meta?: { last_snapshot_seq?: number } }
  if (!asset.data) (asset as { data: typeof data }).data = data
  if (!data.meta) data.meta = {}
  const cur = (data.meta.last_snapshot_seq as number) ?? 0
  if (seq > cur) data.meta.last_snapshot_seq = seq
}

export function createReplayApplier(opts?: ReplayApplierOptions) {
  const ensuredPageIds = new Set<string>()
  // P0-FIX: Page ID mapping — ops may use different IDs than snapshot.
  // Example: snapshot has page-1, but ops recorded with page-175xxx (page was renamed/recreated).
  // Without mapping, applier creates new blank pages → loses background/assets.
  const pageIdMap = new Map<string, string>() // ops page_id → store page_id
  let _snapshotPageIds: string[] = [] // ordered snapshot page IDs for positional mapping

  // Replay metrics (помічник 2026-04-29): track applied vs skipped ratio.
  // ratio < 1 → ops були skipped → можливо bug у emit/store/timeline.
  let _appliedCount = 0
  let _skippedCount = 0

  // Move animator: injected or lazy-initialized on first move op.
  // See MoveAnimator.ts for contract + Phase 1 / Phase 2 evolution.
  let _animator: MoveAnimator | null = opts?.animator ?? null

  function _getAnimator(store: ReplayStoreApi): MoveAnimator | null {
    if (_animator) return _animator
    // Lazy-init default SimpleMoveAnimator ONLY if store supports batch writes.
    if (typeof store.applyTransientPositions !== 'function') return null
    // CRITICAL: pass LIVE store getters, not captured values. currentPageIndex
    // changes during replay (page_navigate), and snapshot-time capture would
    // point at the wrong page on later ops.
    const applyBatch = store.applyTransientPositions
    const liveRef = store as unknown as {
      currentPageIndex: number
      pages: Array<{ id: string; assets?: Array<{ id: string; x?: number; y?: number }> }>
    }
    _animator = createSimpleMoveAnimator({
      get currentPageIndex() { return liveRef.currentPageIndex },
      get pages() { return liveRef.pages },
      applyTransientPositions: applyBatch,
    })
    return _animator
  }

  function reset(): void {
    ensuredPageIds.clear()
    pageIdMap.clear()
    _snapshotPageIds = []
    _appliedCount = 0
    _skippedCount = 0
    // Cancel any in-flight move animation — on seek/reset we apply snapshot
    // state and intermediate frames must not trail behind.
    if (_animator) _animator.cancel()
  }

  function getStats(): {
    applied: number
    skipped: number
    total: number
    ratio: number
  } {
    const total = _appliedCount + _skippedCount
    // DEV sanity: counters не повинні розходитись (early-return до інкременту,
    // exception-eaten branch тощо). Помічник 2026-04-29 hardening.
    if (__DEV__ && total !== _appliedCount + _skippedCount) {
      throw new Error(
        `[Replay DEV] counter mismatch: total=${total} ` +
        `applied=${_appliedCount} skipped=${_skippedCount}`,
      )
    }
    return {
      applied: _appliedCount,
      skipped: _skippedCount,
      total,
      ratio: total > 0 ? _appliedCount / total : 1,
    }
  }

  function markPagesEnsured(pageIds: string[]): void {
    _snapshotPageIds = pageIds.filter(Boolean)
    for (const id of _snapshotPageIds) {
      ensuredPageIds.add(id)
    }
  }

  /**
   * Resolve op.page_id to actual store page_id.
   * Handles mismatch between recording ops and snapshot state.
   */
  function _resolvePageId(opPageId: string, store: ReplayStoreApi): string {
    // 1. Direct match — op page_id exists in store
    if (store.pages.some(p => p.id === opPageId)) return opPageId
    // 2. Already mapped from previous op
    if (pageIdMap.has(opPageId)) return pageIdMap.get(opPageId)!
    // 3. Positional mapping — first unmapped op page_id maps to first unmapped snapshot page
    const mappedSnapshotIds = new Set(pageIdMap.values())
    const unmappedSnapshot = _snapshotPageIds.find(id => !mappedSnapshotIds.has(id))
    if (unmappedSnapshot && store.pages.some(p => p.id === unmappedSnapshot)) {
      pageIdMap.set(opPageId, unmappedSnapshot)
      ensuredPageIds.add(opPageId)
      return unmappedSnapshot
    }
    // 4. Fallback: single-page adopt (legacy compat)
    if (store.pages.length === 1 && ensuredPageIds.size === 0) {
      const adoptId = store.pages[0].id
      pageIdMap.set(opPageId, adoptId)
      ensuredPageIds.add(opPageId)
      return adoptId
    }
    // 5. No match — return original (will trigger addPage below)
    return opPageId
  }

  function apply(store: ReplayStoreApi, op: BoardOperation): void {
    const payload = op.payload as Record<string, unknown>

    // DEV invariant (помічник 2026-04-29): hard-fail у dev/test якщо op
    // конкретного типу прийшов без page_id. Catches emit-side bugs одразу
    // (наприклад callsite який забув передати page_id у новій моделі).
    // Production: counter incremented + skip — replay не блокується через
    // 1 broken op.
    if (__DEV__ && REQUIRES_PAGE_ID.has(op.op_type) && !op.page_id) {
      throw new Error(
        `[Replay DEV] op.page_id missing for op_type='${op.op_type}' — ` +
        `emit-side bug? Op id=${(op as { id?: number | string }).id}`,
      )
    }

    // KNOWN_OP_TYPES guard (помічник 2026-04-29 round 2): drift detection.
    // Новий op_type emitted backend/frontend без update applier → silently
    // skipped. У DEV — throw; у production — console.warn (один раз бачимо у logs).
    if (!KNOWN_OP_TYPES.has(op.op_type)) {
      const msg = `[Replay] unknown op_type='${op.op_type}' — applier needs update`
      if (__DEV__) throw new Error(msg)
      console.warn(msg, { opId: (op as { id?: number | string }).id })
    }

    // Counter flag (помічник 2026-04-29 metric): за замовчуванням op applied.
    // Skip points (warning + break) ставлять `opApplied = false` явно. Default
    // case (unknown op_type) теж count як skipped.
    let opApplied = true

    // P0-FIX: Resolve page by op.page_id with ID mapping + lazy auto-create.
    // TASK 2 hardening (2026-04-29): resolvedPageId hoisted у switch scope так,
    // щоб handlers (asset_add тощо) могли передавати mapped id, не raw op.page_id
    // (інакше addAsset fail-fast throw, бо page під raw id не існує).
    let resolvedPageId = op.page_id
    if (op.page_id && op.op_type !== 'page_add') {
      resolvedPageId = _resolvePageId(op.page_id, store)
      let targetIdx = store.pages.findIndex((p) => p.id === resolvedPageId)
      if (targetIdx < 0) {
        // Page truly doesn't exist — create new
        store.addPage({ background: 'white' })
        const lastPage = store.pages[store.pages.length - 1]
        if (lastPage) {
          (lastPage as { id: string }).id = resolvedPageId
        }
        targetIdx = store.pages.length - 1
        ensuredPageIds.add(op.page_id)
      }
      if (targetIdx >= 0 && targetIdx !== store.currentPageIndex) {
        store.goToPage(targetIdx)
      }
    }

    switch (op.op_type) {
      case 'stroke_add':
        if (payload.stroke)
          store.addStroke(payload.stroke as WBStroke, { skipHistory: true })
        break

      case 'stroke_update':
        if (payload.stroke)
          store.updateStroke(payload.stroke as WBStroke, { skipHistory: true })
        break

      case 'stroke_delete':
        if (payload.stroke_id)
          store.deleteStroke(payload.stroke_id as string, { skipHistory: true })
        break

      case 'asset_add': {
        // TASK 2 (2026-04-29): use resolvedPageId (post-mapping), not raw
        // op.page_id, інакше addAsset fail-fast throw на нерезольвлений id.
        if (payload.asset && resolvedPageId) {
          const a = payload.asset as WBAsset
          // Phase G inv-21.12: embed last_snapshot_seq у asset.data.meta BEFORE
          // store.addAsset, бо updateAsset uses RAF batch — пост-stamp губився
          // би при flush replace.
          stampGraphCalculatorMeta(a, op.seq)
          store.addAsset(a, resolvedPageId, { skipHistory: true })
        }
        break
      }

      case 'asset_update': {
        if (payload.asset) {
          const a = payload.asset as WBAsset
          stampGraphCalculatorMeta(a, op.seq)
          store.updateAsset(a, { skipHistory: true })
        }
        break
      }

      case 'asset_delete':
        if (payload.asset_id)
          store.deleteAsset(payload.asset_id as string, { skipHistory: true })
        break

      case 'page_add': {
        const pageData = payload.page as Record<string, unknown> | undefined
        if (pageData) {
          const originalId = (pageData.id as string) || op.page_id || ''
          if (originalId && ensuredPageIds.has(originalId)) {
            const existingIdx = store.pages.findIndex((p) => p.id === originalId)
            if (existingIdx >= 0 && existingIdx !== store.currentPageIndex) {
              store.goToPage(existingIdx)
            }
            break
          }
          store.addPage({
            name: (pageData.name as string) ?? '',
            background: (pageData.background as WBPageBackground) ?? 'white',
            backgroundColor: (pageData.backgroundColor as string | undefined),
            width: pageData.width as number | undefined,
            height: pageData.height as number | undefined,
          })
          if (originalId) {
            const lastPage = store.pages[store.pages.length - 1]
            if (lastPage) {
              (lastPage as { id: string }).id = originalId
            }
            ensuredPageIds.add(originalId)
          }
        }
        break
      }

      case 'page_navigate':
      case 'page_change':
        if (typeof payload.pageIndex === 'number') {
          store.goToPage(payload.pageIndex)
        } else if (typeof payload.page_index === 'number') {
          store.goToPage(payload.page_index)
        }
        break

      case 'page_delete':
        if (payload.page_id) {
          const idx = store.pages.findIndex((p) => p.id === payload.page_id)
          if (idx >= 0) store.deletePage(idx)
        }
        break

      case 'clear_page':
        if (op.page_id) {
          const idx = store.pages.findIndex((p) => p.id === op.page_id)
          if (idx >= 0) {
            store.goToPage(idx)
            store.clearPage()
          }
        }
        break

      case 'grid_update':
        if (typeof payload.gridSize === 'number') {
          store.setGridSize(payload.gridSize)
        } else if (payload.grid && typeof payload.grid === 'object') {
          store.updateCurrentPageGrid(payload.grid as Partial<WBPageGridSettings>)
        }
        break

      case 'background_update':
        if (typeof payload.color === 'string') {
          // Fix 2026-04-29: pass op.page_id so setBackgroundColor targets
          // correct page, NOT currentPageIndex (wrong during replay seek).
          store.setBackgroundColor(payload.color, (op as { page_id?: string }).page_id)
        }
        break

      case 'group_create':
        if (Array.isArray(payload.itemIds) && payload.itemIds.length > 0) {
          store.createGroup(payload.itemIds as string[])
        }
        break

      case 'group_delete':
        if (typeof payload.group_id === 'string') {
          store.deleteGroup(payload.group_id)
        }
        break

      case 'lock_update':
        if (Array.isArray(payload.ids)) {
          if (payload.locked === true) {
            store.lockItems(payload.ids as string[])
          } else {
            store.unlockItems(payload.ids as string[])
          }
        }
        break

      case 'z_order': {
        const objectId = payload.object_id as string | undefined
        const action = payload.action as string | undefined
        if (!objectId || !action) break
        switch (action) {
          case 'bringForward':  store.bringForward(objectId); break
          case 'sendBackward':  store.sendBackward(objectId); break
          case 'bringToFront':  store.bringToFront(objectId); break
          case 'sendToBack':    store.sendToBack(objectId); break
        }
        break
      }

      // Legacy diff-save format
      case 'add':
      case 'update':
      case 'remove': {
        const kind = payload.kind as string | undefined
        const value = (payload.value ?? {}) as Record<string, unknown>
        const itemId = payload.id as string | undefined
        if (kind === 'stroke') {
          if (op.op_type === 'add' && value)
            store.addStroke(value as unknown as WBStroke, { skipHistory: true })
          else if (op.op_type === 'update' && value)
            store.updateStroke(value as unknown as WBStroke, { skipHistory: true })
          else if (op.op_type === 'remove' && itemId)
            store.deleteStroke(itemId, { skipHistory: true })
        } else if (kind === 'asset') {
          if (op.op_type === 'add' && value && resolvedPageId)
            store.addAsset(value as unknown as WBAsset, resolvedPageId, { skipHistory: true })
          else if (op.op_type === 'update' && value)
            store.updateAsset(value as unknown as WBAsset, { skipHistory: true })
          else if (op.op_type === 'remove' && itemId)
            store.deleteAsset(itemId, { skipHistory: true })
        }
        break
      }

      // Phase G (2026-05-06): graph_calculator high-frequency param delta.
      // Per OPS_SYNC_SSOT.md INV-21 + STORE-RULES 6/10:
      //   - inv-21.12 race guard: drop op silently if base_seq < current
      //     asset.data.meta.last_snapshot_seq (BE drops too — defence-in-depth)
      //   - skipEmit:true (replay path mutation only, no echo)
      case 'graph_param_set': {
        const assetId = payload.asset_id as string | undefined
        const name = payload.name as string | undefined
        const value = payload.value as number | undefined
        const baseSeq = payload.base_seq as number | undefined
        if (!assetId || typeof name !== 'string' || typeof value !== 'number') break

        // STORE-RULE-10 race guard (FE-side): if asset has newer snapshot
        // already applied locally (e.g. interleaved broadcast) → drop stale.
        let isStale = false
        for (const page of store.pages) {
          const asset = page.assets.find((a) => a.id === assetId)
          if (!asset) continue
          if (asset.type !== 'graph_calculator') break
          const meta = (asset.data as { meta?: { last_snapshot_seq?: number } } | undefined)
            ?.meta
          const lastSnap = (meta?.last_snapshot_seq as number) ?? 0
          if (typeof baseSeq === 'number' && baseSeq < lastSnap) isStale = true
          break
        }
        if (isStale) {
          opApplied = false
          break
        }

        // STORE-RULE-3: skipEmit blocks emit; mutates local state only.
        if ('graphParamSet' in store) {
          ;(store as unknown as {
            graphParamSet: (
              id: string,
              name: string,
              value: number,
              opts?: { skipEmit?: boolean },
            ) => void
          }).graphParamSet(assetId, name, value, { skipEmit: true })
        }
        break
      }

      // Phase G2 (2026-05-06): interactive points — ONLY graph_point_set
      // (granular drag delta). add/delete arrive як asset_update snapshot.
      case 'graph_point_set': {
        const assetId = payload.asset_id as string | undefined
        const id = payload.id as string | undefined
        const x = payload.x as number | undefined
        const y = payload.y as number | undefined  // optional (onCurve omits y)
        const baseSeq = payload.base_seq as number | undefined
        if (!assetId || !id || typeof x !== 'number') break
        // Race guard: drop if base_seq < current last_snapshot_seq
        let isStale = false
        for (const page of store.pages) {
          const a = page.assets.find((x2) => x2.id === assetId)
          if (!a) continue
          if (a.type !== 'graph_calculator') break
          const meta = (a.data as { meta?: { last_snapshot_seq?: number } } | undefined)?.meta
          const lastSnap = (meta?.last_snapshot_seq as number) ?? 0
          if (typeof baseSeq === 'number' && baseSeq < lastSnap) isStale = true
          break
        }
        if (isStale) { opApplied = false; break }
        if ('graphPointSet' in store) {
          ;(store as any).graphPointSet(assetId, id, x, y, { skipEmit: true })
        }
        break
      }

      // Legacy GeoBoard geometry_vertex_move (removed 2026-05-14 cleanup) —
      // у replay сесій до cleanup'а ці ops просто пропускаються. Старий
      // geometry_2d type більше не рендериться → vertex updates безсенсовні.
      case 'geometry_vertex_move': {
        // intentional no-op для backward compat replay log
        break
      }

      // P0.5: Generic object property update (drag, resize, rotate, color, etc.)
      case 'object_update': {
        const objId = payload.id as string
        const kind = payload.kind as string
        const changes = payload.changes as Record<string, unknown>
        if (!objId || !changes) break
        // TASK 4 (2026-04-29 strict): replay isolation — skip+log якщо
        // op.page_id missing. NO currentPageIndex fallback (UI state).
        if (!resolvedPageId) {
          console.warn('[Replay] object_update skipped — no op.page_id', { objId })
          opApplied = false
          break
        }
        const targetPageIdx = store.pages.findIndex((p) => p.id === resolvedPageId)
        if (targetPageIdx < 0) break
        const pageData = store.pages[targetPageIdx] as unknown as {
          strokes?: WBStroke[]; assets?: WBAsset[]
        }
        if (!pageData) break
        if (kind === 'stroke') {
          const stroke = pageData.strokes?.find((s) => s.id === objId)
          if (stroke) {
            store.updateStroke({ ...stroke, ...changes } as WBStroke, { skipHistory: true })
          }
        } else if (kind === 'asset') {
          const asset = pageData.assets?.find((a) => a.id === objId)
          if (asset) {
            store.updateAsset({ ...asset, ...changes } as WBAsset, { skipHistory: true })
          }
        }
        break
      }

      // Batch add: paste/duplicate — ONE mutation for all items (no "typing" effect)
      case 'assets_add_batch': {
        const batchAssets = payload.assets as WBAsset[]
        if (!Array.isArray(batchAssets) || batchAssets.length === 0) break
        // TASK 4 strict: NO currentPageIndex fallback у replay.
        if (!resolvedPageId) {
          console.warn('[Replay] assets_add_batch skipped — no op.page_id')
          opApplied = false
          break
        }
        const batchPageIdx = store.pages.findIndex((p) => p.id === resolvedPageId)
        if (batchPageIdx < 0) break
        const pageData = store.pages[batchPageIdx] as unknown as { assets?: WBAsset[] }
        if (!pageData) break
        ;(store as unknown as { pages: Array<Record<string, unknown>> }).pages[batchPageIdx] = {
          ...pageData,
          assets: [...(pageData.assets ?? []), ...batchAssets],
        }
        break
      }

      case 'strokes_add_batch': {
        const batchStrokes = payload.strokes as WBStroke[]
        if (!Array.isArray(batchStrokes) || batchStrokes.length === 0) break
        if (!resolvedPageId) {
          console.warn('[Replay] strokes_add_batch skipped — no op.page_id')
          opApplied = false
          break
        }
        const sBatchPageIdx = store.pages.findIndex((p) => p.id === resolvedPageId)
        if (sBatchPageIdx < 0) break
        const pageData = store.pages[sBatchPageIdx] as unknown as { strokes?: WBStroke[] }
        if (!pageData) break
        ;(store as unknown as { pages: Array<Record<string, unknown>> }).pages[sBatchPageIdx] = {
          ...pageData,
          strokes: [...(pageData.strokes ?? []), ...batchStrokes],
        }
        break
      }

      // Move assets by absolute position (idempotent, assets only, max 50)
      //
      // Phase 1 animation: route through MoveAnimator when guards pass,
      // fall back to instant apply otherwise. Strokes are NOT animated here
      // (future Phase 2 scope). See MoveAnimator.ts for invariants.
      case 'objects_move': {
        const moveItems = payload.items as Array<{ id: string; x: number; y: number }>
        if (!Array.isArray(moveItems) || moveItems.length === 0) break
        if (!resolvedPageId) {
          console.warn('[Replay] objects_move skipped — no op.page_id')
          opApplied = false
          break
        }
        const movePageIdx = store.pages.findIndex((p) => p.id === resolvedPageId)
        if (movePageIdx < 0) break
        const movePage = store.pages[movePageIdx] as unknown as {
          assets?: WBAsset[]
        }
        if (!movePage?.assets) break

        // ─── Guards (cheap short-circuit to instant apply) ────────────────
        const animator = _getAnimator(store)
        const shouldAnimate =
          animator !== null &&
          moveItems.length <= MOVE_ANIMATION_MAX_ITEMS &&
          !prefersReducedMotion()

        if (!shouldAnimate) {
          // Instant apply — current canonical path (no reactivity per-frame).
          for (const item of moveItems) {
            const asset = movePage.assets.find((a) => a.id === item.id)
            if (!asset) continue
            store.updateAsset({ ...asset, x: item.x, y: item.y } as WBAsset, { skipHistory: true })
          }
          break
        }

        // ─── Animated path ────────────────────────────────────────────────
        // Fire-and-forget: applier stays synchronous. If a new op arrives
        // for the same items, animator.cancel() auto-fires from animate()
        // re-entry. On reset/seek, applier.reset() cancels too.
        const animItems: MoveItem[] = moveItems.map((m) => ({
          id: m.id,
          kind: 'asset',
          x: m.x,
          y: m.y,
        }))
        // Canonical final commit — idempotent, safe even after SimpleAnimator
        // (last frame already wrote targets). Required for future Konva-based
        // animators that never touch the store during animation.
        const commitFinal = (): void => {
          // Re-read TARGET page (resolvedPageId), not UI nav state.
          if (!resolvedPageId) return
          const finalPageIdx = store.pages.findIndex((p) => p.id === resolvedPageId)
          if (finalPageIdx < 0) return
          const curPage = store.pages[finalPageIdx] as unknown as {
            assets?: WBAsset[]
          }
          if (!curPage?.assets) return
          for (const item of moveItems) {
            const asset = curPage.assets.find((a) => a.id === item.id)
            if (!asset) continue
            // Skip if already at target (avoids needless reactive churn).
            if (asset.x === item.x && asset.y === item.y) continue
            store.updateAsset({ ...asset, x: item.x, y: item.y } as WBAsset, { skipHistory: true })
          }
        }
        animator!
          .animate(animItems, { duration: MOVE_ANIMATION_DURATION_MS })
          .then(commitFinal)
          .catch(() => commitFinal())
        break
      }

      // Page reorder — set absolute page order by ID array
      case 'page_reorder': {
        const pageIds = payload.pageIds as string[]
        if (!Array.isArray(pageIds)) break
        const pageMap = new Map(store.pages.map((p) => [p.id, p]))
        const reordered = pageIds.map((id) => pageMap.get(id)).filter(Boolean)
        if (reordered.length > 0) {
          ;(store as any).pages = reordered
          // Stay on current page if possible
          const curId = store.pages[store.currentPageIndex]?.id
          if (curId) {
            const idx = store.pages.findIndex((p) => p.id === curId)
            if (idx !== -1) store.goToPage(idx)
          }
        }
        break
      }

      // PDF import — add pages with PDF backgrounds
      case 'pdf_import': {
        const importPages = payload.pages as Array<{
          id: string; name: string;
          background: { type: string; url: string; assetId?: string };
          width?: number; height?: number
        }>
        if (!Array.isArray(importPages)) break
        for (const pg of importPages) {
          store.addPage({
            name: pg.name,
            background: pg.background as WBPageBackground,
            width: pg.width,
            height: pg.height,
          })
          // Set correct ID
          const lastPage = store.pages[store.pages.length - 1]
          if (lastPage && pg.id) {
            (lastPage as { id: string }).id = pg.id
          }
        }
        break
      }

      // Text annotation on objects (interaction layer)
      case 'object_text_update': {
        const objId = payload.object_id as string
        const text = payload.text as string | null
        if (!objId) break
        // silent: true — replay НЕ створює нові ops (infinite loop guard)
        store.setObjectText(objId, text ?? undefined, { silent: true })
        break
      }

      default:
        console.debug('[Replay] unknown op:', op.op_type)
        opApplied = false
    }

    if (opApplied) _appliedCount++
    else _skippedCount++
  }

  return { apply, reset, markPagesEnsured, getStats }
}

// ── Backwards compat: global singleton for boardStore.resetForReplay() ──
// boardStore calls resetReplayAdoptedPages() which needs a global handle.
// Views should use createReplayApplier() instead.
const _globalApplier = createReplayApplier()

/** @deprecated Use createReplayApplier() instead */
export function applyReplayOperation(store: ReplayStoreApi, op: BoardOperation): void {
  _globalApplier.apply(store, op)
}

/** @deprecated Use createReplayApplier().reset() instead */
export function resetReplayAdoptedPages(): void {
  _globalApplier.reset()
}

/** @deprecated Use createReplayApplier().markPagesEnsured() instead */
export function markReplayPagesEnsured(pageIds: string[]): void {
  _globalApplier.markPagesEnsured(pageIds)
}
