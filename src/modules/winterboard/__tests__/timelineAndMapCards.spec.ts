/**
 * H2–H3 · шкала подій і карта подій як об'єкти дошки.
 *
 * ЩО САМЕ СТЕРЕЖУТЬ ЦІ ТЕСТИ
 *
 * 1. ДЕТЕРМІНОВАНИЙ РЕНДЕР. Усе, що видно, походить з `asset.data`. Мережі в
 *    рендерері немає й бути не може: картка мусить однаково малюватись у класі,
 *    в реплеї через рік і в PDF.
 * 2. ОДИН ШТАТНИЙ ЗАПИС. Вибір події чи місця дає рівно один `update:asset`
 *    спільним шляхом — власного write-path, локальної мутації чи другого
 *    списку можливостей немає (ТЗ §9.3).
 * 3. ЧЕСНІСТЬ. Подія без дати не потрапляє на шкалу, місце без придатних
 *    координат — на карту; підпис «Сучасна картографічна основа» обов'язковий.
 * 4. ПАРИТЕТ uk/en — підписи мовою МАТЕРІАЛУ, не UI-локалі.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import TimelineCardRenderer from '../components/board/objects/TimelineCardRenderer.vue'
import MapCardRenderer from '../components/board/objects/MapCardRenderer.vue'
import { project, basemapSpec, BASEMAPS } from '../board/basemaps'
import { formatOneDate, formatTimelineDate } from '../board/timelinePresentation'
import type { WBAsset } from '../types/winterboard'

vi.mock('@/utils/media', () => ({ resolveMediaUrl: (u: string) => u }))

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

const SOURCE = {
  provider: 'wikidata', source_id: 'Q1$a', title: 'Іван Мазепа',
  url: 'https://www.wikidata.org/wiki/Q165419', language: 'uk', author: '',
  license: 'CC0', license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
  revision_id: '2145', retrieved_at: '2026-09-18T10:00:00+00:00',
  evidence: 'P569=1639', evidence_key: 'P569', modified: false,
}

function timelineAsset(data: Record<string, unknown> = {}): WBAsset {
  return {
    id: 'tl1', type: 'timeline_card', src: '', x: 0, y: 0, w: 760, h: 440,
    rotation: 0, locked: false,
    data: {
      version: 1, title: 'Шлях гетьмана', layout: 'ordinal', orientation: 'horizontal',
      events: [
        { id: 'e1', date_start: { year: 1639, precision: 'year' }, date_end: null,
          label: 'Народження', description: 'Народився на Київщині',
          place_ids: [], image: null, sources: [SOURCE] },
        { id: 'e2', date_start: { year: 1687, month: 7, day: 25, precision: 'day' },
          date_end: null, label: 'Обрання гетьманом', description: '',
          place_ids: ['p1'], image: null, sources: [] },
      ],
      active_event_id: null, sources: [], ...data,
    },
  } as unknown as WBAsset
}

function mapAsset(data: Record<string, unknown> = {}): WBAsset {
  return {
    id: 'mp1', type: 'map_card', src: '', x: 0, y: 0, w: 680, h: 520,
    rotation: 0, locked: false,
    data: {
      version: 1, title: 'Місця', basemap: 'ukraine', basemap_version: 'neutral-grid-1',
      projection: 'mercator', historical_boundary_mode: 'none',
      markers: [
        { id: 'p1', label: 'Київ', lat: 50.45, lon: 30.52, date_label: '1687',
          description: 'Столиця', event_ids: ['e2'], sources: [SOURCE] },
      ],
      routes: [], regions: [], active_marker_id: null, sources: [], ...data,
    },
  } as unknown as WBAsset
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mountCard = (C: any, asset: WBAsset) => mount(C, {
  props: { asset, isSelected: false, interactive: true },
  global: { plugins: [i18n()] },
})

// ── Проєкція основи ─────────────────────────────────────────────────────────
describe('локальна основа карти', () => {
  it('точка всередині меж дає частки [0..1]', () => {
    const p = project(50.45, 30.52, basemapSpec('ukraine'))
    expect(p).not.toBeNull()
    expect(p!.x).toBeGreaterThan(0)
    expect(p!.x).toBeLessThan(1)
    expect(p!.y).toBeGreaterThan(0)
    expect(p!.y).toBeLessThan(1)
  })

  it('точка поза межами основи не проєктується взагалі', () => {
    // marker, притиснутий до краю, виглядав би як факт про інше місце
    expect(project(50.45, 30.52, basemapSpec('world'))).not.toBeNull()
    expect(project(-33.86, 151.2, basemapSpec('ukraine'))).toBeNull()
  })

  it('непридатна координата не проєктується', () => {
    const bad: Array<[unknown, unknown]> = [[91, 30], [50, 181], [NaN, 30], ['північ', 30]]
    for (const [la, lo] of bad) {
      expect(project(la, lo, basemapSpec('europe'))).toBeNull()
    }
  })

  it('невідома основа відкочується до Європи, а не падає', () => {
    expect(basemapSpec('марс')).toBe(BASEMAPS.europe)
  })
})

// ── Формат дати з заявленою точністю ────────────────────────────────────────
describe('дата показує заявлену точність', () => {
  it.each([
    [{ year: 1639, precision: 'year' }, 'uk', '1639'],
    [{ year: 1639, month: 3, precision: 'month' }, 'uk', 'березня 1639'],
    [{ year: 1639, month: 3, day: 30, precision: 'day' }, 'uk', '30 березня 1639'],
    [{ year: 1630, precision: 'decade' }, 'uk', '1630-ті'],
    [{ year: 1639, month: 3, day: 30, precision: 'day' }, 'en', 'March 30, 1639'],
    [{ year: 1630, precision: 'decade' }, 'en', '1630s'],
  ])('%o → %s', (date, lang, expected) => {
    expect(formatOneDate(date as never, lang as never)).toBe(expected)
  })

  it('рік не добудовується до першого січня', () => {
    expect(formatOneDate({ year: 1639, precision: 'year' } as never, 'uk')).toBe('1639')
  })

  it('період показується діапазоном, кінець без початку — ні', () => {
    const a = { year: 1687, precision: 'year' } as never
    const b = { year: 1709, precision: 'year' } as never
    expect(formatTimelineDate(a, b, 'uk')).toBe('1687 — 1709')
    expect(formatTimelineDate(null, b, 'uk')).toBe('')
  })
})

// ── Шкала ───────────────────────────────────────────────────────────────────
describe('timeline_card', () => {
  it('малює всі події з даних і жодної понад те', () => {
    const w = mountCard(TimelineCardRenderer, timelineAsset())
    const events = w.findAll('.timeline-card__event')
    expect(events).toHaveLength(2)
    expect(events[0].text()).toContain('1639')
    expect(events[1].text()).toContain('25 липня 1687')
    w.unmount()
  })

  it('клік по події дає РІВНО один update:asset зі зміненим active_event_id', async () => {
    const w = mountCard(TimelineCardRenderer, timelineAsset())
    await w.findAll('.timeline-card__dot')[0].trigger('click')
    const emitted = w.emitted('update:asset') as any[]
    expect(emitted).toHaveLength(1)
    expect(emitted[0][0].data.active_event_id).toBe('e1')
    // решта даних ціла — це патч, а не заміна
    expect(emitted[0][0].data.events).toHaveLength(2)
    w.unmount()
  })

  it('повторний клік знімає вибір, а не лишає його назавжди', async () => {
    const w = mountCard(TimelineCardRenderer, timelineAsset({ active_event_id: 'e1' }))
    await w.findAll('.timeline-card__dot')[0].trigger('click')
    expect((w.emitted('update:asset') as any[])[0][0].data.active_event_id).toBeNull()
    w.unmount()
  })

  it('розгорнута подія показує опис і свої джерела', () => {
    const w = mountCard(TimelineCardRenderer, timelineAsset({ active_event_id: 'e1' }))
    expect(w.find('.timeline-card__description').text()).toContain('Київщині')
    expect(w.find('.source-list__toggle').text()).toBe('Джерела: 1')
    w.unmount()
  })

  it('порожня шкала каже про це чесно', () => {
    const w = mountCard(TimelineCardRenderer, timelineAsset({ events: [] }))
    expect(w.find('.timeline-card__empty').text()).toBe('Подій ще немає')
    w.unmount()
  })

  it('англомовна шкала підписана англійською, хоч UI український', () => {
    const w = mountCard(TimelineCardRenderer,
      timelineAsset({ content_language: 'en', events: [], title: '' }))
    expect(w.find('.timeline-card__title').text()).toBe('Timeline')
    expect(w.find('.timeline-card__empty').text()).toBe('No events yet')
    w.unmount()
  })

  it('readonly-картка не породжує операцій', async () => {
    const w = mount(TimelineCardRenderer, {
      props: { asset: timelineAsset(), isSelected: false, interactive: false },
      global: { plugins: [i18n()] },
    })
    await w.findAll('.timeline-card__dot')[0].trigger('click')
    expect(w.emitted('update:asset')).toBeUndefined()
    w.unmount()
  })
})

// ── Карта ───────────────────────────────────────────────────────────────────
describe('map_card', () => {
  it('малює marker для придатних координат', () => {
    const w = mountCard(MapCardRenderer, mapAsset())
    expect(w.findAll('.map-card__marker')).toHaveLength(1)
    expect(w.find('.map-card__pinlabel').text()).toBe('Київ')
    w.unmount()
  })

  it('місце з непридатними координатами не малюється й не вигадується', () => {
    const w = mountCard(MapCardRenderer, mapAsset({
      markers: [{ id: 'x', label: 'Ніде', lat: 91, lon: 30, date_label: '',
                  description: '', event_ids: [], sources: [] }],
    }))
    expect(w.findAll('.map-card__marker')).toHaveLength(0)
    expect(w.find('.map-card__empty').text()).toBe('Координат немає')
    w.unmount()
  })

  it('підпис про сучасну основу є завжди — це вимога, не прикраса', () => {
    const w = mountCard(MapCardRenderer, mapAsset())
    expect(w.find('.map-card__basemap-note').text()).toBe('Сучасна картографічна основа')
    w.unmount()
  })

  it('клік по marker дає рівно один update:asset', async () => {
    const w = mountCard(MapCardRenderer, mapAsset())
    await w.find('.map-card__pin').trigger('click')
    const emitted = w.emitted('update:asset') as any[]
    expect(emitted).toHaveLength(1)
    expect(emitted[0][0].data.active_marker_id).toBe('p1')
    w.unmount()
  })

  it('вибране місце показує опис, дату й джерела', () => {
    const w = mountCard(MapCardRenderer, mapAsset({ active_marker_id: 'p1' }))
    expect(w.find('.map-card__date').text()).toBe('1687')
    expect(w.find('.map-card__description').text()).toBe('Столиця')
    expect(w.find('.source-list__toggle').text()).toBe('Джерела: 1')
    w.unmount()
  })

  it('маршрут із однієї точки не малюється — це не маршрут', () => {
    const w = mountCard(MapCardRenderer, mapAsset({
      routes: [{ id: 'r1', label: 'Похід', marker_ids: ['p1'] }],
    }))
    expect(w.findAll('.map-card__route')).toHaveLength(0)
    w.unmount()
  })

  it('англомовна карта підписана англійською', () => {
    const w = mountCard(MapCardRenderer,
      mapAsset({ content_language: 'en', markers: [], title: '' }))
    expect(w.find('.map-card__title').text()).toBe('Event map')
    expect(w.find('.map-card__basemap-note').text()).toBe('Modern map base')
    w.unmount()
  })
})

// ── Жодної мережі в рендерері ───────────────────────────────────────────────
describe('рендер детермінований і без мережі', () => {
  it('ані шкала, ані карта не роблять запитів', () => {
    const fetchSpy = vi.fn(() => { throw new Error('мережевий виклик у рендерері') })
    const original = globalThis.fetch
    ;(globalThis as never as { fetch: unknown }).fetch = fetchSpy
    try {
      mountCard(TimelineCardRenderer, timelineAsset()).unmount()
      mountCard(MapCardRenderer, mapAsset()).unmount()
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      ;(globalThis as never as { fetch: unknown }).fetch = original
    }
  })

  it('той самий JSON дає той самий результат', () => {
    const a = mountCard(TimelineCardRenderer, timelineAsset({ active_event_id: 'e2' }))
    const b = mountCard(TimelineCardRenderer, timelineAsset({ active_event_id: 'e2' }))
    expect(a.html()).toBe(b.html())
    a.unmount(); b.unmount()
  })
})
