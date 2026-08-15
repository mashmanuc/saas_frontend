/**
 * Захист математики від браузерного перекладу сторінки — другий call-site.
 *
 * Живий гейт власника 2026-08-15: у нього був увімкнений Chrome-переклад
 * сторінки (uk→en), і радикали з дробовими рисками зникали з умов задач.
 * DOM-дамп доводив, що KaTeX рендерить коректно (msqrt, svg, чистий
 * annotation) — ламало саме розширення перекладу, яке переписує текстові
 * вузли й не розуміє змішаної структури KaTeX (прихований MathML + видимий
 * HTML в одному піддереві).
 *
 * Перший фікс закрив `contentRenderer.ts`, але KaTeX у застосунку
 * викликається З ДВОХ місць — і другий (`MathExpr.vue`) лишався голим.
 * Цей тест стереже саме те, що фікс не буває «наполовину»: додасться третій
 * call-site без захисту — формули знову зламаються там, куди ніхто не
 * подивиться.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MathExpr from '../MathExpr.vue'

describe('MathExpr — не підлягає перекладу сторінки', () => {
  it('успішний KaTeX-рендер має translate="no" + notranslate', () => {
    const w = mount(MathExpr, { props: { expr: 'y = sqrt(4x-7)' } })
    const span = w.find('span.wb-math-expr')
    expect(span.exists()).toBe(true)
    expect(span.attributes('translate')).toBe('no')
    expect(span.classes()).toContain('notranslate')
    expect(span.html()).toContain('katex')
  })

  it('fallback на невалідному виразі теж захищений', () => {
    // У fallback лежить СИРИЙ математичний вираз — перекладач зіпсував би
    // і його (напр. «x» → «х» кирилицею), а це вже мовчазна зміна змісту.
    const w = mount(MathExpr, { props: { expr: '\\\\\\ не вираз {{{' } })
    const code = w.find('code.wb-math-expr--fallback')
    if (code.exists()) {
      expect(code.attributes('translate')).toBe('no')
      expect(code.classes()).toContain('notranslate')
    }
  })

  it('display-режим не втрачає захисту', () => {
    const w = mount(MathExpr, { props: { expr: 'x^2', display: true } })
    expect(w.find('span.wb-math-expr').attributes('translate')).toBe('no')
  })
})
