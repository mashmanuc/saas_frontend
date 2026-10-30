/**
 * Історична карта — об'ємний вигляд на рушії карт (закон §9 v1.78; ТЗ TZ_HISTORICAL_BORDERS_MAP_2026-10-30 §8).
 *
 * ІНВАРІАНТИ
 *   INV-HGL-1  є WebGL — об'ємна карта стає на місце пласкої, коли намалювалась; поки вантажиться — видно пласку
 *   INV-HGL-2  без WebGL чи при збої рушія — та сама пласка карта, рік і кнопки працюють як до v1.78
 *   INV-HGL-3  рік з дошки: новий рік — межі в сусідній шар, той проявляється, старий гасне; нічого не пише сам
 *   INV-HGL-4  фізична основа — закріплений версійний файл; у стані дошки її немає
 *   INV-HGL-5  знімок для PDF — уся картка гілкою DOM (карта, рік, легенда)
 */
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

const engine = vi.hoisted(() => ({ supported: true, failCreate: false, maps: [] as any[], markers: [] as any[] }))

vi.mock('../board/webglSupport', () => ({ webglSupported: () => engine.supported }))
vi.mock('../board/mapEngine', () => {
  class FakeMap {
    sources: Record<string, { data: any; setData: (d: any) => void }> = {}
    layers: Record<string, any> = {}
    paint: Record<string, any> = {}
    handlers: Record<string, Array<(e?: any) => void>> = {}
    zoom = 4
    constructor(public opts: any) {
      if (engine.failCreate) throw new Error('no context')
      engine.maps.push(this)
      queueMicrotask(() => { this.fire('load'); queueMicrotask(() => this.fire('idle')) })
    }
    fire(ev: string) { const hs = this.handlers[ev] ?? []; this.handlers[ev] = hs.filter((h: any) => !h.once); hs.forEach((h) => h()) }
    on(ev: string, fn: any) { (this.handlers[ev] ??= []).push(fn) }
    once(ev: string, fn: any) { fn.once = true; (this.handlers[ev] ??= []).push(fn) }
    addImage() {}
    addSource(id: string, s: any) { const src = { data: s.data, setData: (d: any) => { src.data = d } }; this.sources[id] = src }
    getSource(id: string) { return this.sources[id] }
    addLayer(l: any) { this.layers[l.id] = l }
    getLayer(id: string) { return this.layers[id] }
    setPaintProperty(id: string, k: string, v: any) { this.paint[`${id}.${k}`] = v }
    setLayoutProperty() {}
    setFilter(id: string, f: any) { this.paint[`${id}.filter`] = f }
    cameraForBounds() { return { center: [30, 50], zoom: 4 } }
    jumpTo() {}
    easeTo() {}
    resize() {}
    remove() {}
    getPixelRatio() { return 1 }
    setPixelRatio() {}
    getZoom() { return this.zoom }
    setZoom(z: number) { this.zoom = z }
    getPitch() { return 45 }
    queryRenderedFeatures() { return [] }
    getBounds() { return { contains: () => true } }
    isMoving() { return false }
    dragPan = { enable() {}, disable() {} }
    dragRotate = { enable() {}, disable() {} }
    scrollZoom = { enable() {}, disable() {} }
    touchZoomRotate = { enable() {}, disable() {} }
    doubleClickZoom = { enable() {}, disable() {} }
    touchPitch = { enable() {}, disable() {} }
  }
  class FakeMarker {
    el: HTMLElement
    constructor(opts: any) { this.el = opts.element }
    setLngLat() { return this }
    addTo() { engine.markers.push(this); return this }
    remove() { const i = engine.markers.indexOf(this); if (i >= 0) engine.markers.splice(i, 1) }
  }
  return { default: { Map: FakeMap, Marker: FakeMarker } }
})

import { BORDER_DATASETS, CLIOPATRIA_EAST_EUROPE, loadBorders, statesAt } from '../board/historicalBorders'
import { loadPhysicalBasemap } from '../board/historicalBasemap'
import HistoricalMapCard from '../components/board/objects/HistoricalMapCard.vue'
import MapCardRenderer from '../components/board/objects/MapCardRenderer.vue'
import type { WBAsset } from '../types/winterboard'
import { sanitizeEvents, sanitizePeople, sanitizePlace } from '../../intent/boardActions'
import { linkedHistoricalMapUpdates, timelineMapPins } from '../board/evidenceLinkage'
import { bordersYears, CLIOPATRIA_WORLD, CLIOPATRIA_WORLD_VERSION, loadBordersFor } from '../board/historicalBorders'
import { buildHistoricalMapAsset, mainPlaces, topicRegion } from '../constants/evidenceCardDefaults'
import { createRemoteScenarioAdapter } from '../remote/remoteScenarioAdapter'

const VERSION = BORDER_DATASETS[CLIOPATRIA_EAST_EUROPE].version

function historicalMap(year = 1648): WBAsset {
  return {
    id: 'map-1', type: 'map_card', src: '', x: 0, y: 0, w: 960, h: 600, rotation: 0, locked: false,
    data: {
      version: 1, title: '', basemap: 'east_europe', basemap_version: 'v1', projection: 'mercator',
      historical_boundary_mode: 'dataset', borders: { dataset: CLIOPATRIA_EAST_EUROPE, version: VERSION, year },
      markers: [], routes: [], regions: [], active_marker_id: null, sources: [],
    },
  } as unknown as WBAsset
}

beforeAll(async () => {
  (globalThis as any).ResizeObserver ??= class { observe() {} disconnect() {} }
  await loadBorders(CLIOPATRIA_EAST_EUROPE, VERSION)
  await loadPhysicalBasemap('east_europe')
})
afterEach(() => { engine.supported = true; engine.failCreate = false; engine.maps.length = 0; engine.markers.length = 0 })

async function mountCard(asset = historicalMap(), props: Record<string, unknown> = {}) {
  const w = mount(HistoricalMapCard, { props: { asset, interactive: true, ...props }, attachTo: document.body })
  await flushPromises()
  await flushPromises()
  await nextTick()
  return w
}

describe('INV-HGL-1 · є WebGL — об\'ємна карта на місці пласкої', () => {
  it('намалювалась — пласка схована, кнопки камери є; держави року — у шарі рушія', async () => {
    const w = await mountCard()
    expect(engine.maps).toHaveLength(1)
    expect(w.find('.hmap__svg').attributes('style')).toContain('display: none')
    expect(w.find('[data-testid=map-gl-tilt]').exists()).toBe(true)
    const map = engine.maps[0]
    const ds = (await loadBorders(CLIOPATRIA_EAST_EUROPE, VERSION))!
    const active = map.paint['st1-fill.fill-opacity'] ? 'st1' : 'st0'
    expect(map.sources[active].data.features).toHaveLength(statesAt(ds, 1648).length)
    expect(map.opts.scrollZoom).toBe(true)   // власник 30.10: колесо над картою — наближення карти
    expect(map.opts.canvasContextAttributes.preserveDrawingBuffer).toBe(true)
    w.unmount()
  })
})

describe('INV-HGL-1b · колесо миші над картою', () => {
  it('зі стрілкою — наближає карту й не доходить до дошки; з пером — дошці', async () => {
    const board = vi.fn()
    document.body.addEventListener('wheel', board)
    const w = await mountCard()
    await w.find('.hgl__host').trigger('wheel', { deltaY: -100 })
    expect(board).not.toHaveBeenCalled()
    await w.setProps({ interactive: false })
    await w.find('.hgl__host').trigger('wheel', { deltaY: -100 })
    expect(board).toHaveBeenCalledTimes(1)
    document.body.removeEventListener('wheel', board)
    w.unmount()
  })
})

describe('INV-HGL-2 · без WebGL чи при збої — пласка', () => {
  it('немає WebGL — рушій не вантажиться, пласка видна', async () => {
    engine.supported = false
    const w = await mountCard()
    expect(engine.maps).toHaveLength(0)
    expect(w.find('.hgl').exists()).toBe(false)
    expect(w.find('.hmap__svg').attributes('style') ?? '').not.toContain('display: none')
    expect(w.findAll('.hmap__state').length).toBeGreaterThan(5)
    w.unmount()
  })

  it('рушій не створився — пласка лишається, рік і стрілки працюють', async () => {
    engine.failCreate = true
    const w = await mountCard()
    expect(w.find('.hgl').exists()).toBe(false)
    expect(w.find('.hmap__svg').attributes('style') ?? '').not.toContain('display: none')
    await w.find('[data-testid=map-card-year-next]').trigger('click')
    expect((w.emitted('update:asset')?.[0]?.[0] as any).data.borders.year).toBe(1653)
    w.unmount()
  })
})

describe('INV-HGL-3 · рік з дошки', () => {
  it('новий рік — межі в сусідній шар, він проявляється, старий гасне; змінені — у шарі спалаху', async () => {
    const w = await mountCard(historicalMap(1648))
    const map = engine.maps[0]
    const before = map.paint['st1-fill.fill-opacity'] ? 1 : 0
    await w.setProps({ asset: historicalMap(1653) })
    await nextTick()
    const now = 1 - before
    const ds = (await loadBorders(CLIOPATRIA_EAST_EUROPE, VERSION))!
    expect(map.sources[`st${now}`].data.features).toHaveLength(statesAt(ds, 1653).length)
    expect(map.paint[`st${now}-fill.fill-opacity`]).toBe(0.94)
    expect(map.paint[`st${before}-fill.fill-opacity`]).toBe(0)
    expect(map.sources.flash.data.features.length).toBeGreaterThan(0)
    expect(w.emitted('update:asset')).toBeUndefined()
    w.unmount()
  })
})

describe('INV-HGL-4 · фізична основа — версійний файл', () => {
  it('версія, джерело, річки з назвами, міста-орієнтири; координати в межах обрізу', async () => {
    const base = (await loadPhysicalBasemap('east_europe'))!
    expect(base.meta.version).toMatch(/^v1-[0-9a-f]{10}$/)
    expect(base.meta.source.license).toBe('public domain')
    expect(base.rivers.some((r) => r.name_uk === 'Дніпро')).toBe(true)
    expect(base.cities.map((c) => c.name_uk)).toEqual(expect.arrayContaining(['Київ', 'Львів', 'Чернігів', 'Полтава']))
    const [w, s, e, n] = base.meta.box
    for (const c of base.cities) expect(c.lon >= w && c.lon <= e && c.lat >= s && c.lat <= n).toBe(true)
    expect(await loadPhysicalBasemap('world')).toBeNull()
  })

  it('у стані дошки — лише {dataset, version, year}', () => {
    const data = historicalMap().data as Record<string, unknown>
    expect(JSON.stringify(data)).not.toMatch(/rivers|cities|land/)
  })
})

describe('INV-HGL-5 · знімок для PDF — уся картка', () => {
  it('корінь історичної карти позначено гілкою DOM; звичайна карта — як була', async () => {
    const w = mount(MapCardRenderer, { props: { asset: historicalMap(), interactive: true } })
    expect(w.attributes('data-export-dom')).toBe('')
    expect(w.attributes('data-export-width')).toBe('960')
    const plain = mount(MapCardRenderer, {
      props: { asset: { ...historicalMap(), data: { ...(historicalMap().data as object), borders: undefined, historical_boundary_mode: 'none' } } as WBAsset },
    })
    expect(plain.attributes('data-export-dom')).toBeUndefined()
    w.unmount(); plain.unmount()
  })
})

// ── Закон §9 v1.79: події шкали теми на історичній карті ─────────────────────────────────────────────────────

const ev = (id: string, year: number, label: string, place?: Record<string, unknown>) => ({
  id, date_start: { year, precision: 'year' }, date_end: null, label, description: '', place_ids: [], image: null,
  sources: [], ...(place ? { place } : {}),
})
function timeline(active: string | null, events = [
  ev('e1', 1648, 'Жовті Води', { lat: 48.35, lon: 33.5 }),
  ev('e2', 1648, 'Корсунь', { lat: 49.42, lon: 31.26 }),
  ev('e3', 1654, 'Переяславська рада'),
  ev('e4', 1709, 'Полтавська битва', { lat: 49.62, lon: 34.55 }),
]): WBAsset {
  return {
    id: 'tl-1', type: 'timeline_card', src: '', x: 0, y: 700, w: 1120, h: 640, rotation: 0, locked: false,
    data: { version: 1, title: 'Хмельниччина', layout: 'ordinal', orientation: 'horizontal', view: 'axis', events, active_event_id: active, sources: [] },
  } as unknown as WBAsset
}

describe('INV-HGL-6 · місце події з джерела — при вставці перевірено', () => {
  it('межі землі й назва до 80 знаків; зіпсоване — поля немає', () => {
    expect(sanitizePlace({ lat: 49.42, lon: 31.26, label: 'Корсунь' })).toEqual({ place: { lat: 49.42, lon: 31.26, label: 'Корсунь' } })
    expect(sanitizePlace({ lat: 49.42, lon: 31.26 })).toEqual({ place: { lat: 49.42, lon: 31.26 } })
    for (const bad of [null, {}, { lat: '49', lon: 31 }, { lat: 91, lon: 0 }, { lat: 0, lon: 181 }, { lat: NaN, lon: 0 }]) {
      expect(sanitizePlace(bad)).toEqual({})
    }
    const [kept] = sanitizeEvents([ev('e1', 1648, 'Жовті Води', { lat: 48.35, lon: 33.5, label: 'х'.repeat(120) })])
    expect((kept as any).place.label).toHaveLength(80)
  })
})

describe('INV-HGL-7 · номери подій і рік карти за шкалою', () => {
  it('номери — події шкал сторінки з місцем, номер — порядок на шкалі, відкрита позначена', () => {
    const pins = timelineMapPins([timeline('e2'), historicalMap()])
    expect(pins.map((p) => [p.n, p.label, p.active])).toEqual([[1, 'Жовті Води', false], [2, 'Корсунь', true], [4, 'Полтавська битва', false]])
  })

  it('відкрита подія в роках набору — рік карти стає її роком; поза набором чи той самий рік — нічого', () => {
    const map = historicalMap(1659)
    const [moved] = linkedHistoricalMapUpdates([map, timeline('e2')], timeline('e2'), bordersYears)
    expect((moved.data as any).borders.year).toBe(1648)
    expect(linkedHistoricalMapUpdates([map], timeline('e4'), bordersYears)).toEqual([])
    expect(linkedHistoricalMapUpdates([historicalMap(1648)], timeline('e1'), bordersYears)).toEqual([])
    const other = { ...map, data: { ...(map.data as object), borders: { dataset: CLIOPATRIA_EAST_EUROPE, version: 'v0', year: 1659 } } } as WBAsset
    expect(linkedHistoricalMapUpdates([other], timeline('e2'), bordersYears)).toEqual([])
  })

  it('пульт: крок шкали — і рік карти тим самим записом', () => {
    const state = reactive({ pages: [{ assets: [timeline('e1', [ev('e1', 1648, 'Жовті Води'), ev('e3', 1654, 'Переяславська рада')]), historicalMap(1648)] }] })
    const updateAsset = vi.fn((a: WBAsset) => { state.pages[0].assets = state.pages[0].assets.map((o) => (o.id === a.id ? a : o)) })
    const adapter = createRemoteScenarioAdapter({
      pages: () => state.pages as never, currentPageIndex: () => 0,
      viewer: () => ({ isTutor: true, mode: 'edit' as never }), canWrite: () => true, updateAsset,
      view: { focusObject: vi.fn(), objectFocusId: () => null, resetFocus: vi.fn() },
    })
    adapter.timelineStep('tl-1', 1)
    expect(updateAsset).toHaveBeenCalledTimes(2)
    expect((state.pages[0].assets[1].data as any).borders.year).toBe(1654)
  })

  it('пласка карта — номери подій у роках набору, відкрита з назвою', async () => {
    engine.supported = false
    const pins = timelineMapPins([timeline('e2')])
    const w = await mountCard(historicalMap(1648), { events: pins })
    const shown = w.findAll('.hmap__pin')
    expect(shown).toHaveLength(2)
    expect(w.find('.hmap__pin.is-on').text()).toContain('Корсунь')
    w.unmount()
  })

  it('обʼємна карта — номери в шарі рушія; відкрили іншу подію — камера наближається до неї', async () => {
    const w = await mountCard(historicalMap(1648), { events: timelineMapPins([timeline('e1')]) })
    const map = engine.maps[0]
    const ease = vi.spyOn(map, 'easeTo')
    expect(map.sources.pins.data.features.map((f: any) => f.properties.n)).toEqual([1, 2])
    await w.setProps({ events: timelineMapPins([timeline('e2')]) })
    await nextTick()
    expect(ease).toHaveBeenCalledWith(expect.objectContaining({ center: [31.26, 49.42] }))
    w.unmount()
  })
})

// ── Закон §9 v1.80: персонажі й пояснення події на карті ─────────────────────────────────────────────────────
const KHM = {
  ref: { provider: 'wikidata', id: 'Q203808' }, name: 'Богдан Хмельницький', event_ids: ['e1', 'e2'],
  via: { e1: 'Хмельниччина', e2: 'Хмельниччина' },
  image: { url: 'https://upload.wikimedia.org/k.jpg', author: 'Willem Hondius', license: 'Public domain', attribution: 'Willem Hondius · Public domain', file_page: 'https://commons.wikimedia.org/wiki/File:K.jpg' },
}
const BOHUN = { ref: { provider: 'wikidata', id: 'Q730067' }, name: 'Іван Богун', event_ids: ['e2'], cmd: ['e2', 'e9'] }
const KRYV = { ref: { provider: 'wikidata', id: 'Q2624048' }, name: 'Максим Кривоніс', event_ids: ['e2'],
  image: { url: 'https://upload.wikimedia.org/m.jpg', author: 'Alex Tora', license: 'Public domain', attribution: 'Alex Tora · Public domain', file_page: '' } }
function timelineWithPeople(active: string, people: unknown[] = [KHM, BOHUN, KRYV]): WBAsset {
  const t = timeline(active, [
    { ...ev('e1', 1648, 'Жовті Води', { lat: 48.35, lon: 33.5 }), description: 'Перша перемога козацького війська.' },
    { ...ev('e2', 1648, 'Корсунь', { lat: 49.42, lon: 31.26 }), description: 'Козацько-татарське військо розбило коронне.' },
  ])
  return { ...t, data: { ...(t.data as object), people } } as WBAsset
}

describe('INV-HGL-8 · люди теми — при вставці перевірено', () => {
  it('лише події цієї шкали; портрет — https з автором і ліцензією; «через» — лише для своїх подій', () => {
    const events = sanitizeEvents([ev('e1', 1648, 'Жовті Води'), ev('e2', 1648, 'Корсунь')])
    const out = sanitizePeople([
      KHM,
      { ...BOHUN, event_ids: ['e9'] },                                                  // жодної події цієї шкали
      { ...KRYV, image: { ...KRYV.image, url: 'http://x/m.jpg' } },                   // не https — лише ім'я
      { ...KRYV, ref: { provider: 'wikidata', id: 'Q1' }, image: { ...KRYV.image, author: '' } },
      { ...KHM, ref: { provider: 'wikidata', id: 'Q2' }, via: { e1: 'Хмельниччина', e7: 'Чуже' } },
    ], events)
    const people = (out as any).people
    expect(people.map((p: any) => p.ref.id)).toEqual(['Q203808', 'Q2624048', 'Q1', 'Q2'])
    expect(people[0].image.attribution).toBe('Willem Hondius · Public domain')
    expect(people[1].image).toBeUndefined()
    expect(people[2].image).toBeUndefined()
    expect(people[3].via).toEqual({ e1: 'Хмельниччина' })
    expect(sanitizePeople('нема', events)).toEqual({})
  })

  it('номер події несе її текст і людей у порядку шкали (перший — основний)', () => {
    const [p1, p2] = timelineMapPins([timelineWithPeople('e2')])
    expect(p1.text).toBe('Перша перемога козацького війська.')
    expect(p1.people.map((x) => x.name)).toEqual(['Богдан Хмельницький'])
    expect(p2.people.map((x) => [x.name, x.via, !!x.image, x.commander])).toEqual([
      ['Богдан Хмельницький', 'Хмельниччина', true, false], ['Іван Богун', '', false, true], ['Максим Кривоніс', '', true, false]])
    const kept = (sanitizePeople([BOHUN], sanitizeEvents([ev('e2', 1648, 'Корсунь')])) as any).people[0]
    expect(kept.cmd).toEqual(['e2'])   // e9 — не подія цієї шкали
  })
})

describe('INV-HGL-9 · пояснення відкритої події на карті', () => {
  it('текст відкритої події; заголовок згортає й розгортає; згорнуте лишається згорнутим для наступної події', async () => {
    engine.supported = false
    const w = await mountCard(historicalMap(1648), { events: timelineMapPins([timelineWithPeople('e1')]) })
    const info = () => w.find('[data-testid=map-card-event-info]')
    const toggle = () => w.find('[data-testid=map-card-event-info-toggle]')
    expect(info().text()).toContain('Перша перемога козацького війська.')
    await toggle().trigger('click')
    expect(info().exists()).toBe(true)
    expect(info().text()).toContain('Жовті Води')
    expect(info().text()).not.toContain('Перша перемога')
    expect(toggle().attributes('aria-expanded')).toBe('false')
    await w.setProps({ events: timelineMapPins([timelineWithPeople('e2')]) })
    expect(info().text()).toContain('Корсунь')
    expect(info().text()).not.toContain('Козацько-татарське')
    await toggle().trigger('click')
    expect(info().text()).toContain('Козацько-татарське військо розбило коронне.')
    w.unmount()
  })
})

describe('INV-HGL-10 · персонажі: основний одразу, інші — при наближенні; «Персонажі» вимикає', () => {
  it('огляд — лише основний герой і «+2»; наблизили — троє; «Персонажі» — жодного', async () => {
    const w = await mountCard(historicalMap(1648), { events: timelineMapPins([timelineWithPeople('e2')]) })
    const map = engine.maps[0]
    const names = () => engine.markers.map((m: any) => m.el.querySelector('span')?.textContent)
    expect(names()).toEqual(['Богдан Хмельницький'])
    expect(engine.markers[0].el.querySelector('em')?.textContent).toBe('+2')
    expect(engine.markers[0].el.title).toContain('учасник: Хмельниччина')
    expect(engine.markers[0].el.hasAttribute('data-export-hide')).toBe(true)
    map.zoom = 6
    map.fire('moveend')
    expect(names()).toEqual(['Богдан Хмельницький', 'Іван Богун', 'Максим Кривоніс'])
    expect(engine.markers[1].el.title).toContain('командувач')
    expect(engine.markers[1].el.querySelector('img')).toBeNull()
    await w.find('[data-testid=map-gl-people]').trigger('click')
    expect(engine.markers).toHaveLength(0)
    w.unmount()
  })

  it('подія без людей — портретів немає, кнопки «Персонажі» теж', async () => {
    const w = await mountCard(historicalMap(1648), { events: timelineMapPins([timeline('e1')]) })
    expect(engine.markers).toHaveLength(0)
    expect(w.find('[data-testid=map-gl-people]').exists()).toBe(false)
    w.unmount()
  })
})

// ── Світова карта: будь-яка тема (власник 30.10: «універсальність, а не прив'язка до цієї теми») ──────────────
describe('INV-HGL-11 · світова карта під тему шкали', () => {
  it('регіон — з місць подій із запасом, не менше 14° × 9°; роки — з подій', () => {
    const r = topicRegion([{ lat: 48.35, lon: 33.5 }, { lat: 50.35, lon: 25.1 }])
    expect(r[0]).toBeLessThan(25.1)
    expect(r[2]).toBeGreaterThan(33.5)
    expect(r[2] - r[0]).toBeGreaterThanOrEqual(14)
    expect(r[3] - r[1]).toBeGreaterThanOrEqual(9)
    const one = topicRegion([{ lat: 40.7, lon: -74 }])
    expect(one[2] - one[0]).toBeCloseTo(14, 0)
  })

  it('далекі поодинокі місця регіону не розтягують (війна 1812 — центр Росії; Тихий океан у Другій світовій)', () => {
    const napoleon = [{ lon: 2.4, lat: 48.9 }, { lon: 8.7, lat: 44.9 }, { lon: 16.8, lat: 49.1 }, { lon: -4.2, lat: 40.2 },
      { lon: 12.4, lat: 51.3 }, { lon: 70.1, lat: 58.6 }]
    expect(mainPlaces(napoleon)).toHaveLength(5)
    expect(topicRegion(napoleon)[2]).toBeLessThan(30)
    const ww2 = [{ lon: 19, lat: 52 }, { lon: 27, lat: 65 }, { lon: 6.1, lat: 49.8 }, { lon: -2, lat: 54 }, { lon: 26, lat: 59 },
      { lon: -157.9, lat: 21.4 }, { lon: -178, lat: 30 }, { lon: 44.5, lat: 48.7 }, { lon: -0.6, lat: 49.3 }, { lon: 13.4, lat: 52.5 },
      { lon: 132.5, lat: 34.4 }]
    const kept = mainPlaces(ww2)
    expect(kept.some((p) => p.lon === 44.5)).toBe(true)          // Сталінград — у кадрі
    expect(kept.some((p) => p.lon < -150 || p.lon > 100)).toBe(false)
  })

  it('вставка: є шкала з місцями — світовий набір, регіон і роки теми, назва шкали; немає — «Східна Європа»', () => {
    const world = buildHistoricalMapAsset({ x: 0, y: 0 }, 'uk', undefined,
      { title: 'Наполеонівські війни', places: [{ lat: 48.2, lon: 16.4 }, { lat: 55.7, lon: 37.6 }], years: [1799, 1815] })
    const b = (world.data as any).borders
    expect(b).toMatchObject({ dataset: CLIOPATRIA_WORLD, version: CLIOPATRIA_WORLD_VERSION, year: 1799, years: [1799, 1815] })
    expect(b.region).toHaveLength(4)
    expect((world.data as any).title).toBe('Наполеонівські війни')
    const plain = buildHistoricalMapAsset({ x: 0, y: 0 }, 'uk')
    expect((plain.data as any).borders).toEqual({ dataset: CLIOPATRIA_EAST_EUROPE, version: VERSION, year: 1648 })
    expect(JSON.stringify(world.data)).not.toMatch(/polygons|coordinates/)
  })

  it('завантаження — лише держави регіону й років і лише їхні шматки; «великі» — за площею в регіоні', async () => {
    const index = { meta: { version: CLIOPATRIA_WORLD_VERSION, source: { title: 'Cliopatria', url: 'u', license: 'CC BY 4.0', license_url: 'l' } },
      states: [
        { id: 's1', en: 'Ottoman Empire', uk: 'Османська імперія', wd: 'Q12560', from: 1600, to: 1700, bbox: [20, 30, 45, 48], label: [35, 40], pack: 'a' },
        { id: 's2', en: 'Kingdom of France', uk: 'Франція', wd: 'Q70972', from: 1600, to: 1700, bbox: [-5, 42, 8, 51], label: [2, 47], pack: 'b' },
        { id: 's3', en: 'Inca Empire', uk: 'Інки', wd: 'Q28573', from: 1438, to: 1533, bbox: [-80, -30, -60, 0], label: null, pack: 'c' },
      ] }
    const asked: string[] = []
    const fetchMock = vi.fn(async (url: string) => {
      asked.push(url)
      const body = url.endsWith('index.json') ? index
        : url.endsWith('/a.json') ? { s1: [[[[20, 30], [45, 30], [45, 48], [20, 30]]]] }
          : url.endsWith('/b.json') ? { s2: [[[[-5, 42], [8, 42], [8, 51], [-5, 42]]]] } : {}
      return { ok: true, json: async () => body }
    })
    vi.stubGlobal('fetch', fetchMock)
    const data = await loadBordersFor({ dataset: CLIOPATRIA_WORLD, version: CLIOPATRIA_WORLD_VERSION, year: 1650,
      region: [15, 35, 40, 55], years: [1648, 1687] })
    vi.unstubAllGlobals()
    expect(data!.states.map((s) => [s.entity, s.name_uk])).toEqual([['ottoman', 'Османська імперія']])
    expect(asked.some((u) => u.endsWith('/b.json') || u.endsWith('/c.json'))).toBe(false)
    expect(data!.big).toEqual(['ottoman'])
    expect(data!.meta.change_years).toEqual([1648])
    expect(bordersYears({ dataset: CLIOPATRIA_WORLD, version: CLIOPATRIA_WORLD_VERSION, year: 1650, years: [1648, 1687] })).toEqual([1648, 1687])
  })

  it('обʼємна карта («Східна Європа»): міста — лише з року заснування', async () => {
    const w = await mountCard(historicalMap(1648))
    const map = engine.maps[0]
    expect(map.layers.cities.filter).toEqual(['<=', ['get', 'from'], 1648])
    await w.setProps({ asset: historicalMap(1653) })
    await nextTick()
    expect(map.paint['cities.filter']).toEqual(['<=', ['get', 'from'], 1653])
    w.unmount()
  })
})
