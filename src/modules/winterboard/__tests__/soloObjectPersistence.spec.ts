/**
 * TLV2-05A.1 · позиції об'єктів solo-дошки переживають reload.
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 *
 * Дві дії міняли стан, але не лишали операції в журналі:
 *   • груповий рух Konva-шляхом (`useRectSelect.finishMoveSelected`) — HTML-шлях
 *     групового drag операцію емітив, а цей ні;
 *   • усі вирівнювання (`boardStore.applyAlign`).
 * Виглядало це як «дошка з'їхала назад після оновлення сторінки»: у вкладці
 * об'єкти стояли на нових місцях, у журналі — на старих.
 *
 * ІНВАРІАНТИ
 *   INV-POS-1  груповий рух (обидва шляхи) → операція на КОЖЕН змінений об'єкт
 *   INV-POS-2  вирівнювання → те саме, штатним Ops-шляхом
 *   INV-POS-3  reload/replay записаних операцій відтворює ті самі координати
 *   INV-POS-4  заблокований об'єкт не рухається і операцій не отримує
 *   INV-POS-5  клік без руху не породжує операцій
 *   INV-POS-6  одиночне переміщення не регресує (один `asset_update`)
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWBStore } from '../board/state/boardStore'
import { cancelPendingUpdates } from '../board/state/assetUpdateBatcher'
import { useRectSelect } from '../composables/useRectSelect'
import { useAlign } from '../composables/useAlign'
import { applyReplayOperation } from '../engine/applyReplayOperation'
import type { ReplayStoreApi } from '../engine/applyReplayOperation'
import type { WBAsset, WBStroke } from '../types/winterboard'
import type { RecordOperationRequest } from '../types/replay'

type Store = ReturnType<typeof useWBStore>

function asset(id: string, x: number, y: number, locked = false): WBAsset {
  return {
    id, type: 'theory_card', src: '', x, y, w: 200, h: 100,
    rotation: 0, locked, data: { version: 1, title: id },
  } as unknown as WBAsset
}

function stroke(id: string, x: number, y: number): WBStroke {
  return {
    id, tool: 'pen', color: '#000', size: 2, opacity: 1,
    points: [{ x, y }, { x: x + 10, y: y + 10 }], locked: false,
  } as unknown as WBStroke
}

/** Дошка з трьома картками (одна заблокована) і одним штрихом. */
function seed(store: Store): void {
  store.pages = [{
    id: 'page-1',
    name: 'Page 1',
    strokes: [stroke('s1', 0, 0)],
    assets: [asset('a1', 100, 100), asset('a2', 300, 140), asset('locked', 500, 180, true)],
  } as never]
  store.currentPageIndex = 0
}

function capture(store: Store): { ops: RecordOperationRequest[]; stop: () => void } {
  const ops: RecordOperationRequest[] = []
  const stop = store.onOperation(op => ops.push(op))
  return { ops, stop }
}

/** Координати асетів так, як їх побачить дошка після reload (replay журналу). */
function replayInto(ops: RecordOperationRequest[], assets: WBAsset[]): Record<string, { x: number; y: number }> {
  const pinia = createPinia()
  const prev = getActiveStore()
  setActivePinia(pinia)
  const fresh = useWBStore()
  fresh.pages = [{ id: 'page-1', name: 'Page 1', strokes: [], assets: assets.map(a => ({ ...a })) } as never]
  fresh.currentPageIndex = 0
  fresh.setMode('replay')
  ops.forEach((op, i) => {
    applyReplayOperation(fresh as unknown as ReplayStoreApi, {
      id: i + 1, seq: i + 1, op_type: op.op_type, page_id: op.page_id, payload: op.payload,
    } as never)
  })
  const out: Record<string, { x: number; y: number }> = {}
  for (const a of fresh.pages[0].assets as WBAsset[]) out[a.id] = { x: a.x, y: a.y }
  setActivePinia(prev)
  return out
}

let activePinia: ReturnType<typeof createPinia>
const getActiveStore = () => activePinia

describe('TLV2-05A.1 · позиції solo-дошки', () => {
  let store: Store

  beforeEach(() => {
    activePinia = createPinia()
    setActivePinia(activePinia)
    cancelPendingUpdates()
    // Replay без анімації: інакше позиції доїжджають кадрами rAF.
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) } as never)
    store = useWBStore()
    seed(store)
  })

  afterEach(() => {
    cancelPendingUpdates()
    vi.unstubAllGlobals()
  })

  it('INV-POS-1 · груповий рух Konva-шляхом пише операції на кожен об\'єкт', () => {
    store.selectItems(['a1', 'a2', 's1'])
    const rect = useRectSelect(store)
    const { ops, stop } = capture(store)

    rect.startMoveSelected({ x: 0, y: 0 })
    rect.updateMoveSelected({ x: 40, y: 25 })
    expect(ops, 'покадрово операцій бути не повинно').toHaveLength(0)
    rect.finishMoveSelected()
    stop()

    const moves = ops.filter(o => o.op_type === 'objects_move')
    const strokes = ops.filter(o => o.op_type === 'stroke_update')
    expect(moves).toHaveLength(1)
    expect(strokes).toHaveLength(1)
    expect((moves[0].payload as { items: Array<{ id: string; x: number; y: number }> }).items)
      .toEqual([{ id: 'a1', x: 140, y: 125 }, { id: 'a2', x: 340, y: 165 }])
    expect((strokes[0].payload as { stroke: WBStroke }).stroke.id).toBe('s1')
  })

  it('INV-POS-1 · HTML-шлях групового drag виходить тим самим записом', () => {
    store.selectItems(['a1', 'a2'])
    const { ops, stop } = capture(store)
    store.moveSelectedUnlocked(10, 10)
    store.emitMoveOpsForSelected()   // те, що кличе WBCanvas у кінці drag
    stop()
    expect(ops.map(o => o.op_type)).toEqual(['objects_move'])
    expect((ops[0].payload as { items: unknown[] }).items).toHaveLength(2)
  })

  it('INV-POS-2 · вирівнювання пише операції штатним шляхом', () => {
    store.selectItems(['a1', 'a2', 'locked'])
    const align = useAlign(store)
    const { ops, stop } = capture(store)
    align.alignLeft()
    stop()

    const moves = ops.filter(o => o.op_type === 'objects_move')
    expect(moves).toHaveLength(1)
    const items = (moves[0].payload as { items: Array<{ id: string; x: number }> }).items
    // Ліва межа виділення — 100 (a1), тому рухається лише a2: у a1 зміни немає,
    // і зайвої операції він не отримує. Заблокована картка лишається на 500.
    expect(items).toEqual([{ id: 'a2', x: 100, y: 140 }])
  })

  it.each([
    ['alignRight', 'alignRight'], ['alignTop', 'alignTop'], ['alignBottom', 'alignBottom'],
    ['alignCenter', 'alignCenter'], ['alignMiddle', 'alignMiddle'],
  ] as const)('INV-POS-2 · %s теж не лишається без операції', (_name, fn) => {
    store.selectItems(['a1', 'a2'])
    const align = useAlign(store) as unknown as Record<string, () => void>
    const { ops, stop } = capture(store)
    align[fn]()
    stop()
    expect(ops.filter(o => o.op_type === 'objects_move')).toHaveLength(1)
  })

  it('INV-POS-3 · після reload (replay журналу) координати ті самі', () => {
    const before = [asset('a1', 100, 100), asset('a2', 300, 140), asset('locked', 500, 180, true)]
    store.selectItems(['a1', 'a2'])
    const rect = useRectSelect(store)
    const { ops, stop } = capture(store)
    rect.startMoveSelected({ x: 0, y: 0 })
    rect.updateMoveSelected({ x: 60, y: -20 })
    rect.finishMoveSelected()
    useAlign(store).alignTop()
    stop()

    const live = Object.fromEntries(
      (store.pages[0].assets as WBAsset[]).map(a => [a.id, { x: a.x, y: a.y }]))
    expect(replayInto(ops, before)).toEqual(live)
  })

  it('INV-POS-4 · заблокований об\'єкт не рухається і не отримує операцій', () => {
    store.selectItems(['a1', 'locked'])
    const rect = useRectSelect(store)
    const { ops, stop } = capture(store)
    rect.startMoveSelected({ x: 0, y: 0 })
    rect.updateMoveSelected({ x: 30, y: 30 })
    rect.finishMoveSelected()
    stop()

    const locked = (store.pages[0].assets as WBAsset[]).find(a => a.id === 'locked')!
    expect([locked.x, locked.y]).toEqual([500, 180])
    const ids = ops.flatMap(o => ((o.payload as { items?: Array<{ id: string }> }).items ?? []).map(i => i.id))
    expect(ids).toEqual(['a1'])
  })

  it('INV-POS-5 · клік без руху не породжує операцій', () => {
    store.selectItems(['a1', 'a2'])
    const rect = useRectSelect(store)
    const { ops, stop } = capture(store)
    rect.startMoveSelected({ x: 0, y: 0 })
    rect.finishMoveSelected()
    rect.finishMoveSelected()   // повторний mouseup теж нічого не додає
    stop()
    expect(ops).toHaveLength(0)
  })

  it('INV-POS-6 · одиночне переміщення не регресує: один asset_update', async () => {
    const { ops, stop } = capture(store)
    const a1 = (store.pages[0].assets as WBAsset[])[0]
    store.updateAsset({ ...a1, x: 222 }, { skipHistory: true })
    await new Promise(r => setTimeout(r, 40))   // Layer B: RAF-коалесценція
    stop()
    expect(ops.map(o => o.op_type)).toEqual(['asset_update'])
    expect(ops.filter(o => o.op_type === 'objects_move')).toHaveLength(0)
  })

  it('кожен змінений об\'єкт має рівно одну операцію', () => {
    store.selectItems(['a1', 'a2', 's1'])
    const rect = useRectSelect(store)
    const { ops, stop } = capture(store)
    rect.startMoveSelected({ x: 0, y: 0 })
    rect.updateMoveSelected({ x: 15, y: 15 })
    rect.finishMoveSelected()
    stop()

    const touched: string[] = []
    for (const op of ops) {
      const payload = op.payload as { items?: Array<{ id: string }>; stroke?: { id: string } }
      if (payload.items) touched.push(...payload.items.map(i => i.id))
      if (payload.stroke) touched.push(payload.stroke.id)
    }
    expect([...touched].sort()).toEqual(['a1', 'a2', 's1'])
    expect(new Set(touched).size).toBe(touched.length)
  })
})
