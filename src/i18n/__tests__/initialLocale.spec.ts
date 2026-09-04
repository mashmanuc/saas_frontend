// Яку мову бачить відвідувач, який ще нічого не обирав.
//
// Довго запасним варіантом стояла довідкова локаль `uk`, тому кожен, у кому не
// впізнали українця, все одно отримував українську: німець із `de-DE` і
// берлінським часом бачив українську дошку й українські матеріали. Українські
// перевірки лишились на місці — змінився лише хвіст ланцюга.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getInitialLocale, DEFAULT_LOCALE, VISITOR_FALLBACK_LOCALE, STORAGE_KEY } from '../index'

/** Підмінити мову браузера й часовий пояс на час одного тесту. */
function pretendVisitor(language: string, timeZone: string): void {
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(language)
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
    () => ({ resolvedOptions: () => ({ timeZone }) }) as unknown as Intl.DateTimeFormat,
  )
}

describe('getInitialLocale — мова першого візиту', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('свідомий вибір людини важить більше за будь-яке визначення', () => {
    localStorage.setItem(STORAGE_KEY, 'de')
    pretendVisitor('uk-UA', 'Europe/Kyiv')
    expect(getInitialLocale()).toBe('de')
  })

  it('сміття у сховищі ігнорується (не мова — не приймаємо)', () => {
    localStorage.setItem(STORAGE_KEY, 'klingon')
    pretendVisitor('en-US', 'America/New_York')
    expect(getInitialLocale()).toBe(VISITOR_FALLBACK_LOCALE)
  })

  it('українська мова браузера → українська', () => {
    pretendVisitor('uk-UA', 'America/New_York')
    expect(getInitialLocale()).toBe('uk')
  })

  it('український часовий пояс → українська, навіть з іншою мовою браузера', () => {
    pretendVisitor('en-US', 'Europe/Kyiv')
    expect(getInitialLocale()).toBe('uk')
  })

  it('ані мова, ані пояс не вказують на Україну → англійська', () => {
    pretendVisitor('de-DE', 'Europe/Berlin')
    expect(getInitialLocale()).toBe('en')
  })

  it('поляк теж НЕ отримує українську', () => {
    pretendVisitor('pl-PL', 'Europe/Warsaw')
    expect(getInitialLocale()).toBe('en')
  })

  it('запасна мова відвідувача — не те саме, що довідкова локаль проєкту', () => {
    // uk лишається fallbackLocale для vue-i18n: вона повна, і саме нею
    // затикаються відсутні ключі. Змішати ці дві ролі — і бракуючий
    // англійський рядок знову покаже гостю українську.
    expect(DEFAULT_LOCALE).toBe('uk')
    expect(VISITOR_FALLBACK_LOCALE).toBe('en')
  })
})
