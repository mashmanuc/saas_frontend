import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezonePlugin from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezonePlugin)

const lessonsApiMock = vi.hoisted(() => ({
  listMyLessons: vi.fn(),
  createLesson: vi.fn(),
  rescheduleLesson: vi.fn(),
  cancelLesson: vi.fn(),
}))

vi.mock('../../src/api/lessons', () => ({
  default: lessonsApiMock,
}))

const profileStoreMock = vi.hoisted(() => ({
  settings: { timezone: 'Europe/Kyiv' },
  user: { timezone: 'Europe/Kyiv' },
}))

const authStoreMock = vi.hoisted(() => ({
  user: { timezone: 'Europe/Warsaw' },
}))

vi.mock('../../src/modules/profile/store/profileStore', () => ({
  useProfileStore: () => profileStoreMock,
}))

vi.mock('../../src/modules/auth/store/authStore', () => ({
  useAuthStore: () => authStoreMock,
}))

import { useLessonStore } from '../../src/modules/lessons/store/lessonStore'

describe('lessonStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    profileStoreMock.settings.timezone = 'Europe/Kyiv'
    profileStoreMock.user.timezone = 'Europe/Kyiv'
    authStoreMock.user.timezone = 'Europe/Warsaw'
  })

  it('fetchLessons loads data with UTC/local conversions', async () => {
    const store = useLessonStore()
    const start = '2024-01-01T09:00:00.000Z'
    const end = '2024-01-01T10:30:00.000Z'
    const range = {
      start: '2024-01-01T00:00:00.000Z',
      end: '2024-01-07T00:00:00.000Z',
    }
    store.setRange(range)

    lessonsApiMock.listMyLessons.mockResolvedValueOnce([
      { id: 42, start, end, status: 'scheduled', student: { name: 'Ada' } },
    ])

    await store.fetchLessons()

    expect(lessonsApiMock.listMyLessons).toHaveBeenCalledWith({
      role: 'tutor',
      from: range.start,
      to: range.end,
      status: 'scheduled',
    })

    expect(store.items).toHaveLength(1)
    const [lesson] = store.items
    expect(lesson.startUtc).toBe(start)
    expect(lesson.endUtc).toBe(end)
    expect(dayjs(lesson.startLocal).utc().toISOString()).toBe(start)
    expect(dayjs(lesson.endLocal).utc().toISOString()).toBe(end)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('fetchLessons records backend error message', async () => {
    const store = useLessonStore()
    lessonsApiMock.listMyLessons.mockRejectedValueOnce({
      response: { data: { detail: 'Server unavailable' } },
    })

    await expect(store.fetchLessons()).rejects.toBeDefined()
    expect(store.error).toBe('Server unavailable')
    expect(store.loading).toBe(false)
  })

  it('create/reschedule/cancel lesson actions proxy to API and refresh list', async () => {
    const store = useLessonStore()
    const fetchSpy = vi.spyOn(store, 'fetchLessons').mockResolvedValue()

    lessonsApiMock.createLesson.mockResolvedValueOnce({})
    await store.createLesson({ start: 'a', end: 'b' })
    expect(lessonsApiMock.createLesson).toHaveBeenCalledWith({ start: 'a', end: 'b' })

    lessonsApiMock.rescheduleLesson.mockResolvedValueOnce({})
    await store.rescheduleLesson(15, { start: 'c', end: 'd' })
    expect(lessonsApiMock.rescheduleLesson).toHaveBeenCalledWith(15, { start: 'c', end: 'd' })

    lessonsApiMock.cancelLesson.mockResolvedValueOnce({})
    await store.cancelLesson(15, { reason: 'student' })
    expect(lessonsApiMock.cancelLesson).toHaveBeenCalledWith(15, { reason: 'student' })

    expect(fetchSpy).toHaveBeenCalledTimes(3)
    fetchSpy.mockRestore()
  })

  it('initializeRange populates current week boundaries', () => {
    const store = useLessonStore()
    store.initializeRange()

    const expectedStart = dayjs.utc().startOf('week').toISOString()
    const expectedEnd = dayjs.utc().endOf('week').toISOString()

    expect(store.range.start).toBe(expectedStart)
    expect(store.range.end).toBe(expectedEnd)
  })

  it('startPolling schedules interval and stopPolling clears it', () => {
    vi.useFakeTimers()
    const store = useLessonStore()
    const fetchFn = vi.fn()

    store.startPolling(fetchFn)
    expect(store.pollingTimer).not.toBeNull()

    vi.advanceTimersByTime(30_000)
    expect(fetchFn).toHaveBeenCalledTimes(1)

    store.stopPolling()
    expect(store.pollingTimer).toBeNull()

    vi.useRealTimers()
  })
})
