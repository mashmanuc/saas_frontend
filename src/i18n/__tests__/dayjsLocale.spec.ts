/**
 * dayjs іде за мовою застосунку (2026-09-06).
 *
 * `dayjs.locale()` не викликався ніде, тож бібліотека жила на англійському
 * дефолті: у сповіщеннях українець бачив «a few seconds ago» посеред
 * українського інтерфейсу (помічено на живому екрані перед уроком). Обидва
 * шляхи зміни мови — збережена (setI18nLocale) і тимчасова з URL
 * (applyLocaleOverride, `?lang=en` для /pro і легалки) — мусять тягнути dayjs.
 */
import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { setI18nLocale, applyLocaleOverride, i18n } from '../index.js'

dayjs.extend(relativeTime)
const ago = () => dayjs().subtract(3, 'hour').fromNow()

describe('dayjs locale = мова застосунку', () => {
  it('setI18nLocale("uk") → відносний час українською', () => {
    setI18nLocale('uk')
    expect(i18n.global.locale.value).toBe('uk')
    expect(ago()).toBe('3 години тому')
  })

  it('setI18nLocale("en") → англійською; назад "uk" → знову українською', () => {
    setI18nLocale('en')
    expect(ago()).toBe('3 hours ago')
    setI18nLocale('uk')
    expect(ago()).toBe('3 години тому')
  })

  it('тимчасове перекриття ?lang=en (applyLocaleOverride) теж перемикає dayjs', () => {
    setI18nLocale('uk')
    expect(applyLocaleOverride('en')).toBe(true)
    expect(ago()).toBe('3 hours ago')
    applyLocaleOverride('uk')
    expect(ago()).toBe('3 години тому')
  })

  it('невідома мова не міняє нічого і не кидає', () => {
    setI18nLocale('uk')
    expect(applyLocaleOverride('xx')).toBe(false)
    expect(ago()).toBe('3 години тому')
  })
})
