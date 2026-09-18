/**
 * H0 · доказові джерела змісту на дошці (`theory_card.data.sources[]`).
 *
 * ТЗ `TZ_INTEGRALYK_EVIDENCE_TIMELINE_MAP_2026-09-17.md`, етап H0.
 *
 * Найважливіше тут — не форма, а МЕЖА: `provenance` (LAW §9.D, INV-26) і
 * `sources[]` живуть поряд у `data`, і жодне з них не має з'їсти інше при
 * записі. Саме це ламається непомітно й переживає reload/replay як зіпсоване.
 */
import { describe, it, expect } from 'vitest'
import { corridorData, sourcesData } from '../boardActions'

const REF = {
  provider: 'wikipedia',
  source_id: '',
  title: 'Іван Мазепа',
  url: 'https://uk.wikipedia.org/wiki/Mazepa',
  language: 'uk',
  author: 'Автори Вікіпедії',
  license: 'CC BY-SA 4.0',
  license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
  revision_id: '48211903',
  retrieved_at: '2026-09-18T10:00:00+00:00',
  evidence: 'Український гетьман.',
  evidence_key: '',
  modified: false,
}

const PROVENANCE = {
  content_language: 'uk',
  subject: 'history',
  content_language_source: 'explicit_command',
  source_provider: 'wikipedia',
  source_title: 'Іван Мазепа',
  source_url: 'https://uk.wikipedia.org/wiki/Mazepa',
  license: 'CC BY-SA 4.0',
  author: 'Автори Вікіпедії',
  retrieved_at: '2026-09-18T10:00:00+00:00',
}

describe('sourcesData — запис доказових джерел', () => {
  it('приймає повне джерело й ставить статус', () => {
    const out = sourcesData([REF], 'verified')
    expect(out.sources).toHaveLength(1)
    expect(out.sources[0]).toEqual(REF)
    expect(out.source_status).toBe('verified')
  })

  it('набір ключів закритий — чуже поле не осідає в даних дошки', () => {
    const out = sourcesData([{ ...REF, internal_note: 'секрет' }], 'verified')
    expect(Object.keys(out.sources[0]).sort()).toEqual(Object.keys(REF).sort())
  })

  it('джерело без обов\'язкового поля не лягає на дошку', () => {
    for (const key of ['provider', 'title', 'url', 'retrieved_at', 'evidence']) {
      expect(sourcesData([{ ...REF, [key]: '' }], 'verified')).toEqual({})
    }
  })

  it('невідомий статус — fail closed: mixed, а не verified', () => {
    // `verified` означає «джерела підтверджені». Видавати це за замовчуванням
    // на невідоме значення — хибне підтвердження: картка казала б учителю
    // більше, ніж ми насправді знаємо.
    expect(sourcesData([REF], 'вигаданий').source_status).toBe('mixed')
  })

  it('відсутній статус — теж mixed', () => {
    expect(sourcesData([REF], undefined).source_status).toBe('mixed')
    expect(sourcesData([REF], null as never).source_status).toBe('mixed')
    expect(sourcesData([REF], '').source_status).toBe('mixed')
  })

  it('явні відомі статуси зберігаються як є', () => {
    for (const st of ['verified', 'mixed', 'teacher_provided']) {
      expect(sourcesData([REF], st).source_status).toBe(st)
    }
  })

  it('порожнє й сміття дають порожній результат, а не половинні дані', () => {
    expect(sourcesData(undefined, 'verified')).toEqual({})
    expect(sourcesData('не масив' as never, 'verified')).toEqual({})
    expect(sourcesData([null, 'рядок'] as never, 'verified')).toEqual({})
  })

  it('evidence обрізається — це доказ, а не другий текст картки', () => {
    const out = sourcesData([{ ...REF, evidence: 'я'.repeat(900) }], 'verified')
    expect(out.sources[0].evidence).toHaveLength(500)
  })
})

describe('нові поля контракту й безпека посилання', () => {
  it('license_url і revision_id доходять до дошки', () => {
    const ref = sourcesData([REF], 'verified').sources[0]
    expect(ref.license_url).toBe('https://creativecommons.org/licenses/by-sa/4.0/')
    expect(ref.revision_id).toBe('48211903')
  })

  it('джерело без revision лишається придатним — це чесне «версія невідома»', () => {
    const out = sourcesData([{ ...REF, revision_id: '' }], 'verified')
    expect(out.sources).toHaveLength(1)
    expect(out.sources[0].revision_id).toBe('')
  })

  it('не-веб URL на дошку не лягає взагалі', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://a/b', 'uk.wikipedia.org/x', 'https://']) {
      expect(sourcesData([{ ...REF, url: bad }], 'verified')).toEqual({})
    }
  })

  it('звичайні http/https проходять', () => {
    for (const ok of ['http://a.b/c', 'https://uk.wikipedia.org/wiki/A', 'HTTPS://A.B/C']) {
      expect(sourcesData([{ ...REF, url: ok }], 'verified').sources).toHaveLength(1)
    }
  })

  it('зіпсований retrieved_at не викидає джерело: обовʼязкове поле, а не дата', () => {
    const out = sourcesData([{ ...REF, retrieved_at: 'позавчора' }], 'verified')
    expect(out.sources).toHaveLength(1)
    expect(out.sources[0].retrieved_at).toBe('позавчора')
  })
})

describe('межа між provenance і sources — INV-26 не зачеплено', () => {
  it('обидва поля живуть поряд і не перетирають одне одного', () => {
    const data = {
      version: 1,
      ...corridorData(PROVENANCE),
      ...sourcesData([REF], 'verified'),
    }
    expect(data.content_language).toBe('uk')
    expect(data.provenance.source_provider).toBe('wikipedia')
    expect(data.sources).toHaveLength(1)
    // provenance не отримав ключів джерела, джерело — ключів provenance
    expect(data.provenance).not.toHaveProperty('sources')
    expect(data.provenance).not.toHaveProperty('evidence')
    expect(data.sources[0]).not.toHaveProperty('subject')
    expect(data.sources[0]).not.toHaveProperty('content_language')
  })

  it('картка без джерел — це стара картка, поля просто немає', () => {
    const data = { version: 1, ...corridorData(PROVENANCE), ...sourcesData(undefined, undefined) }
    expect(data).not.toHaveProperty('sources')
    expect(data).not.toHaveProperty('source_status')
    expect(data.provenance.source_url).toBe(PROVENANCE.source_url)
  })
})
