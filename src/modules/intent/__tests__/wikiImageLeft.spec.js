/**
 * Б-146 (власник 2026-10-05: «так, роби картинку ліворуч, текст праворуч»).
 *
 * Довідка з Вікіпедії лягала вузькою карткою 520 з прокруткою, а поруч лишався порожній аркуш.
 * Тепер сервер дає картці розмір картинки наступного кроку (`image_left`), а дошка ставить
 * картку праворуч на всю вільну ширину і лишає картинці місце ліворуч. Порядок дій той самий:
 * [add_card, add_image].
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
    get pages() { return pages },
    addAsset: (asset, pageId) => { (pages.find((x) => x.id === pageId) ?? page).assets.push(asset) },
    addStroke: (stroke) => { page.assets.push({ id: stroke.id, x: stroke.points[0].x, y: stroke.points[0].y, w: stroke.width, h: 40 }) },
    updateAsset: vi.fn(),
  }),
}))
vi.mock('@/modules/ship/sceneRecorder', () => ({ recordCompanionScene: vi.fn() }))
vi.mock('@/modules/winterboard/constants/nmt3dDefaults', () => ({ NMT3D_TEMPLATE_LABELS: {} }))

import { runBoardAction } from '../boardActions'

const IMAGE = {
  kind: 'add_image',
  payload: {
    src: 'https://upload.wikimedia.org/x.jpg', w: 800, h: 1000, caption: 'Богдан Хмельницький',
    source: 'wikimedia_commons', source_url: 'https://commons.wikimedia.org/wiki/File:x.jpg',
    license: 'Public domain', author: '',
  },
}
const card = (extra = {}) => ({
  kind: 'add_card',
  payload: { title: 'Богдан Хмельницький', body: 'Текст статті.', badge: 'Вікіпедія', ...extra },
})
const WIKI = [card({ image_left: { w: 800, h: 1000 } }), IMAGE]

const overlaps = (p, q) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h
const byType = (type) => page.assets.find((a) => a.type === type)

beforeEach(() => {
  zoom = 1
  page = { id: 'p1', width: 1920, height: 1080, assets: [] }
  pages = [page]
})

describe('довідка з картинкою: картинка ліворуч, текст праворуч', () => {
  it('порожній аркуш: картинка в лівому куті, картка поруч до правого поля', async () => {
    for (const a of WIKI) await runBoardAction(a)
    const img = byType('image')
    const text = byType('theory_card')
    expect(img).toMatchObject({ x: 40, y: 40, w: 480, h: 600 })   // 800×1000 → вписано в 480
    expect(text).toMatchObject({ x: 40 + 480 + 40, y: 40 })
    expect(text.w).toBe(1920 - 40 - text.x)                      // уся решта ширини, не 520
    expect(overlaps(img, text)).toBe(false)
  })

  it('без `image_left` (текст без картинки) — звичайна картка 520, як і була', async () => {
    await runBoardAction(card())
    expect(byType('theory_card')).toMatchObject({ x: 40, y: 40, w: 520 })
  })

  it('праворуч у смузі вже щось лежить — картка до нього, з проміжком, без перекриття', async () => {
    const other = { id: 'u', type: 'image', x: 1400, y: 100, w: 400, h: 300 }
    page.assets.push(other)
    for (const a of WIKI) await runBoardAction(a)
    const text = byType('theory_card')
    expect(text.x).toBe(560)
    expect(text.x + text.w).toBeLessThanOrEqual(other.x - 20)
    expect(text.w).toBeGreaterThanOrEqual(520)
    expect(overlaps(text, other)).toBe(false)
  })

  it('є дірка лише під картинку раніше на аркуші — картинка все одно поруч зі своєю карткою', async () => {
    // Угорі праворуч зайнято: вгорі ліворуч вміщується картинка, але не пара.
    page.assets.push({ id: 'u', type: 'image', x: 600, y: 40, w: 1280, h: 300 })
    for (const a of WIKI) await runBoardAction(a)
    const img = page.assets.find((a) => a.type === 'image' && a.id !== 'u')
    const text = byType('theory_card')
    expect(text.y).toBe(380)
    expect(img).toMatchObject({ x: 40, y: 380 })
    expect(text.x).toBe(img.x + img.w + 40)
  })

  it('пульт кладе на підготовчу сторінку — пара там, поточна сторінка не зачеплена', async () => {
    page.assets.push({ id: 'u', type: 'image', x: 40, y: 40, w: 1800, h: 1000 })   // поточна зайнята
    const prep = { id: 'prep', width: 1920, height: 1080, assets: [] }
    pages.push(prep)
    for (const a of WIKI) await runBoardAction(a, { pageId: 'prep' })
    expect(page.assets).toHaveLength(1)
    expect(prep.assets.find((a) => a.type === 'image')).toMatchObject({ x: 40, y: 40, w: 480, h: 600 })
    expect(prep.assets.find((a) => a.type === 'theory_card')).toMatchObject({ x: 560, y: 40, w: 1320 })
  })

  it('пари не вмістити (вузький аркуш) — звичайна картка 520, картинка на вільне місце', async () => {
    page = { id: 'p1', width: 1000, height: 1080, assets: [] }
    pages = [page]
    for (const a of WIKI) await runBoardAction(a)
    const text = byType('theory_card')
    const img = byType('image')
    expect(text.w).toBe(520)
    expect(overlaps(text, img)).toBe(false)
  })

  it('місце картинки живе лише до наступної дії: між ними інша дія — картинка шукає місце сама', async () => {
    await runBoardAction(WIKI[0])
    await runBoardAction({ kind: 'add_text', payload: { text: 'підпис' } })   // ляже в лівий кут
    await runBoardAction(IMAGE)
    const img = byType('image')
    const textStroke = page.assets.find((a) => a.id && !a.type)
    expect(overlaps(img, textStroke)).toBe(false)
    expect(overlaps(img, byType('theory_card'))).toBe(false)
  })

  it('дрібний масштаб (більший резерв висоти) — пара однаково вміщується на порожньому аркуші', async () => {
    zoom = 0.5
    for (const a of WIKI) await runBoardAction(a)
    expect(byType('image')).toMatchObject({ x: 40, y: 40 })
    expect(byType('theory_card').w).toBe(1920 - 40 - 560)
  })
})
