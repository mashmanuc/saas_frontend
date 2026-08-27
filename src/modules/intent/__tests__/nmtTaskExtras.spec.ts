/**
 * Що з картки задачі бачить Інтегралик.
 *
 * ⚠️ Живий випадок власника 2026-08-27. Він відкрив картку «Встановіть
 * відповідність між заданими дробами та їхнім нескоротним виглядом», натиснув
 * «Показати розбір» і спитав: «а що в розв'язках даного завдання не так».
 * Інтегралик чесно відповів, що бачить лише умову — і це була правда:
 *
 *   • у контекст ішли тільки `question` і `correctAnswer`;
 *   • `correctAnswer` заповнений ЛИШЕ для відкритої відповіді, тож для
 *     «відповідності» та вибору варіанта відповіді не було ВЗАГАЛІ;
 *   • `solution` не слався для жодного типу задач.
 *
 * 🔴 Межа — продуктова, не технічна. Рішення власника: розбір видно моделі
 * ЛИШЕ коли тьютор сам його відкрив. Розбір — готова відповідь, і коли доступ
 * до Інтегралика матиме учень, «завжди видно» стало б каналом для списування.
 */
import { describe, it, expect } from 'vitest'
import { nmtTaskExtras } from '../boardActions'

describe('відповідь — для ВСІХ типів задач', () => {
  it('🔴 «відповідність»: пари, яких раніше не було зовсім', () => {
    const out = nmtTaskExtras({
      pairs: [
        { left: '3/6', right: '1/2' },
        { left: '4/20', right: '1/5' },
      ],
    })
    expect(out.answer).toBe('3/6 — 1/2; 4/20 — 1/5')
  })

  it('🔴 вибір варіанта: беруться саме правильні', () => {
    const out = nmtTaskExtras({
      options: [
        { letter: 'А', text: '10/12', isCorrect: false },
        { letter: 'Б', text: '12/35', isCorrect: true },
        { letter: 'В', text: '2/7', isCorrect: false },
      ],
    })
    expect(out.answer).toBe('Б) 12/35')
  })

  it('кілька правильних — усі', () => {
    const out = nmtTaskExtras({
      options: [
        { letter: 'А', text: 'один', isCorrect: true },
        { letter: 'Б', text: 'два', isCorrect: false },
        { letter: 'В', text: 'три', isCorrect: true },
      ],
    })
    expect(out.answer).toBe('А) один, В) три')
  })

  it('відкрита відповідь — як і раніше', () => {
    expect(nmtTaskExtras({ correctAnswer: '6,9' }).answer).toBe('6,9')
  })

  it('нема чого сказати — поля немає', () => {
    // Порожнє поле гірше за відсутнє: «ВІДПОВІДЬ:» без вмісту модель читає
    // як «відповіді не існує».
    expect(nmtTaskExtras({}).answer).toBeUndefined()
    expect(nmtTaskExtras({ correctAnswer: '   ' }).answer).toBeUndefined()
    expect(nmtTaskExtras({ options: [{ letter: 'А', text: 'x', isCorrect: false }] })
      .answer).toBeUndefined()
  })
})

describe('🔴 розбір — тільки за відкритим', () => {
  const SOL = 'Знайдіть НСД чисельника та знаменника'

  it('тьютор відкрив — модель бачить', () => {
    expect(nmtTaskExtras({ solution: SOL, showSolution: true }).solution).toBe(SOL)
  })

  it('🔴 тьютор НЕ відкривав — модель не бачить', () => {
    expect(nmtTaskExtras({ solution: SOL, showSolution: false }).solution).toBeUndefined()
    expect(nmtTaskExtras({ solution: SOL }).solution).toBeUndefined()
  })

  it('відкрив, але розбору немає — поля немає', () => {
    expect(nmtTaskExtras({ showSolution: true }).solution).toBeUndefined()
    expect(nmtTaskExtras({ showSolution: true, solution: '  ' }).solution).toBeUndefined()
  })

  it('довгий розбір обрізається, а не викидається', () => {
    // 400 символів: за виміром 13 000 розборів банку медіана 114, 90-й
    // перцентиль 317 — ріжеться хвіст, а не типовий випадок.
    const out = nmtTaskExtras({ showSolution: true, solution: 'крок '.repeat(300) })
    expect(out.solution).toBeDefined()
    expect(out.solution!.length).toBeLessThanOrEqual(400)
  })
})

describe('розмітка не тече в контекст', () => {
  it('HTML і зайві пробіли зчищаються', () => {
    const out = nmtTaskExtras({
      showSolution: true,
      solution: '<p>Отже,   <b>6,9</b></p>\n\n<span>кінець</span>',
    })
    expect(out.solution).toBe('Отже, 6,9 кінець')
  })

  it('те саме в парах', () => {
    const out = nmtTaskExtras({ pairs: [{ left: '<i>3/6</i>', right: '<b>1/2</b>' }] })
    expect(out.answer).toBe('3/6 — 1/2')
  })
})
