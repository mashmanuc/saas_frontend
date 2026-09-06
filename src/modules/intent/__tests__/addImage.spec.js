/**
 * add_image (Вікіпедія, 2026-09-06) — картинка за URL з провенансом.
 *
 * Стереже: (1) без src або без джерела — на дошку НЕ йде (кидає, не мовчить);
 * (2) форма асета = дзеркало useContentDrop (type:'image', src, x, y, w, h,
 * rotation, locked) + data з source/license/author/retrieved_at; (3) розмір
 * вписаний у 480 по ширині зі збереженням пропорцій; (4) під картинкою —
 * текстовий штрих із джерелом і ліцензією.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

let assets = []
let strokes = []

vi.mock('@/modules/winterboard/board/state/boardStore', () => ({
  useWBStore: () => ({
    workspaceId: 'ws-1',
    currentPage: { id: 'p1', width: 1920, height: 1080, get assets() { return assets } },
    addAsset: (asset) => { assets.push(asset) },
    addStroke: (s) => { strokes.push(s) },
    updateAsset: vi.fn(),
  }),
}))
vi.mock('@/modules/ship/sceneRecorder', () => ({ recordCompanionScene: vi.fn() }))
vi.mock('@/modules/winterboard/constants/nmt3dDefaults', () => ({ NMT3D_TEMPLATE_LABELS: {} }))

import { runBoardAction } from '../boardActions'

const IMG = {
  src: 'https://thumb.wikimedia.org/x/800px-Newton.jpg',
  w: 800, h: 1000,
  caption: 'Ісаак Ньютон',
  source: 'wikimedia_commons',
  source_url: 'https://commons.wikimedia.org/wiki/File:Newton.jpg',
  license: 'Public domain',
  author: 'Godfrey Kneller',
  retrieved_at: '2026-09-06T18:00:00+00:00',
}

beforeEach(() => { assets = []; strokes = [] })

describe('add_image', () => {
  it('кладе image-асет у формі useContentDrop + провенанс у data', async () => {
    await runBoardAction({ kind: 'add_image', payload: IMG })
    expect(assets).toHaveLength(1)
    const a = assets[0]
    expect(a.type).toBe('image')
    expect(a.src).toBe(IMG.src)
    for (const k of ['id', 'x', 'y', 'w', 'h', 'rotation', 'locked']) expect(a).toHaveProperty(k)
    expect(a.data).toMatchObject({
      source: 'wikimedia_commons',
      source_url: IMG.source_url,
      license: 'Public domain',
      author: 'Godfrey Kneller',
      retrieved_at: IMG.retrieved_at,
      caption: 'Ісаак Ньютон',
    })
  })

  it('вписує у 480 по ширині, зберігаючи пропорції', async () => {
    await runBoardAction({ kind: 'add_image', payload: IMG })
    expect(assets[0].w).toBe(480)
    expect(assets[0].h).toBe(600)   // 1000 * 480/800
  })

  it('менша за 480 картинка не збільшується', async () => {
    await runBoardAction({ kind: 'add_image', payload: { ...IMG, w: 300, h: 200 } })
    expect(assets[0].w).toBe(300)
    expect(assets[0].h).toBe(200)
  })

  it('без розмірів від BE — квадрат 360 (канва підтягне після завантаження)', async () => {
    await runBoardAction({ kind: 'add_image', payload: { ...IMG, w: undefined, h: undefined } })
    expect(assets[0].w).toBe(360)
    expect(assets[0].h).toBe(360)
  })

  it('⚠️ послідовні вставки НЕ накривають одна одну', async () => {
    // Живий тест власника 2026-09-06 (Хмельницький + двоє синів): 6 об'єктів
    // лягли в купу, бо каскад зсував на 28 px при картці 520 px завширшки.
    for (let i = 0; i < 4; i++) {
      await runBoardAction({ kind: 'add_image', payload: { ...IMG, w: 400, h: 300 } })
    }
    const boxes = assets.map((a) => ({ x: a.x, y: a.y, w: a.w, h: a.h }))
    const overlaps = (p, q) =>
      p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(overlaps(boxes[i], boxes[j])).toBe(false)
      }
    }
  })

  it('усі вставки лишаються в межах сторінки', async () => {
    for (let i = 0; i < 6; i++) {
      await runBoardAction({ kind: 'add_image', payload: { ...IMG, w: 400, h: 300 } })
    }
    for (const a of assets) {
      expect(a.x).toBeGreaterThanOrEqual(0)
      expect(a.y).toBeGreaterThanOrEqual(0)
      expect(a.x + a.w).toBeLessThanOrEqual(1920)
      expect(a.y + a.h).toBeLessThanOrEqual(1080)
    }
  })

  it('підпис джерела під картинкою — текстовий штрих із ліцензією', async () => {
    await runBoardAction({ kind: 'add_image', payload: IMG })
    expect(strokes).toHaveLength(1)
    expect(strokes[0].tool).toBe('text')
    expect(strokes[0].text).toBe('Джерело: Вікіпедія · Public domain')
    // під картинкою, не над нею
    expect(strokes[0].points[0].y).toBeGreaterThan(assets[0].y + assets[0].h)
  })

  it('⛔ без src — кидає, нічого не кладе', async () => {
    await expect(runBoardAction({ kind: 'add_image', payload: { ...IMG, src: '' } }))
      .rejects.toThrow('Немає адреси')
    expect(assets).toHaveLength(0)
  })

  it('⛔ без джерела — кидає: картинка без провенансу на дошку школи не йде', async () => {
    await expect(runBoardAction({ kind: 'add_image', payload: { ...IMG, source_url: '' } }))
      .rejects.toThrow('без джерела')
    expect(assets).toHaveLength(0)
  })
})
