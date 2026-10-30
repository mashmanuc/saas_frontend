/**
 * Бібліотека шкал тем (власник 2026-10-30: «зберігати це як бібліотеку… Для істориків окремо, для математиків
 * окремо»).
 *
 * ІНВАРІАНТИ
 *   INV-TL-1  натиск ставить шкалу тим самим планом, що дає Інтегралик (`runBoardAction`), без моделі
 *   INV-TL-2  не вміщається на поточній сторінці — нова сторінка одразу після поточної (як у Інтегралика)
 *   INV-TL-3  пілоту історичної карти — і карта, поруч із САМЕ ЦІЄЮ шкалою; без пілоту — лише шкала
 *   INV-TL-4  збій видно на рядку теми; поки ставимо — інші рядки не натискаються
 *   INV-TL-5  історик без математики не бачить математичних застосунків; без вибору предметів — усе як було
 *   INV-TL-6  карта поруч зі шкалою лягає в межах аркуша
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'
import { ADD_TOOL_TO_BOARD_KEY } from '../../../composables/useAddToolToBoard'
import { HISTORICAL_MAP_DRAG_MIME } from '../../../constants/evidenceCardDefaults'
import { MASH_APPS, allInserts, appOf, mathToolsFor, visibleApps, visibleInserts } from '../insertRegistry'
import { besideTimeline } from '../../../composables/useContentDrop'

const api = vi.hoisted(() => ({ fetchTimelineLibrary: vi.fn(), fetchTimelineLibraryItem: vi.fn() }))
vi.mock('@/modules/intent/corridors/corridorApi', () => api)
const board = vi.hoisted(() => ({ runBoardAction: vi.fn(), planFitsCurrentPage: vi.fn(), openPageForPlan: vi.fn() }))
vi.mock('@/modules/intent/boardActions', () => board)

import TimelineLibrary from '../TimelineLibrary.vue'

const ITEMS = [
  { id: '7', title: 'Хмельниччина', language: 'uk', years: [1648, 1657], events: 12, places: 11, people: 9, uses: 4 },
  { id: '3', title: 'Пунічні війни', language: 'uk', years: [-264, -146], events: 6, places: 6, people: 3, uses: 1 },
]
const PLAN = { status: 'board_action_plan', actions: [{ kind: 'add_timeline', payload: { title: 'Хмельниччина', view: 'axis', events: [] } }] }

function mountLibrary(withMap = false) {
  const add = vi.fn()
  const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } as never })
  const w = mount(TimelineLibrary, { props: { withMap }, global: { plugins: [i18n], provide: { [ADD_TOOL_TO_BOARD_KEY as symbol]: add } } })
  return { w, add }
}

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchTimelineLibrary.mockResolvedValue({ items: ITEMS })
  api.fetchTimelineLibraryItem.mockResolvedValue(PLAN)
  board.planFitsCurrentPage.mockResolvedValue(true)
  board.runBoardAction.mockResolvedValue({ ok: true, assetId: 'tl-1' })
})

describe('бібліотека шкал на панелі', () => {
  it('список: назва, роки (до н. е. — словами), кількість подій', async () => {
    const { w } = mountLibrary()
    await flushPromises()
    expect(api.fetchTimelineLibrary).toHaveBeenCalledWith({ language: 'uk', q: '' })
    const rows = w.findAll('[data-testid^="timeline-library-item-"]').map((r) => r.text())
    expect(rows[0]).toContain('Хмельниччина')
    expect(rows[0]).toContain('1648–1657')
    expect(rows[0]).toContain('подій: 12')
    expect(rows[1]).toContain('264 до н. е.–146 до н. е.')
  })

  it('INV-TL-1, INV-TL-3: натиск — план Інтегралика на дошку; без пілоту карти — лише шкала', async () => {
    const { w, add } = mountLibrary(false)
    await flushPromises()
    await w.get('[data-testid="timeline-library-item-7"]').trigger('click')
    await flushPromises()
    expect(api.fetchTimelineLibraryItem).toHaveBeenCalledWith('7')
    expect(board.runBoardAction).toHaveBeenCalledWith(PLAN.actions[0])
    expect(board.openPageForPlan).not.toHaveBeenCalled()
    expect(add).not.toHaveBeenCalled()
  })

  it('INV-TL-3: пілоту — карта поруч із щойно поставленою шкалою', async () => {
    const { w, add } = mountLibrary(true)
    await flushPromises()
    await w.get('[data-testid="timeline-library-item-7"]').trigger('click')
    await flushPromises()
    expect(add).toHaveBeenCalledWith(HISTORICAL_MAP_DRAG_MIME, JSON.stringify({ nextTo: 'tl-1' }))
  })

  it('INV-TL-2: не вміщається — нова сторінка з назвою теми, потім шкала', async () => {
    board.planFitsCurrentPage.mockResolvedValue(false)
    const { w } = mountLibrary()
    await flushPromises()
    await w.get('[data-testid="timeline-library-item-7"]').trigger('click')
    await flushPromises()
    expect(board.openPageForPlan).toHaveBeenCalledWith('Хмельниччина')
    expect(board.openPageForPlan.mock.invocationCallOrder[0]).toBeLessThan(board.runBoardAction.mock.invocationCallOrder[0])
  })

  it('INV-TL-4: збій — видно на рядку; поки ставимо — рядки неактивні', async () => {
    let fail!: (e: Error) => void
    api.fetchTimelineLibraryItem.mockReturnValue(new Promise((_, reject) => { fail = reject }))
    const { w } = mountLibrary()
    await flushPromises()
    await w.get('[data-testid="timeline-library-item-7"]').trigger('click')
    expect(w.get('[data-testid="timeline-library-item-7"]').text()).toContain('Ставлю на дошку')
    expect(w.get('[data-testid="timeline-library-item-3"]').attributes('disabled')).toBeDefined()
    fail(new Error('500'))
    await flushPromises()
    expect(w.get('[data-testid="timeline-library-item-7"]').text()).toContain('Не вдалося поставити')
    expect(board.runBoardAction).not.toHaveBeenCalled()
  })

  it('порожня бібліотека — підказка, як її поповнити; пошук без збігів — свої слова', async () => {
    api.fetchTimelineLibrary.mockResolvedValue({ items: [] })
    const { w } = mountLibrary()
    await flushPromises()
    expect(w.get('[data-testid="timeline-library-empty"]').text()).toContain('Попросіть його')
    await w.get('[data-testid="timeline-library-search"]').setValue('Атлантида')
    await flushPromises()
    expect(api.fetchTimelineLibrary).toHaveBeenLastCalledWith({ language: 'uk', q: 'Атлантида' })
    expect(w.get('[data-testid="timeline-library-empty"]').text()).toContain('Такої теми ще немає')
  })
})

describe('INV-TL-5: інструменти за предметами вчителя', () => {
  const math = ['2d', '3d', 'geometry', 'stereo', 'scenes']

  it('історик без математики — без математичних застосунків і їхніх вставок у пошуку', () => {
    const gate = { evidence: true, scenes: true, borders: true, mathTools: mathToolsFor(['general', 'history']) }
    expect(visibleApps(gate).map((a) => a.app)).toEqual(['content'])
    expect(visibleInserts(gate).every((e) => !math.includes(appOf(e)))).toBe(true)
    expect(visibleInserts(gate).some((e) => e.id === 'analysis.graphCalc')).toBe(false)
    expect(visibleInserts(gate).some((e) => e.family === 'evidence')).toBe(true)
  })

  it('без вибору предметів, математик, історик + математик — усе як було', () => {
    for (const subjects of [[], ['general', 'math'], ['general', 'math', 'history'], ['general', 'physics']]) {
      expect(mathToolsFor(subjects), subjects.join(',')).toBe(true)
    }
    expect(visibleApps({ evidence: true, scenes: true, mathTools: true })).toEqual(MASH_APPS)
    expect(visibleInserts({ evidence: true, scenes: true, borders: true, mathTools: true })).toHaveLength(allInserts().length)
  })

  it('бібліотека — у «Навчальних обʼєктах», лише за предметом «історія» і гейтом', () => {
    const sidebar = readFileSync('src/modules/winterboard/components/sidebar/GroupContentSidebar.vue', 'utf8')
    expect(sidebar).toContain(`const timelineLibraryShown = computed(() => evidenceEnabled.value && teachingSubjects.value.includes('history'))`)
    expect(sidebar).toMatch(/catalogFamily === 'content'[\s\S]*?<template v-if="timelineLibraryShown">[\s\S]*?<TimelineLibrary :with-map="bordersEnabled" \/>/)
  })
})

describe('INV-TL-6: карта поруч зі шкалою — у межах аркуша', () => {
  const map = { id: 'm', type: 'map_card', x: 0, y: 0, w: 960, h: 600 } as never
  const at = (x: number, y: number, w = 1120, h = 640) => ({ id: 't', type: 'timeline_card', x, y, w, h }) as never

  it('шкала зліва вгорі (так її ставить Інтегралик на порожній сторінці) — карта праворуч, решта ширини', () => {
    expect(besideTimeline(map, at(40, 40), 1920, 1080)).toMatchObject({ x: 1200, y: 40, w: 680, h: 425 })
  })

  it('праворуч тісно — під шкалою, якщо там є місце; ніде — як була', () => {
    expect(besideTimeline(map, at(500, 40, 1120, 300), 1920, 1080)).toMatchObject({ x: 500, y: 380, w: 960, h: 600 })
    expect(besideTimeline(map, at(500, 300), 1920, 1080)).toBe(map)
  })
})
