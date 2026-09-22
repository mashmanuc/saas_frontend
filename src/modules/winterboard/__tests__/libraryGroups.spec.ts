/**
 * Групування «Матеріалів» за датою (візуальний розбір 2026-09-22, п. 9).
 */
import { describe, expect, it } from 'vitest'
import { dateFromName, groupAssets } from '../utils/libraryGroups'
import type { LibraryAsset } from '../types/library'

const asset = (name: string, extra: Partial<LibraryAsset> = {}): LibraryAsset => ({
  id: Math.random(), name, storage_key: 'k', cdn_url: '', thumbnail_url: '',
  content_type: name.endsWith('.png') ? 'image/png' : 'application/pdf',
  size_bytes: 1, status: 'active', folder: null, is_favorite: false, last_used_at: null,
  tags: [], created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z', ...extra,
} as LibraryAsset)

const labels = { thisWeek: 'Цього тижня', documents: 'Документи й збірники' }

describe('dateFromName', () => {
  it('формати імен вчителів', () => {
    expect(dateFromName('N22__17_06_26.png')).toEqual(new Date(2026, 5, 17))
    expect(dateFromName('урок 03.09.2026.pdf')).toEqual(new Date(2026, 8, 3))
    expect(dateFromName('scan-2026-05-30.png')).toEqual(new Date(2026, 4, 30))
  })
  it('без дати або з неможливою датою — null', () => {
    expect(dateFromName('NMT_2026_povnyy_zbirnyk.pdf')).toBeNull()
    expect(dateFromName('N22__45_13_26.png')).toBeNull()
    expect(dateFromName('Навчальні плани 7 клас на 2026-2027 н.р..docx')).toBeNull()
  })
})

describe('groupAssets', () => {
  const now = new Date(2026, 8, 22)

  it('скрін власника: червень, травень, документи — у такому порядку', () => {
    const g = groupAssets([
      asset('N22__30_05_26.png'), asset('N22__17_06_26.png'), asset('NMT_2026_povnyy_zbirnyk.pdf'),
      asset('N22__02_06_26.png'), asset('Навчальні плани 7 клас на 2026-2027 н.р..docx'),
    ], { locale: 'uk', labels, now })
    expect(g.map((x) => x.label)).toEqual(['Червень 2026', 'Травень 2026', 'Документи й збірники'])
    expect(g[0].items.map((a) => a.name)).toEqual(['N22__17_06_26.png', 'N22__02_06_26.png'])
    expect(g[2].items).toHaveLength(2)
  })

  it('останні 7 днів — «Цього тижня», першою групою', () => {
    const g = groupAssets([asset('N22__01_09_26.png'), asset('N22__20_09_26.png')], { locale: 'uk', labels, now })
    expect(g.map((x) => x.label)).toEqual(['Цього тижня', 'Вересень 2026'])
  })

  it('картинка без дати в імені — за датою створення', () => {
    const g = groupAssets([asset('photo.png', { created_at: '2026-07-10T10:00:00Z' })], { locale: 'uk', labels, now })
    expect(g[0].label).toBe('Липень 2026')
  })

  it('мова інтерфейсу', () => {
    const g = groupAssets([asset('N22__17_06_26.png')], { locale: 'en', labels, now })
    expect(g[0].label).toBe('June 2026')
  })
})
