import { describe, it, expect } from 'vitest'
import { getSectionedMenuByRole, getMenuByRole, SECTIONED_MENU_BY_ROLE } from '@/config/menu'

describe('getSectionedMenuByRole', () => {
  it('returns sections for tutor', () => {
    const sections = getSectionedMenuByRole('tutor')
    expect(sections.length).toBeGreaterThanOrEqual(4)
    expect(sections[0].key).toBe('main')
    expect(sections[0].items.length).toBeGreaterThan(0)
  })

  it('returns sections for student', () => {
    const sections = getSectionedMenuByRole('student')
    expect(sections.length).toBeGreaterThanOrEqual(3)
  })

  it('returns empty for unknown role', () => {
    expect(getSectionedMenuByRole('unknown')).toEqual([])
  })

  it('returns empty for null', () => {
    expect(getSectionedMenuByRole(null)).toEqual([])
  })

  it('every item has required fields', () => {
    for (const role of ['tutor', 'student', 'admin', 'superadmin']) {
      const sections = getSectionedMenuByRole(role)
      for (const section of sections) {
        expect(section).toHaveProperty('key')
        expect(section).toHaveProperty('items')
        for (const item of section.items) {
          expect(item).toHaveProperty('label')
          expect(item).toHaveProperty('icon')
          expect(item).toHaveProperty('to')
          // label must be i18n key
          expect(item.label).toMatch(/^sidebar\.item\./)
          // icon must be kebab-case
          expect(item.icon).toMatch(/^[a-z][a-z0-9-]*$/)
          // to must start with /
          expect(item.to).toMatch(/^\//)
        }
      }
    }
  })

  it('legacy getMenuByRole still works', () => {
    const tutorMenu = getMenuByRole('tutor')
    expect(tutorMenu.length).toBeGreaterThan(0)
    expect(tutorMenu[0]).toHaveProperty('label')
    expect(tutorMenu[0]).toHaveProperty('to')
  })
})
