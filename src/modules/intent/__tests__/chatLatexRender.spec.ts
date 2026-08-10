/**
 * І-1: відповіді Інтегралика показують формули, а не LaTeX-код.
 *
 * Знахідка власника 2026-08-10: у чаті було видно `\Rightarrow`, `\ge`,
 * `\sqrt{...}` і `**стор.5:**` сирим текстом — учень читав розмітку
 * замість математики.
 *
 * Тестуємо САМ КОНТРАКТ рендерера у трьох аспектах, важливих для чату:
 * формула → KaTeX, markdown-жирний → <strong>, HTML від LLM → екранований.
 * Монтувати CommandPalette не варто: він тягне роутер, стори, WS і
 * половину дошки — крихкий тест, який падатиме з чужих причин.
 * Тут перевіряється те, що справді може зламатись у цій зоні.
 */
import { describe, it, expect } from 'vitest'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'

/** Реальна відповідь Інтегралика зі скріна власника (скорочена). */
const REAL_ANSWER = [
  '**стор.5:** Область визначення $y=\\sqrt{6x-x^2}-\\log_3(x-1)$.',
  'Розв\'язок: $x(6-x)\\ge0 \\Rightarrow x\\in[0;6]$.',
].join('\n')

/** Видимий шар KaTeX (без прихованого MathML-annotation для скрінрідерів). */
function visibleText(html: string): string {
  const host = document.createElement('div')
  host.innerHTML = html
  host.querySelectorAll('.katex-mathml').forEach((el) => el.remove())
  return host.textContent || ''
}

describe('Чат Інтегралика — рендер відповіді', () => {
  it('формули стають KaTeX, а не лишаються командами', () => {
    const html = renderTextWithLatex(REAL_ANSWER)
    expect(html).toContain('katex')
    const seen = visibleText(html)
    for (const cmd of ['\\sqrt', '\\ge', '\\Rightarrow', '\\log_3']) {
      expect(seen).not.toContain(cmd)
    }
  })

  it('**жирний** стає розміткою, а не зірочками', () => {
    const html = renderTextWithLatex('**стор.5:** текст')
    expect(html).toContain('<strong>')
    expect(visibleText(html)).not.toContain('**')
  })

  it('HTML у відповіді LLM екранується — v-html безпечний саме тому', () => {
    const html = renderTextWithLatex('<img src=x onerror="alert(1)"><script>alert(2)</script>')
    const host = document.createElement('div')
    host.innerHTML = html
    expect(host.querySelector('img')).toBeNull()
    expect(host.querySelector('script')).toBeNull()
    expect(host.textContent).toContain('onerror')   // лишилось видимим текстом
  })

  it('звичайний текст без формул проходить незміненим', () => {
    expect(visibleText(renderTextWithLatex('Просто відповідь без формул.')))
      .toContain('Просто відповідь без формул.')
  })

  it('порожня відповідь не валить рендер', () => {
    expect(renderTextWithLatex('')).toBe('')
  })
})
