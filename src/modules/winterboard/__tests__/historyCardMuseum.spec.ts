/**
 * «Музейна етикетка» — довідка про людину однією карткою (власник 2026-10-21, дизайн «Картки Інтегралика», A).
 *
 * Стереже:
 *   1. Етикетка показує те, що дав сервер: три факти, суть, дати, джерело з «Детальніше».
 *   2. Портрет — лише з автором і ліцензією, і підпис під ним їх показує (ТЗ §6.1).
 *   3. Зламаний вміст етикетки не малюється: картка лишається звичайною.
 *   4. На дошці вона — зменшена копія самої себе (композиція 880×560), а не розсипаний текст;
 *      дві людини стають поруч на аркуші, а не одна поверх одної.
 */
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let page: { id: string; width: number; height: number; assets: any[] }

vi.mock('@/modules/winterboard/board/state/boardStore', () => ({
  useWBStore: () => ({
    workspaceId: 'ws-1',
    zoom: 1,
    get currentPage() { return page },
    addAsset: (a: unknown) => { page.assets.push(a) },
    addStroke: vi.fn(),
    updateAsset: vi.fn(),
  }),
}))
vi.mock('@/modules/ship/sceneRecorder', () => ({ recordCompanionScene: vi.fn() }))
vi.mock('@/modules/winterboard/constants/nmt3dDefaults', () => ({ NMT3D_TEMPLATE_LABELS: {} }))

import HistoryCardRenderer from '../components/board/objects/HistoryCardRenderer.vue'
import { fitMeasureZoom, isMuseumCard, isZoomScaledCard } from '../composables/cardZoom'
import { planFitsCurrentPage, runBoardAction, sanitizeMuseum } from '../../intent/boardActions'
import type { HistoryCardData, WBAsset } from '../types/winterboard'

const MUSEUM = {
  category: 'Історія України · Київська Русь',
  facts: [
    { value: '979—1015', label: 'великий князь київський' },
    { value: '988', label: 'хрещення Русі' },
    { value: '«тризуб»', label: 'особистий знак' },
  ],
  summary: 'Ініціював хрещення Русі й збудував Десятинну церкву.',
  timeline: [
    { year: '977—979', label: 'боротьба за престол' },
    { year: '988', label: 'хрещення Русі' },
    { year: '996', label: 'Десятинна церква' },
  ],
}
const IMAGE = {
  url: 'https://upload.wikimedia.org/x/960px-Volodymyr.jpg',
  author: 'Микола Аркас. Історія України-Русі (1912)',
  license: 'Public domain',
  attribution: 'Микола Аркас. Історія України-Русі (1912) · Public domain',
  file_page: 'https://commons.wikimedia.org/wiki/File:Volodymyr.jpg',
}
const SOURCE = {
  provider: 'wikipedia', title: 'Володимир Святославич', url: 'https://uk.wikipedia.org/wiki/Володимир',
  license: 'CC BY-SA 4.0',
}
const DATA: Partial<HistoryCardData> = {
  variant: 'person', title: 'Володимир Святославич', subtitle: 'Володимир Великий · Хреститель Русі',
  image: IMAGE, primary: [], sources: [SOURCE as any], museum: MUSEUM,
}

function render(data: Partial<HistoryCardData>, props: Record<string, unknown> = {}) {
  const asset = {
    id: 'hc1', type: 'history_card', src: '', x: 0, y: 0, w: 880, h: 560, rotation: 0, locked: false,
    data: { version: 1, variant: 'person', title: '', primary: [], ...data },
  } as unknown as WBAsset
  return mount(HistoryCardRenderer, {
    props: { asset, interactive: true, ...props },
    global: { mocks: { $t: (k: string) => k }, stubs: { 'i18n-t': true } },
  })
}

beforeEach(() => {
  page = { id: 'p1', width: 1920, height: 1080, assets: [] }
})

describe('Музейна етикетка · показ', () => {
  it('факти, суть, дати, галузь і джерело — з даних, шапки «Особа» немає', () => {
    const w = render(DATA)
    const card = w.find('[data-testid="history-card-museum"]')
    expect(card.exists()).toBe(true)
    expect(card.find('.museum__cat').text()).toBe('Історія України · Київська Русь')
    expect(card.find('.museum__title').text()).toBe('Володимир Святославич')
    expect(card.findAll('.museum__fact').map((f) => f.text())).toEqual([
      '979—1015великий князь київський', '988хрещення Русі', '«тризуб»особистий знак'])
    expect(card.findAll('.museum__tl li').map((li) => li.find('b').text())).toEqual(['977—979', '988', '996'])
    expect(card.find('.museum__summary').text()).toBe(MUSEUM.summary)
    expect(card.find('.museum__src').text()).toContain('Вікіпедія · «Володимир Святославич» · CC BY-SA 4.0')
    expect(card.find('.museum__more').attributes('href')).toBe(SOURCE.url)
    expect(w.find('.history-card__header').exists()).toBe(false)
    expect(w.find('.history-card__fields').exists()).toBe(false)
  })

  it('підпис під портретом — автор (посиланням на сторінку файла) і ліцензія', () => {
    const cap = render(DATA).find('[data-testid="history-card-museum-caption"]')
    expect(cap.text()).toBe('Микола Аркас. Історія України-Русі (1912) · Public domain')
    expect(cap.find('a').attributes('href')).toBe(IMAGE.file_page)
  })

  it('портрет без автора не показується — етикетка на всю ширину', () => {
    const w = render({ ...DATA, image: { ...IMAGE, author: '' } })
    expect(w.find('.museum__img').exists()).toBe(false)
    expect(w.find('.museum').classes()).toContain('museum--no-image')
  })

  it('кнопка видалення — лише у виділеної картки з інструментом виділення', async () => {
    expect(render(DATA).find('.history-card__delete-btn').exists()).toBe(false)
    expect(render(DATA, { isSelected: true, interactive: false }).find('.history-card__delete-btn').exists()).toBe(false)
    const w = render(DATA, { isSelected: true })
    await w.find('.history-card__delete-btn').trigger('click')
    expect(w.emitted('delete')).toHaveLength(1)
  })

  it('підписи — мовою статті', () => {
    const w = render({ ...DATA, museum: { ...MUSEUM, lang: 'en' } })
    expect(w.find('.museum__more').text()).toBe('↗ Read more')
    expect(w.find('.museum__src').text()).toContain('Source:')
  })

  it('немає галузі — «Довідка»', () => {
    expect(render({ ...DATA, museum: { ...MUSEUM, category: '' } }).find('.museum__cat').text()).toBe('Довідка')
  })

  it('без етикетки картка та сама, що й була', () => {
    const w = render({ ...DATA, museum: undefined })
    expect(w.find('[data-testid="history-card-museum"]').exists()).toBe(false)
    expect(w.find('.history-card__header').exists()).toBe(true)
  })
})

describe('Музейна етикетка · форма даних', () => {
  it('правильна етикетка проходить як є', () => {
    expect(sanitizeMuseum(MUSEUM)).toEqual(MUSEUM)
    expect(sanitizeMuseum({ ...MUSEUM, lang: 'en' })?.lang).toBe('en')
    expect(sanitizeMuseum({ ...MUSEUM, lang: 'de' })).not.toHaveProperty('lang')
  })

  it('не три факти, не 2–4 дати чи без суті — етикетки немає', () => {
    expect(sanitizeMuseum({ ...MUSEUM, facts: MUSEUM.facts.slice(0, 2) })).toBeNull()
    expect(sanitizeMuseum({ ...MUSEUM, timeline: MUSEUM.timeline.slice(0, 1) })).toBeNull()
    expect(sanitizeMuseum({ ...MUSEUM, timeline: [...MUSEUM.timeline, ...MUSEUM.timeline] })).toBeNull()
    expect(sanitizeMuseum({ ...MUSEUM, summary: '  ' })).toBeNull()
    expect(sanitizeMuseum({ ...MUSEUM, facts: [...MUSEUM.facts.slice(0, 2), { value: 3, label: 'x' }] })).toBeNull()
    expect(sanitizeMuseum(null)).toBeNull()
  })
})

describe('Музейна етикетка · на дошці', () => {
  it('Інтегралик кладе картку 880×560 з етикеткою; без етикетки — 520×380, як була', async () => {
    await runBoardAction({ kind: 'add_history_card', payload: { ...DATA, museum: MUSEUM } })
    await runBoardAction({ kind: 'add_history_card', payload: { ...DATA, museum: { ...MUSEUM, facts: [] } } })
    const [museum, plain] = page.assets
    expect([museum.w, museum.h]).toEqual([880, 560])
    expect(museum.data.museum).toEqual(MUSEUM)
    expect([plain.w, plain.h]).toEqual([520, 380])
    expect(plain.data.museum).toBeUndefined()
  })

  it('план з етикеткою міряє місце під 880×560: дві поруч, третя — вже ні', async () => {
    const card = { kind: 'add_history_card', payload: { ...DATA, museum: MUSEUM } }
    expect(await planFitsCurrentPage([card, card])).toBe(true)
    expect(await planFitsCurrentPage([card, card, card])).toBe(false)
  })

  it('зменшується цілком, як картка задачі, і висоту міряє в пікселях картки', () => {
    const asset = { type: 'history_card', data: { museum: MUSEUM } }
    expect(isMuseumCard(asset)).toBe(true)
    expect(isZoomScaledCard(asset)).toBe(true)
    expect(fitMeasureZoom(asset, 0.47)).toBe(1)
    expect(isZoomScaledCard({ type: 'history_card', data: {} })).toBe(false)
    expect(isMuseumCard({ type: 'theory_card', data: { museum: MUSEUM } })).toBe(false)
  })
})
