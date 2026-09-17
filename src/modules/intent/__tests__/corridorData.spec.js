/**
 * Коридори — мова матеріалу й походження в ДАНИХ об'єкта (ТЗ 2026-09-17 §3.7, §6.3, §11.4).
 *
 * Дані об'єкта переживають reload/replay/clone/export самі собою (вони в ops);
 * тут стережемо, що мова й атрибуція туди потрапляють — і що без `corridor`
 * (користувачі поза rollout-гейтом) дані байт-у-байт як раніше.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

let assets = []
let pages = []

vi.mock('@/modules/winterboard/board/state/boardStore', () => ({
  useWBStore: () => ({
    workspaceId: 'ws-1',
    get currentPage() { return pages[pages.length - 1] },
    addAsset: (asset) => { assets.push(asset) },
    addStroke: vi.fn(),
    updateAsset: vi.fn(),
    addPageUndoable: () => { const id = `p${pages.length + 1}`; pages.push({ id, width: 1920, height: 1080, assets: [] }); return id },
  }),
}))
vi.mock('@/modules/ship/sceneRecorder', () => ({ recordCompanionScene: vi.fn() }))
vi.mock('@/modules/winterboard/constants/nmt3dDefaults', () => ({ NMT3D_TEMPLATE_LABELS: {} }))

import { corridorData, runBoardAction } from '../boardActions'

const PROVENANCE = {
  subject: 'history', content_language: 'uk', requested_content_language: 'en', source_language: 'uk',
  source_provider: 'wikipedia', source_url: 'https://uk.wikipedia.org/wiki/Mazepa', license: 'CC BY-SA 4.0',
  retrieved_at: '2026-09-17T10:00:00+00:00', translation_used: false,
}

beforeEach(() => { assets = []; pages = [{ id: 'p1', width: 1920, height: 1080, assets: [] }] })

describe('corridorData', () => {
  it('без коридору — нічого', () => {
    expect(corridorData(undefined)).toEqual({})
    expect(corridorData({ content_language: 'de' })).toEqual({})
  })

  it('закритий список ключів; оригінальні URL, ліцензія й мова джерела зберігаються (kill-проба 15)', () => {
    const out = corridorData({ ...PROVENANCE, evil: '<script>', capability_profile: 'EN_GUIDE' })
    expect(out.content_language).toBe('uk')
    expect(out.provenance).toMatchObject({
      source_url: PROVENANCE.source_url, license: 'CC BY-SA 4.0', source_language: 'uk',
      requested_content_language: 'en', translation_used: false,
    })
    expect(out.provenance).not.toHaveProperty('evil')
    expect(out.provenance).not.toHaveProperty('capability_profile')
  })
})

describe('створення матеріалу з мовою', () => {
  it('add_card без коридору — дані як були (поза гейтом нічого не змінюється)', async () => {
    await runBoardAction({ kind: 'add_card', payload: { title: 'T', body: 'B', badge: 'Теорія' } })
    expect(assets[0].data).toEqual({ version: 1, badge: 'Теорія', title: 'T', body: 'B', formulas: [] })
  })

  it('add_card з коридором — content_language і provenance у data', async () => {
    await runBoardAction({ kind: 'add_card', payload: { title: 'Photosynthesis', body: 'Plants…', corridor: { ...PROVENANCE, content_language: 'en' } } })
    expect(assets[0].data.content_language).toBe('en')
    expect(assets[0].data.provenance.source_provider).toBe('wikipedia')
  })

  it('add_image з коридором зберігає атрибуцію і мову', async () => {
    await runBoardAction({ kind: 'add_image', payload: {
      src: 'https://upload/x.jpg', w: 400, h: 500, caption: 'Мазепа', source: 'wikimedia_commons',
      source_url: 'https://commons/File:x.jpg', license: 'CC BY-SA 4.0', author: 'Painter',
      corridor: { ...PROVENANCE, source_provider: 'wikimedia_commons', author: 'Painter' },
    } })
    expect(assets[0].data).toMatchObject({ content_language: 'uk', license: 'CC BY-SA 4.0' })
    expect(assets[0].data.provenance).toMatchObject({ author: 'Painter', source_provider: 'wikimedia_commons' })
  })

  it('add_page з карткою — мова в даних картки', async () => {
    await runBoardAction({ kind: 'add_page', payload: { card: { title: 'Timeline', body: '1648' }, corridor: { content_language: 'en' } } })
    expect(assets[0].data).toMatchObject({ content_language: 'en', provenance: {} })
  })
})
