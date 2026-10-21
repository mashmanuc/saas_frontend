import { describe, expect, it } from 'vitest'
import { getBoardCover } from '../boardCover'

describe('getBoardCover — обкладинка дошки в Студії', () => {
  it('слова з назви дають знак теми', () => {
    expect(getBoardCover('Урок: Звичайні дроби', 'uk').glyph).toBe('½')
    expect(getBoardCover('Урок: Квадратні рівняння', 'uk').glyph).toBe('x²')
    expect(getBoardCover('Урок: Паралелограм, ромб, трапеція', 'uk').glyph).toBe('▱')
    expect(getBoardCover('Урок: Показникові, логарифмічні, тригонометричні вирази', 'uk').glyph).toBe('log')
    expect(getBoardCover('Урок: Звичайні дроби', 'uk').mono).toBe(false)
  })

  it('слово ловиться лише з початку: «Матеріали», «Нотатки», «Посилання», «Умова» — монограма', () => {
    for (const name of ['Матеріали', 'Нотатки', 'Посилання', 'Умова задачі', 'Картинки']) {
      expect(getBoardCover(name, 'uk').mono, name).toBe(true)
    }
    for (const name of ['Physics Class', 'Single lesson', 'Колонка', '5 хвилин', 'Програма уроку']) {
      expect(getBoardCover(name, 'uk').mono, name).toBe(true)
    }
    for (const name of ['General revision', 'Warm-up', 'Meaning of words']) {
      expect(getBoardCover(name, 'en').mono, name).toBe(true)
    }
    expect(getBoardCover('Коло і круг', 'uk').glyph).toBe('○')
    expect(getBoardCover('sin і cos', 'uk').glyph).toBe('sin')
    expect(getBoardCover('Карта світу', 'uk').glyph).toBe('⌖')
    expect(getBoardCover('Вода і розчини', 'uk').glyph).toBe('%')
  })

  it('монограма: літера + число в кінці, інакше дві літери; дату не бере', () => {
    expect(getBoardCover('Почерк7', 'uk').glyph).toBe('П7')
    expect(getBoardCover('Заняття 3', 'uk').glyph).toBe('З3')
    expect(getBoardCover('Підготовка до НМТ', 'uk').glyph).toBe('Пд')
    expect(getBoardCover('Вероніка 21.10', 'uk').glyph).toBe('В')
    expect(getBoardCover('Урок: Мій особливий урок', 'uk').glyph).toBe('Мо')
  })

  it('англійська назва — англійські слова; мова без слів — монограма', () => {
    expect(getBoardCover('Present Perfect grammar', 'en').glyph).toBe('Ab')
    expect(getBoardCover('Quadratic equations', 'en-GB').glyph).toBe('x²')
    const pl = getBoardCover('Lekcja: Ułamki zwykłe', 'pl')
    expect(pl.mono).toBe(true)
    expect(pl.glyph).toBe('Uz')
  })

  it('порожня назва — без знака', () => {
    expect(getBoardCover('', 'uk')).toMatchObject({ glyph: '', empty: true })
    expect(getBoardCover(null, 'uk').empty).toBe(true)
    expect(getBoardCover('Урок:', 'uk').empty).toBe(true)
    expect(getBoardCover('Без назви', 'uk').empty).toBe(true)
    expect(getBoardCover('Untitled', 'en').empty).toBe(true)
  })

  it('відтінок стабільний для тієї самої назви', () => {
    expect(getBoardCover('Почерк7', 'uk').hue).toBe(getBoardCover('Почерк7', 'uk').hue)
    const h = getBoardCover('Урок: Звичайні дроби', 'uk').hue
    expect(h).toBeGreaterThanOrEqual(45 - 8)
    expect(h).toBeLessThanOrEqual(45 + 8)
  })
})
