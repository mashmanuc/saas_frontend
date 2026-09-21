/**
 * Розкладка вставок Інтегралика (2026-09-21, браузерне приймання Next Actions).
 *
 * Стереже: місце шукається за ТИМ, ЩО ВЖЕ ЛЕЖИТЬ на сторінці, а не лічильником
 * у пам'яті. До виправлення після перезавантаження сторінки довідка лягла точно
 * на картку події, а карта 680×520 не вміщалась у слот 560×420 — 11 перекриттів
 * на 7 об'єктах.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

let page
let pages
let zoom = 1

vi.mock('@/modules/winterboard/board/state/boardStore', () => ({
  useWBStore: () => ({
    workspaceId: 'ws-1',
    get zoom() { return zoom },
    get currentPage() { return page },
    addAsset: (asset) => { page.assets.push(asset) },
    addStroke: vi.fn(),
    updateAsset: vi.fn(),
    addPageUndoable: ({ name } = {}) => {
      page = { id: `p${pages.length + 1}`, name, width: 1920, height: 1080, assets: [] }
      pages.push(page)
      return page.id
    },
  }),
}))
vi.mock('@/modules/ship/sceneRecorder', () => ({ recordCompanionScene: vi.fn() }))
vi.mock('@/modules/winterboard/constants/nmt3dDefaults', () => ({ NMT3D_TEMPLATE_LABELS: {} }))

import { findFreeSpot, openPageForPlan, planFitsCurrentPage, runBoardAction } from '../boardActions'

const CARD = { kind: 'add_history_card', payload: { variant: 'polity', title: 'X', primary: [] } }
const MAP = { kind: 'add_map', payload: { title: 'M', markers: [{ id: 'm', lat: 49.6, lon: 34.5, label: 'P' }] } }

const overlaps = (p, q) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h

beforeEach(() => {
  zoom = 1
  page = { id: 'p1', width: 1920, height: 1080, assets: [] }
  pages = [page]
})

describe('findFreeSpot', () => {
  it('порожня сторінка — лівий верхній кут із полем', () => {
    expect(findFreeSpot([], 520, 380)).toEqual({ x: 40, y: 40 })
  })

  it('не кладе на зайняте, навіть якщо зайняте поставив учитель руками', () => {
    const taken = [{ x: 40, y: 40, w: 520, h: 940 }]
    const spot = findFreeSpot(taken, 520, 380)
    expect(overlaps({ ...spot, w: 520, h: 380 }, taken[0])).toBe(false)
  })

  it('місця немає — null, а не «в ту саму точку»', () => {
    expect(findFreeSpot([{ x: 0, y: 0, w: 1920, h: 1080 }], 520, 380)).toBeNull()
  })
})

describe('вставки лягають поруч, а не одна на одну', () => {
  it('картка, карта й ще три картки — без жодного перекриття', async () => {
    for (const action of [CARD, MAP, CARD, CARD, CARD]) await runBoardAction(action)
    const boxes = page.assets.map((a) => ({ x: a.x, y: a.y, w: a.w, h: a.h }))
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j])).toBe(false)
    }
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.x + b.w).toBeLessThanOrEqual(1920)
    }
  })

  it('сторінку заповнили й перезавантажили — нова вставка не лягає на першу', async () => {
    // Раніше лічильник у пам'яті після перезавантаження починав з нуля.
    page.assets.push({ id: 'old', type: 'history_card', x: 40, y: 40, w: 520, h: 940 })
    await runBoardAction(CARD)
    const fresh = page.assets[1]
    expect(overlaps(fresh, page.assets[0])).toBe(false)
  })

  it('картка, що виросла під вміст, враховується реальною висотою', async () => {
    page.assets.push({ id: 'tall', type: 'theory_card', x: 40, y: 40, w: 1840, h: 500 })
    await runBoardAction(CARD)
    expect(page.assets[1].y).toBeGreaterThanOrEqual(540)
  })
})

describe('набір (Next Actions) — вміщується цілим або йде на нову сторінку', () => {
  it('шість карток на порожній сторінці вміщуються', async () => {
    expect(await planFitsCurrentPage(Array(6).fill(CARD))).toBe(true)
  })

  it('сім карток — уже ні', async () => {
    expect(await planFitsCurrentPage(Array(7).fill(CARD))).toBe(false)
  })

  it('дрібний зум — картки виростуть, тож на сторінку вміщується менше', async () => {
    // Вміст картки має екранний розмір: на зумі 0.4 картка в одиницях дошки
    // виросте до ~1000 (INV-25), і друга смуга карток лягла б під першу.
    zoom = 0.4
    expect(await planFitsCurrentPage(Array(3).fill(CARD))).toBe(true)
    expect(await planFitsCurrentPage(Array(4).fill(CARD))).toBe(false)
  })

  it('на дрібному зумі нова картка не лягає під ту, що виросте', async () => {
    zoom = 0.4
    for (let i = 0; i < 3; i++) await runBoardAction(CARD)
    const [a, b, c] = page.assets
    expect(new Set([a.y, b.y, c.y]).size).toBe(1)
  })

  it('симуляція нічого не кладе на дошку', async () => {
    await planFitsCurrentPage([CARD, MAP])
    expect(page.assets).toHaveLength(0)
  })

  it('нова сторінка стає поточною, і набір лягає вже на неї', async () => {
    page.assets.push({ id: 'a', type: 'history_card', x: 40, y: 40, w: 1840, h: 1000 })
    await openPageForPlan('Полтавська битва — Сторони битви')
    await runBoardAction(CARD)
    expect(pages).toHaveLength(2)
    expect(pages[1].name).toBe('Полтавська битва — Сторони битви')
    expect(pages[1].assets).toHaveLength(1)
    expect(pages[0].assets).toHaveLength(1)
  })
})
