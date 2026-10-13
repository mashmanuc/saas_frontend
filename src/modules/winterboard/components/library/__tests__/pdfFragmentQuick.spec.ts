/**
 * «⚡ Швидка вирізка фрагмента» (власник 2026-10-13): рамка на самому вікні документа → фрагмент одразу на дошці.
 * Точка вікна → частки сторінки; випадковий клік нічого не вирізає; місце запамʼятовується ДО запиту;
 * помилка — лише повідомлення, на дошці нічого.
 */
import { describe, it, expect, vi } from 'vitest'
import { fragmentErrorKey, quickRect, viewerPointToPage } from '../pdfFragmentRect'
import { runQuickCut, type QuickCutDeps } from '../pdfFragmentFlow'

const HEADER = 28
const FOOTER = 32

describe('viewerPointToPage', () => {
  it('сторінка у вікні — від 1 px зліва до w−1 і від шапки до футера', () => {
    expect(viewerPointToPage(1, HEADER, 422, 600, HEADER, FOOTER)).toEqual({ x: 0, y: 0 })
    expect(viewerPointToPage(421, 600 - FOOTER, 422, 600, HEADER, FOOTER)).toEqual({ x: 1, y: 1 })
    const mid = viewerPointToPage(211, HEADER + 270, 422, 600, HEADER, FOOTER)
    expect(mid.x).toBeCloseTo(0.5, 6)
    expect(mid.y).toBeCloseTo(0.5, 6)
  })

  it('за межами сторінки — притиснуто до краю', () => {
    expect(viewerPointToPage(-50, 0, 422, 600, HEADER, FOOTER)).toEqual({ x: 0, y: 0 })
    expect(viewerPointToPage(900, 900, 422, 600, HEADER, FOOTER)).toEqual({ x: 1, y: 1 })
  })
})

describe('quickRect', () => {
  it('рамка з двох точок у будь-якому порядку', () => {
    const r = quickRect({ x: 0.8, y: 0.6 }, { x: 0.1, y: 0.4 })!
    expect(r.x).toBeCloseTo(0.1, 6)
    expect(r.y).toBeCloseTo(0.4, 6)
    expect(r.w).toBeCloseTo(0.7, 6)
    expect(r.h).toBeCloseTo(0.2, 6)
  })

  it('випадковий клік чи риска (сторона < 1 %) — нічого не вирізаємо', () => {
    expect(quickRect({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toBeNull()
    expect(quickRect({ x: 0.5, y: 0.5 }, { x: 0.505, y: 0.9 })).toBeNull()
    expect(quickRect({ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.505 })).toBeNull()
  })
})

describe('fragmentErrorKey', () => {
  it('мережа, ліміт, не готовий документ, невідоме', () => {
    expect(fragmentErrorKey(new Error('offline'))).toBe('offline')
    expect(fragmentErrorKey({ response: { status: 507, data: {} } })).toBe('quota')
    expect(fragmentErrorKey({ response: { status: 409, data: { error: 'not_ready' } } })).toBe('notReady')
    expect(fragmentErrorKey({ response: { status: 403, data: { error: 'forbidden' } } })).toBe('forbidden')
    expect(fragmentErrorKey({ response: { status: 500, data: {} } })).toBe('failed')
  })
})

describe('runQuickCut', () => {
  const RES = { id: 7, name: 'НМТ · с.4 · фрагмент.png', cdn_url: '/m/f.png', width: 3000, height: 500 } as never
  const RECT = { x: 0.1, y: 0.7, w: 0.8, h: 0.2 }
  const ARGS = { contentItem: 5, page: 4, rect: RECT, viewer: 'docviewer-1' }

  function deps(over: Partial<QuickCutDeps> = {}) {
    const order: string[] = []
    const d: QuickCutDeps = {
      snapshot: vi.fn(() => { order.push('snapshot'); return { boardId: 'b1', pageId: 'p1', viewerId: 'docviewer-1' } }),
      cut: vi.fn(async () => { order.push('cut'); return RES }),
      place: vi.fn(() => 'placed' as const),
      notify: vi.fn(),
      ...over,
    }
    return { d, order }
  }

  it('один запит; дошка й сторінка — запамʼятовані ДО запиту; фрагмент поставлено без повідомлень', async () => {
    const { d, order } = deps()
    expect(await runQuickCut(d, ARGS)).toBe('placed')
    expect(order).toEqual(['snapshot', 'cut'])
    expect(d.cut).toHaveBeenCalledTimes(1)
    expect(d.cut).toHaveBeenCalledWith({ contentItem: 5, page: 4, rect: RECT, board: 'b1', viewer: 'docviewer-1' })
    expect(d.place).toHaveBeenCalledWith({ boardId: 'b1', pageId: 'p1', viewerId: 'docviewer-1' }, RES, RECT)
    expect(d.notify).not.toHaveBeenCalled()
  })

  it('сторінку змінили, поки вирізало — не ставимо, кажемо, що файл у «Матеріалах»', async () => {
    const { d } = deps({ place: vi.fn(() => 'not_placed' as const) })
    expect(await runQuickCut(d, ARGS)).toBe('not_placed')
    expect(d.notify).toHaveBeenCalledWith('not_placed', { name: 'НМТ · с.4 · фрагмент.png' })
  })

  it('вирізати не вдалося — лише повідомлення з причиною, на дошці нічого, без повторів', async () => {
    const { d } = deps({ cut: vi.fn(async () => { throw { response: { status: 507, data: {} } } }) })
    expect(await runQuickCut(d, ARGS)).toBe('failed')
    expect(d.cut).toHaveBeenCalledTimes(1)
    expect(d.place).not.toHaveBeenCalled()
    expect(d.notify).toHaveBeenCalledWith('cut_failed', { reasonKey: 'quota' })
  })
})
