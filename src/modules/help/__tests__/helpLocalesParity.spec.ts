/**
 * «Допомога» трьома мовами — той самий набір статей (власник 2026-10-15: «зміни за останній
 * місяць, які не описані… додати»; додано 7 статей, оновлено 10).
 *
 * Стереже: uk/en/ru мають ті самі розділи й статті в тому самому порядку (HelpView бере набір за
 * мовою інтерфейсу — стаття, додана лише в одну мову, для інших просто зникла б); посилання
 * `/help/<slug>` усередині статей ведуть на наявні статті; тіло статті не порожнє.
 */
import { describe, expect, it } from 'vitest'
import { HELP_SECTIONS, type HelpSection } from '../data/helpArticles'
import { HELP_SECTIONS_EN } from '../data/helpArticles.en'
import { HELP_SECTIONS_RU } from '../data/helpArticles.ru'

const LOCALES: Record<string, HelpSection[]> = { uk: HELP_SECTIONS, en: HELP_SECTIONS_EN, ru: HELP_SECTIONS_RU }

const shape = (sections: HelpSection[]) =>
  sections.map((s) => ({ key: s.key, icon: s.icon, slugs: s.articles.map((a) => a.slug) }))

describe('довідка — однаковий набір статей у всіх мовах', () => {
  it('розділи й статті en/ru — як в українському оригіналі', () => {
    expect(shape(HELP_SECTIONS_EN)).toEqual(shape(HELP_SECTIONS))
    expect(shape(HELP_SECTIONS_RU)).toEqual(shape(HELP_SECTIONS))
  })

  it('нові статті 2026-10-15 на місці', () => {
    const all = HELP_SECTIONS.flatMap((s) => s.articles.map((a) => a.slug))
    for (const slug of ['integralyk', 'vyrizka-fragmenta', 'video-na-doshtsi', 'pult', 'dzerkalo', 'moi-uroky', 'nalashtuvannia']) {
      expect(all).toContain(slug)
    }
  })

  for (const [locale, sections] of Object.entries(LOCALES)) {
    it(`${locale}: посилання /help/… ведуть на наявні статті, тіла не порожні`, () => {
      const slugs = new Set(sections.flatMap((s) => s.articles.map((a) => a.slug)))
      for (const article of sections.flatMap((s) => s.articles)) {
        expect(article.title.trim(), article.slug).not.toBe('')
        expect(article.body.replace(/<[^>]+>/g, '').trim().length, article.slug).toBeGreaterThan(40)
        for (const [, target] of article.body.matchAll(/href="\/help\/([^"]+)"/g)) {
          expect(slugs.has(target), `${locale}/${article.slug} → /help/${target}`).toBe(true)
        }
      }
    })
  }
})
