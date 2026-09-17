/**
 * Коридори — мова матеріалу й походження в ДАНИХ об'єкта (ТЗ 2026-09-17 §3.7, §6.3, §11.4).
 *
 * Дані об'єкта переживають reload/replay/clone/export самі собою (вони в ops);
 * тут стережемо, що мова й атрибуція туди потрапляють — і що без `corridor`
 * (користувачі поза rollout-гейтом) дані байт-у-байт як раніше.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

let assets = []
let strokes = []
let pages = []

vi.mock('@/modules/winterboard/board/state/boardStore', () => ({
  useWBStore: () => ({
    workspaceId: 'ws-1',
    get currentPage() { return pages[pages.length - 1] },
    addAsset: (asset) => { assets.push(asset) },
    addStroke: (stroke) => { strokes.push(stroke) },
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

beforeEach(() => { assets = []; strokes = []; pages = [{ id: 'p1', width: 1920, height: 1080, assets: [] }] })

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

  it("рев'ю C0–C4: атрибуція CC BY-SA переживає allowlist — автор, share_alike, URL ліцензії, джерело мови", () => {
    const out = corridorData({
      ...PROVENANCE, author: 'Wikipedia contributors', share_alike: true, source_title: 'Ivan Mazepa',
      license_url: 'https://creativecommons.org/licenses/by-sa/4.0/', content_language_source: 'explicit_command',
    })
    expect(out.provenance).toMatchObject({
      author: 'Wikipedia contributors', share_alike: true, source_title: 'Ivan Mazepa',
      license_url: 'https://creativecommons.org/licenses/by-sa/4.0/', content_language_source: 'explicit_command',
    })
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

  it("рев'ю C0–C4: add_text з коридором несе мову й провенанс у stroke.data (LAW §9.D)", async () => {
    await runBoardAction({ kind: 'add_text', payload: { text: '1648 — the beginning', corridor: {
      content_language: 'en', content_language_source: 'lesson', subject: 'history', translation_used: false,
    } } })
    expect(strokes).toHaveLength(1)
    expect(strokes[0].text).toBe('1648 — the beginning')
    expect(strokes[0].data).toEqual({ content_language: 'en', provenance: {
      content_language_source: 'lesson', subject: 'history', translation_used: false } })
  })

  it('add_text без коридору — штрих без data (поза гейтом нічого не змінюється)', async () => {
    await runBoardAction({ kind: 'add_text', payload: { text: 'Привіт' } })
    expect(strokes[0]).not.toHaveProperty('data')
  })

  it("рев'ю C0–C4: підпис англійської картинки — серверний рядок атрибуції мовою матеріалу", async () => {
    await runBoardAction({ kind: 'add_image', payload: {
      src: 'https://upload/x.jpg', w: 400, h: 500, caption: 'Ivan Mazepa', source: 'wikimedia_commons',
      source_url: 'https://commons/File:x.jpg', license: 'CC BY-SA 4.0', author: 'Painter',
      attribution_text: 'Source: Wikimedia Commons, Painter · CC BY-SA 4.0',
      corridor: { ...PROVENANCE, content_language: 'en', source_provider: 'wikimedia_commons', author: 'Painter', share_alike: true },
    } })
    expect(strokes).toHaveLength(1)
    expect(strokes[0].text).toBe('Source: Wikimedia Commons, Painter · CC BY-SA 4.0')
    expect(strokes[0].text).not.toMatch(/Джерело|Вікіпед/)
    expect(strokes[0].data.content_language).toBe('en')
    expect(assets[0].data.provenance).toMatchObject({ author: 'Painter', share_alike: true })
  })

  it('add_image без коридору — підпис як був', async () => {
    await runBoardAction({ kind: 'add_image', payload: {
      src: 'https://upload/x.jpg', w: 400, h: 500, caption: 'Мазепа', source: 'wikimedia_commons',
      source_url: 'https://commons/File:x.jpg', license: 'CC BY-SA 4.0', author: 'Painter',
      attribution_text: 'Source: ignored without corridor',
    } })
    expect(strokes[0].text).toBe('Джерело: Вікіпедія · CC BY-SA 4.0')
    expect(strokes[0]).not.toHaveProperty('data')
  })

  it('add_page з карткою — мова в даних картки', async () => {
    await runBoardAction({ kind: 'add_page', payload: { card: { title: 'Timeline', body: '1648' }, corridor: { content_language: 'en' } } })
    expect(assets[0].data).toMatchObject({ content_language: 'en', provenance: {} })
  })
})
