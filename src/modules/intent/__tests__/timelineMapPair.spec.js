/**
 * Шкала теми + історична карта парою (LAW §9 v1.82; власник 31.10 зі знімком сайту: «А тут карта не додається… ти
 * не додав»). Учителю пілоту карти шкала теми з місцями подій від Інтегралика лягає одразу смугою згори, карта — під
 * нею; решті — як було (вісь 1120 × 640, без карти).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

let assets = []
let pages = []
const auth = { user: { pilots: ['historical_borders'] } }

vi.mock('@/modules/winterboard/board/state/boardStore', () => ({
  useWBStore: () => ({
    workspaceId: 'ws-1',
    get currentPage() { return pages[pages.length - 1] },
    get pages() { return pages },
    addAsset: (asset, pageId) => { assets.push({ ...asset, pageId }); pages.find((p) => p.id === pageId)?.assets.push(asset) },
    updateAsset: vi.fn(),
    addPageUndoable: () => { const id = `p${pages.length + 1}`; pages.push({ id, width: 1920, height: 1080, assets: [] }); return id },
  }),
}))
vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => auth }))
vi.mock('@/modules/ship/sceneRecorder', () => ({ recordCompanionScene: vi.fn() }))
vi.mock('@/modules/winterboard/constants/nmt3dDefaults', () => ({ NMT3D_TEMPLATE_LABELS: {} }))

import { runBoardAction } from '../boardActions'

const ev = (id, year, place) => ({
  id, label: `Подія ${year}`, date_start: { year, precision: 'year' }, date_end: null, description: '', sources: [],
  ...(place ? { place } : {}),
})
const timeline = (events, extra = {}) => ({
  kind: 'add_timeline',
  payload: { title: 'Хмельниччина', layout: 'ordinal', orientation: 'horizontal', view: 'axis', eras: [], events, sources: [], ...extra },
})
const WITH_PLACES = [ev('e1', 1648, { lat: 48.4, lon: 33.6 }), ev('e2', 1649, { lat: 49.7, lon: 25.1 }), ev('e3', 1654, { lat: 50.1, lon: 31.4 })]

beforeEach(() => {
  assets = []
  pages = [{ id: 'p1', width: 1920, height: 1080, assets: [] }]
  auth.user = { pilots: ['historical_borders'] }
})

describe('шкала теми й карта — пара (v1.82)', () => {
  it('пілот карти: смуга згори на всю ширину + карта цієї теми під нею до низу аркуша', async () => {
    await runBoardAction(timeline(WITH_PLACES))
    const [tl, map] = assets
    expect(tl).toMatchObject({ type: 'timeline_card', x: 40, y: 40, w: 1840, h: 360, data: { strip: true, view: 'axis' } })
    expect(map).toMatchObject({ type: 'map_card', x: 40, y: 440, w: 1840, h: 600, pageId: 'p1' })
    expect(map.data.borders).toMatchObject({ dataset: 'cliopatria-world', years: [1648, 1654] })
    expect(map.data.title).toBe('Хмельниччина')
    expect(map.id).not.toBe(tl.id)
  })

  it('поза пілотом — як було: вісь без карти', async () => {
    auth.user = { pilots: [] }
    await runBoardAction(timeline(WITH_PLACES))
    expect(assets).toHaveLength(1)
    expect(assets[0]).toMatchObject({ w: 1120, h: 640 })
    expect(assets[0].data.strip).toBeUndefined()
  })

  it('без місць подій — карти немає й смуги теж', async () => {
    await runBoardAction(timeline([ev('e1', 1648), ev('e2', 1649)]))
    expect(assets).toHaveLength(1)
    expect(assets[0].data.strip).toBeUndefined()
  })

  it('на аркуші немає місця під пару — нова сторінка одразу після поточної', async () => {
    pages[0].assets.push({ id: 'x', type: 'text', x: 600, y: 400, w: 400, h: 200 })
    await runBoardAction(timeline(WITH_PLACES))
    expect(pages).toHaveLength(2)
    expect(assets.map((a) => a.pageId)).toEqual(['p2', 'p2'])
  })
})
