/**
 * «Складові» й інші дії «що показати далі» — на сторінку ОДРАЗУ після поточної
 * (власник 2026-10-06: «складові появилися… на останній сторінці. А мали б на наступній»).
 *
 * `addPageUndoable({ afterCurrent: true })` — вставка за поточною з переходом, ↶ і штатним
 * `page_add` з `insertAt` (як «Дублювати сторінку»). Без прапорця — як було: у кінець,
 * `page_add` без `insertAt`. Дії «що показати далі» відкривають сторінку через
 * `openPageForPlan`, і та тепер просить саме вставку за поточною.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWBStore } from '../board/state/boardStore'
import type { RecordOperationRequest } from '../types/replay'

function seed(store: ReturnType<typeof useWBStore>, current = 1) {
  store.pages = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase(), strokes: [], assets: [] }))
  store.currentPageIndex = current
}

function track(store: ReturnType<typeof useWBStore>) {
  const ops: RecordOperationRequest[] = []
  store.onOperation((op) => ops.push(op))
  return ops
}

const pageAdds = (ops: RecordOperationRequest[]) => ops.filter((o) => o.op_type === 'page_add')

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('addPageUndoable({ afterCurrent: true }) — одразу після поточної', () => {
  it('сторінка стає наступною за поточною, екран переходить на неї, op несе insertAt', () => {
    const store = useWBStore()
    seed(store, 1)
    const ops = track(store)
    const id = store.addPageUndoable({ name: 'Річ Посполита — Складові', afterCurrent: true })
    expect(store.pages.map((p) => p.id)).toEqual(['a', 'b', id, 'c', 'd'])
    expect(store.currentPageIndex).toBe(2)
    const [op] = pageAdds(ops)
    expect(op.payload).toMatchObject({ page: { id, name: 'Річ Посполита — Складові' }, insertAt: 2 })
  })

  it('↶ прибирає сторінку й повертає на ту, з якої її відкрили; ↷ ставить на те саме місце', () => {
    const store = useWBStore()
    seed(store, 1)
    const ops = track(store)
    const id = store.addPageUndoable({ afterCurrent: true })
    store.undo()
    expect(store.pages.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(store.currentPageIndex).toBe(1)
    expect(ops.some((o) => o.op_type === 'page_delete' && o.page_id === id)).toBe(true)
    store.redo()
    expect(store.pages.map((p) => p.id)).toEqual(['a', 'b', id, 'c', 'd'])
    expect(store.currentPageIndex).toBe(2)
    const adds = pageAdds(ops)
    expect(adds[adds.length - 1]?.payload).toMatchObject({ insertAt: 2 })
  })

  it('з останньої сторінки — та сама поведінка, що й «у кінець»', () => {
    const store = useWBStore()
    seed(store, 3)
    const id = store.addPageUndoable({ afterCurrent: true })
    expect(store.pages.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd', id])
    expect(store.currentPageIndex).toBe(4)
  })
})

describe('без прапорця — як було', () => {
  it('у кінець, перехід на неї, page_add без insertAt', () => {
    const store = useWBStore()
    seed(store, 1)
    const ops = track(store)
    const id = store.addPageUndoable({ name: 'Нова' })
    expect(store.pages.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd', id])
    expect(store.currentPageIndex).toBe(4)
    expect(pageAdds(ops)[0].payload).not.toHaveProperty('insertAt')
  })
})

describe('openPageForPlan — для дій «що показати далі»', () => {
  it('просить сторінку одразу після поточної', async () => {
    const store = useWBStore()
    seed(store, 0)
    const spy = vi.spyOn(store, 'addPageUndoable')
    const { openPageForPlan } = await import('@/modules/intent/boardActions')
    await openPageForPlan('Річ Посполита — Складові')
    expect(spy).toHaveBeenCalledWith({ name: 'Річ Посполита — Складові', afterCurrent: true })
    expect(store.pages[1].name).toBe('Річ Посполита — Складові')
    expect(store.currentPageIndex).toBe(1)
  })
})

describe('addPageUndoable({ inheritLook: true }) — сторінка продовження розв\'язку рукою (власник 2026-10-18)', () => {
  it('бере вигляд поточної: колір, візерунок, розмір; колір іде в page_add', () => {
    const store = useWBStore()
    seed(store, 1)
    Object.assign(store.pages[1], { background: 'grid', backgroundColor: '#dbeafe', width: 1600, height: 900 })
    const ops = track(store)
    const id = store.addPageUndoable({ afterCurrent: true, inheritLook: true })
    const page = store.pages.find((p) => p.id === id)!
    expect(page).toMatchObject({ background: 'grid', backgroundColor: '#dbeafe', width: 1600, height: 900 })
    expect(pageAdds(ops)[0].payload).toMatchObject({ page: { background: 'grid', backgroundColor: '#dbeafe' } })
  })

  it('фото чи PDF у фоні не копіюється (це вміст сторінки) — лишається колір', () => {
    const store = useWBStore()
    seed(store, 1)
    Object.assign(store.pages[1], {
      background: { type: 'image', url: 'https://cdn.m4sh.org/p.png', assetId: 'img-1' }, backgroundColor: '#fce7f3',
      width: 1240, height: 1754,
    })
    const id = store.addPageUndoable({ afterCurrent: true, inheritLook: true })
    const page = store.pages.find((p) => p.id === id)!
    expect(page).toMatchObject({ background: 'white', backgroundColor: '#fce7f3' })
    expect(page.width).toBeUndefined()
  })

  it('без прапорця — як було: біла сторінка, колір у page_add не шлемо', () => {
    const store = useWBStore()
    seed(store, 1)
    Object.assign(store.pages[1], { background: 'dots', backgroundColor: '#dcfce7' })
    const ops = track(store)
    const id = store.addPageUndoable({ afterCurrent: true })
    expect(store.pages.find((p) => p.id === id)).toMatchObject({ background: 'white', backgroundColor: '#ffffff' })
    expect((pageAdds(ops)[0].payload as any).page.backgroundColor).toBeUndefined()
  })
})
