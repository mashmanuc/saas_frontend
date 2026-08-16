/**
 * Математика у відповідях Інтегралика (скарга власника 2026-08-16).
 *
 * У чаті стояло `Будую графіки: a+3-(x-1)^2, sqrt(9-(x-1)^2)` сирим текстом.
 * Діагноз виявився не таким, як звучала скарга: LaTeX не «не рендерився» —
 * його там не було. BE кладе ASCII-формат рушія, а рендерер шукає `$…$`.
 *
 * Тести стережуть головне: підставляємо `$latex$` РІВНО на місце відомих
 * виразів (вони приходять у payload), нічого не вгадуючи в тексті.
 */
import { describe, it, expect } from 'vitest'
import { explainWithRenderedMath } from '../explainMath'

const action = (...srcs: string[]) => ({
  kind: 'add_graph',
  payload: { expressions: srcs.map((src) => ({ src })) },
})

describe('explainWithRenderedMath', () => {
  it('живий рядок зі скріна власника стає формулами', () => {
    const explain = 'Будую графіки: a+3-(x-1)^2, sqrt(9-(x-1)^2), -sqrt(9-(x-1)^2) (повзунок: a)'
    const out = explainWithRenderedMath(
      explain, action('a+3-(x-1)^2', 'sqrt(9-(x-1)^2)', '-sqrt(9-(x-1)^2)'))

    expect(out).toContain('\\sqrt')          // корінь став справжнім радикалом
    expect(out).not.toContain('sqrt(')       // сирого ASCII не лишилось
    expect(out).toContain('Будую графіки:')  // текст навколо не зачеплено
    expect(out).toContain('(повзунок: a)')
  })

  it('довший вираз замінюється першим — короткий не ріже його на шматки', () => {
    // `(x-1)^2` є ПІДРЯДКОМ у `sqrt(9-(x-1)^2)`: без сортування за довжиною
    // заміна короткого зіпсувала б довгий.
    const out = explainWithRenderedMath(
      'Графіки: (x-1)^2 і sqrt(9-(x-1)^2)', action('(x-1)^2', 'sqrt(9-(x-1)^2)'))
    expect(out).toContain('\\sqrt')
    expect(out.match(/\$/g)!.length).toBe(4)   // рівно дві пари $…$
  })

  it('вираз, який парсер не бере, лишається сирим — рядок не ламається', () => {
    const out = explainWithRenderedMath('Будую графік: ((((', action('(((('))
    expect(out).toBe('Будую графік: ((((')
  })

  it('дія без виразів не змінює текст', () => {
    expect(explainWithRenderedMath('Створюю дошку.', { kind: 'create_board', payload: {} }))
      .toBe('Створюю дошку.')
  })

  it('відсутній/кривий action не валить рендер', () => {
    expect(explainWithRenderedMath('Текст', undefined)).toBe('Текст')
    expect(explainWithRenderedMath('Текст', null)).toBe('Текст')
    expect(explainWithRenderedMath('Текст', { payload: { expressions: 'не масив' } }))
      .toBe('Текст')
  })

  it('порожній explain лишається порожнім', () => {
    expect(explainWithRenderedMath('', action('x^2'))).toBe('')
    expect(explainWithRenderedMath(undefined as unknown as string, action('x^2'))).toBe('')
  })

  it('вирази у вигляді рядків (а не {src}) теж підхоплюються', () => {
    const out = explainWithRenderedMath('Графік: x^2', { payload: { expressions: ['x^2'] } })
    expect(out).toContain('$')
  })
})
