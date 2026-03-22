import { describe, it, expect } from 'vitest'
import { SECTIONED_MENU_BY_ROLE } from '@/config/menu'

describe('Sidebar Knowledge Items', () => {
  it('tutor teaching section exists', () => {
    const tutorMenu = SECTIONED_MENU_BY_ROLE.tutor
    const teaching = tutorMenu.find((s: any) => s.key === 'teaching')
    expect(teaching).toBeDefined()
  })

  it('tutor teaching section has 3 items', () => {
    const teaching = SECTIONED_MENU_BY_ROLE.tutor.find((s: any) => s.key === 'teaching')
    expect(teaching!.items).toHaveLength(3)
  })

  it('teaching items have correct routes', () => {
    const teaching = SECTIONED_MENU_BY_ROLE.tutor.find((s: any) => s.key === 'teaching')!
    const routes = teaching.items.map((i: any) => i.to)
    expect(routes).toContain('/knowledge/my-lessons')
    expect(routes).toContain('/knowledge/catalog')
    expect(routes).toContain('/knowledge/analytics')
  })

  it('teaching items have icons', () => {
    const teaching = SECTIONED_MENU_BY_ROLE.tutor.find((s: any) => s.key === 'teaching')!
    teaching.items.forEach((item: any) => {
      expect(item.icon).toBeTruthy()
    })
  })

  it('teaching items have i18n labels', () => {
    const teaching = SECTIONED_MENU_BY_ROLE.tutor.find((s: any) => s.key === 'teaching')!
    teaching.items.forEach((item: any) => {
      expect(item.label).toMatch(/^sidebar\.item\./)
    })
  })

  it('teaching items have hints', () => {
    const teaching = SECTIONED_MENU_BY_ROLE.tutor.find((s: any) => s.key === 'teaching')!
    teaching.items.forEach((item: any) => {
      expect(item.hint).toBeTruthy()
      expect(item.hint).toMatch(/^sidebar\.hint\./)
    })
  })

  it('student has lesson catalog in tutors section', () => {
    const studentMenu = SECTIONED_MENU_BY_ROLE.student
    const tutors = studentMenu.find((s: any) => s.key === 'tutors')
    expect(tutors).toBeDefined()
    const catalogItem = tutors!.items.find((i: any) => i.to === '/knowledge/catalog')
    expect(catalogItem).toBeDefined()
  })

  it('knowledge hub is first teaching item', () => {
    const teaching = SECTIONED_MENU_BY_ROLE.tutor.find((s: any) => s.key === 'teaching')!
    expect(teaching.items[0].to).toBe('/knowledge/my-lessons')
  })
})
