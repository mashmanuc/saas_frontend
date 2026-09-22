/**
 * Розклад тьютора без блоку доступності (рішення власника 2026-09-22).
 *
 * Підстава — візуальний огляд `saas_docs/UI_VISUAL_AUDIT_2026-09-22.md` п.2:
 * кнопка «Позначити вільний час» відкривала режим, результат якого нікому не
 * показувався. Єдиний екран, де учень бачив вільні години тьютора
 * (`StudentAvailabilityCalendar` → `/v1/tutors/{slug}/availability`), живе в
 * маркетплейсі, вимкненому 2026-06-17.
 *
 * Guard структурний: повернення смуги — це кілька рядків шаблону, які не
 * впали б у жодному наявному тесті (`availabilityDraftUnifiedStore` має власні
 * тести й лишається зеленим сам по собі, навіть коли в режим нікому увійти).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (name: string) => readFileSync(resolve(__dirname, '..', name), 'utf8')

const weekNavigation = read('WeekNavigation.vue')
const weekView = read('CalendarWeekView.vue')
const guide = read('CalendarGuideModal.vue')

describe('Розклад: блок «Позначити вільний час» прибрано', () => {
  it('WeekNavigation не має ні кнопки, ні смуги статусу доступності', () => {
    expect(weekNavigation).not.toContain('mark-free-time')
    expect(weekNavigation).not.toContain('mark_free_time')
    expect(weekNavigation).not.toContain('availability-status')
  })

  it('CalendarWeekView більше не входить у режим доступності зі смуги', () => {
    expect(weekView).not.toContain('@mark-free-time')
  })

  it('довідка не описує кнопку, якої немає', () => {
    expect(guide).not.toContain('calendar.guide.setupButton')
  })
})

describe('Розклад: що лишилось на місці', () => {
  it('довідка календаря доступна з рядка навігації тижнем', () => {
    expect(weekNavigation).toContain('week-navigation__help')
    expect(weekNavigation).toContain("emit('show-guide')")
    expect(weekView).toContain('@show-guide="showGuideModal = true"')
  })

  it('лінк на урок стоїть НАД сіткою, а не під нею', () => {
    const footer = weekView.indexOf('<CalendarFooter')
    const board = weekView.indexOf('<CalendarBoardV2')
    expect(footer).toBeGreaterThan(-1)
    expect(board).toBeGreaterThan(-1)
    expect(footer).toBeLessThan(board)
  })
})
