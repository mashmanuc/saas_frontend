/**
 * CalculusInspector — i18n (EN/UK) + KaTeX-рендер (ТЗ 2026-07-21 P0-A/P0-B).
 *
 * РЕАЛЬНІ локалі uk.json/en.json (не моки) — тест ловить missing keys, які
 * i18n:check бачить лише статично. KaTeX ганяється справжній (happy-dom).
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

import uk from '../../../../../i18n/locales/uk.json'
import en from '../../../../../i18n/locales/en.json'
import CalculusInspector from '../../sidebar/CalculusInspector.vue'
import {
  __resetCalculusUiForTests,
  registerCalculusInspector,
  type CalculusBridge,
} from '../../../board/state/calculusUiState'

function makeBridge(overrides: Partial<CalculusBridge> = {}): CalculusBridge {
  return {
    mode: 'derivative',
    expr: 'x^2',
    showSecant: false,
    showDerivTrace: false,
    h: 0.5,
    riemann: 'off',
    N: 12,
    showF: false,
    a: -1.5,
    b: 1.5,
    setExpr: () => {},
    commitExpr: () => {},
    toggle: () => {},
    setRiemann: () => {},
    setH: () => {},
    setN: () => {},
    setBound: () => {},
    onExprPreset: () => {},
    ...overrides,
  }
}

function mountWith(locale: 'uk' | 'en') {
  const i18n = createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'uk',
    messages: { uk, en } as never,
  })
  return mount(CalculusInspector, { global: { plugins: [i18n] } })
}

beforeEach(() => {
  __resetCalculusUiForTests()
  registerCalculusInspector('calc-test-1', makeBridge())
})

describe('CalculusInspector — EN локаль (портфоліо-критерій)', () => {
  it('усі панельні рядки англійською, 0 кирилиці, 0 raw-ключів', () => {
    const w = mountWith('en')
    const text = w.text()
    expect(text).toContain('Derivative & integral')
    expect(text).toContain('Examples')
    expect(text).toContain('Expression')
    expect(text).toContain('Derivative')
    // Кирилиця відсутня (мат-нотація f'(x)/Σ/∫ — не кирилиця)
    expect(text).not.toMatch(/[А-Яа-яІіЇїЄєҐґ]/)
    // Немає нерозгорнутих ключів
    expect(text).not.toMatch(/winterboard\./)
    w.unmount()
  })

  it('title-атрибути теж EN', () => {
    const w = mountWith('en')
    const titles = w.findAll('[title]').map((n) => n.attributes('title'))
    expect(titles).toContain('Show secant line')
    expect(titles.join(' ')).not.toMatch(/[А-Яа-яІіЇїЄєҐґ]/)
    w.unmount()
  })
})

describe('CalculusInspector — UK локаль', () => {
  it('панельні рядки українською', () => {
    const w = mountWith('uk')
    const text = w.text()
    expect(text).toContain('Похідна та інтеграл')
    expect(text).toContain('Приклади')
    expect(text).toContain('Вираз')
    expect(text).not.toMatch(/winterboard\./)
    w.unmount()
  })
})

describe('CalculusInspector — KaTeX-рендер (P0-B)', () => {
  it('header містить KaTeX-розмітку виразу (y = x^2)', () => {
    const w = mountWith('uk')
    expect(w.find('.calc-insp__title .katex').exists()).toBe(true)
    w.unmount()
  })

  it('усі 8 кнопок-пресетів рендеряться KaTeX', () => {
    const w = mountWith('uk')
    const presets = w.findAll('.calc-insp__btn--preset')
    expect(presets.length).toBe(8)
    for (const p of presets) {
      expect(p.find('.katex').exists()).toBe(true)
    }
    w.unmount()
  })

  it('невалідний вираз у header → plain-text fallback без крешу', () => {
    __resetCalculusUiForTests()
    registerCalculusInspector('calc-test-2', makeBridge({ expr: '3x^^2' }))
    const w = mountWith('uk')
    // fallback = <code> з сирим виразом, БЕЗ .katex
    expect(w.find('.calc-insp__title .katex').exists()).toBe(false)
    expect(w.find('.calc-insp__title').text()).toContain('3x^^2')
    w.unmount()
  })
})

describe('CalculusInspector — поля меж інтегрування (2026-07-21)', () => {
  it('integral mode: поля a/b видимі зі значеннями bridge; derivative — ні', () => {
    __resetCalculusUiForTests()
    registerCalculusInspector('calc-b-1', makeBridge({ mode: 'integral', a: 0, b: 2 }))
    const w = mountWith('uk')
    const inputs = w.findAll('.calc-insp__bound-input')
    expect(inputs.length).toBe(2)
    expect((inputs[0].element as HTMLInputElement).value).toBe('0')
    expect((inputs[1].element as HTMLInputElement).value).toBe('2')
    w.unmount()

    __resetCalculusUiForTests()
    registerCalculusInspector('calc-b-2', makeBridge({ mode: 'derivative' }))
    const w2 = mountWith('uk')
    expect(w2.findAll('.calc-insp__bound-input').length).toBe(0)
    w2.unmount()
  })

  it('@change поля → setBound з розпарсеним числом; сміття ігнорується', async () => {
    const calls: Array<['a' | 'b', number]> = []
    __resetCalculusUiForTests()
    registerCalculusInspector('calc-b-3', makeBridge({
      mode: 'integral', a: 0, b: 2,
      setBound: (which, v) => calls.push([which, v]),
    }))
    const w = mountWith('uk')
    const [aInput, bInput] = w.findAll('.calc-insp__bound-input')

    await aInput.setValue('-1.25')
    await aInput.trigger('change')
    await bInput.setValue('3')
    await bInput.trigger('change')
    expect(calls).toContainEqual(['a', -1.25])
    expect(calls).toContainEqual(['b', 3])

    const before = calls.length
    await aInput.setValue('')
    await aInput.trigger('change')
    expect(calls.length).toBe(before) // NaN не проходить
    w.unmount()
  })
})
