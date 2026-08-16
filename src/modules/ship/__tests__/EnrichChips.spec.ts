/**
 * Чіпи-жанри enrich — стоять НА ВИМІРІ, не на смаку.
 *
 * Питання власника 2026-08-16: «в нас тільки 3 сценарії? для юзера це не
 * очевидно». Факт був такий: бек знає 7 жанрів, UI показував 3 — чотири
 * невидимі. Прогін `tools/phrase_probe/exp_chip_genre.py` (62 фрази × 3
 * зразки, прод-модель) показав, ЯКІ формулювання класифікатор упізнає
 * стабільно, і чіпи взяли переможців.
 *
 * Тест стереже дві речі, які легко зламати з добрих намірів:
 *   1. кількість жанрів у меню (хтось «причепурить» і викине шар);
 *   2. ДОСЛІВНІСТЬ фраз — сусідні формулювання того самого жанру
 *      провалились у вимірі («Зв'яжи із транспортом» → Метод замість
 *      Прикладу з життя; «Додай математичну довідку» → Формула замість
 *      Теорії). Змінив фразу — переміряй, інакше чіп тихо почне замовляти
 *      не той шар.
 */
import { describe, it, expect } from 'vitest'
import uk from '@/i18n/locales/uk.json'
import en from '@/i18n/locales/en.json'

const chipsUk = (uk as any).winterboard.enrich.chips
const chipsEn = (en as any).winterboard.enrich.chips

/** Дослівні переможці виміру 2026-08-16 (Mistral, 3/3 зразки). */
const MEASURED_UK: Record<string, string> = {
  commonMistake: 'Додай пастку.',        // Помилка 10/10
  formulas: 'Нагадай формулу.',          // Формула 11/13
  method: 'З чого почати?',              // Метод 8/10
  hint: 'Додай підказку.',               // Підказка 5/7
  lifeExample: "Зв'яжи із спортом.",     // Приклад із життя 6/10
  theory: 'Додай теорію.',               // Теорія 3/8 — найслабший, але робочий
}

describe('чіпи enrich — жанри з виміру', () => {
  it('усі шість виміряних жанрів на місці', () => {
    expect(Object.keys(chipsUk).sort()).toEqual(Object.keys(MEASURED_UK).sort())
  })

  it('фрази ДОСЛІВНО ті, що пройшли вимір 3/3', () => {
    for (const [key, phrase] of Object.entries(MEASURED_UK)) {
      expect(chipsUk[key], `${key}: фразу змінено — потрібен новий прогін exp_chip_genre.py`)
        .toBe(phrase)
    }
  })

  it('«Приклад» у меню НЕМАЄ (вимір 0/4, падає в «Метод»)', () => {
    // Рішення власника 2026-08-16, варіант «б»: у беку жанр лишається (може
    // стояти в badge наявних карток), у UI не пропонуємо — не можна
    // замовляти шар, якого система не відрізняє від методу.
    const all = Object.values(chipsUk).join(' ').toLowerCase()
    expect(all).not.toContain('розібраний приклад')
    expect(all).not.toContain('взірцевий')
  })

  it('англійська локаль має ті самі ключі', () => {
    expect(Object.keys(chipsEn).sort()).toEqual(Object.keys(chipsUk).sort())
  })

  it('плейсхолдер не дублює чіпи', () => {
    // Був списком тих самих прикладів — тепер меню їх показує саме.
    const ph = (uk as any).winterboard.enrich.instructionPlaceholder
    expect(ph).not.toContain('напр.')
    expect(ph.length).toBeLessThan(80)
  })
})
