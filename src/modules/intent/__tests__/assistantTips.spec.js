/**
 * Підказки Інтегралика з предметом (слово власника 2026-09-22):
 * вибрано історію — підказки історії й проєкту, але не математики;
 * вибрано кілька предметів — можна змішано.
 */
import { describe, expect, it } from 'vitest'

import { TIPS, tipPool, tipSubjects } from '../assistantTips'

const registry = (...ids) => ({ subjects: ids.map((id) => ({ id })) })
const state = (over = {}) => ({
  registryLoaded: true, enabled: true, registry: registry('history'), subject: { locked: null }, ...over,
})
const kinds = (context, subjects) => {
  const byText = new Map(TIPS[context].map((tip) => [tip.t, tip.s]))
  return new Set(tipPool(context, subjects).map((t) => byText.get(t)))
}

describe('tipSubjects — які предмети видно', () => {
  it('у профілі лише історія — лише історія', () => {
    expect([...tipSubjects(state())]).toEqual(['history'])
  })

  it('кілька предметів — усі вони, «Загальний» не предмет підказок', () => {
    expect([...tipSubjects(state({ registry: registry('math', 'history', 'general') }))])
      .toEqual(['math', 'history'])
  })

  it('предмет дошки зафіксовано — лише він', () => {
    const s = state({ registry: registry('math', 'history'), subject: { locked: 'math' } })
    expect([...tipSubjects(s)]).toEqual(['math'])
  })

  it('реєстр ще невідомий — жодного предмета (лише проєкт)', () => {
    expect(tipSubjects({ registryLoaded: false }).size).toBe(0)
  })

  it('коридорів у користувача немає — як до коридорів (без обмежень)', () => {
    expect(tipSubjects({ registryLoaded: true, enabled: false, registry: null })).toBeNull()
  })
})

describe('tipPool — що показуємо', () => {
  for (const context of ['board', 'studio', 'other']) {
    it(`${context}: вибрано історію — жодної підказки математики`, () => {
      const got = kinds(context, tipSubjects(state()))
      expect(got.has('math')).toBe(false)
      expect(got.has('platform')).toBe(true)
    })

    it(`${context}: вибрано математику — жодної підказки історії`, () => {
      const got = kinds(context, tipSubjects(state({ registry: registry('math') })))
      expect(got.has('history')).toBe(false)
      expect(got.has('math')).toBe(true)
    })
  }

  it('на дошці історика є саме історичні підказки', () => {
    expect(kinds('board', tipSubjects(state())).has('history')).toBe(true)
  })

  it('кілька предметів — змішано', () => {
    const got = kinds('board', tipSubjects(state({ registry: registry('math', 'history') })))
    expect(got.has('math') && got.has('history')).toBe(true)
  })

  it('невідомий контекст — набір «деінде», пул ніколи не порожній', () => {
    expect(tipPool('nowhere', new Set()).length).toBeGreaterThan(5)
  })

  it('кожна підказка має відомий предмет', () => {
    for (const pool of Object.values(TIPS)) {
      for (const tip of pool) expect(['platform', 'math', 'history']).toContain(tip.s)
    }
  })
})

describe('assistantPlaceholder — поле чату за предметами', async () => {
  const { assistantPlaceholder } = await import('../assistantTips')
  it('лише історія — про історію, без математики', () => {
    const text = assistantPlaceholder(tipSubjects(state()))
    expect(text).not.toMatch(/математик/)
    expect(text).toMatch(/подію чи постать/)
  })
  it('кілька предметів або невідомо — нейтрально', () => {
    expect(assistantPlaceholder(tipSubjects(state({ registry: registry('math', 'history') }))))
      .toBe('Продовжте діалог або запитайте за темою уроку…')
    expect(assistantPlaceholder(new Set())).toBe('Продовжте діалог або запитайте за темою уроку…')
    expect(assistantPlaceholder(null)).toBe('Продовжте діалог або запитайте за темою уроку…')
  })
  it('лише математика — про математику', () => {
    expect(assistantPlaceholder(tipSubjects(state({ registry: registry('math') })))).toMatch(/математик/)
  })
})

// FIRST USER GATE 2026-09-23, крок 4: у першому полі були лише переходи
// («урок», «дошку», «мої уроки») — новачок не дізнавався про графіки й формули.
describe('commandPlaceholder — перше поле палітри за предметами', async () => {
  const { commandPlaceholder } = await import('../assistantTips')
  it('коридори вимкнено (null) — приклад графіка, без історії', () => {
    const text = commandPlaceholder(null)
    expect(text).toMatch(/графік/)
    expect(text).not.toMatch(/битва|Хмельницький/)
  })
  it('лише історія — без математики', () => {
    const text = commandPlaceholder(tipSubjects(state()))
    expect(text).not.toMatch(/графік|формул/)
    expect(text).toMatch(/Полтавська битва/)
  })
  it('лише математика — графік', () => {
    expect(commandPlaceholder(tipSubjects(state({ registry: registry('math') })))).toMatch(/графік/)
  })
  it('реєстр ще не завантажено — нейтрально, без предмета', () => {
    const text = commandPlaceholder(new Set())
    expect(text).not.toMatch(/графік|битва/)
  })
})
