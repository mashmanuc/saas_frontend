/**
 * ТЗ-K гейт 6: round-trip `src → latex → src` мусить бути стабільним.
 *
 * Конвертери `latexToSrc` і `asciiMathToLatex` — ПАРА. Правка одного боку
 * без звірки з іншим уже коштувала регресії: гілка `\log_` ковтала
 * аргумент і без нижнього індексу, через що найчастіший `\log\left(x\right)`
 * перетворювався на `log(()x)`. Тест ловить саме такий клас — коли
 * підтримка рідкісної форми ламає поширену.
 */
import { describe, expect, it } from 'vitest'

import { asciiMathToLatex, isRenderableAscii } from '../utils/asciiMathToLatex'
import { latexToSrc } from '../utils/latexToSrc'

/** Пробіли — форматування, не зміст: рушій їх ігнорує. */
const norm = (s: string) => s.replace(/\s+/g, '')

describe('latex round-trip', () => {
  it.each([
    ['звичайний логарифм', 'log(x)'],
    ['логарифм з основою', 'log(x,3)'],
    ['основа-дріб', 'log(x,((1)/(3)))'],
    ['число як аргумент', 'log(27,((1)/(3)))'],
    ['корінь', 'sqrt(x)'],
    ['дріб', '((1)/(3))'],
    ['тригонометрія', 'tan(2*x)'],
    ['рівняння з параметром', 'y = a*sin(x)'],
  ])('%s: src → latex → src не втрачає змісту', (_label, src) => {
    const latex = asciiMathToLatex(src)
    expect(latex).toBeTruthy()
    expect(norm(latexToSrc(latex))).toBe(norm(src))
  })

  it('основа логарифма їде в ДРУГИЙ аргумент — саме її рахує рушій', () => {
    expect(latexToSrc('\\log_{3}x')).toBe('log(x,3)')
    expect(latexToSrc('\\log_{\\frac{1}{3}}27')).toBe('log(27,((1)/(3)))')
  })

  it('логарифм БЕЗ основи лишається одноаргументним', () => {
    // Регресія 2026-08-06: гілка з основою спрацьовувала й тут, даючи
    // `log(()x)` — дужкову групу `\left(` вона читала як один символ.
    expect(latexToSrc('\\log\\left(x\\right)')).toBe('log(x)')
  })

  it('невідома функція — видима помилка, а не мовчазне множення', () => {
    // `log_(...)x` зі старих дошок парсер приймав як виклик функції з
    // іменем `log_`, помножений на x. Тепер це invalid.
    expect(isRenderableAscii('log(x,3)')).toBe(true)
  })
})
