/**
 * Історична карта на пульті (LAW §9 v1.77; макет дизайнера, вкладка «Пульт»: «крок до попередньої/наступної зміни
 * меж, «По черзі», «На весь екран»»).
 *
 * ІНВАРІАНТИ
 *   INV-HMR-1  стан: карта з кордонами сторінки, що на екрані, несе map_dataset / map_version / map_year і `playing`;
 *              карта без кордонів, інші сторінки — без цих полів (П1: немає полів — немає кнопок)
 *   INV-HMR-2  крок — той самий запис, що ←/→ картки: один asset_update `borders.year` на сусідній рік зміни меж; на
 *              межі — нічого; умови — як на дошці (учитель, редагування, запис, не згорнута)
 *   INV-HMR-3  «по черзі» — той самий ▶, що на картці (спільний стан екрана); вмикає лише той, хто може писати;
 *              зупинити — завжди; таймер картки пише за `navigable`, а не за інструментом (з пером теж крокує)
 *   INV-HMR-4  «На весь екран» — той самий board-expand, що ⛶ на картці; focus_id називає карту; «Уся сторінка» згортає
 *   INV-HMR-5  телефон: розбір — дзеркало сервера; панель — рік, плашки змін, ← / → з роком, «По черзі», ⛶ / ▭
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import { createRemoteScenarioAdapter } from '../remote/remoteScenarioAdapter'
import { createRemoteViewAdapter } from '../composables/useRemoteViewAdapter'
import { useBoardRemote } from '../composables/useBoardRemote'
import { parseRemoteScenario, type RemoteScenarioItem } from '../composables/useRemoteChannel'
import { isTimelinePlaying, setTimelinePlaying } from '../board/timelinePlayback'
import { BORDER_DATASETS, CLIOPATRIA_EAST_EUROPE, loadBorders } from '../board/historicalBorders'
import { cardWindowActions } from '../board/windowActions'
import RemoteObjectControls from '../components/remote/RemoteObjectControls.vue'
import HistoricalMapCard from '../components/board/objects/HistoricalMapCard.vue'
import type { WBAsset } from '../types/winterboard'

const VERSION = BORDER_DATASETS[CLIOPATRIA_EAST_EUROPE].version

function historicalMap(id: string, year = 1659, extra: Record<string, unknown> = {}): WBAsset {
  return {
    id, type: 'map_card', src: '', x: 0, y: 0, w: 960, h: 600, rotation: 0, locked: false,
    data: {
      version: 1, title: '', basemap: 'east_europe', historical_boundary_mode: 'dataset', places: [], sources: [],
      borders: { dataset: CLIOPATRIA_EAST_EUROPE, version: VERSION, year },
    },
    ...extra,
  } as unknown as WBAsset
}

const plainMap = (id: string) => ({
  id, type: 'map_card', x: 0, y: 700, w: 400, h: 300, rotation: 0, locked: false,
  data: { version: 1, title: 'Місця', basemap: 'europe', historical_boundary_mode: 'none', places: [] },
}) as unknown as WBAsset

function setup(pages: WBAsset[][], opts: { mode?: string; isTutor?: boolean; canWrite?: boolean; current?: number } = {}) {
  const state = reactive({ pages: pages.map((assets) => ({ assets })), current: opts.current ?? 0 })
  const updateAsset = vi.fn((a: WBAsset) => {
    const page = state.pages[state.current]
    page.assets = page.assets.map((o) => (o.id === a.id ? a : o))
  })
  const view = { focusObject: vi.fn(() => true), objectFocusId: vi.fn(() => null as string | null), resetFocus: vi.fn() }
  const adapter = createRemoteScenarioAdapter({
    pages: () => state.pages as never,
    currentPageIndex: () => state.current,
    viewer: () => ({ isTutor: opts.isTutor ?? true, mode: (opts.mode ?? 'edit') as never }),
    canWrite: () => opts.canWrite ?? true,
    updateAsset,
    view,
  })
  return { adapter, state, updateAsset, view }
}

const yearOf = (a: WBAsset) => (a.data as { borders: { year: number } }).borders.year

// Набір на дошці вже завантажила картка (кеш `loadBorders`); перше імпортування файла в тесті — довше за flushPromises
beforeAll(async () => { await loadBorders(CLIOPATRIA_EAST_EUROPE, VERSION) })

afterEach(() => {
  for (const id of ['map-1', 'map-2']) setTimelinePlaying(id, false)
  vi.useRealTimers()
})

// ── INV-HMR-1 · стан ─────────────────────────────────────────────────────────

describe('INV-HMR-1 · карта в стані пульта', () => {
  it('набір, версія, рік; «грає» — зі спільного стану; координат немає', () => {
    const { adapter } = setup([[historicalMap('map-1')]])
    const item = adapter.state().items[0]
    expect(item).toMatchObject({
      object_id: 'map-1', kind: 'card', map_dataset: CLIOPATRIA_EAST_EUROPE, map_version: VERSION, map_year: 1659,
      playing: false, title: 'Східна Європа',   // без власної назви — назва набору, як у шапці картки
    })
    expect(JSON.stringify(item)).not.toContain('polygons')
    setTimelinePlaying('map-1', true)
    expect(adapter.state().items[0].playing).toBe(true)
  })

  it('карта без кордонів і карта іншої сторінки — без полів карти', () => {
    const { adapter } = setup([[plainMap('pm-1')], [historicalMap('map-2')]])
    const items = adapter.state().items
    expect(items.find((i) => i.object_id === 'pm-1')).not.toHaveProperty('map_year')
    expect(items.find((i) => i.object_id === 'map-2')).toBeUndefined()
  })
})

// ── INV-HMR-2 · крок ─────────────────────────────────────────────────────────

describe('INV-HMR-2 · крок = ←/→ картки', () => {
  it('→ і ← — сусідній рік зміни меж, один запис на крок', async () => {
    const { adapter, state, updateAsset } = setup([[historicalMap('map-1', 1659)]])
    adapter.mapStep('map-1', 1)
    await flushPromises()
    expect(updateAsset).toHaveBeenCalledTimes(1)
    expect(yearOf(state.pages[0].assets[0])).toBe(1662)
    // Два натиски підряд — два кроки (як два кліки на картці): кожен бере рік, що вже на дошці
    adapter.mapStep('map-1', -1)
    adapter.mapStep('map-1', -1)
    await flushPromises()
    expect(updateAsset).toHaveBeenCalledTimes(3)
    expect(yearOf(state.pages[0].assets[0])).toBe(1653)
  })

  it('на межах — нічого', async () => {
    const first = setup([[historicalMap('map-1', 1648)]])
    first.adapter.mapStep('map-1', -1)
    const last = setup([[historicalMap('map-1', 1687)]])
    last.adapter.mapStep('map-1', 1)
    await flushPromises()
    expect(first.updateAsset).not.toHaveBeenCalled()
    expect(last.updateAsset).not.toHaveBeenCalled()
  })

  it('учень, перегляд, запис неможливий, згорнута, карта без кордонів — нічого', async () => {
    const cases = [
      setup([[historicalMap('map-1')]], { isTutor: false }),
      setup([[historicalMap('map-1')]], { mode: 'view' }),
      setup([[historicalMap('map-1')]], { canWrite: false }),
      setup([[historicalMap('map-1', 1659, { minimized: true })]]),
    ]
    for (const c of cases) c.adapter.mapStep('map-1', 1)
    const plain = setup([[plainMap('pm-1')]])
    plain.adapter.mapStep('pm-1', 1)
    await flushPromises()
    for (const c of [...cases, plain]) expect(c.updateAsset).not.toHaveBeenCalled()
  })
})

// ── INV-HMR-3 · «по черзі» ───────────────────────────────────────────────────

describe('INV-HMR-3 · «по черзі» = ▶ картки', () => {
  it('вмикає той, хто може писати; зупинити — завжди', () => {
    const student = setup([[historicalMap('map-1')]], { isTutor: false })
    student.adapter.mapPlay('map-1')
    expect(isTimelinePlaying('map-1')).toBe(false)
    const teacher = setup([[historicalMap('map-1')]])
    teacher.adapter.mapPlay('map-1')
    expect(isTimelinePlaying('map-1')).toBe(true)
    student.adapter.mapPause('map-1')
    expect(isTimelinePlaying('map-1')).toBe(false)
  })

  it('картка: ▶ з пульта крокує й з пером (interactive=false, navigable=true); 1687 — з першого року', async () => {
    await loadBorders(CLIOPATRIA_EAST_EUROPE, VERSION)
    vi.useFakeTimers()
    const w = mount(HistoricalMapCard, { props: { asset: historicalMap('map-1', 1659), interactive: false, navigable: true } })
    await flushPromises()
    setTimelinePlaying('map-1', true)
    await nextTick()
    const years = () => (w.emitted('update:asset') ?? []).map(([a]) => yearOf(a as WBAsset))
    expect(years()).toEqual([1662])
    await w.setProps({ asset: historicalMap('map-1', 1662) })
    vi.advanceTimersByTime(2400)
    expect(years()).toEqual([1662, 1670])
    setTimelinePlaying('map-1', false)
    await nextTick()
    vi.advanceTimersByTime(5000)
    expect(years()).toHaveLength(2)

    const end = mount(HistoricalMapCard, { props: { asset: historicalMap('map-2', 1687), interactive: false, navigable: true } })
    await flushPromises()
    setTimelinePlaying('map-2', true)
    await nextTick()
    expect((end.emitted('update:asset') ?? []).map(([a]) => yearOf(a as WBAsset))).toEqual([1648])
    w.unmount()
    end.unmount()
  })

  it('картка учня (не navigable, не interactive): «грає» нічого не пише', async () => {
    await loadBorders(CLIOPATRIA_EAST_EUROPE, VERSION)
    const w = mount(HistoricalMapCard, { props: { asset: historicalMap('map-1', 1659), interactive: false, navigable: false } })
    await flushPromises()
    setTimelinePlaying('map-1', true)
    await nextTick()
    expect(w.emitted('update:asset')).toBeUndefined()
    w.unmount()
  })
})

// ── INV-HMR-4 · на весь екран ────────────────────────────────────────────────

describe('INV-HMR-4 · «На весь екран» карти = ⛶ на картці', () => {
  it('сценарій: карта з кордонами — до вигляду; карта без кордонів і згорнута — ні', () => {
    const { adapter, view } = setup([[historicalMap('map-1'), plainMap('pm-1'), historicalMap('map-2', 1659, { minimized: true, y: 900 })]])
    adapter.focus('pm-1')
    adapter.focus('map-2')
    expect(view.focusObject).not.toHaveBeenCalled()
    adapter.focus('map-1')
    expect(view.focusObject).toHaveBeenCalledWith('map-1')
  })

  it('⛶ на картці — лише в історичної карти; звичайна карта Інтегралика без ⛶, як до 30.10', () => {
    const teacher = { isTutor: true, mode: 'edit' as never }
    expect(cardWindowActions(historicalMap('map-1'), teacher).expand).toBe(true)
    expect(cardWindowActions(plainMap('pm-1'), teacher).expand).toBe(false)
  })

  it('вигляд: board-expand; focus_id — карта; «Уся сторінка» згортає', () => {
    const store: any = {
      containerWidth: 1000, containerHeight: 600, pageWidth: 2000, pageHeight: 1500, zoom: 1, scrollX: 0, scrollY: 0,
      expandedAssetId: null, currentPageIndex: 0, pages: [{ assets: [historicalMap('map-1')] }],
      setZoom: vi.fn(), setScroll: vi.fn(), updateAsset: vi.fn(),
    }
    const v = createRemoteViewAdapter(store)
    expect(v.focusObject('map-1')).toBe(true)
    expect(store.expandedAssetId).toBe('map-1')
    expect(store.setZoom).not.toHaveBeenCalled()
    expect(v.objectFocusId()).toBe('map-1')
    v.resetFocus()
    expect(store.expandedAssetId).toBeNull()
  })
})

// ── INV-HMR-5 · телефон ──────────────────────────────────────────────────────

describe('INV-HMR-5 · телефон: розбір', () => {
  const MAP = { map_dataset: CLIOPATRIA_EAST_EUROPE, map_version: VERSION, map_year: 1659 }
  const raw = (extra: Record<string, unknown>, kind = 'card') => ({
    focus_id: null, items: [{ object_id: 'map-1', kind, title: 'Східна Європа', page_index: 0, minimized: false, ...extra }],
  })

  it('поля карти й «грає» — у картки', () => {
    expect(parseRemoteScenario(raw({ ...MAP, playing: true }))?.items[0]).toMatchObject({
      mapDataset: CLIOPATRIA_EAST_EUROPE, mapVersion: VERSION, mapYear: 1659, playing: true,
    })
  })

  it.each([
    [{ map_dataset: CLIOPATRIA_EAST_EUROPE, map_version: VERSION }],
    [{ ...MAP, map_dataset: 'Cliopatria' }],
    [{ ...MAP, map_version: 'v 1' }],
    [{ ...MAP, map_year: 1659.5 }],
    [{ ...MAP, map_year: 2101 }],
    [{ ...MAP, event_count: 3 }],
    [{ ...MAP, event_index: 0, playing: true }],
    [{ ...MAP, playing: 'так' }],
  ])('зіпсоване — сценарій відкидається: %j', (extra) => {
    expect(parseRemoteScenario(raw(extra))).toBeUndefined()
  })

  it('не картка з полями карти — відкидається', () => {
    expect(parseRemoteScenario(raw(MAP, 'image'))).toBeUndefined()
  })
})

describe('INV-HMR-5 · телефон: панель карти', () => {
  const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })
  const item = (extra: Partial<RemoteScenarioItem>): RemoteScenarioItem => ({
    objectId: 'map-1', kind: 'card', title: 'Східна Європа', pageIndex: 0, minimized: false,
    mapDataset: CLIOPATRIA_EAST_EUROPE, mapVersion: VERSION, mapYear: 1659, playing: false, ...extra,
  })
  const mountItem = async (it: RemoteScenarioItem, focusId: string | null = null) => {
    await loadBorders(it.mapDataset, it.mapVersion)
    const w = mount(RemoteObjectControls, {
      props: { item: it, focusId, ready: true, idPrefix: 'object', variant: 'main' },
      global: { plugins: [i18n] },
    })
    await flushPromises()
    return w
  }
  const sent = (w: Awaited<ReturnType<typeof mountItem>>) => (w.emitted('send') ?? []).map(([cmd, args]) => [cmd, args])

  it('рік, плашки змін, ← 1653 / 1662 →, «По черзі», ⛶ — команди з адресою; «Згорнути» лишилося', async () => {
    const w = await mountItem(item({}))
    expect(w.find('[data-testid=object-map-year]').text()).toBe('1659')
    const chips = w.find('[data-testid=object-map-changes]').text()
    expect(chips).toContain('Річ Посполита')
    expect(chips).toContain('Швеція')
    expect(w.find('[data-testid=object-map-prev]').text()).toContain('1653')
    expect(w.find('[data-testid=object-map-next]').text()).toContain('1662')
    await w.find('[data-testid=object-map-prev]').trigger('click')
    await w.find('[data-testid=object-map-next]').trigger('click')
    await w.find('[data-testid=object-map-play]').trigger('click')
    await w.find('[data-testid=object-focus]').trigger('click')
    expect(sent(w)).toEqual([
      ['map.step', { object_id: 'map-1', dir: -1 }],
      ['map.step', { object_id: 'map-1', dir: 1 }],
      ['map.play', { object_id: 'map-1' }],
      ['view.focus', { object_id: 'map-1' }],
    ])
    expect(w.find('[data-testid=object-minimize]').exists()).toBe(true)
    expect(w.find('[data-testid=object-event-prev]').exists()).toBe(false)
  })

  it('грає — «❚❚ Пауза» шле map.pause; на весь екран — «▭ Уся сторінка»', async () => {
    const w = await mountItem(item({ playing: true }), 'map-1')
    expect(w.find('[data-testid=object-map-play]').text()).toContain('Пауза')
    await w.find('[data-testid=object-map-play]').trigger('click')
    await w.find('[data-testid=object-whole-page]').trigger('click')
    expect(sent(w)).toEqual([['map.pause', { object_id: 'map-1' }], ['view.page', {}]])
  })

  it('перший рік — «Перший знімок», ← сіра; останній — → сіра', async () => {
    const first = await mountItem(item({ mapYear: 1648 }))
    expect(first.find('[data-testid=object-map-changes]').text()).toContain('Перший знімок')
    expect(first.find('[data-testid=object-map-prev]').attributes('disabled')).toBeDefined()
    const last = await mountItem(item({ mapYear: 1687 }))
    expect(last.find('[data-testid=object-map-next]').attributes('disabled')).toBeDefined()
  })

  it('набору цієї версії телефон не знає — лише рік і кнопки', async () => {
    const w = await mountItem(item({ mapVersion: 'v9-unknown' }))
    expect(w.find('[data-testid=object-map-year]').text()).toBe('1659')
    expect(w.find('[data-testid=object-map-changes]').exists()).toBe(false)
    expect(w.find('[data-testid=object-map-next]').attributes('disabled')).toBeUndefined()
  })
})

// ── ноутбук приймає команди карти з каналу ───────────────────────────────────

describe('ноутбук: команди map.* — в адаптер сценарію', () => {
  const mounted: Array<{ unmount: () => void }> = []
  afterEach(() => { while (mounted.length) mounted.pop()!.unmount() })

  it('крок ±1, «по черзі», пауза — з адресою; інший крок і без адреси — ігнор', () => {
    const store = reactive({ currentPageIndex: 0, pageCount: 1, goToPage: vi.fn(), addPage: vi.fn() })
    const scenario = {
      state: vi.fn(() => ({ focus_id: null, items: [] })),
      play: vi.fn(), pause: vi.fn(), volume: vi.fn(), focus: vi.fn(), minimize: vi.fn(), restore: vi.fn(), docPage: vi.fn(),
      timelineStep: vi.fn(), timelinePlay: vi.fn(), timelinePause: vi.fn(), mapStep: vi.fn(), mapPlay: vi.fn(), mapPause: vi.fn(),
    }
    let api!: ReturnType<typeof useBoardRemote>
    mounted.push(mount(defineComponent({
      setup() {
        api = useBoardRemote({
          sessionId: ref('4ba7fff3-9452-4c42-9ff9-04415ff25d90'), store, undo: vi.fn(), sendMessage: vi.fn(),
          enabled: ref(true), scenario: scenario as never,
        })
        return () => h('div')
      },
    })))
    const fire = (cmd: string, args: Record<string, unknown> = {}) => window.dispatchEvent(new CustomEvent('wb:remote-command', {
      detail: { userId: 'u', pair: api.pairCode.value, clientId: 'phone', cmd, args },
    }))
    fire('map.step', { object_id: 'map-1', dir: 1 })
    fire('map.step', { object_id: 'map-1', dir: -1 })
    fire('map.step', { object_id: 'map-1', dir: 2 })
    fire('map.step', { dir: 1 })
    fire('map.play', { object_id: 'map-1' })
    fire('map.pause', { object_id: 'map-1' })
    fire('map.play', {})
    expect(scenario.mapStep.mock.calls).toEqual([['map-1', 1], ['map-1', -1]])
    expect(scenario.mapPlay.mock.calls).toEqual([['map-1']])
    expect(scenario.mapPause.mock.calls).toEqual([['map-1']])
    expect(scenario.timelineStep).not.toHaveBeenCalled()
  })
})
