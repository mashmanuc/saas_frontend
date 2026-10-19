// useRemoteViewAdapter — «задача на екран», A−/A+, ▲/▼, відповідь/розбір над фейковим стором.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createRemoteViewAdapter, TASK_ASSET_TYPE,
} from '../composables/useRemoteViewAdapter'
import { resetTutorGate } from '../composables/useStudentTutor'
import { getNmtPresentationScale, resetNmtPresentationScales } from '../composables/useNmtPresentationScale'

function card(id: string, x: number, y: number, w = 400, data: Record<string, unknown> = {}) {
  return { id, type: TASK_ASSET_TYPE, x, y, w, h: 200, data: { externalId: id, ...data } }
}

function makeStore(assets: any[] = [], over: Partial<any> = {}) {
  const store: any = {
    containerWidth: 1000, containerHeight: 600,
    pageWidth: 2000, pageHeight: 1500,
    zoom: 1, scrollX: 0, scrollY: 0,
    expandedAssetId: null,
    currentPageIndex: 0,
    pages: [{ assets }],
    setZoom: vi.fn(function (this: any, z: number) { store.zoom = Math.max(0.1, Math.min(5, z)) }),
    setScroll: vi.fn((x: number, y: number) => { store.scrollX = x; store.scrollY = y }),
    updateAsset: vi.fn((a: any) => {
      const page = store.pages[0]
      page.assets = page.assets.map((o: any) => (o.id === a.id ? a : o))
    }),
    ...over,
  }
  return store
}

describe('useRemoteViewAdapter', () => {
  beforeEach(() => { resetTutorGate(); resetNmtPresentationScales() })

  it('fitTask: локально розгортає картку на весь простір, не змінюючи її геометрію', () => {
    const store = makeStore([card('a', 100, 300, 400)])
    const v = createRemoteViewAdapter(store)
    expect(v.fitTask()).toBe(0)
    expect(store.expandedAssetId).toBe('a')
    expect(v.summary().presenting).toBe(true)
    expect(store.zoom).toBe(1)
    expect(store.setScroll).not.toHaveBeenCalled()
  })

  it('fitTask на сторінці без карток → −1, стор не чіпається', () => {
    const store = makeStore([{ id: 'img', type: 'image', x: 0, y: 0, w: 100, h: 100 }])
    const v = createRemoteViewAdapter(store)
    expect(v.fitTask()).toBe(-1)
    expect(store.expandedAssetId).toBeNull()
  })

  it('повторний fitTask циклює по картках зверху вниз; resetFocus повертає на першу', () => {
    const store = makeStore([card('low', 0, 900), card('top', 0, 100), card('mid', 0, 500)])
    const v = createRemoteViewAdapter(store)
    expect(v.taskCards().map((c) => c.id)).toEqual(['top', 'mid', 'low'])
    expect(v.fitTask()).toBe(0)
    expect(v.fitTask()).toBe(1)
    expect(v.fitTask()).toBe(2)
    expect(v.fitTask()).toBe(0)
    v.resetFocus()
    expect(store.expandedAssetId).toBeNull()
    expect(v.fitTask()).toBe(0)
  })

  it('Б-106: A+ поза показом ставить фокус без показу; «Задача на екран» розгортає саме її, далі — по колу', () => {
    const store = makeStore([card('top', 0, 100), card('mid', 0, 500), card('low', 0, 900)])
    const v = createRemoteViewAdapter(store)
    v.changeTextScale(1)
    expect(store.updateAsset).toHaveBeenCalledTimes(1)   // §9.C v1.13: спільний масштаб, не локальний
    expect(store.pages[0].assets.find((a: any) => a.id === 'top').data.presentationScale).toBe(1.15)
    expect(getNmtPresentationScale('top')).toBe(1)
    expect(store.expandedAssetId).toBeNull()
    expect(v.summary().presenting).toBe(false)
    expect(v.fitTask()).toBe(0)          // збільшена картка, а не наступна за нею
    expect(store.expandedAssetId).toBe('top')
    expect(v.fitTask()).toBe(1)
    expect(v.fitTask()).toBe(2)
    // ноутбук сам згорнув показ (фокус лишився на 'low') → «Задача на екран» повертає ту саму картку
    store.expandedAssetId = null
    expect(v.fitTask()).toBe(2)
    expect(store.expandedAssetId).toBe('low')
  })

  it('у показі A+ — локальний множник розгорнутої картки: без операції, не полотно, не рамка', () => {
    const store = makeStore([card('a', 0, 0, 800)])
    const v = createRemoteViewAdapter(store)
    store.zoom = 1
    const initialWidth = store.pages[0].assets[0].w
    v.fitTask()   // «Задача на екран»
    expect(v.changeTextScale(1)).toBe(1.25)
    expect(getNmtPresentationScale('a')).toBe(1.25)
    expect(store.zoom).toBe(1)
    expect(store.pages[0].assets[0].w).toBe(initialWidth)
    expect(store.updateAsset).not.toHaveBeenCalled()
    expect(v.changeTextScale(3)).toBe(2) // стеля саме для шрифту
    expect(v.changeTextScale(-1)).toBe(1.6)
    expect(store.updateAsset).not.toHaveBeenCalled()
  })

  it('Б-109: поза показом A± — крок спільного масштабу картки, рівно одна операція на команду', () => {
    const store = makeStore([card('a', 10, 20, 800)])
    const v = createRemoteViewAdapter(store)
    const scaleOnBoard = () => store.pages[0].assets[0].data.presentationScale
    expect(v.changeTextScale(1)).toBe(1.15)
    expect(store.updateAsset).toHaveBeenCalledTimes(1)
    expect(scaleOnBoard()).toBe(1.15)
    const { x, y, w, h } = store.pages[0].assets[0]
    expect([x, y, w, h]).toEqual([10, 20, 800, 200])   // геометрію пише лише автопідгонка картки (INV-25)
    expect(v.changeTextScale(3)).toBe(1.75)            // три кроки — одна операція
    expect(store.updateAsset).toHaveBeenCalledTimes(2)
    expect(v.changeTextScale(1)).toBe(2)
    expect(v.changeTextScale(1)).toBe(2)               // межа: операції немає
    expect(store.updateAsset).toHaveBeenCalledTimes(3)
    expect(v.changeTextScale(-1)).toBe(1.75)
    expect(store.updateAsset).toHaveBeenCalledTimes(4)
    expect(getNmtPresentationScale('a')).toBe(1)       // локальний множник не чіпали
    expect(store.expandedAssetId).toBeNull()
  })

  it('Б-109: у показі операцій немає, і після «Уся сторінка» множника вже немає', () => {
    const store = makeStore([card('a', 0, 0, 800)])
    const v = createRemoteViewAdapter(store)
    v.fitTask()
    v.changeTextScale(1); v.changeTextScale(1); v.changeTextScale(1)
    expect(getNmtPresentationScale('a')).toBe(1.95)
    v.resetFocus()   // «Уся сторінка» або інша сторінка
    expect(getNmtPresentationScale('a')).toBe(1)
    expect(store.updateAsset).not.toHaveBeenCalled()
    expect(store.pages[0].assets[0].data.presentationScale).toBeUndefined()
  })

  it('Б-109: ціль у показі — саме розгорнута картка, навіть коли фокус деінде', () => {
    const store = makeStore([card('a', 0, 100), card('b', 0, 500)])
    const v = createRemoteViewAdapter(store)
    store.expandedAssetId = 'b'   // розгорнули на ноутбуці, не з пульта
    expect(v.changeTextScale(1)).toBe(1.25)
    expect(getNmtPresentationScale('b')).toBe(1.25)
    expect(getNmtPresentationScale('a')).toBe(1)
    expect(store.updateAsset).not.toHaveBeenCalled()
  })

  it('A+ без карток не чіпає сторінку', () => {
    const store = makeStore([])
    const v = createRemoteViewAdapter(store)
    expect(v.changeTextScale(1)).toBe(1)
    expect(store.zoom).toBe(1)
    expect(store.updateAsset).not.toHaveBeenCalled()
  })

  it('scrollBy без відкритої на екран картки не рухає полотно', () => {
    const store = makeStore([], { scrollX: -123, scrollY: 0 })
    const v = createRemoteViewAdapter(store)
    v.scrollBy(1)
    expect(store.scrollY).toBe(0)
    expect(store.scrollX).toBe(-123)
  })

  it('scrollBy гортає тіло саме розгорнутої картки, а не полотно', () => {
    document.body.innerHTML = '<div data-testid="nmt-task-a"><div class="nmt-task__body"></div></div>'
    const body = document.querySelector('.nmt-task__body') as HTMLElement
    Object.defineProperty(body, 'clientHeight', { value: 200 })
    Object.defineProperty(body, 'scrollHeight', { value: 1000 })
    const store = makeStore([card('a', 0, 0)], { scrollX: -123, scrollY: 77 })
    const v = createRemoteViewAdapter(store)
    v.fitTask()
    expect(v.scrollBy(1)).toBe(80)
    expect(body.scrollTop).toBe(80)
    expect(store.scrollX).toBe(-123)
    expect(store.scrollY).toBe(77)
    expect(v.scrollBy(-1)).toBe(0)
  })

  it('v1.34 reveal(answer): лише поточна задача (до v1.34 — усі задачі сторінки); повторно — ховає', () => {
    const store = makeStore([card('a', 0, 0), card('b', 0, 300, 400, { showAnswer: true })])
    const v = createRemoteViewAdapter(store)
    expect(v.reveal('answer')).toBe(1)                     // поточна — перша ('a'), 'b' не чіпаємо
    expect(store.pages[0].assets.map((a: any) => !!a.data.showAnswer)).toEqual([true, true])
    expect(v.reveal('answer', 'b')).toBe(1)                // з адресою — рівно 'b'
    expect(store.pages[0].assets.map((a: any) => !!a.data.showAnswer)).toEqual([true, false])
    expect(v.reveal('answer', 'a')).toBe(1)
    expect(store.pages[0].assets.map((a: any) => !!a.data.showAnswer)).toEqual([false, false])
  })

  it('reveal(solution) не чіпає showAnswer; без карток → 0', () => {
    const store = makeStore([card('a', 0, 0, 400, { showAnswer: true })])
    const v = createRemoteViewAdapter(store)
    expect(v.reveal('solution')).toBe(1)
    const a = store.pages[0].assets[0]
    expect(a.data.showSolution).toBe(true)
    expect(a.data.showAnswer).toBe(true)
    expect(createRemoteViewAdapter(makeStore([])).reveal('answer')).toBe(0)
  })

  it('картки з інших сторінок не рахуються', () => {
    const store = makeStore([card('a', 0, 0)], { currentPageIndex: 1, pages: [{ assets: [card('a', 0, 0)] }, { assets: [] }] })
    const v = createRemoteViewAdapter(store)
    expect(v.summary().count).toBe(0)
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('useRemoteViewAdapter — A+/A− змінюють типографіку, не дошку', () => {
  beforeEach(() => { resetTutorGate(); resetNmtPresentationScales() })

  it('A+ не зменшує текст, A− не збільшує текст — у показі (локально) і поза ним (спільно)', () => {
    const store = makeStore([card('a', 0, 0, 400)], { zoom: 1 })
    const v = createRemoteViewAdapter(store)
    expect(v.changeTextScale(2)).toBe(1.3)
    expect(v.changeTextScale(-1)).toBe(1.15)
    expect(store.updateAsset).toHaveBeenCalledTimes(2)
    v.fitTask()
    expect(v.changeTextScale(2)).toBe(1.56)
    expect(v.changeTextScale(-1)).toBe(1.25)
    expect(store.zoom).toBe(1)
    expect(store.updateAsset).toHaveBeenCalledTimes(2)
  })

  it('fitTask не залежить від виміру полотна: режим показу локальний', () => {
    const store = makeStore([card('a', 0, 0, 400), card('b', 0, 500, 400)],
                            { containerWidth: 0, zoom: 1 })
    const v = createRemoteViewAdapter(store)
    expect(v.fitTask()).toBe(0)
    expect(store.zoom).toBe(1)
    expect(store.setScroll).not.toHaveBeenCalled()
    expect(store.expandedAssetId).toBe('a')
  })
})


// ──────────────────────────────────────────────────────────────────────────
// LAW §9 v1.34 — поточний об'єкт пульта (власник 2026-10-19: «згоден з усіма чотирма, роби»; маніфест П2).
// Урок 19.10: виділив другу задачу — A+ збільшував першу, а ✍ писав другу.

function image(id: string, x: number, y: number) {
  return { id, type: 'image', src: 'https://cdn.m4sh.org/wb/cut.png', x, y, w: 300, h: 200 }
}
function theory(id: string, x: number, y: number) {
  return { id, type: 'theory_card', x, y, w: 300, h: 200, data: { title: 'Задача', body: '$3x = 12$' } }
}
function selectable(assets: any[], over: Partial<any> = {}) {
  const store = makeStore(assets, { selectedIds: [] as string[], ...over })
  store.selectItems = vi.fn((ids: string[]) => { store.selectedIds = ids })
  return store
}

describe('v1.34 поточний об\'єкт пульта', () => {
  beforeEach(() => { resetTutorGate(); resetNmtPresentationScales() })

  it('урок 19.10: виділена на дошці друга задача — і A+, і ✍ ідуть до неї', () => {
    const store = selectable([card('t1', 0, 100, 400, { solution: '$x=1$' }), card('t2', 500, 100, 400, { solution: '$x=2$' })])
    const v = createRemoteViewAdapter(store)
    store.selectedIds = ['t2']
    expect(v.currentObjectId()).toBe('t2')
    v.changeTextScale(1)
    expect(store.pages[0].assets.find((a: any) => a.id === 't2').data.presentationScale).toBe(1.15)
    expect(store.pages[0].assets.find((a: any) => a.id === 't1').data.presentationScale).toBeUndefined()
    expect(v.handwriteTarget()?.id).toBe('t2')
  })

  it('порядок: розгорнута → виділена → обрана → перша (згори вниз, зліва направо)', () => {
    const store = selectable([card('b', 500, 100), card('a', 0, 100), card('c', 0, 600)])
    const v = createRemoteViewAdapter(store)
    expect(v.objects().map((o) => o.id)).toEqual(['a', 'b', 'c'])
    expect(v.currentObjectId()).toBe('a')                  // нічого не обрано — перша
    expect(v.selectObject('c')).toBe(true)
    expect(store.selectedIds).toEqual(['c'])               // Р1: обрав на пульті — виділилось на дошці
    store.selectedIds = []                                 // учитель клацнув по порожньому — лишається обрана
    expect(v.currentObjectId()).toBe('c')
    store.selectedIds = ['b']                              // виділив інший на дошці — пульт перемкнувся
    expect(v.currentObjectId()).toBe('b')
    store.expandedAssetId = 'a'                            // «Задача на екран» — саме вона
    expect(v.currentObjectId()).toBe('a')
  })

  it('інша сторінка — поточний: виділений там, інакше перший; обраний з іншої сторінки не тягнеться', () => {
    const store = selectable([card('a', 0, 0), card('b', 0, 300)], {
      pages: [{ assets: [card('a', 0, 0), card('b', 0, 300)] }, { assets: [card('x', 0, 0), card('y', 0, 300)] }],
    })
    const v = createRemoteViewAdapter(store)
    v.selectObject('b')
    store.currentPageIndex = 1
    store.selectedIds = []
    expect(v.currentObjectId()).toBe('x')
  })

  it('адреса: об\'єкта вже немає на сторінці — нічого не робимо, причина «gone»; вдала дія причину знімає', () => {
    const store = selectable([card('a', 0, 0)])
    const v = createRemoteViewAdapter(store)
    expect(v.changeTextScale(1, 'zzz')).toBe(1)
    expect(store.updateAsset).not.toHaveBeenCalled()
    expect(v.objectNotice()).toBe('gone')
    expect(v.reveal('answer', 'zzz')).toBe(0)
    expect(v.presentObject('zzz')).toBe(false)
    expect(v.selectObject('zzz')).toBe(false)
    v.changeTextScale(1, 'a')
    expect(v.objectNotice()).toBeNull()
  })

  it('вирізка й картка — об\'єкти пульта лише з правом Інтегралика (✍); дії задачі для них — «unsupported»', () => {
    const assets = [card('t', 0, 0), image('cut', 500, 0), theory('crd', 0, 400)]
    const without = createRemoteViewAdapter(selectable(assets))
    expect(without.objects().map((o) => o.kind)).toEqual(['task'])
    const store = selectable(assets)
    const v = createRemoteViewAdapter(store, { canSolve: () => true })
    expect(v.objects().map((o) => [o.id, o.kind, o.n, o.hw])).toEqual([
      ['t', 'task', 1, true], ['cut', 'image', 1, true], ['crd', 'card', 1, true],
    ])
    expect(v.changeTextScale(1, 'cut')).toBe(1)
    expect(v.objectNotice()).toBe('unsupported')
    expect(v.handwriteTarget('cut')?.id).toBe('cut')
    expect(v.objectNotice()).toBeNull()
  })

  it('задача без розв\'язку без права Інтегралика: ✍ недоступний (hw=false), адреса — «unsupported»', () => {
    const v = createRemoteViewAdapter(selectable([card('t', 0, 0)]))
    expect(v.objects()[0].hw).toBe(false)
    expect(v.handwriteTarget('t')).toBeNull()
    expect(v.objectNotice()).toBe('unsupported')
  })

  it('«Задача на екран» з адресою — рівно вона; перемикач у показі показує обрану задачу', () => {
    const store = selectable([card('a', 0, 0), card('b', 0, 300)])
    const v = createRemoteViewAdapter(store)
    expect(v.presentObject('b')).toBe(true)
    expect(store.expandedAssetId).toBe('b')
    expect(v.objects().find((o) => o.id === 'b')?.presenting).toBe(true)
    v.selectObject('a')
    expect(store.expandedAssetId).toBe('a')
  })

  it('стан для пульта — без тексту задачі: вид, номер серед свого виду, прапорці', () => {
    const v = createRemoteViewAdapter(selectable([card('a', 0, 0, 400, { showAnswer: true, question: 'секрет' })]))
    const [o] = v.objects()
    expect(o).toEqual({ id: 'a', kind: 'task', n: 1, hw: false, answer: true, solution: false, presenting: false })
    expect(JSON.stringify(v.objects())).not.toContain('секрет')
  })
})


// ──────────────────────────────────────────────────────────────────────────
// LAW §9 v1.35 — етап 2 поточного об'єкта: усі види «Сценарію» в тому самому перемикачі (кімната з «Сценарієм»).

function media(id: string, type: string, x: number, y: number, over: Record<string, unknown> = {}) {
  return { id, type, x, y, w: 400, h: 240, ...over }
}

describe('v1.35 етап 2: відео, аудіо, документи, картки й картинки — об\'єкти пульта', () => {
  beforeEach(() => { resetTutorGate(); resetNmtPresentationScales() })

  const page = () => [
    card('t', 0, 0),
    media('yt', 'youtube_player', 500, 0),
    media('snd', 'audio_player', 0, 300),
    media('pdf', 'document_viewer', 500, 300, { content_ref: { content_type: 'pdf' }, totalPages: 5, currentPage: 0 }),
    theory('crd', 0, 600),
    image('pic', 500, 600),
    media('mp4', 'video_player', 0, 900, { minimized: true }),
  ]

  it('з «Сценарієм» — усі види сторінки згори вниз, потім зліва направо; номер — серед свого виду', () => {
    const v = createRemoteViewAdapter(selectable(page()), { allKinds: () => true })
    expect(v.listsAllKinds()).toBe(true)
    expect(v.objects().map((o) => [o.id, o.kind, o.n])).toEqual([
      ['t', 'task', 1], ['yt', 'video', 1], ['snd', 'audio', 1], ['pdf', 'pdf', 1],
      ['crd', 'card', 1], ['pic', 'image', 1], ['mp4', 'video', 2],
    ])
  })

  it('без «Сценарію» (класна кімната) — як v1.34: лише задачі, картинка й картка — лише з правом Інтегралика', () => {
    const v = createRemoteViewAdapter(selectable(page()))
    expect(v.listsAllKinds()).toBe(false)
    expect(v.objects().map((o) => o.kind)).toEqual(['task'])
  })

  it('згорнуте лишається в списку з `minimized` (Р3); автовибір бере перший незгорнутий', () => {
    const store = selectable([media('mp4', 'video_player', 0, 0, { minimized: true }), media('yt', 'youtube_player', 0, 300)])
    const v = createRemoteViewAdapter(store, { allKinds: () => true })
    expect(v.objects().map((o) => [o.id, o.minimized === true])).toEqual([['mp4', true], ['yt', false]])
    expect(v.currentObjectId()).toBe('yt')
  })

  it('вибір згорнутого: поточний, але на дошці нічого не виділяємо (він у треї)', () => {
    const store = selectable([media('mp4', 'video_player', 0, 0, { minimized: true }), media('yt', 'youtube_player', 0, 300)])
    const v = createRemoteViewAdapter(store, { allKinds: () => true })
    expect(v.selectObject('mp4')).toBe(true)
    expect(v.currentObjectId()).toBe('mp4')
    expect(store.selectItems).not.toHaveBeenCalled()
  })

  it('дія «Сценарію» робить об\'єкт поточним і виділяє його на дошці (Е2-1); виділив на дошці — поточний він', () => {
    const store = selectable(page())
    const v = createRemoteViewAdapter(store, { allKinds: () => true })
    v.adoptObject('pdf')
    expect(v.currentObjectId()).toBe('pdf')
    expect(store.selectedIds).toEqual(['pdf'])
    store.selectedIds = ['snd']
    expect(v.currentObjectId()).toBe('snd')
    v.adoptObject('nope')                                     // не з цієї сторінки — нічого
    expect(v.currentObjectId()).toBe('snd')
  })

  it('дії задачі для відео — «unsupported», а не тиша (маніфест П5)', () => {
    const store = selectable(page())
    const v = createRemoteViewAdapter(store, { allKinds: () => true })
    expect(v.changeTextScale(1, 'yt')).toBe(1)
    expect(v.objectNotice()).toBe('unsupported')
    expect(store.updateAsset).not.toHaveBeenCalled()
  })
})

describe('v1.35 етап 2: згорнутий об\'єкт — без ✍', () => {
  beforeEach(() => { resetTutorGate(); resetNmtPresentationScales() })

  it('згорнута картка з правом Інтегралика: hw=false, ✍ з адресою — «unsupported», а не письмо біля схованого', () => {
    const crd = { ...theory('crd', 0, 0), minimized: true }
    const v = createRemoteViewAdapter(selectable([crd]), { allKinds: () => true, canSolve: () => true })
    expect(v.objects()[0]).toMatchObject({ id: 'crd', kind: 'card', minimized: true, hw: false })
    expect(v.handwriteTarget('crd')).toBeNull()
    expect(v.objectNotice()).toBe('unsupported')
  })
})
