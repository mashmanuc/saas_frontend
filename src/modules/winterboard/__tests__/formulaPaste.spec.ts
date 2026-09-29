/**
 * Власник 2026-09-29 (з прода): «в перше поле не вводиться формула» і «формули не копіюються з поля в поле
 * адекватно»; «це і в інших об'єктах треба перевірити».
 *   • вставка у звичайне поле формули: LaTeX із поля MathQuill → звичайний запис (той самий latexToSrc);
 *   • три звичайні поля формул (панель калькулятора, поле на картці графіка, панель похідних/інтегралів) —
 *     з цією вставкою;
 *   • дотик до панелі будь-якого об'єкта вмикає «Виділення» (з пером картки відкидали правки з панелі).
 */
import { describe, it, expect, vi } from 'vitest'
import { looksLikeLatex, pasteFormulaAsSrc } from '../utils/formulaPaste'
import { asciiMathToLatex } from '../utils/asciiMathToLatex'
import sidebarSource from '../components/sidebar/GroupContentSidebar.vue?raw'
import graphInspectorSource from '../components/sidebar/GraphCalcInspector.vue?raw'
import calculusInspectorSource from '../components/sidebar/CalculusInspector.vue?raw'
import graphRendererSource from '../components/board/objects/GraphCalculatorRenderer.vue?raw'

// Рівно те, що кладе в буфер поле MathQuill (живий стенд, Ctrl+A → Ctrl+C)
const MQ_COPIED = '\\left(x-2\\right)^2+\\left(y-4\\right)^2=9'

function pasteInto(input: HTMLInputElement, text: string) {
  const preventDefault = vi.fn()
  const e = { clipboardData: { getData: () => text }, target: input, preventDefault } as unknown as ClipboardEvent
  const onInput = vi.fn()
  input.addEventListener('input', onInput)
  pasteFormulaAsSrc(e)
  return { preventDefault, onInput }
}

describe('вставка у звичайне поле формули', () => {
  it('LaTeX розпізнається; звичайний запис — ні', () => {
    expect(looksLikeLatex(MQ_COPIED)).toBe(true)
    expect(looksLikeLatex('\\frac{1}{x}')).toBe(true)
    expect(looksLikeLatex('x^{2}')).toBe(true)
    expect(looksLikeLatex('(x-2)^2+(y-4)^2=9')).toBe(false)
    expect(looksLikeLatex('y = 2*x')).toBe(false)
  })

  it('скопійоване з MathQuill лягає звичайним записом і ту саму формулу малює знову', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    const { preventDefault, onInput } = pasteInto(input, MQ_COPIED)
    expect(preventDefault).toHaveBeenCalled()
    expect(onInput).toHaveBeenCalledTimes(1) // штатний обробник поля оновлює модель
    expect(input.value).not.toContain('\\')
    expect(input.value.replace(/\s/g, '')).toMatch(/^\(x-2\)\^\(?2\)?\+\(y-4\)\^\(?2\)?=9$/)
    // та сама формула: запис → LaTeX для показу дає ті самі степені
    expect(asciiMathToLatex(input.value)).toMatch(/\^\{?2\}?/)
    input.remove()
  })

  it('вставка в позицію курсора, решта поля лишається', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.value = 'y = '
    input.setSelectionRange(4, 4)
    pasteInto(input, '\\sqrt{x}')
    expect(input.value.startsWith('y = ')).toBe(true)
    expect(input.value).not.toContain('\\')
    input.remove()
  })

  it('звичайний текст — звичайна вставка браузера (нічого не підмінюємо)', () => {
    const input = document.createElement('input')
    const { preventDefault, onInput } = pasteInto(input, '(x-5)^2+(y-9)^2=25')
    expect(preventDefault).not.toHaveBeenCalled()
    expect(onInput).not.toHaveBeenCalled()
  })
})

describe('підключення в полях і панелі', () => {
  it('три звичайні поля формул мають цю вставку', () => {
    // Панель виразів: onPaste — кілька рядків стають кількома формулами, один рядок іде в
    // pasteFormulaAsSrc (поведінка — GraphCalcInspectorDesmosKeys.spec, «один рядок — як і раніше»)
    expect(graphInspectorSource).toMatch(/class="gc-insp__expr-input"[\s\S]{0,400}@paste="onPaste\(\$event, expr\.id\)"/)
    expect(graphInspectorSource).toMatch(/if \(lines\.length < 2\) \{\s*pasteFormulaAsSrc\(e\)/)
    expect(graphRendererSource).toMatch(/class="gc-input"[\s\S]{0,500}@paste="pasteFormulaAsSrc"/)
    expect(calculusInspectorSource).toMatch(/class="calc-insp__expr-input"[\s\S]{0,400}@paste="pasteFormulaAsSrc"/)
  })

  it('дотик до панелі будь-якого об\'єкта вмикає «Виділення» (картки приймають правки лише з ним)', () => {
    expect(sidebarSource).toMatch(/class="insp-zoom-wrap"[\s\S]{0,200}@pointerdown\.capture="ensureSelectTool"[\s\S]{0,80}@focusin="ensureSelectTool"/)
    expect(sidebarSource).toMatch(/function ensureSelectTool\(\): void \{\s*if \(wbStore\.currentTool !== 'select'\) wbStore\.setTool\('select'\)/)
  })
})
