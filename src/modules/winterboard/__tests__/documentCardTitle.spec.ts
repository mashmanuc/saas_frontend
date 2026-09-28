/**
 * Власник 2026-09-28 («так»): у шапці картки документа — назва файлу (як у «Сценарії» на пульті),
 * без назви — вид документа мовою інтерфейсу, а не вписане в код англійське «Presentation».
 */
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import en from '../../../i18n/locales/en.json'
import { documentHeaderText, documentKind } from '../board/documentTitle'

function i18n(locale: 'uk' | 'en' = 'uk') {
  return createI18n({ legacy: false, locale, fallbackLocale: 'en', messages: { uk, en } as any })
}

describe('картка документа: у шапці назва файлу, а не «Presentation»', () => {
  const t = i18n().global.t as unknown as (k: string) => string

  it('назва файлу — як у «Сценарії» на пульті', () => {
    expect(documentHeaderText({ title: 'Комбінаторика правила.pptx', content_ref: { content_type: 'presentation' } }, t))
      .toBe('Комбінаторика правила.pptx')
  })

  it('без назви — вид документа мовою інтерфейсу', () => {
    expect(documentHeaderText({ content_ref: { content_type: 'presentation' } }, t)).toBe('Презентація')
    expect(documentHeaderText({ title: '   ', content_ref: { content_type: 'document' } }, t)).toBe('Документ')
    expect(documentHeaderText({ content_ref: { content_type: 'pdf' } }, t)).toBe('PDF')
    const tEn = i18n('en').global.t as unknown as (k: string) => string
    expect(documentHeaderText({ content_ref: { content_type: 'presentation' } }, tEn)).toBe('Presentation')
  })

  it('невідомий чи порожній вид — PDF, як було', () => {
    expect(documentKind({})).toBe('pdf')
    expect(documentKind({ content_ref: { content_type: 'what' } })).toBe('pdf')
  })
})
