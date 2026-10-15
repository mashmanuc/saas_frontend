/**
 * «Майбутні уроки» учня (власник 2026-10-15, розклад учня п.4): урок із розкладу вчителя —
 * «Заплановано», без «Приєднатися» (зайти можна, коли вчитель відкриє урок), «Деталі» — розклад учня,
 * а не мертва сторінка /bookings.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/modules/booking/api/calendarV055Api', () => ({ calendarV055Api: { joinEventRoom: vi.fn() } }))

import UpcomingLessonCard from '../UpcomingLessonCard.vue'
import StudentUpcomingLessonsSection from '../StudentUpcomingLessonsSection.vue'

const SCHEDULED = {
  id: 'event-12',
  scheduled_at: '2026-10-16T13:00:00+00:00',
  duration_minutes: 60,
  status: 'scheduled' as const,
  tutor_name: 'Олена Вчителька',
  tutor_avatar: null,
  student_name: 'Максим Учень',
  student_avatar: null,
  classroom_session_id: null,
  wb_session_id: null,
  can_join: false,
  lesson_type: 'scheduled',
  notes: null,
}

describe('Майбутні уроки учня — урок із розкладу', () => {
  it('картка: учитель, «Заплановано», без «Приєднатися», «Деталі» → розклад учня', () => {
    const w = mount(UpcomingLessonCard, {
      props: { lesson: SCHEDULED, isTutor: false },
      // tests/setup.js глушить router-link порожнім <a> — тут потрібна заглушка, що пам'ятає `to`
      global: { stubs: { 'router-link': RouterLinkStub } },
    })
    expect(w.text()).toContain('Олена Вчителька')
    expect(w.find('.status-badge').text()).toBe('Заплановано')
    expect(w.find('.join-btn').exists()).toBe(false)
    expect(w.findComponent(RouterLinkStub).props('to')).toBe('/student/schedule')
  })

  it('«Переглянути всі уроки» веде в розклад учня', () => {
    const w = mount(StudentUpcomingLessonsSection, {
      props: { upcomingLessons: [SCHEDULED] },
      global: {
        stubs: { 'router-link': RouterLinkStub, UpcomingLessonCard: true, Card: { template: '<div><slot /></div>' }, Heading: true },
        mocks: { $t: (k: string) => k },
      },
    })
    const targets = w.findAllComponents(RouterLinkStub).map((l) => l.props('to'))
    expect(targets).toContain('/student/schedule')
    expect(targets).not.toContain('/bookings')
  })
})
