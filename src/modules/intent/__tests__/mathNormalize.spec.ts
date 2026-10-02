/**
 * Правило формул M4SH (власник 2026-10-02: «Хто може заборонити перенос формули? Тільки в деяких
 * випадках дозволити… роби»). Перенос рядка `\\` — лише в багаторядкових блоках; за цим правилом
 * однозначні випадки відновлюються до перевірки KaTeX, решта — відмова й повторна генерація.
 * Керуючі символи будуються з кодів, бекслеш — константою: у джерелі тесту нема чому з'їстися.
 */
import { describe, it, expect } from 'vitest'
import { documentFromSource, normalizeSource, prepareActions } from '../math/contract.mjs'

const BS = String.fromCharCode(92)
const FF = String.fromCharCode(12)   // \f, яким JSON читає одинарний бекслеш перед frac
const BSP = String.fromCharCode(8)   // \b — перед begin, beta
const TAB = String.fromCharCode(9)   // \t — перед times, text
const CR = String.fromCharCode(13)   // \r — перед right, rho
const LF = String.fromCharCode(10)   // \n — перед neq, nu, nabla

const norm = (s: string, formula = false) => normalizeSource(s, formula)

describe('відновлюється однозначне', () => {
  it('JSON з’їв бекслеш: \\f, \\b, \\r, \\t перед командою — повертаємо', () => {
    expect(norm(`$${FF}rac{1}{2}$`)).toEqual({ text: `$${BS}frac{1}{2}$`, fixes: ['json_control'] })
    expect(norm(`$$${BSP}egin{cases}x${BS}${BS}y${BS}end{cases}$$`).text).toBe(`$$${BS}begin{cases}x${BS}${BS}y${BS}end{cases}$$`)
    expect(norm(`$${BS}left(x${CR}ight)$`).text).toBe(`$${BS}left(x${BS}right)$`)
    expect(norm(`$a${TAB}imes b$`).text).toBe(`$a${BS}times b$`)
  })

  it('табуляція й CR, що не дають команди, — це пробіл і кінець рядка, не бекслеш', () => {
    expect(norm(`Крок 1:${TAB}далі`)).toEqual({ text: 'Крок 1: далі', fixes: [] })
    expect(norm(`рядок${CR}${LF}далі`)).toEqual({ text: `рядок${LF}далі`, fixes: [] })
  })

  it('у формулі Enter + назва команди — з’їдений \\n (\\neq, \\nu); інший Enter у формулі — пробіл', () => {
    expect(norm(`$x ${LF}eq 0$`)).toEqual({ text: `$x ${BS}neq 0$`, fixes: ['json_newline_command'] })
    expect(norm(`$${LF}u = 2$`).text).toBe(`$${BS}nu = 2$`)
    expect(norm(`$$a +${LF}b$$`)).toEqual({ text: '$$a + b$$', fixes: [] })
    expect(norm(`Перший рядок${LF}другий`)).toEqual({ text: `Перший рядок${LF}другий`, fixes: [] })
  })

  it('поза блоком \\\\ + команда — подвоєний бекслеш; подвоєний блок — разом із переносами в ньому', () => {
    expect(norm(`$${BS}${BS}frac{1}{2} + ${BS}${BS}pi$`).text).toBe(`$${BS}frac{1}{2} + ${BS}pi$`)
    expect(norm(`$$${BS}${BS}begin{cases} x ${BS}${BS}${BS}${BS} ${BS}${BS}frac{1}{y} ${BS}${BS}end{cases}$$`).text)
      .toBe(`$$${BS}begin{cases} x ${BS}${BS} ${BS}frac{1}{y} ${BS}end{cases}$$`)
  })

  it('у тексті: парні подвоєні розділювачі — одинарні (Б-130); \\\\ в кінці рядка — новий рядок (прод 01.10)', () => {
    expect(norm(`Скоротити ${BS}${BS}(${BS}${BS}frac{6}{8}${BS}${BS}).`).text).toBe(`Скоротити ${BS}(${BS}frac{6}{8}${BS}).`)
    const card = `Розглянемо: ${BS}(ax^2 + bx + c = 0${BS}).${BS}${BS}${LF}1. Дискримінант: ${BS}(D = b^2 - 4ac${BS}).${BS}${BS}`
    const fixed = norm(card).text
    expect(fixed).toBe(`Розглянемо: ${BS}(ax^2 + bx + c = 0${BS}).${LF}1. Дискримінант: ${BS}(D = b^2 - 4ac${BS}).`)
    expect(() => documentFromSource(fixed)).not.toThrow()
    expect(norm(`а ${BS}${BS} б`).text).toBe(`а ${LF}б`)
  })
})

describe('подвоєний у JSON перенос рядка — буквальні «бекслеш + n» (стенд 02.10, похідна)', () => {
  it('у тексті — новий рядок; картка похідної з моделі проходить з першого разу', () => {
    const body = `Маємо $y = f(g(x))$.${BS}n${BS}nФормула: $y' = f'(g(x)) ${BS}cdot g'(x)$${BS}n${BS}n**Приклад**: ${BS}( y = (3x^2+2)^5 ${BS}).`
    const result = norm(body)
    expect(result.text).toBe(`Маємо $y = f(g(x))$.${LF}${LF}Формула: $y' = f'(g(x)) ${BS}cdot g'(x)$${LF}${LF}**Приклад**: ${BS}( y = (3x^2+2)^5 ${BS}).`)
    expect(result.fixes).toEqual(['escaped_newline', 'escaped_newline', 'escaped_newline', 'escaped_newline'])
    expect(() => documentFromSource(result.text)).not.toThrow()
  })

  it('у формулі — пробіл, лише коли далі не літера; справжня команда й незрозуміле \nx — без змін', () => {
    expect(norm(`$x${BS}n+1$`)).toEqual({ text: '$x +1$', fixes: ['escaped_newline'] })
    expect(norm(`$${BS}nabla f$`)).toEqual({ text: `$${BS}nabla f$`, fixes: [] })
    expect(norm(`$${BS}nx$`)).toEqual({ text: `$${BS}nx$`, fixes: [] })
  })

  it('команда поза формулою (\neq у тексті) — не вгадуємо: лишається, і перевірка відхиляє', () => {
    const s = `x ${BS}neq 0`
    expect(norm(s)).toEqual({ text: s, fixes: [] })
    expect(() => documentFromSource(s)).toThrow(expect.objectContaining({ code: 'math_outside_delimiters' }))
  })
})

describe('правильне й неоднозначне не чіпаємо', () => {
  const VALID = [
    `$${BS}frac{1}{2}$`, `$x ${BS}neq 0$`, `$$${BS}begin{aligned}x&=1${BS}${BS}y&=2${BS}end{aligned}$$`,
    `$${BS}left(${BS}frac{a}{b}${BS}right)$`, 'Текст без формул', '$5$', 'Зошит коштує 5$ за штуку.',
    `$${BS}text{якщо } x>0$`, `$$${BS}begin{pmatrix}a${BS}${BS}b${BS}end{pmatrix}$$`,
  ]
  it.each(VALID)('без змін: %s', (s) => {
    expect(norm(s)).toEqual({ text: s, fixes: [] })
  })

  it('усередині блоку \\\\ + літери — це перенос рядка (\\\\pi, \\\\u), поки блок не подвоєно', () => {
    const s = `$$${BS}begin{cases} x ${BS}${BS}pi ${BS}${BS}u ${BS}end{cases}$$`
    expect(norm(s)).toEqual({ text: s, fixes: [] })
  })

  it('поза блоком \\ + одна літера не вгадуємо: \\u — це й перенос зі змінною u, і акцент', () => {
    const s = `$a ${BS}${BS}u b$`
    expect(norm(s)).toEqual({ text: s, fixes: [] })
  })

  it('перенос поза блоком лишається забороненим — відмова, а не вгадування', () => {
    expect(norm(`$a ${BS}${BS} b$`).fixes).toEqual([])
    expect(() => documentFromSource(`$a ${BS}${BS} b$`)).toThrow(expect.objectContaining({ code: 'standalone_linebreak' }))
  })

  it('повторна нормалізація нічого не змінює', () => {
    for (const s of [`$${FF}rac{1}{2}$`, `$x ${LF}eq 0$`, `Скоротити ${BS}${BS}(${BS}${BS}frac{6}{8}${BS}${BS}).`,
      `кінець.${BS}${BS}`, `$${BS}${BS}frac{1}{2}$`]) {
      const once = norm(s).text
      expect(norm(once)).toEqual({ text: once, fixes: [] })
    }
  })
})

describe('preflight дій', () => {
  it('картка: текст нормалізовано, документ — з нормалізованого, журнал — зі шляхом поля', () => {
    const fixes: { code: string; path: string }[] = []
    const [a] = prepareActions([{ kind: 'add_card', payload: { title: 'Похідна', body: `$f'(x) = ${FF}rac{1}{x}$` } }], fixes)
    expect(a.payload.body).toBe(`$f'(x) = ${BS}frac{1}{x}$`)
    expect(a.payload.math_content.fields.body.source).toBe(a.payload.body)
    expect(fixes).toEqual([{ code: 'json_control', path: '0.body' }])
  })

  it('формула: Enter + назва команди — у формулі завжди', () => {
    const [a] = prepareActions([{ kind: 'add_formula', payload: { latex: `x ${LF}eq ${LF}abla y` } }])
    expect(a.payload.latex).toBe(`x ${BS}neq ${BS}nabla y`)
  })
})
