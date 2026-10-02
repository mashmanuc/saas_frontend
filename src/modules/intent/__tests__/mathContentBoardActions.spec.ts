/**
 * Б-141 на дошці: документ нового матеріалу з'являється в даних об'єкта ЛИШЕ з позначкою сервера
 * (поіменний прапорець INTEGRALYK_MATH_CONTENT_USER_IDS). Без неї — дані байт-у-байт як до Б-141.
 * Правка старим шляхом знімає документ зміненого поля: він уже не відповідає тексту.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

type Asset = { id: string; type: string; data: Record<string, any> }
let pages: { id: string; width: number; height: number; assets: Asset[] }[] = []
const updates: Asset[] = []

vi.mock('@/modules/winterboard/board/state/boardStore', () => ({
  useWBStore: () => ({
    workspaceId: 'ws-1',
    get currentPage() { return pages[pages.length - 1] },
    addAsset: (asset: Asset) => { pages[pages.length - 1].assets.push(asset) },
    updateAsset: (asset: Asset) => {
      updates.push(asset)
      const page = pages[pages.length - 1]
      page.assets = page.assets.map((a) => (a.id === asset.id ? asset : a))
    },
    addStroke: vi.fn(),
    addPageUndoable: vi.fn(),
  }),
}))
vi.mock('@/modules/ship/sceneRecorder', () => ({ recordCompanionScene: vi.fn() }))
vi.mock('@/modules/winterboard/constants/nmt3dDefaults', () => ({ NMT3D_TEMPLATE_LABELS: {} }))

import { runBoardAction } from '../boardActions'

const last = () => pages[0].assets[pages[0].assets.length - 1]

beforeEach(() => {
  pages = [{ id: 'p1', width: 1920, height: 1080, assets: [] }]
  updates.length = 0
})

describe('формула', () => {
  it('без позначки сервера — вставляється як до Б-141, без math_content і без падіння', async () => {
    await runBoardAction({ kind: 'add_formula', payload: { latex: 'x^2' } })
    expect(last().data).toEqual({ version: 1, formula: 'x^2', fontSize: 22, color: '#1e293b', bg: '#f8fafc' })
  })

  it('з позначкою — документ формули під полем formula', async () => {
    await runBoardAction({ kind: 'add_formula', math_contract: 1, payload: { latex: 'x^2' } })
    expect(last().data.math_content).toEqual({
      version: 1, fields: { formula: { version: 1, source: 'x^2', nodes: [{ type: 'math', latex: 'x^2', display: true }] } },
    })
  })

  it('зміна формули старим шляхом знімає документ попередньої формули', async () => {
    await runBoardAction({ kind: 'add_formula', math_contract: 1, payload: { latex: 'x^2' } })
    await runBoardAction({ kind: 'set_param', payload: { object_id: last().id, type: 'formula', value: 'y^3' } })
    const data = updates[updates.length - 1].data
    expect(data.formula).toBe('y^3')
    expect(data).not.toHaveProperty('math_content')
  })

  it('зміна формули з позначкою — новий документ', async () => {
    await runBoardAction({ kind: 'add_formula', math_contract: 1, payload: { latex: 'x^2' } })
    await runBoardAction({ kind: 'set_param', math_contract: 1, payload: { object_id: last().id, type: 'formula', value: 'y^3' } })
    expect(updates[updates.length - 1].data.math_content.fields.formula.source).toBe('y^3')
  })
})

describe('картка', () => {
  it('правка тексту нової картки старим шляхом — документ тексту знято, документ заголовка лишився', async () => {
    await runBoardAction({ kind: 'add_card', math_contract: 1, payload: { title: 'Корені', body: '$x=1$' } })
    await runBoardAction({ kind: 'update_card', payload: { body: 'Інший текст' } })
    const data = updates[updates.length - 1].data
    expect(data.body).toBe('Інший текст')
    expect(Object.keys(data.math_content.fields)).toEqual(['title'])
  })

  it('стара картка без документа, правка старим шляхом — math_content не з’являється', async () => {
    await runBoardAction({ kind: 'add_card', payload: { title: 'T', body: 'B' } })
    await runBoardAction({ kind: 'update_card', payload: { body: 'C' } })
    expect(updates[updates.length - 1].data).not.toHaveProperty('math_content')
  })

  it('правка з позначкою — документ зміненого поля новий, решта лишається', async () => {
    await runBoardAction({ kind: 'add_card', math_contract: 1, payload: { title: 'Корені', body: '$x=1$' } })
    await runBoardAction({ kind: 'update_card', math_contract: 1, payload: { body: '$x=2$' } })
    const fields = updates[updates.length - 1].data.math_content.fields
    expect(fields.body.source).toBe('$x=2$')
    expect(fields.title.source).toBe('Корені')
  })
})
