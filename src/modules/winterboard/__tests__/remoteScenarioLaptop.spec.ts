/**
 * «Сценарій» на ноутбуці (LAW §9 v1.15, ТЗ §3–§4.6): список для пульта і виконання наміру.
 *
 * ІНВАРІАНТИ
 *   INV-SCN-1  список = відео, аудіо й документи УСІХ сторінок у порядку сторінок, у сторінці
 *              згори вниз, потім зліва направо; `kind` — наш вид; ≤ 50; id > 64 — поза списком
 *   INV-SCN-2  стан відтворення, гучність і сторінка документа — лише для поточної сторінки
 *   INV-SCN-3  команда діє лише на об'єкт поточної сторінки зі списку сценарію
 *   INV-SCN-4  «Згорнути» / «Повернути» / сторінка документа — ті самі умови й той самий
 *              asset_update, що кнопки дошки; без можливості запису — нічого
 *   INV-SCN-5  «На весь екран» — полотно цього екрана до об'єкта (відступ 24 px, межі
 *              масштабу), за справжнім положенням аркуша (center − scroll); «Уся сторінка»
 *              і зміна сторінки повертають вигляд до першого показу; показ один за раз
 *   INV-SCN-6  ноутбук оголошує `caps ∋ 'scenario'` і шле поле `scenario` лише з адаптером
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'
import { mount } from '@vue/test-utils'

const players = vi.hoisted(() => ({
  playVideo: vi.fn(), pauseVideo: vi.fn(), changeVideoVolume: vi.fn(),
  playMedia: vi.fn(), pauseMedia: vi.fn(), changeMediaVolume: vi.fn(),
}))

vi.mock('../board/youtubeRemoteControl', async () => {
  const { reactive } = await import('vue')
  return {
    playVideo: players.playVideo, pauseVideo: players.pauseVideo, changeVideoVolume: players.changeVideoVolume,
    ytPlayStates: reactive({}), ytPlayErrors: reactive({}), ytVolumes: reactive({}),
  }
})
vi.mock('../board/htmlMediaRemoteControl', async () => {
  const { reactive } = await import('vue')
  return {
    playMedia: players.playMedia, pauseMedia: players.pauseMedia, changeMediaVolume: players.changeMediaVolume,
    mediaPlayStates: reactive({}), mediaPlayErrors: reactive({}), mediaVolumes: reactive({}),
  }
})

import { ytPlayErrors, ytPlayStates, ytVolumes } from '../board/youtubeRemoteControl'
import { mediaPlayStates, mediaVolumes } from '../board/htmlMediaRemoteControl'
import { createRemoteScenarioAdapter, scenarioKind, SCENARIO_ITEMS_MAX } from '../remote/remoteScenarioAdapter'
import { closeMediaShow, mediaShow } from '../board/mediaShow'
import { createRemoteViewAdapter, FOCUS_MARGIN_PX, TASK_ASSET_TYPE } from '../composables/useRemoteViewAdapter'
import { useBoardRemote } from '../composables/useBoardRemote'
import type { WBAsset } from '../types/winterboard'

const asset = (id: string, type: string, x: number, y: number, extra: Record<string, unknown> = {}) =>
  ({ id, type, x, y, w: 320, h: 180, rotation: 0, locked: false, ...extra } as unknown as WBAsset)

function scenarioSetup(pages: WBAsset[][], opts: { current?: number; mode?: string; canWrite?: boolean } = {}) {
  const state = reactive({ pages: pages.map((assets) => ({ assets })), current: opts.current ?? 0, mode: opts.mode ?? 'edit' })
  const updateAsset = vi.fn((a: WBAsset) => {
    const page = state.pages[state.current]
    page.assets = page.assets.map((o) => (o.id === a.id ? a : o))
  })
  const view = { focusObject: vi.fn(() => true), objectFocusId: vi.fn(() => null as string | null), resetFocus: vi.fn() }
  const canWrite = vi.fn(() => opts.canWrite ?? true)
  const adapter = createRemoteScenarioAdapter({
    pages: () => state.pages,
    currentPageIndex: () => state.current,
    viewer: () => ({ isTutor: true, mode: state.mode }),
    canWrite,
    updateAsset,
    view,
  })
  return { adapter, state, updateAsset, view, canWrite }
}

beforeEach(() => {
  Object.values(players).forEach((f) => f.mockReset())
  for (const r of [ytPlayStates, ytPlayErrors, ytVolumes, mediaPlayStates, mediaVolumes] as Record<string, unknown>[]) {
    for (const k of Object.keys(r)) delete r[k]
  }
})

// ── INV-SCN-1 / 2 · список ───────────────────────────────────────────────────

describe('INV-SCN-1 · список сценарію', () => {
  it('вид — наш, а не провайдер: YouTube і файл = video; документ — за content_type', () => {
    expect(scenarioKind({ type: 'youtube_player' })).toBe('video')
    expect(scenarioKind({ type: 'video_player' })).toBe('video')
    expect(scenarioKind({ type: 'audio_player' })).toBe('audio')
    expect(scenarioKind({ type: 'document_viewer', content_ref: { content_type: 'presentation' } })).toBe('presentation')
    expect(scenarioKind({ type: 'document_viewer', content_ref: { content_type: 'pdf' } })).toBe('pdf')
    expect(scenarioKind({ type: 'document_viewer', content_ref: { content_type: 'document' } })).toBe('document')
    expect(scenarioKind({ type: 'document_viewer' })).toBe('document')
    for (const t of ['image', 'nmt_task', 'theory_card', 'sticky']) expect(scenarioKind({ type: t }), t).toBeNull()
  })

  // v1.25 (2026-10-06): раніше тут стверджувалось «інші картки не потрапляють» — тепер картинка
  // й картка ПОТОЧНОЇ сторінки в списку є (власник: «згортати, розгортати з пульта»); задача НМТ
  // і картки інших сторінок — як і раніше, ні.
  it('порядок: сторінки, у сторінці згори вниз і зліва направо; картка й картинка — лише поточної', () => {
    const { adapter } = scenarioSetup([
      [asset('p0-late', 'audio_player', 500, 400), asset('img', 'image', 0, 0), asset('p0-first', 'youtube_player', 900, 10),
        asset('task0', TASK_ASSET_TYPE, 0, 600)],
      [],
      [asset('p2-b', 'document_viewer', 400, 100, { content_ref: { content_type: 'pdf' } }),
        asset('p2-a', 'video_player', 100, 100), asset('task', TASK_ASSET_TYPE, 0, 0), asset('img2', 'image', 0, 50)],
    ])
    const { items } = adapter.state()
    expect(items.map((i) => [i.object_id, i.page_index, i.kind])).toEqual([
      ['img', 0, 'image'], ['p0-first', 0, 'video'], ['p0-late', 0, 'audio'], ['p2-a', 2, 'video'], ['p2-b', 2, 'pdf'],
    ])
  })

  it('назва — з об\'єкта (≤ 200) або порожня; згорнуте позначене', () => {
    const { adapter } = scenarioSetup([[
      asset('a', 'video_player', 0, 0, { title: 'т'.repeat(250) }),
      asset('b', 'audio_player', 0, 10, { minimized: true }),
    ]])
    const [a, b] = adapter.state().items
    expect(a.title).toHaveLength(200)
    expect(b.title).toBe('')
    expect(b.minimized).toBe(true)
  })

  it(`не більше ${SCENARIO_ITEMS_MAX}; id довший за 64 — поза списком (сервер відкинув би все поле)`, () => {
    const many = Array.from({ length: 60 }, (_, i) => asset(`v-${i}`, 'video_player', 0, i))
    const { adapter } = scenarioSetup([[asset('x'.repeat(65), 'video_player', 0, -1), ...many]])
    const { items } = adapter.state()
    expect(items).toHaveLength(SCENARIO_ITEMS_MAX)
    expect(items.some((i) => i.object_id.length > 64)).toBe(false)
  })
})

describe('INV-SCN-2 · живі поля — лише для поточної сторінки', () => {
  it('YouTube: стан, помилка й гучність; файл/аудіо: стан і гучність; документ: сторінка', () => {
    ytPlayStates['yt-1'] = 'error'; ytPlayErrors['yt-1'] = 'not_embeddable'; ytVolumes['yt-1'] = 40
    mediaPlayStates['aud-1'] = 'playing'; mediaVolumes['aud-1'] = 60
    mediaPlayStates['vid-far'] = 'playing'
    const { adapter } = scenarioSetup([
      [
        asset('yt-1', 'youtube_player', 0, 0),
        asset('aud-1', 'audio_player', 0, 10),
        asset('vid-2', 'video_player', 0, 20),
        asset('doc-1', 'document_viewer', 0, 30, { currentPage: 2, totalPages: 12, content_ref: { content_type: 'presentation' } }),
        asset('doc-0', 'document_viewer', 0, 40, { currentPage: 0, totalPages: 0 }),
      ],
      [asset('vid-far', 'video_player', 0, 0)],
    ])
    const byId = Object.fromEntries(adapter.state().items.map((i) => [i.object_id, i]))
    expect(byId['yt-1']).toMatchObject({ state: 'error', error: 'not_embeddable', volume: 40 })
    expect(byId['aud-1']).toMatchObject({ state: 'playing', volume: 60 })
    expect(byId['vid-2'].state).toBe('idle')
    expect(byId['vid-2']).not.toHaveProperty('volume')     // елемента ще нема — поля нема
    expect(byId['doc-1']).toMatchObject({ doc_page: 2, doc_pages: 12 })
    expect(byId['doc-0']).not.toHaveProperty('doc_pages')   // невідома кількість сторінок
    // інша сторінка — лише значок і назва
    expect(byId['vid-far']).not.toHaveProperty('state')
    expect(byId['doc-1']).not.toHaveProperty('volume')
  })
})

// ── INV-SCN-3 / 4 · команди ──────────────────────────────────────────────────

describe('INV-SCN-3 · команда — лише для об\'єкта поточної сторінки зі списку', () => {
  it('▶/⏸/гучність: YouTube → плеєр YouTube, файл і аудіо → HTML-програвач', () => {
    const { adapter } = scenarioSetup([[
      asset('yt-1', 'youtube_player', 0, 0), asset('vid-1', 'video_player', 0, 10), asset('aud-1', 'audio_player', 0, 20),
    ]])
    adapter.play('yt-1'); adapter.pause('yt-1'); adapter.volume('yt-1', 1)
    adapter.play('vid-1'); adapter.pause('aud-1'); adapter.volume('aud-1', -1)
    expect(players.playVideo).toHaveBeenCalledWith('yt-1')
    expect(players.pauseVideo).toHaveBeenCalledWith('yt-1')
    expect(players.changeVideoVolume).toHaveBeenCalledWith('yt-1', 1)
    expect(players.playMedia).toHaveBeenCalledWith('vid-1')
    expect(players.pauseMedia).toHaveBeenCalledWith('aud-1')
    expect(players.changeMediaVolume).toHaveBeenCalledWith('aud-1', -1)
  })

  // v1.25: картинка поточної сторінки тепер у списку й керується (INV-SCN-7) — тут лишились
  // об'єкт іншої сторінки, невідомий id і задача НМТ.
  it('об\'єкт іншої сторінки, невідомий id чи задача НМТ — команди ігноруються', () => {
    const { adapter, updateAsset, view } = scenarioSetup([
      [asset('task', TASK_ASSET_TYPE, 0, 0)],
      [asset('vid-far', 'video_player', 0, 0), asset('img-far', 'image', 0, 0)],
    ])
    for (const id of ['vid-far', 'img-far', 'nope', 'task']) {
      adapter.play(id); adapter.pause(id); adapter.volume(id, 1); adapter.focus(id)
      adapter.minimize(id); adapter.restore(id); adapter.docPage(id, 1)
    }
    Object.values(players).forEach((f) => expect(f).not.toHaveBeenCalled())
    expect(updateAsset).not.toHaveBeenCalled()
    expect(view.focusObject).not.toHaveBeenCalled()
  })

  it('згорнутий програвач не запускається (мовчить, §4.1); на весь екран — ні аудіо, ні згорнуте', () => {
    const { adapter, view } = scenarioSetup([[
      asset('vid-1', 'video_player', 0, 0, { minimized: true }), asset('aud-1', 'audio_player', 0, 10),
      asset('doc-1', 'document_viewer', 0, 20, { totalPages: 3 }),
    ]])
    adapter.play('vid-1')
    expect(players.playMedia).not.toHaveBeenCalled()
    adapter.focus('aud-1'); adapter.focus('vid-1')
    expect(view.focusObject).not.toHaveBeenCalled()
    adapter.focus('doc-1')
    expect(view.focusObject).toHaveBeenCalledWith('doc-1')
  })
})

describe('INV-SCN-4 · запис — ті самі умови й той самий asset_update, що кнопки дошки', () => {
  it('«Згорнути»: пауза, потім один asset_update лише з minimized; «на весь екран» — спершу «Уся сторінка»', () => {
    const { adapter, updateAsset, view } = scenarioSetup([[asset('vid-1', 'video_player', 0, 0, { title: 'Маятник' })]])
    view.objectFocusId.mockReturnValue('vid-1')
    adapter.minimize('vid-1')
    expect(view.resetFocus).toHaveBeenCalledTimes(1)
    expect(players.pauseMedia).toHaveBeenCalledWith('vid-1')
    expect(updateAsset).toHaveBeenCalledTimes(1)
    const written = updateAsset.mock.calls[0][0] as WBAsset
    expect(written).toMatchObject({ id: 'vid-1', minimized: true, title: 'Маятник', x: 0, y: 0 })
    // уже згорнуте — вдруге не пишеться
    adapter.minimize('vid-1')
    expect(updateAsset).toHaveBeenCalledTimes(1)
  })

  it('«Повернути»: лише згорнуте; той самий об\'єкт на тому самому місці', () => {
    const { adapter, updateAsset } = scenarioSetup([[
      asset('aud-1', 'audio_player', 40, 50, { minimized: true }), asset('aud-2', 'audio_player', 0, 60),
    ]])
    adapter.restore('aud-2')
    expect(updateAsset).not.toHaveBeenCalled()
    adapter.restore('aud-1')
    expect(updateAsset.mock.calls[0][0]).toMatchObject({ id: 'aud-1', minimized: false, x: 40, y: 50 })
  })

  it('сторінка документа: ±1 у межах, на межі нічого; як стрілки картки', () => {
    const { adapter, updateAsset } = scenarioSetup([[
      asset('doc-1', 'document_viewer', 0, 0, { currentPage: 0, totalPages: 3 }),
    ]])
    adapter.docPage('doc-1', -1)
    expect(updateAsset).not.toHaveBeenCalled()
    adapter.docPage('doc-1', 1)
    adapter.docPage('doc-1', 1)
    adapter.docPage('doc-1', 1)
    expect(updateAsset.mock.calls.map((c) => (c[0] as WBAsset).currentPage)).toEqual([1, 2])
  })

  it('без можливості запису (DESYNC / inputLocked) або не в режимі редагування — нічого не пишеться', () => {
    const pages = () => [[
      asset('vid-1', 'video_player', 0, 0), asset('aud-1', 'audio_player', 0, 10, { minimized: true }),
      asset('doc-1', 'document_viewer', 0, 20, { currentPage: 0, totalPages: 3 }),
    ]]
    for (const setup of [scenarioSetup(pages(), { canWrite: false }), scenarioSetup(pages(), { mode: 'readonly' })]) {
      setup.adapter.minimize('vid-1'); setup.adapter.restore('aud-1'); setup.adapter.docPage('doc-1', 1)
      expect(setup.updateAsset).not.toHaveBeenCalled()
    }
  })
})

// ── INV-SCN-5 · «На весь екран» ──────────────────────────────────────────────

function viewStore(over: Record<string, unknown> = {}) {
  const store: any = reactive({
    containerWidth: 0, containerHeight: 0,          // як у кімнаті уроку: стор розміру поля не знає
    pageWidth: 2000, pageHeight: 1500,
    zoom: 1, scrollX: 0, scrollY: 0,
    expandedAssetId: null, currentPageIndex: 0, stageFollowsScroll: true,
    pages: [{ assets: [
      asset('doc-1', 'document_viewer', 500, 300, { w: 640, h: 360 }),
      asset('dot', 'document_viewer', 10, 10, { w: 10, h: 10 }),
      asset('vid-1', 'video_player', 900, 900, { w: 640, h: 360, title: 'Маятник' }),
      asset('yt-1', 'youtube_player', 900, 100, { w: 480, h: 270 }),
      { id: 'task-1', type: TASK_ASSET_TYPE, x: 0, y: 0, w: 400, h: 200, data: { externalId: 'task-1' } },
    ] }],
    setZoom: vi.fn(), setScroll: vi.fn(), updateAsset: vi.fn(),
    ...over,
  })
  const applied: Array<[number, number, number]> = []
  const view = createRemoteViewAdapter(store, {
    viewportSize: () => ({ width: 1000, height: 600 }),
    applyView: (z, x, y) => { applied.push([z, x, y]); store.zoom = z; store.scrollX = x; store.scrollY = y },
  })
  return { store, view, applied }
}

describe('INV-SCN-5 · «На весь екран» — полотно цього екрана до об\'єкта', () => {
  it('об\'єкт посередині видимої частини з відступом 24 px (center − scroll + p·zoom)', () => {
    const { view, applied } = viewStore()
    expect(view.focusObject('doc-1')).toBe(true)
    const [z, x, y] = applied[0]
    const m = FOCUS_MARGIN_PX
    expect(z).toBeCloseTo(Math.min((1000 - 2 * m) / 640, (600 - 2 * m) / 360), 10)
    // екран = 0 − scroll + p·zoom: лівий край на відступі, об'єкт по центру
    const left = -x + 500 * z
    const top = -y + 300 * z
    expect(left).toBeCloseTo((1000 - 640 * z) / 2, 6)
    expect(top).toBeCloseTo((600 - 360 * z) / 2, 6)
    expect(left).toBeGreaterThanOrEqual(m - 1e-9)
    expect(left + 640 * z).toBeLessThanOrEqual(1000 - m + 1e-9)
    expect(view.objectFocusId()).toBe('doc-1')
  })

  it('стор знає розмір поля — центр аркуша той самий, що в boardStore.stageOrigin', () => {
    const { view, applied } = viewStore({ containerWidth: 1000, containerHeight: 600, pageWidth: 400, pageHeight: 300 })
    view.focusObject('doc-1')
    const [z, x] = applied[0]
    const center = Math.max(0, (1000 - 400 * z) / 2)
    expect(center - x + 500 * z).toBeCloseTo((1000 - 640 * z) / 2, 6)
  })

  it('масштаб — у межах полотна (0.1…5)', () => {
    const { view, applied } = viewStore()
    view.focusObject('dot')
    expect(applied[0][0]).toBe(5)
  })

  it('«Уся сторінка» / зміна сторінки: вигляд до ПЕРШОГО показу, фокус знято', () => {
    const { store, view, applied } = viewStore({ zoom: 0.8, scrollX: 12, scrollY: 34 })
    view.focusObject('doc-1')
    view.focusObject('dot')          // другий показ не перезаписує запам'ятоване
    view.resetFocus()
    expect(applied[applied.length - 1]).toEqual([0.8, 12, 34])
    expect(store.zoom).toBe(0.8)
    expect(view.objectFocusId()).toBeNull()
    applied.length = 0
    view.resetFocus()                // нічого запам'ятованого — вигляд не чіпаємо
    expect(applied).toHaveLength(0)
  })

  it('показ один за раз: «На весь екран» знімає «Задачу на екран», і навпаки', () => {
    const { store, view, applied } = viewStore({ zoom: 0.7 })
    view.fitTask()
    expect(store.expandedAssetId).toBe('task-1')
    view.focusObject('doc-1')
    expect(store.expandedAssetId).toBeNull()
    view.fitTask()
    expect(applied[applied.length - 1][0]).toBe(0.7) // вигляд повернуто
    expect(view.objectFocusId()).toBeNull()
    expect(store.expandedAssetId).toBe('task-1')
  })

  it('кімната без зсуву аркуша прокруткою або без розміру поля — нічого не робимо', () => {
    const a = viewStore({ stageFollowsScroll: false })
    expect(a.view.focusObject('doc-1')).toBe(false)
    expect(a.applied).toHaveLength(0)
    const b = createRemoteViewAdapter(viewStore().store, { viewportSize: () => null })
    expect(b.focusObject('doc-1')).toBe(false)
  })
})


// ── INV-SCN-5b · відео «на весь екран» — показ, як презентація (власник 2026-09-28) ─────────

describe('INV-SCN-5b · відео «на весь екран» — показ поверх екрана, а не масштаб полотна', () => {
  afterEach(() => closeMediaShow())

  it('відео (файл і YouTube) відкривається показом: полотно не рухається, focus_id — це відео', () => {
    for (const id of ['vid-1', 'yt-1']) {
      const { store, view, applied } = viewStore({ zoom: 0.9 })
      expect(view.focusObject(id)).toBe(true)
      expect(mediaShow.id).toBe(id)
      expect(applied).toHaveLength(0)
      expect(store.zoom).toBe(0.9)
      expect(view.objectFocusId()).toBe(id)
      closeMediaShow()
    }
  })

  it('«Уся сторінка» / інша сторінка (resetFocus) закриває показ', () => {
    const { view } = viewStore()
    view.focusObject('vid-1')
    view.resetFocus()
    expect(mediaShow.id).toBeNull()
    expect(view.objectFocusId()).toBeNull()
  })

  it('закрили на ноутбуці (× чи Esc) — пульт отримує focus_id: null', () => {
    const { view } = viewStore()
    view.focusObject('vid-1')
    closeMediaShow()
    expect(view.objectFocusId()).toBeNull()
  })

  it('Esc закриває показ; інші клавіші не доходять до дошки під показом', () => {
    const { view } = viewStore()
    view.focusObject('vid-1')
    const boardKey = vi.fn()
    window.addEventListener('keydown', boardKey)
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    expect(boardKey).not.toHaveBeenCalled()
    expect(mediaShow.id).toBe('vid-1')
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(mediaShow.id).toBeNull()
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    expect(boardKey).toHaveBeenCalledTimes(1)          // показ закрито — дошка знову чує клавіші
    window.removeEventListener('keydown', boardKey)
  })

  it('показ один за раз: документ «на весь екран» чи «Задача на екран» закривають показ відео', () => {
    const { view, applied } = viewStore()
    view.focusObject('vid-1')
    view.focusObject('doc-1')
    expect(mediaShow.id).toBeNull()
    expect(applied).toHaveLength(1)                    // документ — масштаб полотна
    expect(view.objectFocusId()).toBe('doc-1')
    view.focusObject('yt-1')
    expect(mediaShow.id).toBe('yt-1')
    expect(applied[applied.length - 1][0]).toBe(1)     // вигляд до документа повернуто
    view.fitTask()
    expect(mediaShow.id).toBeNull()
  })
})

// ── INV-SCN-6 · під'єднання до useBoardRemote ────────────────────────────────

const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
const wrappers: Array<{ unmount: () => void }> = []

function boardRemote(withScenario: boolean) {
  const store = reactive({ currentPageIndex: 0, pageCount: 2, goToPage: vi.fn(), addPage: vi.fn() })
  const sendMessage = vi.fn()
  const scenario = {
    state: vi.fn(() => ({ focus_id: null, items: [] })),
    play: vi.fn(), pause: vi.fn(), volume: vi.fn(), focus: vi.fn(), minimize: vi.fn(), restore: vi.fn(), docPage: vi.fn(),
  }
  const media = { list: vi.fn(() => []), add: vi.fn(), play: vi.fn(), pause: vi.fn() }
  let api!: ReturnType<typeof useBoardRemote>
  wrappers.push(mount(defineComponent({
    setup() {
      api = useBoardRemote({
        sessionId: ref(SID), store, undo: vi.fn(), sendMessage, enabled: ref(true), media,
        ...(withScenario ? { scenario } : {}),
      })
      return () => h('div')
    },
  })))
  const fire = (cmd: string, args: Record<string, unknown> = {}) => window.dispatchEvent(new CustomEvent('wb:remote-command', {
    detail: { userId: 'u', pair: api.pairCode.value, clientId: 'phone', cmd, args },
  }))
  return { api, sendMessage, scenario, media, fire }
}

describe('INV-SCN-6 · caps і поле scenario — лише з адаптером', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => {
    while (wrappers.length) wrappers.pop()!.unmount()
    vi.useRealTimers()
  })

  it('з адаптером: caps ∋ scenario і поле scenario; без нього — ні', () => {
    const on = boardRemote(true)
    on.fire('hello')
    expect(on.sendMessage.mock.calls[0][0]).toMatchObject({ caps: ['video', 'scenario'], scenario: { focus_id: null, items: [] } })
    wrappers.pop()!.unmount()
    const off = boardRemote(false)
    off.fire('hello')
    const msg = off.sendMessage.mock.calls[0][0]
    expect(msg.caps).toEqual(['video'])
    expect(msg).not.toHaveProperty('scenario')
  })

  it('команди сценарію йдуть в адаптер; video.play — у сценарій (будь-який програвач)', () => {
    const { fire, scenario, media } = boardRemote(true)
    fire('video.play', { object_id: 'aud-1' })
    fire('video.pause', { object_id: 'aud-1' })
    fire('video.volume', { object_id: 'aud-1', delta: -1 })
    fire('view.focus', { object_id: 'doc-1' })
    fire('card.minimize', { object_id: 'vid-1' })
    fire('card.restore', { object_id: 'vid-1' })
    fire('doc.page', { object_id: 'doc-1', dir: 1 })
    expect(scenario.play).toHaveBeenCalledWith('aud-1')
    expect(scenario.pause).toHaveBeenCalledWith('aud-1')
    expect(scenario.volume).toHaveBeenCalledWith('aud-1', -1)
    expect(scenario.focus).toHaveBeenCalledWith('doc-1')
    expect(scenario.minimize).toHaveBeenCalledWith('vid-1')
    expect(scenario.restore).toHaveBeenCalledWith('vid-1')
    expect(scenario.docPage).toHaveBeenCalledWith('doc-1', 1)
    expect(media.play).not.toHaveBeenCalled()
  })

  it('крок не ±1 — ігнор (другий рубіж після сервера)', () => {
    const { fire, scenario } = boardRemote(true)
    fire('video.volume', { object_id: 'a', delta: 2 })
    fire('doc.page', { object_id: 'd', dir: 0 })
    expect(scenario.volume).not.toHaveBeenCalled()
    expect(scenario.docPage).not.toHaveBeenCalled()
  })

  it('без адаптера: video.play — як v1.8 (YouTube-медіа), нові команди ігноруються', () => {
    const { fire, media } = boardRemote(false)
    fire('video.play', { object_id: 'yt-1' })
    expect(media.play).toHaveBeenCalledWith('yt-1')
    expect(() => {
      fire('card.minimize', { object_id: 'yt-1' })
      fire('view.focus', { object_id: 'yt-1' })
    }).not.toThrow()
  })
})

// ── INV-SCN-7 · v1.25 картки й картинки поточної сторінки ─────────────────────

describe('INV-SCN-7 · картки й картинки — лише сторінки, що на екрані (v1.25)', () => {
  const lessonPage = () => [
    asset('pic', 'image', 0, 0, { data: { caption: 'Річ Посполита в кордонах 1619 року' } }),
    asset('theory', 'theory_card', 960, 0, { data: { title: 'Держава, якої вже немає', body: 'Подивись на карту…' } }),
    asset('q', 'discussion_question', 0, 780, { data: { question: 'У складі якої держави була більша частина земель?' } }),
    asset('hist', 'history_card', 960, 400, { data: { title: 'Річ Посполита' } }),
    asset('task', TASK_ASSET_TYPE, 0, 900),
  ]

  it('вид і назва: картинка — підпис, картка — заголовок, питання — текст питання; задачі НМТ немає', () => {
    const { adapter } = scenarioSetup([lessonPage()])
    expect(adapter.state().items.map((i) => [i.object_id, i.kind, i.title])).toEqual([
      ['pic', 'image', 'Річ Посполита в кордонах 1619 року'],
      ['theory', 'card', 'Держава, якої вже немає'],
      ['hist', 'card', 'Річ Посполита'],
      ['q', 'card', 'У складі якої держави була більша частина земель?'],
    ])
  })

  it('картки й картинки інших сторінок у списку немає (медіа — є)', () => {
    const { adapter } = scenarioSetup([[asset('v', 'video_player', 0, 0)], lessonPage()], { current: 0 })
    expect(adapter.state().items.map((i) => i.object_id)).toEqual(['v'])
  })

  it('картка без заголовка — перші слова тексту; без нічого — порожньо (пульт: «Картка N»)', () => {
    const { adapter } = scenarioSetup([[
      asset('t1', 'theory_card', 0, 0, { data: { body: '  Перший   рядок тексту ' } }),
      asset('t2', 'theory_card', 0, 10, { data: {} }),
    ]])
    expect(adapter.state().items.map((i) => i.title)).toEqual(['Перший рядок тексту', ''])
  })

  it('«Згорнути» / «Повернути» — той самий asset_update, що й кнопки на дошці', () => {
    const { adapter, updateAsset, state } = scenarioSetup([lessonPage()])
    adapter.minimize('theory')
    expect(updateAsset).toHaveBeenCalledTimes(1)
    expect(updateAsset.mock.calls[0][0]).toMatchObject({ id: 'theory', minimized: true })
    expect(state.pages[0].assets.find((a) => a.id === 'theory')?.minimized).toBe(true)
    expect(adapter.state().items.find((i) => i.object_id === 'theory')?.minimized).toBe(true)
    adapter.restore('theory')
    expect(updateAsset.mock.calls[1][0]).toMatchObject({ id: 'theory', minimized: false })
    adapter.minimize('pic')
    expect(updateAsset.mock.calls[2][0]).toMatchObject({ id: 'pic', minimized: true })
  })

  it('«На весь екран»: картинка — так, картка — ні (текст не росте з полотном)', () => {
    const { adapter, view } = scenarioSetup([lessonPage()])
    adapter.focus('pic')
    adapter.focus('theory')
    expect(view.focusObject).toHaveBeenCalledTimes(1)
    expect(view.focusObject).toHaveBeenCalledWith('pic')
  })

  it('картка іншої сторінки чи задача НМТ — команди ігноруються', () => {
    const { adapter, updateAsset } = scenarioSetup([[asset('v', 'video_player', 0, 0)], lessonPage()], { current: 0 })
    adapter.minimize('theory')
    const other = scenarioSetup([lessonPage()])
    other.adapter.minimize('task')
    expect(updateAsset).not.toHaveBeenCalled()
    expect(other.updateAsset).not.toHaveBeenCalled()
  })
})
