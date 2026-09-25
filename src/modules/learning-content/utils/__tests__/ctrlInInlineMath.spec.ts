// Керуючий символ усередині `$…$` — це зʼїдена LaTeX-команда, не текст.
//
// Живий випадок власника 2026-09-25 (запис ролика): у картці замість кореня
// стояло «u3⁄2». У дошці лежить `$\frac{<перенос>u{3}}{2}$` — модель написала
// `\nu` з одинарним бекслешем, а `\n` є ВАЛІДНИМ JSON-escape, тож розбір
// відповіді моделі тихо замінив команду переносом рядка плюс літерою.
//
// Бекенд лікує це на вході (`parser._fix_ctrl_inside_inline_math`). Тут — показ
// уже ЗАПИСАНИХ дошок: вони несуть побитий текст у стані, Replay і експорті.
import { describe, expect, it } from 'vitest'

import { parseLatexSegments, renderTextWithLatex } from '../contentRenderer'

/** Рівно те, що лежить у дошці власника: команда зникла, лишився перенос. */
const OWNER_BODY = `Косинус $30^${String.raw`\circ`}$ дорівнює $${String.raw`\frac{`}\nu{3}}{2}$.`

const CTRL_CHARS = /[\n\t\f\r\b]/

describe('зʼїдена команда в $…$ (перенос рядка замість бекслеша)', () => {
  it('команда відновлюється, керуючого символу у формулі не лишається', () => {
    // Доказ, що вхід справді побитий так само, як на проді.
    expect(OWNER_BODY).toContain('\nu{3}')

    const inline = parseLatexSegments(OWNER_BODY)
      .filter((s) => s.type === 'inline')
      .map((s) => s.value)
      .join(' ')

    expect(inline).toContain(String.raw`\nu{3}`)
    expect(inline).not.toMatch(CTRL_CHARS)
    expect(renderTextWithLatex(OWNER_BODY)).toContain('katex')
  })

  it('перенос у тілі картки лишається переносом', () => {
    const segments = parseLatexSegments('Крок 1\nКрок 2: $R = 5$')
    const text = segments.filter((s) => s.type === 'text').map((s) => s.value).join('')

    expect(text).toContain('\n')
  })

  it('виносна формула зберігає свої переноси', () => {
    const display = `$$${String.raw`\begin{cases}`}\nx > 1\ny = 2\n${String.raw`\end{cases}`}$$`
    const seg = parseLatexSegments(display).find((s) => s.type === 'display')

    expect(seg?.value).toContain('\ny = 2')
  })
})
