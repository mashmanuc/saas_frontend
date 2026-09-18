/**
 * H4 · санітизація того, що приходить від `knowledge_build`.
 *
 * ЧОМУ ЦЕ ВАЖЛИВО САМЕ НА КЛІЄНТІ
 *
 * Бекенд уже відкинув усе непридатне, але дошка — останній рубіж: на неї може
 * прийти й стара пропозиція, і відповідь, зібрана вручну. Правило те саме, що
 * для джерел H0: на дошку лягає лише те, що має сенс, і нічого не
 * домальовується.
 *
 * Подія без дати — не подія на шкалі часу. Місце з координатою поза
 * діапазоном — не marker, а маршрут з однієї точки — не маршрут.
 */
import { describe, it, expect } from 'vitest'
import { sanitizeEvents, sanitizeMarkers, sanitizeRoutes } from '../boardActions'

const SOURCE = {
  provider: 'wikidata', source_id: 'Q1$a', title: 'Іван Мазепа',
  url: 'https://www.wikidata.org/wiki/Q165419', language: 'uk', author: '',
  license: 'CC0', license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
  revision_id: '2145', retrieved_at: '2026-09-18T10:00:00+00:00',
  evidence: 'P569=1639', evidence_key: 'P569', modified: false,
}

const EVENT = {
  id: 'event-born',
  date_start: { year: 1639, precision: 'year' },
  date_end: null,
  label: 'Народження',
  description: 'Народився на Київщині',
  place_ids: ['place-birthplace'],
  image: null,
  sources: [SOURCE],
}

const MARKER = {
  id: 'place-birthplace', label: 'Мазепинці', lat: 49.72, lon: 30.18,
  date_label: '1639', description: 'місце народження',
  event_ids: ['event-born'], sources: [SOURCE],
}

describe('події шкали', () => {
  it('повна подія проходить цілком', () => {
    const [e] = sanitizeEvents([EVENT])
    expect(e.id).toBe('event-born')
    expect(e.date_start).toEqual({ year: 1639, precision: 'year' })
    expect(e.label).toBe('Народження')
    expect(e.place_ids).toEqual(['place-birthplace'])
    expect(e.sources).toHaveLength(1)
  })

  it('точність дня зберігається повністю', () => {
    const [e] = sanitizeEvents([{
      ...EVENT, date_start: { year: 1687, month: 7, day: 25, precision: 'day' },
    }])
    expect(e.date_start).toEqual({ year: 1687, month: 7, day: 25, precision: 'day' })
  })

  it('подія без придатної дати на шкалу не лягає', () => {
    for (const bad of [null, {}, { year: 'тисяча' }, { month: 3 }]) {
      expect(sanitizeEvents([{ ...EVENT, date_start: bad }])).toEqual([])
    }
  })

  it('невідома точність нормалізується до року, а не зберігається як є', () => {
    const [e] = sanitizeEvents([{ ...EVENT, date_start: { year: 1639, precision: 'вигадана' } }])
    expect(e.date_start.precision).toBe('year')
  })

  it('безглуздий місяць чи день просто не потрапляють у дату', () => {
    const [e] = sanitizeEvents([{
      ...EVENT, date_start: { year: 1639, month: 13, day: 99, precision: 'day' },
    }])
    expect(e.date_start).toEqual({ year: 1639, precision: 'day' })
  })

  it('більше дванадцяти подій на шкалу не йде (ТЗ §6.2)', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ ...EVENT, id: `e${i}` }))
    expect(sanitizeEvents(many)).toHaveLength(12)
  })

  it('сміття замість списку дає порожньо, а не падіння', () => {
    for (const bad of [null, undefined, 'подія', 42]) {
      expect(sanitizeEvents(bad as never)).toEqual([])
    }
  })
})

describe('місця карти', () => {
  it('повне місце проходить цілком', () => {
    const [m] = sanitizeMarkers([MARKER])
    expect(m.lat).toBe(49.72)
    expect(m.lon).toBe(30.18)
    expect(m.event_ids).toEqual(['event-born'])
  })

  it('координата поза діапазоном — місця немає', () => {
    // дзеркало `facts.normalize_coordinate`: обрізати до межі не можна
    for (const [lat, lon] of [[91, 30], [-90.5, 30], [50, 181], [50, -180.5]]) {
      expect(sanitizeMarkers([{ ...MARKER, lat, lon }])).toEqual([])
    }
  })

  it('нечислова координата — місця немає', () => {
    expect(sanitizeMarkers([{ ...MARKER, lat: 'північ' }])).toEqual([])
  })
})

describe('маршрути', () => {
  it('маршрут із двох місць проходить', () => {
    const [r] = sanitizeRoutes([{ id: 'r1', label: 'Похід', marker_ids: ['a', 'b'] }])
    expect(r.marker_ids).toEqual(['a', 'b'])
  })

  it('маршрут із однієї точки не маршрут', () => {
    expect(sanitizeRoutes([{ id: 'r1', label: 'Похід', marker_ids: ['a'] }])).toEqual([])
    expect(sanitizeRoutes([{ id: 'r2', label: '', marker_ids: [] }])).toEqual([])
  })
})
