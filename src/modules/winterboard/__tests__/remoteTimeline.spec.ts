/**
 * Шкала подій на пульті (LAW §9 v1.75; власник 2026-10-29: «Розгортати на цілий екран. Переключати події. Або вмикати.
 * Або ставити на паузу»).
 *
 * ІНВАРІАНТИ
 *   INV-TLR-1  стан: картка шкали сторінки, що на екрані, несе event_count / event_index / event_title; `playing` —
 *              лише шкала з віссю; інші сторінки й інші картки — без цих полів (П1: немає подій — немає кнопок)
 *   INV-TLR-2  крок — той самий запис, що кнопки картки: один asset_update `active_event_id` (з картою того самого
 *              набору — ще її підсвітка); жодна не відкрита — ▶ першу, ◀ останню; на межі — нічого
 *   INV-TLR-3  умови — як на дошці: учитель, редагування, запис можливий, шкала не згорнута; інакше нічого
 *   INV-TLR-4  «по черзі» — той самий ▶, що на картці (спільний стан екрана); вмикати — лише шкала з віссю, яку можна
 *              писати; зупинити — завжди
 *   INV-TLR-5  «На весь екран» — той самий board-expand, що ⛶ на картці; focus_id називає шкалу хоч би хто розгорнув;
 *              «Уся сторінка» згортає; інші картки «на весь екран» не мають
 *   INV-TLR-6  телефон: розбір полів — дзеркало сервера; кнопки — ◀ назва ▶, ▶/❚❚ (лише з `playing`), ⛶/▭
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import { createRemoteScenarioAdapter } from '../remote/remoteScenarioAdapter'
import { createRemoteViewAdapter } from '../composables/useRemoteViewAdapter'
import { useBoardRemote } from '../composables/useBoardRemote'
import { parseRemoteScenario, type RemoteScenarioItem } from '../composables/useRemoteChannel'
import { isTimelinePlaying, setTimelinePlaying } from '../board/timelinePlayback'
import RemoteObjectControls from '../components/remote/RemoteObjectControls.vue'
import TimelineCardRenderer from '../components/board/objects/TimelineCardRenderer.vue'
import type { WBAsset } from '../types/winterboard'

vi.mock('@/utils/media', () => ({ resolveMediaUrl: (u: string) => u }))

const ev = (id: string, year: number, label: string, extra: Record<string, unknown> = {}) => ({
  id, date_start: { year, precision: 'year' }, date_end: null, label, description: `Про ${label}.`,
  place_ids: [], image: null, sources: [], ...extra,
})

function timeline(id: string, data: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): WBAsset {
  return {
    id, type: 'timeline_card', src: '', x: 0, y: 0, w: 1120, h: 640, rotation: 0, locked: false,
    data: {
      version: 1, title: 'Кримська війна', layout: 'ordinal', orientation: 'horizontal', view: 'axis',
      events: [ev('e1', 1853, 'Синопська битва'), ev('e2', 1854, 'Облога   Севастополя'), ev('e3', 1856, 'Паризький мир')],
      active_event_id: 'e1', sources: [], ...data,
    },
    ...extra,
  } as unknown as WBAsset
}

const theory = (id: string) =>
  ({ id, type: 'theory_card', x: 0, y: 700, w: 400, h: 200, rotation: 0, locked: false, data: { title: 'Конспект' } }) as unknown as WBAsset

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

afterEach(() => {
  for (const id of ['tl-1', 'tl-2', 'tl-old']) setTimelinePlaying(id, false)
  vi.useRealTimers()
})

// ── INV-TLR-1 · стан ─────────────────────────────────────────────────────────

describe('INV-TLR-1 · шкала в стані пульта', () => {
  it('відкрита подія: скільки, яка і її назва (пробіли стиснуто); «грає» — зі спільного стану', () => {
    const { adapter } = setup([[timeline('tl-1', { active_event_id: 'e2' })]])
    expect(adapter.state().items[0]).toMatchObject({
      object_id: 'tl-1', kind: 'card', event_count: 3, event_index: 1, event_title: 'Облога Севастополя', playing: false,
    })
    setTimelinePlaying('tl-1', true)
    expect(adapter.state().items[0].playing).toBe(true)
  })

  it('жодна подія не відкрита — без індексу й назви; старий список — без «по черзі»', () => {
    const { adapter } = setup([[timeline('tl-1', { active_event_id: null }), timeline('tl-old', { view: undefined }, { y: 800 })]])
    const [axis, old] = adapter.state().items
    expect(axis).toMatchObject({ event_count: 3 })
    expect(axis).not.toHaveProperty('event_index')
    expect(axis).not.toHaveProperty('event_title')
    expect(old).toMatchObject({ event_count: 3, event_index: 0 })
    expect(old).not.toHaveProperty('playing')
  })

  it('інша картка й шкала без подій — полів немає', () => {
    const { adapter } = setup([[theory('th-1'), timeline('tl-2', { events: [], active_event_id: null }, { y: 900 })]])
    for (const item of adapter.state().items) {
      expect(item).not.toHaveProperty('event_count')
      expect(item).not.toHaveProperty('playing')
    }
  })
})

// ── INV-TLR-2 / 3 · крок ─────────────────────────────────────────────────────

describe('INV-TLR-2 · крок — той самий запис, що кнопки картки', () => {
  it('▶ і ◀ — один asset_update active_event_id; на межі — нічого', () => {
    const { adapter, updateAsset, state } = setup([[timeline('tl-1')]])
    adapter.timelineStep('tl-1', 1)
    expect(updateAsset).toHaveBeenCalledTimes(1)
    expect((updateAsset.mock.calls[0][0] as any).data.active_event_id).toBe('e2')
    expect((updateAsset.mock.calls[0][0] as any).data.title).toBe('Кримська війна')
    adapter.timelineStep('tl-1', -1)
    adapter.timelineStep('tl-1', -1)          // уже перша
    expect(updateAsset).toHaveBeenCalledTimes(2)
    expect((state.pages[0].assets[0] as any).data.active_event_id).toBe('e1')
  })

  it('жодна не відкрита — «Наступна» відкриває першу, «Попередня» — останню', () => {
    const first = setup([[timeline('tl-1', { active_event_id: null })]])
    first.adapter.timelineStep('tl-1', 1)
    expect((first.updateAsset.mock.calls[0][0] as any).data.active_event_id).toBe('e1')
    const last = setup([[timeline('tl-1', { active_event_id: null })]])
    last.adapter.timelineStep('tl-1', -1)
    expect((last.updateAsset.mock.calls[0][0] as any).data.active_event_id).toBe('e3')
  })

  it('з картою того самого набору — ще її підсвітка (як на картці)', () => {
    const map = { id: 'map-1', type: 'map_card', x: 0, y: 700, w: 400, h: 300, rotation: 0, locked: false,
      data: { knowledge_set_id: 'ks-1', markers: [{ id: 'm-sev' }], active_marker_id: null } } as unknown as WBAsset
    const tl = timeline('tl-1', { knowledge_set_id: 'ks-1',
      events: [ev('e1', 1853, 'Синоп'), ev('e2', 1854, 'Севастополь', { place_ids: ['m-sev'] })] })
    const { adapter, updateAsset } = setup([[tl, map]])
    adapter.timelineStep('tl-1', 1)
    expect(updateAsset).toHaveBeenCalledTimes(2)
    expect((updateAsset.mock.calls[1][0] as any)).toMatchObject({ id: 'map-1', data: { active_marker_id: 'm-sev' } })
  })
})

describe('INV-TLR-3 · умови — як на дошці', () => {
  it.each([
    ['учень', { isTutor: false }],
    ['перегляд', { mode: 'view' }],
    ['запис неможливий', { canWrite: false }],
  ])('%s — нічого', (_name, opts) => {
    const { adapter, updateAsset } = setup([[timeline('tl-1')]], opts)
    adapter.timelineStep('tl-1', 1)
    adapter.timelinePlay('tl-1')
    expect(updateAsset).not.toHaveBeenCalled()
    expect(isTimelinePlaying('tl-1')).toBe(false)
  })

  it('згорнута, інша сторінка, не шкала — нічого', () => {
    const { adapter, updateAsset } = setup([[timeline('tl-1', {}, { minimized: true }), theory('th-1')], [timeline('tl-2')]])
    adapter.timelineStep('tl-1', 1)
    adapter.timelineStep('tl-2', 1)
    adapter.timelineStep('th-1', 1)
    adapter.timelinePlay('tl-1')
    expect(updateAsset).not.toHaveBeenCalled()
    expect(isTimelinePlaying('tl-1')).toBe(false)
  })
})

// ── INV-TLR-4 · «по черзі» ───────────────────────────────────────────────────

describe('INV-TLR-4 · «по черзі» — той самий ▶, що на картці', () => {
  const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

  it('пульт вмикає — таймер картки робить крок її записом; ❚❚ зупиняє', async () => {
    vi.useFakeTimers()
    const { adapter } = setup([[timeline('tl-1')]])
    const w = mount(TimelineCardRenderer, { props: { asset: timeline('tl-1'), interactive: true }, global: { plugins: [i18n()] } })
    adapter.timelinePlay('tl-1')
    await w.vm.$nextTick()
    expect(w.find('[data-testid="timeline-axis-play"]').text()).toBe('❚❚')
    vi.advanceTimersByTime(4500)
    const updates = w.emitted('update:asset')!
    expect(updates).toHaveLength(1)
    expect((updates[0][0] as WBAsset).data).toMatchObject({ active_event_id: 'e2' })
    adapter.timelinePause('tl-1')
    await w.vm.$nextTick()
    vi.advanceTimersByTime(20_000)
    expect(w.emitted('update:asset')).toHaveLength(1)
    expect(w.find('[data-testid="timeline-axis-play"]').text()).toBe('▶')
    w.unmount()
  })

  it('▶ на картці — пульт бачить «грає»; картка зникла — не грає', async () => {
    const { adapter } = setup([[timeline('tl-1')]])
    const w = mount(TimelineCardRenderer, { props: { asset: timeline('tl-1'), interactive: true }, global: { plugins: [i18n()] } })
    await w.find('[data-testid="timeline-axis-play"]').trigger('click')
    expect(adapter.state().items[0].playing).toBe(true)
    w.unmount()
    expect(adapter.state().items[0].playing).toBe(false)
  })

  it('старий список «по черзі» не вмикає; зупинити — завжди', () => {
    const { adapter } = setup([[timeline('tl-old', { view: undefined })]])
    adapter.timelinePlay('tl-old')
    expect(isTimelinePlaying('tl-old')).toBe(false)
    // зупинка нічого не пише — діє і для учня, і в перегляді
    const viewer = setup([[timeline('tl-1')]], { isTutor: false })
    setTimelinePlaying('tl-1', true)
    viewer.adapter.timelinePause('tl-1')
    expect(isTimelinePlaying('tl-1')).toBe(false)
  })
})

// ── INV-TLR-5 · на весь екран ────────────────────────────────────────────────

describe('INV-TLR-5 · «На весь екран» шкали = ⛶ на картці', () => {
  it('сценарій: шкала — до вигляду; інша картка — ні; згорнута — ні', () => {
    const { adapter, view } = setup([[timeline('tl-1'), theory('th-1'), timeline('tl-2', {}, { minimized: true, y: 900 })]])
    adapter.focus('th-1')
    adapter.focus('tl-2')
    expect(view.focusObject).not.toHaveBeenCalled()
    adapter.focus('tl-1')
    expect(view.focusObject).toHaveBeenCalledWith('tl-1')
  })

  function makeStore(assets: any[]) {
    const store: any = {
      containerWidth: 1000, containerHeight: 600, pageWidth: 2000, pageHeight: 1500, zoom: 1, scrollX: 0, scrollY: 0,
      expandedAssetId: null, currentPageIndex: 0, pages: [{ assets }],
      setZoom: vi.fn(), setScroll: vi.fn(), updateAsset: vi.fn(),
    }
    return store
  }

  it('вигляд: board-expand без зміни масштабу; focus_id — шкала; «Уся сторінка» згортає', () => {
    const store = makeStore([timeline('tl-1')])
    const v = createRemoteViewAdapter(store)
    expect(v.focusObject('tl-1')).toBe(true)
    expect(store.expandedAssetId).toBe('tl-1')
    expect(store.setZoom).not.toHaveBeenCalled()
    expect(v.objectFocusId()).toBe('tl-1')
    v.resetFocus()
    expect(store.expandedAssetId).toBeNull()
    expect(v.objectFocusId()).toBeNull()
  })

  it('розгорнули ⛶ на картці — пульт теж бачить шкалу на весь екран; задача розгорнута — ні', () => {
    const store = makeStore([timeline('tl-1'), { id: 'task-1', type: 'nmt_task', x: 0, y: 700, w: 400, h: 200, data: {} }])
    const v = createRemoteViewAdapter(store)
    store.expandedAssetId = 'tl-1'
    expect(v.objectFocusId()).toBe('tl-1')
    store.expandedAssetId = 'task-1'
    expect(v.objectFocusId()).toBeNull()
  })
})

// ── INV-TLR-6 · телефон ──────────────────────────────────────────────────────

describe('INV-TLR-6 · телефон: розбір', () => {
  const raw = (extra: Record<string, unknown>, kind = 'card') => ({
    focus_id: null, items: [{ object_id: 'tl-1', kind, title: 'Кримська війна', page_index: 0, minimized: false, ...extra }],
  })

  it('поля шкали — у картки', () => {
    expect(parseRemoteScenario(raw({ event_count: 3, event_index: 1, event_title: 'Облога', playing: true }))!.items[0])
      .toMatchObject({ eventCount: 3, eventIndex: 1, eventTitle: 'Облога', playing: true })
    expect(parseRemoteScenario(raw({ event_count: 3 }))!.items[0]).toMatchObject({ eventCount: 3 })
  })

  it.each([
    [{ event_count: 0 }], [{ event_count: 101 }], [{ event_count: 2.5 }], [{ event_index: 0 }],
    [{ event_count: 3, event_index: 3 }], [{ event_count: 3, event_title: 'x' }], [{ event_count: 3, playing: 'так' }],
    [{ playing: true }],
  ])('зіпсоване %j — сценарій відкидається цілим', (extra) => {
    expect(parseRemoteScenario(raw(extra))).toBeUndefined()
  })

  it('не картка з полями шкали — відкидається', () => {
    expect(parseRemoteScenario(raw({ event_count: 3 }, 'image'))).toBeUndefined()
  })
})

describe('INV-TLR-6 · телефон: кнопки', () => {
  const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })
  const item = (extra: Partial<RemoteScenarioItem>): RemoteScenarioItem =>
    ({ objectId: 'tl-1', kind: 'card', title: 'Кримська війна', pageIndex: 0, minimized: false, ...extra })
  const mountItem = (it: RemoteScenarioItem, focusId: string | null = null, ready = true) => mount(RemoteObjectControls, {
    props: { item: it, focusId, ready, idPrefix: 'object', variant: 'main' },
    global: { plugins: [i18n] },
  })
  const sent = (w: ReturnType<typeof mountItem>) => (w.emitted('send') ?? []).map(([cmd, args]) => [cmd, args])

  it('◀ назва ▶, стан «подія 2 з 3», «по черзі», ⛶ — команди з адресою', async () => {
    const w = mountItem(item({ eventCount: 3, eventIndex: 1, eventTitle: 'Облога Севастополя', playing: false }))
    expect(w.find('[data-testid=object-event-label]').text()).toBe('Облога Севастополя')
    expect(w.find('[data-testid=object-status]').text()).toBe('подія 2 з 3')
    await w.find('[data-testid=object-event-prev]').trigger('click')
    await w.find('[data-testid=object-event-next]').trigger('click')
    await w.find('[data-testid=object-tell]').trigger('click')
    await w.find('[data-testid=object-tell-stop]').trigger('click')
    await w.find('[data-testid=object-focus]').trigger('click')
    expect(sent(w)).toEqual([
      ['timeline.step', { object_id: 'tl-1', dir: -1 }],
      ['timeline.step', { object_id: 'tl-1', dir: 1 }],
      ['timeline.play', { object_id: 'tl-1' }],
      ['timeline.pause', { object_id: 'tl-1' }],
      ['view.focus', { object_id: 'tl-1' }],
    ])
  })

  it('грає — «▶ Розповідає» підсвічена, зелена крапка; на весь екран — «▭ Уся сторінка»', async () => {
    const w = mountItem(item({ eventCount: 3, eventIndex: 0, eventTitle: 'Синоп', playing: true }), 'tl-1')
    const tell = w.find('[data-testid=object-tell]')
    expect(tell.text()).toContain('Розповідає')
    expect(tell.classes()).toContain('wb-scn__btn--playing')
    expect(w.find('[data-testid=object-status]').classes()).toContain('wb-scn__status--playing')
    expect(w.find('[data-testid=object-focus]').exists()).toBe(false)
    await w.find('[data-testid=object-whole-page]').trigger('click')
    expect(sent(w)).toEqual([['view.page', {}]])
  })

  it('на першій події ◀ сіра, тап — причина; жодна не відкрита — обидві стрілки діють', async () => {
    const w = mountItem(item({ eventCount: 3, eventIndex: 0, eventTitle: 'Синоп' }))
    expect(w.find('[data-testid=object-event-prev]').attributes('disabled')).toBeDefined()
    await w.find('[data-testid=object-event-prev]').element.parentElement!.dispatchEvent(new Event('click'))
    await w.vm.$nextTick()
    expect(w.find('[data-testid=object-why]').text()).toBe('Це перша подія')
    const none = mountItem(item({ eventCount: 3 }))
    expect(none.find('[data-testid=object-event-label]').text()).toBe('Подію не відкрито')
    expect(none.find('[data-testid=object-status]').text()).toBe('подій: 3, жодна не відкрита')
    expect(none.find('[data-testid=object-event-prev]').attributes('disabled')).toBeUndefined()
    expect(none.find('[data-testid=object-event-next]').attributes('disabled')).toBeUndefined()
  })

  it('старий список — без «по черзі»; звичайна картка — лише «Згорнути», як до v1.75', () => {
    const old = mountItem(item({ eventCount: 2, eventIndex: 0, eventTitle: 'А' }))
    expect(old.find('[data-testid=object-tell]').exists()).toBe(false)
    expect(old.find('[data-testid=object-event-next]').exists()).toBe(true)
    const plain = mountItem(item({}))
    expect(plain.find('[data-testid=object-event-label]').exists()).toBe(false)
    expect(plain.find('[data-testid=object-focus]').exists()).toBe(false)
    expect(plain.find('[data-testid=object-minimize]').exists()).toBe(true)
  })
})

// ── ноутбук приймає команди шкали з каналу (другий рубіж після сервера) ─────

describe('ноутбук: команди timeline.* — в адаптер сценарію', () => {
  const mounted: Array<{ unmount: () => void }> = []
  afterEach(() => { while (mounted.length) mounted.pop()!.unmount() })

  function laptop() {
    const store = reactive({ currentPageIndex: 0, pageCount: 1, goToPage: vi.fn(), addPage: vi.fn() })
    const scenario = {
      state: vi.fn(() => ({ focus_id: null, items: [] })),
      play: vi.fn(), pause: vi.fn(), volume: vi.fn(), focus: vi.fn(), minimize: vi.fn(), restore: vi.fn(), docPage: vi.fn(),
      timelineStep: vi.fn(), timelinePlay: vi.fn(), timelinePause: vi.fn(),
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
    return { fire, scenario }
  }

  it('крок ±1, «по черзі», стоп — з адресою; інший крок і без адреси — ігнор', () => {
    const { fire, scenario } = laptop()
    fire('timeline.step', { object_id: 'tl-1', dir: 1 })
    fire('timeline.step', { object_id: 'tl-1', dir: -1 })
    fire('timeline.step', { object_id: 'tl-1', dir: 2 })
    fire('timeline.step', { dir: 1 })
    fire('timeline.play', { object_id: 'tl-1' })
    fire('timeline.pause', { object_id: 'tl-1' })
    fire('timeline.play', {})
    expect(scenario.timelineStep.mock.calls).toEqual([['tl-1', 1], ['tl-1', -1]])
    expect(scenario.timelinePlay.mock.calls).toEqual([['tl-1']])
    expect(scenario.timelinePause.mock.calls).toEqual([['tl-1']])
  })
})

