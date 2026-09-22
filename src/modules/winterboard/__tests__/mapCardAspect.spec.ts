/**
 * MapCard V1 — карта без спотворення (власник 2026-09-22: «карта — обрубок»).
 *
 * Було: частки [0..1] по кожній осі окремо лягали в квадрат 1000×1000, тож
 * основу «Україна» (20° × 9°) тягнуло вгору в ~1.45 раза. Тепер висота полотна
 * — за пропорціями основи: 1 радіан Mercator по X = 1 радіан по Y.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { basemapAspect, basemapSpec, landPaths } from '../board/basemaps'
import MapCardRenderer from '../components/board/objects/MapCardRenderer.vue'
import type { WBAsset } from '../types/winterboard'

const mercator = (deg: number) => Math.log(Math.tan(Math.PI / 4 + (deg * Math.PI) / 360))

describe('basemapAspect — однаковий масштаб X і Y', () => {
  it.each(['ukraine', 'europe', 'world'] as const)('%s: висота/ширина в радіанах Mercator', (id) => {
    const [w, s, e, n] = basemapSpec(id).bounds
    expect(basemapAspect(basemapSpec(id))).toBeCloseTo((mercator(n) - mercator(s)) / ((e - w) * Math.PI / 180), 6)
  })

  it('«Україна» ширша, ніж висока — не квадрат', () => {
    const aspect = basemapAspect(basemapSpec('ukraine'))
    expect(aspect).toBeGreaterThan(0.6)
    expect(aspect).toBeLessThan(0.8)
  })

  it('суша лягає в межі полотна з пропорціями основи', () => {
    const spec = basemapSpec('ukraine')
    const h = 1000 * basemapAspect(spec)
    const ys = landPaths(spec, 1000, h).join(' ').match(/,-?\d+(\.\d+)?/g)!.map(v => Number(v.slice(1)))
    // частина кілець виходить за краї (їх обрізає SVG), але середина — у межах висоти
    const inside = ys.filter(y => y >= 0 && y <= h)
    expect(inside.length).toBeGreaterThan(50)
    expect(Math.max(...inside)).toBeLessThanOrEqual(h)
  })
})

function mapAsset(markers: Array<{ id: string; label: string; lat: number; lon: number }>): WBAsset {
  return {
    id: 'm1', type: 'map_card', src: '', x: 0, y: 0, w: 680, h: 520, rotation: 0, locked: false,
    data: { version: 1, title: 'Полтавська битва', basemap: 'ukraine', projection: 'mercator', markers },
  } as unknown as WBAsset
}

describe('MapCardRenderer — полотно не квадратне', () => {
  it('viewBox має пропорції основи, маркер у межах', () => {
    const w = mount(MapCardRenderer, {
      props: { asset: mapAsset([{ id: 'p', label: 'Полтава', lat: 49.59, lon: 34.55 }]) },
      global: { mocks: { t: (k: string) => k } },
    })
    const [, , vw, vh] = w.find('svg.map-card__svg').attributes('viewBox')!.split(' ').map(Number)
    expect(vh / vw).toBeCloseTo(basemapAspect(basemapSpec('ukraine')), 2)
    const pin = w.find('circle.map-card__pin')
    const cy = Number(pin.attributes('cy'))
    expect(cy).toBeGreaterThan(0)
    expect(cy).toBeLessThan(vh)
  })
})

describe('MapCardRenderer — підписи близьких місць не зливаються', () => {
  it('Суботів і Чигирин (~10 км): точки на місці, підписи на різних рядках', () => {
    const w = mount(MapCardRenderer, {
      props: { asset: mapAsset([
        { id: 'a', label: 'Суботів', lat: 49.07, lon: 32.60 },
        { id: 'b', label: 'Чигирин', lat: 49.08, lon: 32.66 },
      ]) },
      global: { mocks: { t: (k: string) => k } },
    })
    const ys = w.findAll('text.map-card__pinlabel').map(t => Number(t.attributes('y')))
    expect(Math.abs(ys[0] - ys[1])).toBeGreaterThanOrEqual(20)
    expect(w.findAll('line.map-card__leader').length).toBe(1)
  })

  it('далекі місця — без зсуву й без виносок', () => {
    const w = mount(MapCardRenderer, {
      props: { asset: mapAsset([
        { id: 'a', label: 'Київ', lat: 50.45, lon: 30.52 },
        { id: 'b', label: 'Одеса', lat: 46.48, lon: 30.73 },
      ]) },
      global: { mocks: { t: (k: string) => k } },
    })
    expect(w.findAll('line.map-card__leader').length).toBe(0)
  })
})
