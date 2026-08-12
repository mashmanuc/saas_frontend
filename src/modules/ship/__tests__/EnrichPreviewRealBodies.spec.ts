/**
 * Сторож на РЕАЛЬНИХ тілах карток, а не на вигаданих.
 *
 * Живий тест власника 2026-08-12 показав, що формульні картки висіли в
 * прев'ю сирим LaTeX. Причина була системна (контракт «body без $» проти
 * рендерера, який рендерить лише між доларами), і питання власника було
 * правильне: «а в інших картках — теорія, помилка — воно як?».
 *
 * Відповідь виміряна на корпусі (620 карток прод-моделі):
 *   add_card    87 карток із математикою — ВСІ з доларами;
 *   add_formula 32 картки з математикою — ВСІ голі (так вимагає контракт).
 * Тобто ламалось рівно одне сімейство, і рівно його ми полагодили.
 *
 * Фікстура — зріз того самого корпусу: всі 32 формульні плюс по кілька
 * текстових на КОЖЕН жанр (Теорія, Метод, Помилка, Підказка, Формула,
 * Приклад із життя). Якщо колись зміниться контракт промпту або
 * рендерер — падає тут, на живих даних, а не в проді на очах тьютора.
 */
import { describe, it, expect } from 'vitest'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'
import bodies from './realBodies.fixture.json'

interface RealBody { action: string; body: string; badge: string }

/** Дзеркало `EnrichPatchesPreview::renderBody` — контракт, не реалізація. */
function renderBody(p: RealBody): string {
  const body = String(p?.body ?? '')
  if (!body.trim()) return ''
  const bare = p?.action === 'add_formula' && !body.includes('$')
  return renderTextWithLatex(bare ? `$$${body}$$` : body)
}

/** Видимий шар KaTeX без прихованого MathML (там LaTeX є ЗА ЗАДУМОМ). */
function visible(html: string): string {
  const host = document.createElement('div')
  host.innerHTML = html
  host.querySelectorAll('.katex-mathml').forEach((el) => el.remove())
  return host.textContent || ''
}

const REAL = bodies as unknown as RealBody[]

describe('прев\'ю enrich на реальних тілах корпусу', () => {
  it('кожне тіло дає KaTeX', () => {
    const bad = REAL.filter((p) => !renderBody(p).includes('katex'))
      .map((p) => `[${p.badge}/${p.action}] ${p.body.slice(0, 50)}`)
    expect(bad).toEqual([])
  })

  it('жодне не лишає сирої LaTeX-команди на видимому шарі', () => {
    const bad = REAL
      .filter((p) => /\\[a-zA-Z]{2,}/.test(visible(renderBody(p))))
      .map((p) => `[${p.badge}] ${visible(renderBody(p)).slice(0, 50)}`)
    expect(bad).toEqual([])
  })

  it('покриття не звузилось: усі жанри та обидві дії у фікстурі', () => {
    const badges = new Set(REAL.map((p) => p.badge))
    for (const genre of ['Теорія', 'Метод', 'Помилка', 'Підказка', 'Формула']) {
      expect(badges, genre).toContain(genre)
    }
    const actions = new Set(REAL.map((p) => p.action))
    expect(actions).toContain('add_card')
    expect(actions).toContain('add_formula')
  })

  it('формульні тіла в корпусі справді голі — саме це й ламалось', () => {
    const formulas = REAL.filter((p) => p.action === 'add_formula')
    expect(formulas.length).toBeGreaterThan(20)
    expect(formulas.every((p) => !p.body.includes('$'))).toBe(true)
  })
})
