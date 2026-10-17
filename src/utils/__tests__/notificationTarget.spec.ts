/**
 * Сторінка «Сповіщення» (2026-10-17, С5): сповіщення про урок веде в розклад учня на тиждень уроку,
 * «Урок розпочався» — у живий урок; решта — як було; адреси лише всередині сайту.
 */
import { describe, it, expect } from 'vitest'
import { notificationTarget } from '../notificationTarget'

describe('notificationTarget', () => {
  it('урок у розкладі та живий урок', () => {
    expect(notificationTarget({ event_id: 7, url: '/student/schedule?week=2026-10-19&booking=7' }, 'student'))
      .toBe('/student/schedule?week=2026-10-19&booking=7')
    expect(notificationTarget({ lesson_id: '5', room_url: '/winterboard/classroom/5' }, 'student')).toBe('/winterboard/classroom/5')
  })

  it('чужі адреси не відкриваємо', () => {
    expect(notificationTarget({ url: 'https://evil.example/x' }, 'student')).toBeNull()
    expect(notificationTarget({ room_url: '//evil.example' }, 'student')).toBeNull()
  })

  it('решта — як було', () => {
    expect(notificationTarget({ thread_id: 3 }, 'tutor')).toBe('/tutor/messages/3')
    expect(notificationTarget({ relation_id: 1 }, 'tutor')).toBe('/tutor/students')
    expect(notificationTarget({ relation_id: 1 }, 'student')).toBe('/student/inquiries')
    expect(notificationTarget({ billing: true }, 'tutor')).toBe('/tutor/billing')
    expect(notificationTarget({}, 'student')).toBeNull()
  })
})
