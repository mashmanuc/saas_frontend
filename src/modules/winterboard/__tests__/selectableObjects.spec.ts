/**
 * TLV2-05B.1 · згорнуті картки поза виділенням і груповим переміщенням.
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 *
 * У 05B фільтр «згорнуте не виділяється» був вписаний вручну в solo-Ctrl+A й рамку,
 * а класна кімната мала власний Ctrl+A без нього. Згорнута картка потрапляла у
 * виділення, рухалась разом із видимою групою — і після відновлення з'являлась
 * не там, де її згорнули.
 *
 * ІНВАРІАНТИ
 *   INV-SEL-1  одне правило `isAssetSelectable` / `selectableIdsOnPage`
 *   INV-SEL-2  Ctrl+A (спільний для solo й класу) не бере згорнуту картку, бере решту
 *   INV-SEL-3  обидві кімнати кличуть спільний Ctrl+A, а не власну копію
 *   INV-SEL-4  рамка не бере згорнуту картку
 *   INV-SEL-5  груповий рух не зсуває згорнуту картку й не пише їй операцій,
 *              навіть якщо вона вже опинилась у виділенні
 *   INV-SEL-6  після відновлення картка на тих самих x/y
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWBStore } from '../board/state/boardStore'
import { cancelPendingUpdates } from '../board/state/assetUpdateBatcher'
import { isAssetSelectable, selectAllOnCurrentPage, selectableIdsOnPage } from '../board/selectableObjects'
import { minimizedAsset, restoredAsset } from '../board/boardTray'
import { useRectSelect } from '../composables/useRectSelect'
import type { WBAsset, WBStroke } from '../types/winterboard'
import type { RecordOperationRequest } from '../types/replay'

const SRC = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf-8')

function card(id: string, type: string, x: number, y: number, extra: Record<string, unknown> = {}): WBAsset {
  return {
    id, type, src: '', x, y, w: 200, h: 100, rotation: 0, locked: false,
    data: { version: 1, title: id }, ...extra,
  } as unknown as WBAsset
}

function stroke(id: string): WBStroke {
  return {
    id, tool: 'pen', color: '#000', size: 2, opacity: 1,
    points: [{ x: 10, y: 10 }, { x: 20, y: 20 }], locked: false,
  } as unknown as WBStroke
}

describe('INV-SEL-1 · одне правило', () => {
  it('згорнута картка не виділяється; видима, штрих і медіа — так', () => {
    expect(isAssetSelectable(card('t', 'theory_card', 0, 0, { minimized: true }))).toBe(false)
    expect(isAssetSelectable(card('t', 'theory_card', 0, 0))).toBe(true)
    expect(isAssetSelectable(card('t', 'theory_card', 0, 0, { minimized: false }))).toBe(true)
    // Медіа не згортаються — тому й з minimized:true лишаються на полотні й виділяються.
    expect(isAssetSelectable(card('v', 'video_player', 0, 0, { minimized: true }))).toBe(true)
    expect(isAssetSelectable(null)).toBe(false)
  })

  it('id сторінки для виділення: усі штрихи + незгорнуті картки', () => {
    const page = {
      strokes: [stroke('s1')],
      assets: [card('a', 'theory_card', 0, 0), card('m', 'nmt_task', 0, 0, { minimized: true })],
    }
    expect(selectableIdsOnPage(page)).toEqual(['s1', 'a'])
  })
})

describe('store: Ctrl+A, рамка, груповий рух', () => {
  let ops: RecordOperationRequest[]
  let stop: () => void

  beforeEach(() => {
    setActivePinia(createPinia())
    cancelPendingUpdates()
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16) as unknown as number)
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id as never))
  })

  afterEach(() => {
    stop?.()
    cancelPendingUpdates()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  /** Сторінка: видима теорія, згорнута задача (на 500/300), видима капсула, штрих. */
  function seed() {
    const store = useWBStore()
    store.pages = [{
      id: 'page-1', name: '1',
      strokes: [stroke('s1')],
      assets: [
        card('theory', 'theory_card', 100, 100),
        card('task', 'nmt_task', 500, 300, { minimized: true }),
        card('capsule', 'visual_capsule', 900, 100),
      ],
    }] as never
    store.currentPageIndex = 0
    ops = []
    stop = store.onOperation(op => ops.push(op))
    return store
  }

  const find = (store: ReturnType<typeof useWBStore>, id: string) =>
    (store.pages[0].assets as WBAsset[]).find(a => a.id === id)!

  it('INV-SEL-2 · Ctrl+A не бере згорнуту картку, решту — бере', () => {
    const store = seed()
    selectAllOnCurrentPage(store)
    expect(store.selectedIds).toEqual(['s1', 'theory', 'capsule'])
    expect(store.currentTool).toBe('select')
  })

  it('INV-SEL-4 · рамка не бере згорнуту картку', () => {
    const store = seed()
    const rect = useRectSelect(store)
    rect.startRectSelect({ x: 0, y: 0 })
    rect.updateRectSelect({ x: 3000, y: 3000 })
    rect.finishRectSelect()
    expect(store.selectedIds).toEqual(['s1', 'theory', 'capsule'])
  })

  it('INV-SEL-5/6 · груповий рух після Ctrl+A не чіпає згорнуту; відновлена — на старому місці', () => {
    const store = seed()
    selectAllOnCurrentPage(store)
    const rect = useRectSelect(store)
    rect.startMoveSelected({ x: 0, y: 0 })
    rect.updateMoveSelected({ x: 40, y: 25 })
    rect.finishMoveSelected()

    expect([find(store, 'theory').x, find(store, 'theory').y]).toEqual([140, 125])
    expect([find(store, 'capsule').x, find(store, 'capsule').y]).toEqual([940, 125])
    expect([find(store, 'task').x, find(store, 'task').y]).toEqual([500, 300])

    store.updateAsset(restoredAsset(find(store, 'task')))
    vi.advanceTimersByTime(20)
    expect(find(store, 'task').minimized).toBe(false)
    expect([find(store, 'task').x, find(store, 'task').y]).toEqual([500, 300])
  })

  it('INV-SEL-5 · навіть якщо згорнута картка вже у виділенні — не рухається й без операції', () => {
    const store = seed()
    // Застаріле виділення: картку згорнули в іншій вкладці, поки вона була виділена.
    store.selectedIds = ['theory', 'task']
    store.moveSelectedUnlocked(30, 30)
    store.emitMoveOpsForSelected()

    expect([find(store, 'task').x, find(store, 'task').y]).toEqual([500, 300])
    const moved = ops.flatMap(o => ((o.payload as { items?: Array<{ id: string }> }).items ?? []).map(i => i.id))
    expect(moved).toEqual(['theory'])
  })

  it('HTML-шлях групового drag (moveSelected) теж не зсуває згорнуту', () => {
    const store = seed()
    store.selectedIds = ['theory', 'task']
    store.moveSelected(15, 15)
    expect([find(store, 'task').x, find(store, 'task').y]).toEqual([500, 300])
    expect([find(store, 'theory').x, find(store, 'theory').y]).toEqual([115, 115])
  })

  it('згорнути видиму картку після виділення → наступний рух її не зсуває', () => {
    const store = seed()
    store.updateAsset(minimizedAsset(find(store, 'capsule')))
    vi.advanceTimersByTime(20)
    store.selectedIds = ['theory', 'capsule']
    store.moveSelectedUnlocked(50, 0)
    expect(find(store, 'capsule').x).toBe(900)
    expect(find(store, 'theory').x).toBe(150)
  })
})

describe('INV-SEL-3 · обидві кімнати кличуть спільний Ctrl+A', () => {
  it.each([
    'modules/winterboard/views/WBSoloRoom.vue',
    'modules/winterboard/views/WBClassroomRoom.vue',
  ])('%s', (file) => {
    const src = read(file)
    expect(src).toMatch(/function handleSelectAll\(\) \{[\s\S]{0,200}?selectAllOnCurrentPage\(store\)\s*\}/)
    // Власної копії «усі асети сторінки» в кімнаті більше немає.
    expect(src).not.toContain('...page.assets.map(a => a.id)')
  })

  it('рамка й watcher полотна беруть те саме правило', () => {
    expect(read('modules/winterboard/composables/useRectSelect.ts')).toContain('if (!isAssetSelectable(asset)) continue')
    expect(read('modules/winterboard/components/canvas/WBCanvas.vue'))
      .toContain('assets.value.filter(a => !isAssetSelectable(a))')
  })
})
