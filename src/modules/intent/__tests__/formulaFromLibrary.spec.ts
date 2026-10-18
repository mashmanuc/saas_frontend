/**
 * Пакет 2 «один Інтегралик» (19.10): формула з бібліотеки лягає на дошку з назвою й позначеннями.
 *
 * Сервер кладе в `add_formula` ще `title`, `notation` («$a$, $b$ — катети»), `formula_id`; спільний
 * контракт перевіряє назву й позначення так само, як заголовок і текст картки. Тут — що з цього
 * потрапляє в дані картки, що вона малює і що знімається, коли формулу змінили.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import FormulaCardRenderer from '@/modules/winterboard/components/board/objects/FormulaCardRenderer.vue'
import { formulaCardHeight, withFormula } from '@/modules/winterboard/types/formulaCard'

type Asset = { id: string; type: string; h?: number; y?: number; data: Record<string, any> }
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

import { runBoardAction, summarizeAsset } from '../boardActions'

const PYTHAGORAS = {
  latex: 'c^2 = a^2 + b^2',
  title: 'Теорема Піфагора',
  notation: '$a$, $b$ — катети; $c$ — гіпотенуза',
  formula_id: 'geo.pythagoras',
}

const last = () => pages[0].assets[pages[0].assets.length - 1]

beforeEach(() => {
  pages = [{ id: 'p1', width: 1920, height: 1080, assets: [] }]
  updates.length = 0
})

describe('формула з бібліотеки на дошці', () => {
  it('з позначкою сервера — назва, позначення, id і документи всіх трьох полів', async () => {
    await runBoardAction({ kind: 'add_formula', math_contract: 1, payload: { ...PYTHAGORAS } })
    const card = last()
    expect(card.data).toMatchObject({ formula: PYTHAGORAS.latex, title: PYTHAGORAS.title,
      notation: PYTHAGORAS.notation, formula_id: 'geo.pythagoras' })
    expect(Object.keys(card.data.math_content.fields).sort()).toEqual(['formula', 'notation', 'title'])
    expect(card.data.math_content.fields.notation.source).toBe(PYTHAGORAS.notation)
    // Картка вища на рядки назви й позначень — і центр лишається центром.
    expect(card.h).toBe(formulaCardHeight(PYTHAGORAS))
    expect(card.h).toBeGreaterThan(110)
  })

  it('без позначки сервера — ті самі поля, без документа', async () => {
    await runBoardAction({ kind: 'add_formula', payload: { ...PYTHAGORAS } })
    expect(last().data).toMatchObject({ title: PYTHAGORAS.title, notation: PYTHAGORAS.notation })
    expect(last().data).not.toHaveProperty('math_content')
  })

  it('формула не з бібліотеки — картка як раніше, 110 заввишки', async () => {
    await runBoardAction({ kind: 'add_formula', math_contract: 1, payload: { latex: 'x^2' } })
    expect(last().h).toBe(110)
    expect(Object.keys(last().data.math_content.fields)).toEqual(['formula'])
    expect(last().data).not.toHaveProperty('title')
  })

  it('Інтегралик змінив формулу — назва й позначення знімаються; та сама — лишаються', async () => {
    await runBoardAction({ kind: 'add_formula', math_contract: 1, payload: { ...PYTHAGORAS } })
    const id = last().id
    await runBoardAction({ kind: 'set_param', payload: { object_id: id, type: 'formula', value: PYTHAGORAS.latex } })
    expect(updates[updates.length - 1].data.title).toBe(PYTHAGORAS.title)
    await runBoardAction({ kind: 'set_param', payload: { object_id: id, type: 'formula', value: 'y^3' } })
    const data = updates[updates.length - 1].data
    expect(data.formula).toBe('y^3')
    for (const key of ['title', 'notation', 'formula_id']) expect(data).not.toHaveProperty(key)
  })

  it('учитель змінив формулу вручну — так само (withFormula)', () => {
    const data = { formula: PYTHAGORAS.latex, title: 'T', notation: 'N', formula_id: 'id', fontSize: 22 }
    expect(withFormula(data, PYTHAGORAS.latex)).toEqual(data)
    expect(withFormula(data, 'x')).toEqual({ formula: 'x', fontSize: 22 })
  })

  it('назва в описі дошки — «перенеси формулу Піфагора» знаходить картку', () => {
    const label = summarizeAsset({ id: 'f', type: 'formula_card', data: { formula: 'c^2', title: 'Теорема Піфагора' } }).label
    expect(label).toBe('Теорема Піфагора: c^2')
    expect(summarizeAsset({ id: 'g', type: 'formula_card', data: { formula: 'x^2' } }).label).toBe('x^2')
  })
})

describe('картка формули малює назву й позначення', () => {
  const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  const render = (data: Record<string, unknown>) => mount(FormulaCardRenderer, {
    props: { asset: { id: 'f', type: 'formula_card', x: 0, y: 0, w: 380, h: 180, data } as never },
    global: { plugins: [i18n()] },
  })

  it('з бібліотеки — назва зверху, позначення з KaTeX знизу', () => {
    const wrapper = render({ version: 1, formula: PYTHAGORAS.latex, title: PYTHAGORAS.title,
      notation: PYTHAGORAS.notation, fontSize: 22, color: '#1e293b', bg: '#f8fafc' })
    expect(wrapper.find('.formula-card-renderer__title').text()).toBe('Теорема Піфагора')
    const notation = wrapper.find('.formula-card-renderer__notation')
    expect(notation.text()).toContain('катети')
    expect(notation.findAll('.katex').length).toBe(3)
  })

  it('стара картка — ні назви, ні позначень', () => {
    const wrapper = render({ version: 1, formula: 'x^2', fontSize: 22, color: '#1e293b', bg: '#f8fafc' })
    expect(wrapper.find('.formula-card-renderer__title').exists()).toBe(false)
    expect(wrapper.find('.formula-card-renderer__notation').exists()).toBe(false)
  })
})
