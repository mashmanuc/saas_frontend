/**
 * Меню учня без пунктів, що ведуть у нікуди (власник 2026-10-19, «роби»): «Вчителі → Мої запити»
 * (/student/inquiries) з вимкненням каталогу вчителів лише перекидав на головну.
 */
import { describe, it, expect } from 'vitest'
import { getSectionedMenuByRole, getMenuByRole } from '../menu'

describe('меню учня', () => {
  it('немає «Мої запити» й порожнього розділу «Вчителі»', () => {
    const sections = getSectionedMenuByRole('student') as Array<{ key: string; items: Array<{ to: string }> }>
    expect(sections.map((s) => s.key)).not.toContain('tutors')
    const links = [...sections.flatMap((s) => s.items), ...(getMenuByRole('student') as Array<{ to: string }>)]
      .map((i) => i.to)
    expect(links).not.toContain('/student/inquiries')
    expect(sections.every((s) => s.items.length > 0)).toBe(true)
  })
})
