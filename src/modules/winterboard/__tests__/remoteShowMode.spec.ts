/**
 * Режим показу (LAW §9 v1.56, власник 2026-10-25: «якби було за замовчуванням на цілий екран, щоб при переході на
 * наступну сторінку не прийшлось би клацати… оце чорненьке меню треба приховувати»).
 *
 * ІНВАРІАНТИ
 *   INV-SHOW-1  «На весь екран» картинки чи документа вмикає режим показу; відео (свій показ) — ні
 *   INV-SHOW-2  у режимі показу нова сторінка — одразу на весь екран її головна (найбільша) картинка;
 *               сторінка без картинки — уся сторінка; режим не знімається
 *   INV-SHOW-3  перемкнути пульт на мелодію в режимі показу — повний екран лишається; інша картинка — на весь екран
 *   INV-SHOW-4  «Уся сторінка» — кінець режиму: уся сторінка вписана в екран (v1.59), клас на <body> знято
 *   INV-SHOW-5  без режиму показу зміна сторінки — звичайний вигляд, як і було
 *   INV-SHOW-6  сторінка ще без об'єктів — показ чекає й застосовується, щойно вони з'являться
 *   INV-SHOW-7  v1.60: картинка з файлом — показом, як відео (`mediaShow.id`, без масштабу полотна): «Далі» —
 *               головна картинка нової сторінки в показі, ▶ на іншу картинку — вона в показі, мелодія — показ лишається,
 *               сторінка без картинки — показ закрито й уся сторінка, «Уся сторінка» — показ закрито
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createRemoteViewAdapter } from '../composables/useRemoteViewAdapter'
import { SHOW_MODE_BODY_CLASS, setShowMode, showMode } from '../board/showMode'
import { closeMediaShow, mediaShow } from '../board/mediaShow'

const img = (id: string, x: number, y: number, w: number, h: number) =>
  ({ id, type: 'image', x, y, w, h, rotation: 0, locked: false })
const audio = (id: string) => ({ id, type: 'audio_player', x: 40, y: 920, w: 420, h: 80, title: 'Мелодія' })

function setup(pages: any[]) {
  const store: any = reactive({
    containerWidth: 0, containerHeight: 0, pageWidth: 1920, pageHeight: 1080,
    zoom: 0.75, scrollX: 5, scrollY: 7, expandedAssetId: null, currentPageIndex: 0, stageFollowsScroll: true,
    pages, setZoom: vi.fn(), setScroll: vi.fn(), updateAsset: vi.fn(), selectedIds: [], selectItems: vi.fn(),
  })
  const applied: Array<[number, number, number]> = []
  const view = createRemoteViewAdapter(store, {
    viewportSize: () => ({ width: 1920, height: 1080 }),
    applyView: (z, x, y) => { applied.push([z, x, y]); store.zoom = z; store.scrollX = x; store.scrollY = y },
    allKinds: () => true,
  })
  return { store, view, applied }
}

const FESTIVAL = () => [
  { assets: [img('slide-03', 40, 40, 1520, 855), audio('mel-01')] },
  { assets: [img('art-small', 1600, 40, 200, 200), img('slide-04', 40, 40, 1520, 855), audio('mel-02')] },
  { assets: [{ id: 'task-1', type: 'nmt_task', x: 0, y: 0, w: 400, h: 200, data: {} }] },
]

afterEach(() => { setShowMode(false); closeMediaShow() })

describe('режим показу', () => {
  it('INV-SHOW-1: «На весь екран» картинки вмикає показ (клас на <body>); відео — ні', () => {
    const { view } = setup([{ assets: [img('slide', 40, 40, 1520, 855), { id: 'v', type: 'video_player', x: 0, y: 0, w: 640, h: 360 }] }])
    view.focusObject('v')
    expect(showMode.active).toBe(false)
    view.focusObject('slide')
    expect(showMode.active).toBe(true)
    expect(document.body.classList.contains(SHOW_MODE_BODY_CLASS)).toBe(true)
  })

  it('INV-SHOW-2: «Далі» — головна картинка нової сторінки одразу на весь екран; без картинки — уся сторінка', () => {
    const { store, view, applied } = setup(FESTIVAL())
    view.focusObject('slide-03')
    store.currentPageIndex = 1
    view.pageChanged()
    expect(view.objectFocusId()).toBe('slide-04')                    // найбільша, не маленька
    const [z] = applied[applied.length - 1]
    expect(z).toBeCloseTo(Math.min((1920 - 48) / 1520, (1080 - 48) / 855), 6)

    store.currentPageIndex = 2
    view.pageChanged()
    expect(showMode.active).toBe(true)
    expect(view.objectFocusId()).toBeNull()
    expect(applied[applied.length - 1][0]).toBeCloseTo(1, 6)          // уся сторінка 16:9 — на весь екран 16:9
  })

  it('INV-SHOW-3: пульт на мелодію — повний екран лишається; інша картинка — стає на весь екран', () => {
    const { store, view, applied } = setup(FESTIVAL())
    store.currentPageIndex = 1
    view.focusObject('slide-04')
    const before = applied.length
    expect(view.selectObject('mel-02')).toBe(true)
    expect(applied).toHaveLength(before)                             // вигляд не чіпали
    expect(view.objectFocusId()).toBe('slide-04')
    view.selectObject('art-small')
    expect(view.objectFocusId()).toBe('art-small')
    expect(applied.length).toBe(before + 1)
  })

  it('INV-SHOW-4: «Уся сторінка» — кінець показу, уся сторінка вписана в екран (v1.59), клас знято', () => {
    const { store, view, applied } = setup(FESTIVAL())
    view.focusObject('slide-03')
    store.currentPageIndex = 1
    view.pageChanged()
    view.resetFocus()
    expect(showMode.active).toBe(false)
    expect(document.body.classList.contains(SHOW_MODE_BODY_CLASS)).toBe(false)
    expect(applied[applied.length - 1]).toEqual([1, 0, 0])            // уся сторінка, без сірих смуг
  })

  it('INV-SHOW-5: без показу зміна сторінки — звичайний вигляд, як і було', () => {
    const { store, view, applied } = setup(FESTIVAL())
    store.currentPageIndex = 1
    view.pageChanged()
    expect(applied).toHaveLength(0)
    expect(view.objectFocusId()).toBeNull()
  })

  it('INV-SHOW-6: сторінка ще порожня — показ чекає, об\'єкти з\'явились — головна картинка на весь екран', () => {
    const pages: any[] = [{ assets: [img('slide-03', 40, 40, 1520, 855)] }, { assets: [] }]
    const { store, view } = setup(pages)
    view.focusObject('slide-03')
    store.currentPageIndex = 1
    view.pageChanged()
    expect(view.objectFocusId()).toBeNull()
    store.pages[1].assets.push(img('slide-04', 40, 40, 1520, 855))
    expect(view.pageAssetCount()).toBe(1)
    view.retryShow()
    expect(view.objectFocusId()).toBe('slide-04')
  })

  it('INV-SHOW-7: картинка з файлом — показом, як відео; «Далі», ▶ і мелодія — у показі; «Уся сторінка» — закрито', () => {
    const pic = (id: string, w = 1520, h = 855) => ({ ...img(id, 40, 40, w, h), src: `/media/${id}.png` })
    const { store, view, applied } = setup([
      { assets: [pic('slide-03'), audio('mel-01')] },
      { assets: [{ ...pic('art-small', 200, 200), x: 1600 }, pic('slide-04'), audio('mel-02')] },
      { assets: [{ id: 'task-1', type: 'nmt_task', x: 0, y: 0, w: 400, h: 200, data: {} }] },
    ])
    expect(view.focusObject('slide-03')).toBe(true)
    expect(mediaShow.id).toBe('slide-03')
    expect(applied).toHaveLength(0)                                  // полотно не масштабуємо
    expect(showMode.active).toBe(true)

    store.currentPageIndex = 1
    view.pageChanged()
    expect(mediaShow.id).toBe('slide-04')                              // найбільша картинка нової сторінки
    expect(view.objectFocusId()).toBe('slide-04')
    view.selectObject('mel-02')
    expect(mediaShow.id).toBe('slide-04')                              // «Грати» — показ лишається
    view.selectObject('art-small')
    expect(mediaShow.id).toBe('art-small')
    expect(applied).toHaveLength(0)

    store.currentPageIndex = 2
    view.pageChanged()
    expect(mediaShow.id).toBeNull()                                    // без картинки — показ закрито, уся сторінка
    expect(applied[applied.length - 1][0]).toBeCloseTo(1, 6)

    store.currentPageIndex = 0
    view.pageChanged()
    expect(mediaShow.id).toBe('slide-03')
    view.resetFocus()
    expect(mediaShow.id).toBeNull()
    expect(showMode.active).toBe(false)
  })
})
