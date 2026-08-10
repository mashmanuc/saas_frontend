/**
 * Поле виразу не має підмінятись прев'ю ПОСЕРЕД набору.
 *
 * Живий прогін 2026-08-10: «+ вираз» → вводиться рівно ОДИН символ, далі
 * поле стає нечутливим і потребує повторного кліку.
 *
 * Корінь — не фокус, а порядок умов у шаблоні:
 *   v-if      editingId !== expr.id && expr.src.trim()  → прев'ю (кнопка)
 *   v-else-if editingId === expr.id && mqEditing        → MathQuill
 *   v-else                                              → input
 *
 * Нове поле порожнє, тому рендериться третьою гілкою, але `editingId`
 * порожній (його ставив лише клік по прев'ю). Перший символ робив
 * `expr.src.trim()` істинним → ПЕРША умова спрацьовувала → input
 * замінювався кнопкою разом із фокусом.
 *
 * Тест перевіряє САМЕ УМОВУ, а не реалізацію: він не знає про @focus і
 * лишиться валідним, якщо режим редагування триматимуть інакше.
 */
import { describe, it, expect } from 'vitest'

/** Дзеркало шаблонних умов рядка виразу (GraphCalcInspector.vue). */
function renderedBranch(
  editingId: string | null,
  expr: { id: string; src: string },
  mqEditing: boolean,
): 'preview' | 'mathquill' | 'input' {
  if (editingId !== expr.id && expr.src.trim()) return 'preview'
  if (editingId === expr.id && mqEditing) return 'mathquill'
  return 'input'
}

describe('GraphCalcInspector — гілка рендеру рядка виразу', () => {
  const expr = { id: 'e1', src: '' }

  it('нове порожнє поле — це input', () => {
    expect(renderedBranch(null, expr, false)).toBe('input')
  })

  it('БЕЗ режиму редагування перший символ підміняє input на прев\'ю (баг)', () => {
    // Саме це й ламало ввід: editingId порожній, src щойно став непорожнім.
    expect(renderedBranch(null, { id: 'e1', src: 'і' }, false)).toBe('preview')
  })

  it('У режимі редагування поле лишається полем після першого символу', () => {
    // Виправлена поведінка: фокус фіксує editingId, тож перша умова хибна.
    expect(renderedBranch('e1', { id: 'e1', src: 'і' }, false)).toBe('input')
    expect(renderedBranch('e1', { id: 'e1', src: 'y = x^2' }, false)).toBe('input')
  })

  it('редагування іншого рядка не перетворює цей на input', () => {
    // Сусідній рядок із текстом лишається прев'ю, поки редагують не його.
    expect(renderedBranch('e2', { id: 'e1', src: 'y = x' }, false)).toBe('preview')
  })

  it('MathQuill-гілка недосяжна без режиму редагування', () => {
    expect(renderedBranch(null, { id: 'e1', src: 'y = x' }, true)).toBe('preview')
    expect(renderedBranch('e1', { id: 'e1', src: 'y = x' }, true)).toBe('mathquill')
  })
})
