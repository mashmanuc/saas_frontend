/**
 * Регресія прод-багу 2026-08-19 (m4sh.org/workspace, стор. 3):
 * користувач дописав `a` у вираз → слайдер параметра з'явився, а КРИВА ЗНИКЛА
 * і не поверталась, доки не F5.
 *
 * Механізм: коміт виразу йде повним setState із ще порожніми params →
 * вираз класифікується `needsParam`. Далі param-sync доносить параметр через
 * fast-path рендерера → `setParamValue()` — а той (до фіксу) НЕ перекласифікував
 * вирази, лише планував рендер. Вираз назавжди лишався `needsParam`.
 * F5 «лікував», бо монтування — це повний setState із перекласифікацією.
 *
 * Тест ганяє СПРАВЖНІЙ vendor-рушій (без моку). Рендер не потрібен —
 * класифікація синхронна; rAF глушимо як НО-ОП (не синхронний виклик —
 * урок MoveAssetDropdown: синхронний rAF сам створює баги).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GraphCalculator } from '../vendor/graph_calculator/graph-calculator.js'

const VIEWPORT = { cx: 0, cy: 0, scale: 38 }

function makeEngine() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  return new (GraphCalculator as any)(host, {})
}

describe('GraphCalculator: параметр, що приходить після виразу', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('вираз без відомого параметра чекає (needsParam), а не малюється', () => {
    const calc = makeEngine()
    calc.setState({
      expressions: [{ id: 'e1', src: 'y=a*x^3-3*x', color: '#388c46' }],
      params: {},
      viewport: VIEWPORT,
    })
    expect(calc.expressions[0].classified?.kind).toBe('needsParam')
  })

  it('setParamValue з НОВИМ іменем перекласифіковує — крива повертається', () => {
    const calc = makeEngine()
    // Крок 1: коміт виразу, params ще порожні (так і буває наживо —
    // param-sync прилітає наступним апдейтом).
    calc.setState({
      expressions: [{ id: 'e1', src: 'y=a*x^3-3*x', color: '#388c46' }],
      params: {},
      viewport: VIEWPORT,
    })
    expect(calc.expressions[0].classified?.kind).toBe('needsParam')

    // Крок 2: fast-path рендерера доносить параметр саме цим викликом.
    calc.setParamValue('a', -9)

    expect(calc.params.a).toEqual({ value: -9, min: -10, max: 10, step: 0.1 })
    expect(calc.expressions[0].classified?.kind).not.toBe('needsParam')
    // Класифікація мусить дати побудовну криву (явна y-крива).
    expect(calc.expressions[0].classified?.kind).toBe('explicitY')
  })

  it('зміна значення ВЖЕ відомого параметра не перекласифіковує (гаряча гілка)', () => {
    const calc = makeEngine()
    calc.setState({
      expressions: [{ id: 'e1', src: 'y=a*x', color: '#388c46' }],
      params: { a: { value: 1, min: -10, max: 10, step: 0.1 } },
      viewport: VIEWPORT,
    })
    const before = calc.expressions[0].classified
    expect(before?.kind).toBe('explicitY')
    calc.setParamValue('a', 5)
    // Той самий об'єкт класифікації — reclassify не запускався.
    expect(calc.expressions[0].classified).toBe(before)
    expect(calc.params.a.value).toBe(5)
  })

  it('addParameterFor пише повну форму {value,min,max,step}, не голе число', () => {
    const calc = makeEngine()
    calc.setState({
      expressions: [{ id: 'e1', src: 'y=k*x', color: '#388c46' }],
      params: {},
      viewport: VIEWPORT,
    })
    calc.addParameterFor('k', 'e1', 2, 'param-expr-1')
    // До фіксу тут лежало голе `2`, яке env-збірка мовчки пропускала —
    // параметр ставав undefined у виразі, крива — NaN.
    expect(calc.params.k).toEqual({ value: 2, min: -10, max: 10, step: 0.1 })
    expect(calc.expressions.find((e: any) => e.id === 'e1').classified?.kind)
      .toBe('explicitY')
  })
})
