/**
 * ТЗ «Числова пряма — один рядок» (2026-10-13) §2: чим рахувати, вирішує програма, не вчитель.
 * Кожен рядок таблиці — окремо для пілота й не-пілота. Плюс єдиний заголовок, відповідь (з назвою)
 * і ОДЗ — однакові, хоч би чим рахували (§1).
 */
import { describe, expect, it, vi } from 'vitest'
import {
  chooseNumberLine,
  defaultNumberLineData,
  evaluate,
  numberLineKind,
  type ChooseInput,
  type ChooseOutcome,
  type NumberLineData,
  type SolverBound,
  type SolverResult,
} from '..'

const B = (approx: number, text: string, closed: boolean): SolverBound => ({ latex: text, approx, exact: true, closed, text })
const ROOT: SolverResult = { ok: true, intervals: [{ from: B(-1, '−1', true), to: B(3, '3', false) }], points: [], domain: 'x ≥ −1', answer: 'x ∈ [−1; 3)' }

async function run(lines: string[], opts: Partial<ChooseInput> = {}, reply: unknown = ROOT) {
  const solve = vi.fn().mockResolvedValue(reply)
  const out = await chooseNumberLine({ lines, combine: 'and', signs: false, pilot: true, ...opts }, defaultNumberLineData(), solve)
  return { out, solve }
}
const fields = (o: ChooseOutcome) => {
  if (!o.ok) throw new Error(`очікував успіх: ${JSON.stringify(o)}`)
  return o.fields
}
const errCode = (o: ChooseOutcome) => (!o.ok && 'errors' in o ? o.errors[0].code : null)
const apply = (o: ChooseOutcome): NumberLineData => ({ ...defaultNumberLineData(), ...fields(o) })

describe('таблиця §2 — порядок зверху вниз', () => {
  for (const pilot of [true, false]) {
    const who = pilot ? 'пілот' : 'не пілот'

    it(`${who}: кілька рядків, усі лінійні / подвійні → рушій «Нерівності» (set), без запиту`, async () => {
      const { out, solve } = await run(['x > 1', '-1 < 2x + 1 ≤ 5'], { pilot, combine: 'or' })
      expect(fields(out)).toMatchObject({ mode: 'set', combine: 'or' })
      expect(fields(out).conditions).toHaveLength(2)
      expect(solve).not.toHaveBeenCalled()
    })

    it(`${who}: кілька рядків, хоч один нелінійний → «Система — поки лише з лінійних» під тим рядком`, async () => {
      const { out, solve } = await run(['x > 1', '', 'x^2 < 4'], { pilot })
      expect(out).toEqual({ ok: false, errors: [{ line: 2, index: 0, code: 'system_not_linear' }] })
      expect(solve).not.toHaveBeenCalled()
    })

    it(`${who}: один рядок без «Знаків», лінійний / подвійний → set`, async () => {
      for (const q of ['x - 7 ≥ 7', '-1 < 2x + 1 ≤ 5', '3 − x ≤ 2x', '2,5x ≤ 1']) {
        const { out, solve } = await run([q], { pilot })
        expect(fields(out).mode).toBe('set')
        expect(solve).not.toHaveBeenCalled()
      }
    })

    it(`${who}: одруківка — помилка під рядком, без запиту`, async () => {
      const { out, solve } = await run(['x >'], { pilot })
      expect(errCode(out)).toBe('expect_number_after')
      expect(solve).not.toHaveBeenCalled()
    })
  }

  it('пілот: один рядок + «Знаки», рушій інтервалів бере → intervals', async () => {
    const { out, solve } = await run(['(x-1)(x+3)/(x-2) ≥ 0'], { signs: true })
    expect(fields(out)).toMatchObject({ mode: 'intervals', expression: '(x-1)(x+3)/(x-2)', rhs: '0', op: '>=' })
    expect(solve).not.toHaveBeenCalled()
  })

  it('пілот: «Знаки», рушій інтервалів не бере (корінь зі змінною) → сервер + тиха примітка', async () => {
    const { out, solve } = await run(['√(x-1) ≥ 7'], { signs: true })
    expect(solve).toHaveBeenCalledWith('√(x-1) ≥ 7')
    expect(out).toMatchObject({ ok: true, note: 'signs_only_products', fields: { mode: 'solved', inequality: '√(x-1) ≥ 7' } })
  })

  it('пілот: «Знаки» на подвійній нерівності → set + та сама примітка', async () => {
    const { out, solve } = await run(['-1 < 2x + 1 ≤ 5'], { signs: true })
    expect(out).toMatchObject({ ok: true, note: 'signs_only_products', fields: { mode: 'set' } })
    expect(solve).not.toHaveBeenCalled()
  })

  it('пілот: один рядок без «Знаків», нелінійний → сервер (solved)', async () => {
    for (const q of ['x^2 - 4 > 0', '√(x+1) > x − 1', '1/x > 0', '(x-1)(x+3)/(x-2) ≥ 0']) {
      const { out, solve } = await run([q])
      expect(solve).toHaveBeenCalledWith(q)
      expect(fields(out)).toMatchObject({ mode: 'solved', inequality: q })
    }
  })

  it('не пілот: нелінійний — відмова словами, БЕЗ запиту (і зі «Знаками» теж, коли рушій не бере)', async () => {
    for (const [q, signs] of [['x^2 - 4 > 0', false], ['√(x-1) ≥ 7', false], ['√(x-1) ≥ 7', true]] as const) {
      const { out, solve } = await run([q], { pilot: false, signs })
      expect(solve).not.toHaveBeenCalled()
      expect(out.ok).toBe(false)
      expect(['not_linear', 'root_form']).toContain(errCode(out))
    }
  })

  it('відмова сервера — окремо (текст складає той, хто показує), рядок той самий', async () => {
    const { out } = await run(['', 'x^6 + x + 7 > 0'], {}, { ok: false, reason: 'timeout', detail: 'не встиг' })
    expect(out).toEqual({ ok: false, refusal: { ok: false, reason: 'timeout', detail: 'не встиг' }, line: 1 })
  })

  it('сервер повернув казна-що — server_error, а не падіння', async () => {
    const { out } = await run(['x^2 > 4'], {}, null)
    expect(out).toMatchObject({ ok: false, refusal: { reason: 'server_error' } })
  })

  it('порожньо — помилка «порожній рядок»', async () => {
    const { out } = await run(['  ', ''])
    expect(errCode(out)).toBe('empty')
  })

  it('поля інших способів очищаються (у даних не лишається чужого)', async () => {
    const solve = vi.fn()
    const base: NumberLineData = { ...defaultNumberLineData(), mode: 'solved', inequality: 'x^2 > 1', result: ROOT, solver: 's' }
    const out = await chooseNumberLine({ lines: ['x > 1'], combine: 'and', signs: false, pilot: true }, base, solve)
    const data = { ...base, ...fields(out) }
    expect(data.mode).toBe('set')
    expect(data.inequality).toBeUndefined()
    expect(data.result).toBeUndefined()
  })
})

describe('однаковий вхід — однаковий вигляд (§1)', () => {
  it('x − 7 ≥ 7: set, intervals і solved — той самий заголовок і відповідь з назвою', async () => {
    const set = apply((await run(['x - 7 ≥ 7'])).out)
    const iv = apply((await run(['x - 7 ≥ 7'], { signs: true })).out)
    const solved: NumberLineData = { ...defaultNumberLineData(), mode: 'solved', inequality: 'x - 7 ≥ 7',
      result: { ok: true, intervals: [{ from: B(14, '14', true), to: null }], points: [], domain: null, answer: 'x ∈ [14; +∞)' } }
    for (const d of [set, solved]) expect(numberLineKind(d)).toBe('inequality')
    expect(numberLineKind(iv)).toBe('intervals')
    for (const d of [set, iv, solved]) {
      const ev = evaluate(d)
      if (!('answer' in ev)) throw new Error('eval')
      expect(ev.answer).toEqual({ kind: 'set', text: 'x ∈ [14; +∞)', name: 'ray' })
    }
  })

  it('кілька рядків — система / сукупність', async () => {
    expect(numberLineKind(apply((await run(['x > 1', 'x < 4'])).out))).toBe('system')
    expect(numberLineKind(apply((await run(['x > 1', 'x < 4'], { combine: 'or' })).out))).toBe('union')
  })

  it('відповідь сервера: точка — `x = p`, обʼєднання — як на сторінці', () => {
    const d = (r: Partial<SolverResult>): NumberLineData => ({ ...defaultNumberLineData(), mode: 'solved', inequality: 'q',
      result: { ok: true, intervals: [], points: [], domain: null, answer: '', ...r } })
    const ans = (x: NumberLineData) => { const e = evaluate(x); if (!('answer' in e)) throw new Error('eval'); return e.answer }
    expect(ans(d({ points: [B(1, '1', true)] }))).toEqual({ kind: 'point', text: 'x = 1' })
    expect(ans(d({ intervals: [{ from: B(3, '3', true), to: null }], points: [B(-2, '−2', true)] })).text).toBe('x ∈ {−2} ∪ [3; +∞)')
    expect(ans(d({}))).toEqual({ kind: 'empty', text: '∅' })
    expect(ans(d({ intervals: [{ from: null, to: null }] }))).toEqual({ kind: 'all', text: 'x ∈ (−∞; +∞)', name: 'line' })
  })
})

describe('ОДЗ — однаково для всіх способів (§1)', () => {
  const dom = (d: NumberLineData) => { const e = evaluate(d); return 'domain' in e ? e.domain : 'ERR' }

  it('лінійні — без ОДЗ; дріб зі змінною в знаменнику — «x ≠ …» і з рушія, і з сервера', async () => {
    expect(dom(apply((await run(['x - 7 ≥ 7'])).out))).toBeNull()
    expect(dom(apply((await run(['(x-1)(x+3)/(x-2) ≥ 0'], { signs: true })).out))).toBe('x ≠ 2')
    const solved: NumberLineData = { ...defaultNumberLineData(), mode: 'solved', inequality: '(x-1)/((x+2)(x-3)) > 0',
      result: { ok: true, intervals: [{ from: B(-2, '−2', false), to: B(1, '1', false) }, { from: B(3, '3', false), to: null }], points: [], domain: null, answer: '' } }
    expect(dom(solved)).toBe('x ≠ −2, x ≠ 3')
  })

  it('корінь — ОДЗ від сервера; многочлен без знаменника — немає', () => {
    expect(dom({ ...defaultNumberLineData(), mode: 'solved', inequality: '√(x+1) > x − 1', result: ROOT })).toBe('x ≥ −1')
    expect(dom({ ...defaultNumberLineData(), mode: 'solved', inequality: 'x^2 - 4 > 0',
      result: { ok: true, intervals: [{ from: null, to: B(-2, '−2', false) }, { from: B(2, '2', false), to: null }], points: [], domain: null, answer: '' } })).toBeNull()
  })
})
