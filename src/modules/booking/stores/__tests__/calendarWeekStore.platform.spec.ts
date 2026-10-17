/**
 * К1 (власник 2026-10-17): «звідки учень» доходить до картки. Сховище тижня перебудовує учня — і раніше лишало
 * лише id та імʼя, тож `student.platform` зі знімка губилось, а учні з платформи малювались «своїми».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { getCalendarWeek } = vi.hoisted(() => ({ getCalendarWeek: vi.fn() }))
vi.mock('../../api/calendarV055Api', () => ({ calendarV055Api: { getCalendarWeek } }))

import { useCalendarWeekStore } from '../calendarWeekStore'

const ev = (id: number, platform: string | null | undefined) => ({
  id, start: '2026-10-19T18:00:00+03:00', end: '2026-10-19T19:00:00+03:00', status: 'scheduled', is_first: false,
  student: { id: id + 100, name: `Учень ${id}`, ...(platform === undefined ? {} : { platform }) },
  lesson_link: '', can_reschedule: true, can_mark_no_show: false,
})

describe('calendarWeekStore — учень «З платформи»', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('platform зі знімка лишається в учня; порожнє чи відсутнє — null', async () => {
    getCalendarWeek.mockResolvedValue({
      days: [], events: { '2026-10-19': [ev(1, 'Платформа А'), ev(2, null), ev(3, undefined), ev(4, '  ')] },
      accessible: [], blockedRanges: [], dictionaries: {}, meta: { weekStart: '2026-10-19', timezone: 'Europe/Kyiv' },
    })
    const store = useCalendarWeekStore()
    await store.fetchWeekSnapshot(578, '2026-10-19', true)
    const byId = Object.fromEntries(store.events.map((e) => [e.id, e.student.platform]))
    expect(byId).toEqual({ 1: 'Платформа А', 2: null, 3: null, 4: null })
  })
})
