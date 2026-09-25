// Команда, написана СЛОВОМ усередині \text{}, і градус як \text{o}.
//
// Живий випадок власника 2026-09-25 (другий за день). У дошці лежить:
//   $ \frac{\text{гипотенуза}}{2} \times \text{sqrt{3}}$
// і замість «√3» у картці стоїть слово «sqrt3». Бекслеша немає, тож розгортач
// `\text{}` таке не чіпав — «математики ж усередині немає».
import katex from 'katex'
import { describe, expect, it } from 'vitest'

import { toKatexCompatible } from '../katexCompat'

/** Чи бере KaTeX те, що ми віддаємо, і що саме там опиняється. */
function compile(tex: string): string {
  return toKatexCompatible(tex)
}

function renders(tex: string): boolean {
  try {
    katex.renderToString(compile(tex), { throwOnError: true, strict: false })
    return true
  } catch {
    return false
  }
}

describe('команда словом у \\text{}', () => {
  it('рядок власника дає справжній корінь, а не слово «sqrt»', () => {
    const owner = String.raw`\frac{\text{гипотенуза}}{2} \times \text{sqrt{3}}`
    const out = compile(owner)

    expect(out).toContain(String.raw`\sqrt{3}`)
    expect(out).not.toContain('text{sqrt')
    expect(renders(owner)).toBe(true)
  })

  it('слово без дужок теж: \\text{sqrt3}', () => {
    expect(compile(String.raw`\text{sqrt3}`)).toBe(String.raw`\sqrt3`)
  })

  it('справжній текст у формулі лишається текстом', () => {
    const prose = String.raw`\text{гіпотенуза}`
    expect(compile(prose)).toBe(prose)
    // `\text{sin}` — це підпис, а не команда зі списку.
    expect(compile(String.raw`\text{sin}`)).toBe(String.raw`\text{sin}`)
  })

  it('градус як \\text{o} стає \\circ', () => {
    const out = compile(String.raw`30^\text{o}`)

    expect(out).toContain(String.raw`\circ`)
    expect(out).not.toContain('text{o}')
    expect(renders(String.raw`30^\text{o}`)).toBe(true)
  })
})
