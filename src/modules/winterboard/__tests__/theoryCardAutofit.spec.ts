/**
 * Авто-розмір картки теорії — стискання під вміст.
 *
 * Issue власника 2026-08-09: короткі картки лишались на стартових 380px
 * із півекраном порожнечі. Авто-фіт існував, але вмів ЛИШЕ рости.
 *
 * ⚠️ Ключова пастка, через яку перший фікс не спрацював: `.theory-card__body`
 * має `flex: 1 1 auto`, тобто розтягується на всю картку — його
 * `scrollHeight` дорівнює висоті КОНТЕЙНЕРА, а не тексту. Тому «скільки
 * місця займає вміст» треба міряти по дітях, а не по самому блоку.
 * Тест фіксує саме цей контракт: у jsdom layout нульовий, тож перевіряємо
 * не пікселі, а що вимір НЕ спирається на scrollHeight розтягнутого блоку.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(
  resolve(__dirname, '../components/board/objects/TheoryCardRenderer.vue'),
  'utf-8',
)

describe('TheoryCardRenderer — авто-розмір під вміст', () => {
  it('вимірює вміст по дітях, а не scrollHeight розтягнутого body', () => {
    // Саме ця підміна й була багом: body.scrollHeight ≈ висота картки.
    expect(SRC).toContain('function measureContent')
    const fn = SRC.slice(SRC.indexOf('function measureContent'))
      .slice(0, SRC.slice(SRC.indexOf('function measureContent')).indexOf('\n}') + 2)
    expect(fn).toContain('body.children')
    expect(fn).toContain('getBoundingClientRect')
  })

  it('має гілку стискання з нижньою межею і мертвою зоною', () => {
    // MIN_H — щоб однорядкова картка не стала смужкою.
    // SHRINK_EPS — щоб картка не «дихала» на кожному переміряні.
    expect(SRC).toMatch(/const MIN_H\s*=\s*\d+/)
    expect(SRC).toMatch(/const SHRINK_EPS\s*=\s*\d+/)
    expect(SRC).toContain('props.asset.h - fitH > SHRINK_EPS')
  })

  it('ручний resize і далі вимикає авто-фіт назавжди', () => {
    // Вимога власника 2026-08-07 — стискання не сміє її перекрити.
    expect(SRC).toContain('if (userResized.value) return')
  })
})
