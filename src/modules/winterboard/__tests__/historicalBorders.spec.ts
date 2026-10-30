/**
 * Кордони держав у часі на карті дошки (ТЗ `saas_docs/plans/TZ_HISTORICAL_BORDERS_MAP_2026-10-30.md`).
 * Власник 2026-10-30: «об'єкт не має залежати від ChatGPT… залежить від даних» — тут перевіряємо саме дані й те,
 * що картка малює рівно набір цієї версії на рік картки, а рік змінює одним `asset_update`.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import {
  BORDER_DATASETS, CLIOPATRIA_EAST_EUROPE, ENTITY_COLORS, bordersDiff, changeYears, clampYear, entityColor, loadBorders,
  statesAt, stepYear, type BordersDataset,
} from '../board/historicalBorders'
import { buildHistoricalMapAsset } from '../constants/evidenceCardDefaults'
import { visibleApps, visibleInserts } from '../components/sidebar/insertRegistry'
import MapCardRenderer from '../components/board/objects/MapCardRenderer.vue'
import type { MapCardData, WBAsset } from '../types/winterboard'

const VERSION = BORDER_DATASETS[CLIOPATRIA_EAST_EUROPE].version

async function dataset(): Promise<BordersDataset> {
  const data = await loadBorders(CLIOPATRIA_EAST_EUROPE, VERSION)
  expect(data).not.toBeNull()
  return data!
}

describe('набір кордонів — дані, не вигадка', () => {
  it('версія, джерело й ліцензія — у самому файлі; інша версія не підставляється', async () => {
    const data = await dataset()
    expect(data.meta.version).toBe(VERSION)
    expect(data.meta.source.license).toBe('CC BY 4.0')
    expect(data.meta.years_inclusive).toBe(true)
    expect(data.meta.verified_by_historian).toBe(false)
    expect(await loadBorders(CLIOPATRIA_EAST_EUROPE, 'v1-0000000000')).toBeNull()
    expect(await loadBorders('нема-такого', VERSION)).toBeNull()
  })

  it('кожна версія держави — роки, багатокутники з придатними координатами, колір сутності', async () => {
    const data = await dataset()
    expect(data.states.length).toBeGreaterThan(40)
    for (const s of data.states) {
      expect(s.from).toBeLessThanOrEqual(s.to)
      expect(ENTITY_COLORS[s.entity]).toBeTruthy()
      expect(s.polygons.length).toBeGreaterThan(0)
      for (const polygon of s.polygons) for (const ring of polygon) {
        expect(ring.length).toBeGreaterThanOrEqual(4)
        for (const [lon, lat] of ring) {
          expect(lon).toBeGreaterThanOrEqual(-180); expect(lon).toBeLessThanOrEqual(180)
          expect(lat).toBeGreaterThanOrEqual(-90); expect(lat).toBeLessThanOrEqual(90)
        }
      }
    }
  })

  it('роки зміни меж — із самих даних, по зростанню, у межах набору', async () => {
    const data = await dataset()
    const years = changeYears(data)
    expect(years).toEqual([...years].sort((a, b) => a - b))
    expect(years[0]).toBe(1648)
    expect(years[years.length - 1]).toBeLessThanOrEqual(1687)
    for (const y of years) expect(data.states.some((s) => Math.max(s.from, 1648) === y)).toBe(true)
  })
})

describe('рік → держави', () => {
  it('роки включні: на кожен рік одна версія кожної держави; Запорозькі козаки — з 1662', async () => {
    const data = await dataset()
    for (const year of [1648, 1654, 1667, 1687]) {
      const entities = statesAt(data, year).map((s) => s.entity)
      expect(new Set(entities).size).toBe(entities.length)
      expect(entities).toContain('commonwealth')
      expect(entities).toContain('crimea')
    }
    expect(statesAt(data, 1661).map((s) => s.entity)).not.toContain('zaporozhian_cossacks')
    expect(statesAt(data, 1662).map((s) => s.entity)).toContain('zaporozhian_cossacks')
  })

  it('крок ◀ ▶ — між роками зміни меж; на краю — той самий рік; рік поза набором — до краю', async () => {
    const data = await dataset()
    expect(stepYear(data, 1648, 1)).toBe(1653)
    expect(stepYear(data, 1654, 1)).toBe(1659)
    expect(stepYear(data, 1654, -1)).toBe(1653)
    expect(stepYear(data, 1648, -1)).toBe(1648)
    expect(stepYear(data, 1687, 1)).toBe(1687)
    expect(clampYear(data, 1500)).toBe(1648)
    expect(clampYear(data, 1800)).toBe(1687)
    expect(clampYear(data, 'x')).toBe(1648)
  })
})

describe('картка на дошці', () => {
  it('нова карта — лише посилання на набір і рік, координат у стані дошки немає', () => {
    const asset = buildHistoricalMapAsset({ x: 960, y: 540 })
    const data = asset.data as MapCardData
    expect(asset.type).toBe('map_card')
    expect(data.historical_boundary_mode).toBe('dataset')
    expect(data.borders).toEqual({ dataset: CLIOPATRIA_EAST_EUROPE, version: VERSION, year: 1648 })
    expect(data.basemap).toBe('east_europe')
    expect(JSON.stringify(data)).not.toContain('polygons')
  })

  it('малює держави на рік картки; ▶ — наступний рік одним оновленням; підпис джерела є', async () => {
    const asset = buildHistoricalMapAsset({ x: 960, y: 540 })
    const w = mount(MapCardRenderer, { props: { asset, interactive: true, canFit: false } })
    await flushPromises()
    const data = await dataset()
    expect(w.findAll('.hmap__state')).toHaveLength(statesAt(data, 1648).length)
    expect(w.get('[data-testid="map-card-year"]').text()).toBe('1648')
    expect(w.get('[data-testid="map-card-borders-note"]').text()).toContain('CC BY 4.0')
    await w.get('[data-testid="map-card-year-next"]').trigger('click')
    const updates = w.emitted('update:asset')!
    expect(updates).toHaveLength(1)
    expect((updates[0][0] as WBAsset & { data: MapCardData }).data.borders?.year).toBe(1653)
    expect(w.get('[data-testid="map-card-year-prev"]').attributes('disabled')).toBeDefined()
    w.unmount()
  })

  it('інша версія набору — чесно «недоступний», кордонів не намальовано', async () => {
    const asset = buildHistoricalMapAsset({ x: 960, y: 540 })
    ;(asset.data as MapCardData).borders!.version = 'v1-0000000000'
    const w = mount(MapCardRenderer, { props: { asset, interactive: true, canFit: false } })
    await flushPromises()
    expect(w.findAll('.hmap__state')).toHaveLength(0)
    expect(w.find('[data-testid="map-card-borders-missing"]').exists()).toBe(true)
    w.unmount()
  })
})

describe('вставка — лише пілоту historical_borders', () => {
  it('без пілота плитки немає; з пілотом — є, і картка «Навчальні обʼєкти» видна навіть без доказового гейта', () => {
    expect(visibleInserts({ evidence: false }).some((e) => e.id === 'evidence.historical_map')).toBe(false)
    expect(visibleInserts({ evidence: true }).some((e) => e.id === 'evidence.historical_map')).toBe(false)
    expect(visibleInserts({ evidence: false, borders: true }).map((e) => e.id)).toContain('evidence.historical_map')
    expect(visibleInserts({ evidence: false, borders: true }).map((e) => e.id)).not.toContain('evidence.map')
    expect(visibleApps({ evidence: false }).some((a) => a.app === 'content')).toBe(false)
    expect(visibleApps({ evidence: false, borders: true }).some((a) => a.app === 'content')).toBe(true)
  })
})

describe('видимість на дошці', () => {
  it('поза гейтом коридорів учитель-пілот бачить свою історичну карту, звичайну карту подій — ні', async () => {
    const { filterEvidenceCards } = await import('../board/evidenceCards')
    const historical = buildHistoricalMapAsset({ x: 960, y: 540 })
    const plain = { ...historical, id: 'plain',
      data: { ...(historical.data as MapCardData), historical_boundary_mode: 'none' as const, borders: undefined } }
    const v = { evidenceEnabled: false, isTutor: true, mode: 'edit' }
    expect(filterEvidenceCards([historical, plain], v)).toHaveLength(0)
    expect(filterEvidenceCards([historical, plain], { ...v, bordersEnabled: true }).map((a) => a.id)).toEqual([historical.id])
  })
})

describe('макет дизайнера: що змінилося, легенда, на весь екран', () => {
  it('різниця знімків — за сутністю: 1662 — зʼявилися Запорозькі козаки; перший знімок — без різниці', async () => {
    const data = await dataset()
    expect(bordersDiff(data, 1648)).toEqual({ changed: [], added: [], gone: [] })
    const d = bordersDiff(data, 1665)                       // знімок 1662 відносно 1659
    expect(d.added).toContain('zaporozhian_cossacks')
    expect(d.changed).toContain('commonwealth')
  })

  it('нова держава без кольору — відтінок за назвою, стабільний', () => {
    expect(entityColor('commonwealth')).toBe(ENTITY_COLORS.commonwealth)
    expect(entityColor('нова_держава')).toMatch(/^hsl\(\d+ 45% 66%\)$/)
    expect(entityColor('нова_держава')).toBe(entityColor('нова_держава'))
  })

  it('легенда: мітки «межі змінилися» / «зʼявилася»; на весь екран — текст «що змінилося» і повні назви', async () => {
    const asset = buildHistoricalMapAsset({ x: 960, y: 540 })
    ;(asset.data as MapCardData).borders!.year = 1662
    const w = mount(MapCardRenderer, { props: { asset, interactive: true, canFit: false, isExpanded: true } })
    await flushPromises()
    const legend = w.get('[data-testid="map-card-legend"]').text()
    expect(legend).toContain('Запорозькі козаки')
    expect(legend).toContain('зʼявилася')
    expect(legend).toContain('межі змінилися')
    expect(legend).toContain('Немає даних')
    expect(w.get('[data-testid="map-card-change"]').text()).toMatch(/^Від 1659 р\. /)
    w.unmount()
  })
})
