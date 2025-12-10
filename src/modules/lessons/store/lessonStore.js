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
      const rawStartUtc = rawLesson.utc_start || rawLesson.start
      const rawEndUtc = rawLesson.utc_end || rawLesson.end
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
        const lessonsArray = Array.isArray(response) ? response : response?.results || []
        this.items = lessonsArray.map((lesson) => this.normalizeLesson(lesson, timezone))

        this.hasMoreEvents = Boolean(response?.has_more_events)
      } catch (error) {
        this.setError(error?.response?.data?.detail || 'Не вдалося завантажити уроки.')
        throw error
      } finally {
        this.setLoading(false)
      }
    },

    async createLesson(payload) {
      await lessonsApi.createLesson(payload)
      await this.fetchLessons()
    },

    async rescheduleLesson(id, payload) {
      await lessonsApi.rescheduleLesson(id, payload)
      await this.fetchLessons()
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