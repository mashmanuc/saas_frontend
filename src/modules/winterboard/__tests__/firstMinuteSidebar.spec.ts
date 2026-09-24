/**
 * Перша хвилина нового вчителя: права панель має давати дію, а не порожнечу.
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 * Розбір uid 238 (2026-09-24): людина створила дошку за 10 с після реєстрації,
 * пробула хвилину і пішла з нулем операцій. На дошці її зустрічали порожні
 * «Матеріали» (вкладка за замовчуванням) і напис «Матеріалів ще немає».
 *
 * ІНВАРІАНТИ
 *   INV-FIRST-1  файлів нема → відкривається «Інструменти»
 *   INV-FIRST-2  файли є → лишаються «Матеріали»
 *   INV-FIRST-3  людина сама обрала вкладку → її вибір не перебиваємо
 *   INV-FIRST-4  порожні «Матеріали» кажуть навіщо і дають кнопку
 *   INV-FIRST-5  підказка інструментів згадує КЛІК (він працює), не лише drag
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/modules/winterboard/components/sidebar/GroupContentSidebar.vue', 'utf8')
const UK = JSON.parse(readFileSync('src/i18n/locales/uk.json', 'utf8'))
const EN = JSON.parse(readFileSync('src/i18n/locales/en.json', 'utf8'))

describe('вкладка за замовчуванням — за даними', () => {
  it('INV-FIRST-1 + 2: рішення приймається після відповіді сервера і лише на нулі файлів', () => {
    expect(SRC).toMatch(/if \(total === 0\) activeTab\.value = 'tools'/)
    // «ще вантажиться» не привід перемикати
    expect(SRC).toMatch(/if \(loading \|\| tabChosenByUser \|\| props\.localMode\) return/)
  })

  it('INV-FIRST-3: клік по вкладці фіксує вибір людини', () => {
    expect(SRC).toMatch(/@click="pickTab\('materials'\)"/)
    expect(SRC).toMatch(/@click="pickTab\('tools'\)"/)
    expect(SRC).toMatch(/tabChosenByUser = true/)
  })
})

describe('порожні «Матеріали» дають дію', () => {
  it('INV-FIRST-4: заголовок, пояснення навіщо і кнопка завантаження', () => {
    expect(SRC).toContain("winterboard.contentSidebar.emptyTitle")
    expect(SRC).toContain("winterboard.contentSidebar.emptyLead")
    expect(SRC).toContain("winterboard.contentSidebar.emptyCta")
    expect(SRC).toMatch(/content-sidebar__empty-cta[\s\S]{0,400}type="file"/)
  })

  it('тексти є в обох мовах і пояснюють користь, а не констатують', () => {
    for (const dict of [UK, EN]) {
      const cs = dict.winterboard.contentSidebar
      expect(cs.emptyTitle).toBeTruthy()
      expect(cs.emptyLead.length).toBeGreaterThan(30)
      expect(cs.emptyCta).toBeTruthy()
    }
  })
})

describe('підказки кажуть правду про спосіб', () => {
  it('INV-FIRST-5: на «Інструментах» згадано клік, і саме першим', () => {
    const hint = UK.winterboard.contentSidebar.toolsHint
    expect(SRC).toContain('winterboard.contentSidebar.toolsHint')
    expect(hint.toLowerCase()).toContain('натисніть')
    expect(hint.toLowerCase().indexOf('натисніть'))
      .toBeLessThan(hint.toLowerCase().indexOf('перетягн'))
  })

  it('порожня дошка більше не відсилає до панелі, яка в новачка порожня', () => {
    const sub = UK.winterboard.emptyCanvas.sub
    expect(sub).not.toContain('матеріали з правої панелі')
    expect(sub).toContain('Інструменти')
  })
})
