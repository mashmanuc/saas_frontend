import { defineStore } from 'pinia'
import lessonsApi from '../../../api/lessons'
import { useProfileStore } from '../../profile/store/profileStore'
import { useAuthStore } from '../../auth/store/authStore'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezonePlugin from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezonePlugin)

export const LESSON_STATUSES = Object.freeze({
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
})

const POLLING_INTERVAL = 30_000

function unwrapResponse(response) {
  return response?.data ?? response
}

function normalizeErrorCode(error) {
  const raw = error?.response?.data?.error?.code ?? error?.response?.data?.code
  if (!raw) return null
  return String(raw).toLowerCase().replace(/-/g, '_')
}

export const useLessonStore = defineStore('lessons', {
  state: () => ({
    items: [],
    loading: false,
    error: null,
    pollingTimer: null,
    hasMoreEvents: false,
    range: {
      start: null,
      end: null,
    },
    role: 'tutor',
    status: LESSON_STATUSES.SCHEDULED,
  }),

  getters: {
    upcomingLessons: (state) => state.items.filter((lesson) => lesson.status === LESSON_STATUSES.SCHEDULED),
  },

  actions: {
    setRange({ start, end }) {
      this.range = {
        start: start ? dayjs.utc(start).toISOString() : null,
        end: end ? dayjs.utc(end).toISOString() : null,
      }
    },
    setRole(role) {
      this.role = role
    },
    setStatus(status) {
      this.status = status
    },
    setLessons(lessons) {
      this.items = lessons
    },
    clearLessons() {
      this.items = []
    },
    setLoading(value) {
      this.loading = value
    },
    setError(message) {
      this.error = message
    },
    startPolling(fetchFn) {
      this.stopPolling()
      this.pollingTimer = setInterval(fetchFn, POLLING_INTERVAL)
    },
    stopPolling() {
      if (this.pollingTimer) {
        clearInterval(this.pollingTimer)
        this.pollingTimer = null
      }
    },

    normalizeLesson(rawLesson, fallbackTimezone) {
      const rawStartUtc = rawLesson.utc_start || rawLesson.utcStart || rawLesson.starts_at || rawLesson.start
      const rawEndUtc = rawLesson.utc_end || rawLesson.utcEnd || rawLesson.ends_at || rawLesson.end
      const start = dayjs.utc(rawStartUtc)
      const end = dayjs.utc(rawEndUtc)
      const timezone = rawLesson.timezone || fallbackTimezone
      const startLocal = rawLesson.user_local_start ? dayjs(rawLesson.user_local_start) : start.tz(timezone)
      const endLocal = rawLesson.user_local_end ? dayjs(rawLesson.user_local_end) : end.tz(timezone)
      return {
        ...rawLesson,
        timezone,
        startUtc: start.toISOString(),
        endUtc: end.toISOString(),
        startLocal: startLocal.format(),
        endLocal: endLocal.format(),
      }
    },

    resolveUserTimezone() {
      const profileStore = useProfileStore()
      const authStore = useAuthStore()
      return (
        profileStore?.settings?.timezone ||
        profileStore?.user?.timezone ||
        authStore?.user?.timezone ||
        dayjs.tz?.guess?.() ||
        'UTC'
      )
    },

    async fetchLessons(params = {}) {
      const timezone = this.resolveUserTimezone()
      if (!this.range.start || !this.range.end) {
        this.initializeRange()
      }

      const queryParams = {
        role: this.role,
        from: dayjs.utc(params.start ?? this.range.start).toISOString(),
        to: dayjs.utc(params.end ?? this.range.end).toISOString(),
      }
      if (this.status && this.status !== 'all') {
        queryParams.status = this.status
      }

      this.setLoading(true)
      this.setError(null)

      try {
        const response = await lessonsApi.listMyLessons(queryParams)
        const data = unwrapResponse(response)
        const lessonsArray = Array.isArray(data) ? data : data?.results || []
        this.items = lessonsArray.map((lesson) => this.normalizeLesson(lesson, timezone))

        this.hasMoreEvents = Boolean(data?.has_more_events)
      } catch (error) {
        const code = normalizeErrorCode(error)
        if (code === 'forbidden') {
          error.mappedMessage = 'Доступ заборонено.'
        }
        this.setError(error?.mappedMessage || error?.response?.data?.detail || 'Не вдалося завантажити уроки.')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    async createLesson(payload) {
      try {
        await lessonsApi.createLesson(payload)
        await this.fetchLessons()
      } catch (error) {
        const code = normalizeErrorCode(error)
        if (code === 'not_a_member') {
          error.mappedMessage = 'Учень не доданий до класу/немає доступу.'
        }
        if (code === 'time_conflict') {
          error.mappedMessage = 'Конфлікт часу, оберіть інший слот.'
        }
        throw error
      }
    },

    async rescheduleLesson(id, payload) {
      try {
        await lessonsApi.rescheduleLesson(id, payload)
        await this.fetchLessons()
      } catch (error) {
        const code = normalizeErrorCode(error)
        if (code === 'time_conflict') {
          error.mappedMessage = 'Конфлікт часу, оберіть інший слот.'
        }
        throw error
      }
    },

    async cancelLesson(id, payload) {
      await lessonsApi.cancelLesson(id, payload)
      await this.fetchLessons()
    },

    initializeRange() {
      const start = dayjs.utc().startOf('week').toISOString()
      const end = dayjs.utc().endOf('week').toISOString()
      this.range = { start, end }
    },
  },
})