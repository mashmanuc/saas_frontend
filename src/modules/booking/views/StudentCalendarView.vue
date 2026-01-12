<template>
  <div class="student-calendar-view">
    <!-- Header with Tutor Filter -->
    <div class="calendar-header">
      <div class="calendar-header-left">
        <h1>{{ $t('student.calendar.title') }}</h1>
        <div class="week-nav">
          <button class="nav-btn" @click="goToPreviousWeek" :disabled="loading">
            ‹
          </button>
          <span class="week-range">{{ weekRangeLabel }}</span>
          <button class="nav-btn" @click="goToNextWeek" :disabled="loading">
            ›
          </button>
          <button class="today-btn" @click="goToCurrentWeek" :disabled="isCurrentWeek || loading">
            {{ $t('calendar.today') }}
          </button>
        </div>
      </div>
      <div class="calendar-controls">
        <select v-model="selectedTutorId" class="tutor-filter">
          <option :value="null">{{ $t('student.calendar.allTutors') }}</option>
          <option v-for="tutor in uniqueTutors" :key="tutor.id" :value="tutor.id">
            {{ tutor.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- Loading/Error States -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>{{ $t('calendar.loading') }}</p>
    </div>
    
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button @click="fetchMyCalendar" class="btn-retry">{{ $t('common.retry') }}</button>
    </div>
    
    <!-- Unified Calendar Grid (student mode) -->
    <CalendarWeekView 
      v-else 
      mode="student" 
      :external-days="studentDays"
      :external-events="studentEvents"
    />

    <!-- Student Event Drawer -->
    <Teleport to="body">
      <div v-if="selectedEvent" class="student-event-drawer-overlay" @click.self="closeEventDrawer">
        <div class="student-event-drawer">
          <div class="drawer-header">
            <h2>{{ $t('student.calendar.eventDetails') }}</h2>
            <button @click="closeEventDrawer" class="btn-close">×</button>
          </div>

          <div class="drawer-body">
            <div class="event-detail">
              <label>{{ $t('calendar.time') }}</label>
              <p>{{ formatDateTime(selectedEvent.start) }} - {{ formatTime(selectedEvent.end) }}</p>
            </div>

            <div class="event-detail">
              <label>{{ $t('calendar.tutor') }}</label>
              <p>{{ selectedEvent.tutor?.name || $t('common.unknown') }}</p>
            </div>

            <div class="event-detail">
              <label>{{ $t('calendar.status') }}</label>
              <p>{{ $t(`calendar.status.${selectedEvent.status}`) }}</p>
            </div>

            <div class="drawer-actions">
              <button
                v-if="selectedEvent.permissions?.can_message"
                @click="handleMessageTutor"
                class="btn-primary"
              >
                {{ $t('student.calendar.messageTutor') }}
              </button>

              <button
                v-if="selectedEvent.permissions?.can_join_room"
                @click="handleJoinLesson"
                class="btn-secondary"
                :disabled="joiningRoom"
              >
                {{ joiningRoom ? $t('common.loading') : $t('student.calendar.joinLesson') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import { calendarV055Api } from '@/modules/booking/api/calendarV055Api'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import CalendarWeekView from '@/modules/booking/components/calendar/CalendarWeekView.vue'
import type { MyCalendarEvent, DaySnapshot, CalendarEvent as CalendarEventV055 } from '@/modules/booking/types/calendarV055'

dayjs.extend(utc)
dayjs.extend(timezone)

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

const selectedEvent = ref<MyCalendarEvent | null>(null)
const selectedTutorId = ref<number | null>(null)
const joiningRoom = ref(false)
const myEvents = ref<MyCalendarEvent[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const STUDENT_TIMEZONE = 'Europe/Kiev'

function getMondayStart(date: dayjs.Dayjs) {
  const tzDate = date.tz(STUDENT_TIMEZONE)
  const dayOfWeek = tzDate.day() // 0 = Sunday, 1 = Monday
  const daysFromMonday = (dayOfWeek + 6) % 7
  return tzDate.subtract(daysFromMonday, 'day').startOf('day')
}

const currentWeekStart = ref(getMondayStart(dayjs()))
const currentWeekEnd = computed(() => currentWeekStart.value.add(6, 'day'))
const weekRangeLabel = computed(() => {
  const start = currentWeekStart.value
  const end = currentWeekEnd.value
  const sameMonth = start.month() === end.month()
  const startFormat = start.format('DD MMM')
  const endFormat = end.format(sameMonth ? 'DD MMM YYYY' : 'DD MMM YYYY')
  return `${startFormat} — ${endFormat}`
})
const isCurrentWeek = computed(() => {
  const todayMonday = getMondayStart(dayjs())
  return todayMonday.isSame(currentWeekStart.value, 'day')
})

// Extract unique tutors from my calendar events
const uniqueTutors = computed(() => {
  const tutorMap = new Map<number, { id: number; name: string }>()
  
  myEvents.value.forEach(event => {
    if (event.tutor) {
      tutorMap.set(event.tutor.id, { id: event.tutor.id, name: event.tutor.name || 'Unknown' })
    }
  })
  
  return Array.from(tutorMap.values()).sort((a, b) => a.name.localeCompare(b.name))
})

// Filter events by selected tutor (local filter)
const filteredEvents = computed(() => {
  if (selectedTutorId.value === null) {
    return myEvents.value
  }
  return myEvents.value.filter(event => event.tutor?.id === selectedTutorId.value)
})

// Step 3.2: Build studentDays (7 days: Monday → Sunday)
const studentDays = computed<DaySnapshot[]>(() => {
  const start = currentWeekStart.value
  const days: DaySnapshot[] = []
  for (let i = 0; i < 7; i++) {
    const day = start.add(i, 'day')
    const dateStr = day.format('YYYY-MM-DD')
    const eventsCount = filteredEvents.value.filter(e => e.start.startsWith(dateStr)).length
    days.push({
      date: dateStr,
      dayStatus: 'working',
      eventsCount,
      availableMinutes: 0,
      isPast: day.endOf('day').isBefore(dayjs())
    })
  }
  return days
})

// Step 3.3: Build studentEvents (map MyCalendarEvent → CalendarEventV055)
const studentEvents = computed<CalendarEventV055[]>(() => {
  return filteredEvents.value.map(event => ({
    id: event.id,
    start: event.start,
    end: event.end,
    status: event.status as CalendarEventV055['status'],
    is_first: false,
    student: event.student || { id: 0, name: 'Unknown' },
    lesson_link: '',
    can_reschedule: false,
    can_mark_no_show: false,
    clientName: event.tutor?.name || 'Tutor',
    // Store tutor info in student field for rendering (will show in grid)
    // Note: CalendarEventV055 expects 'student' field, but for student view we show tutor name
  }))
})

function closeEventDrawer() {
  selectedEvent.value = null
}

async function handleMessageTutor() {
  if (!selectedEvent.value?.tutor) return
  
  // Navigate to existing chat/relations flow (v0.69 People Contacts)
  // Use negotiation chat or relations depending on what exists
  router.push({
    path: `/chat/tutor/${selectedEvent.value.tutor.id}`
  }).catch(() => {
    // Fallback to beta people if route doesn't exist
    router.push('/beta/people')
  })
  
  closeEventDrawer()
}

async function handleJoinLesson() {
  if (!selectedEvent.value) return
  
  joiningRoom.value = true
  
  try {
    // Call backend join endpoint (v0.70)
    const response = await calendarV055Api.joinEventRoom(selectedEvent.value.id)
    
    // Navigate to classroom using backend-provided URL
    if (response.room?.url) {
      router.push(response.room.url)
      closeEventDrawer()
    } else {
      console.error('[StudentCalendarView] No room URL in response:', response)
      alert(t('student.calendar.joinError'))
    }
  } catch (err: any) {
    console.error('[StudentCalendarView] Error joining room:', err)
    
    // Handle specific error codes from backend (v0.71 spec)
    const errorCode = err?.response?.data?.code
    const statusCode = err?.response?.status
    let errorMessage = t('student.calendar.joinError')
    
    // Map backend error codes to i18n keys
    if (statusCode === 409 || errorCode === 'room_not_available_yet') {
      errorMessage = t('student.calendar.tooEarly')
    } else if (statusCode === 410 || errorCode === 'room_expired') {
      errorMessage = t('student.calendar.expired')
    } else if (statusCode === 403 || errorCode === 'not_event_participant') {
      errorMessage = t('student.calendar.noAccess')
    } else if (statusCode === 404 || errorCode === 'event_not_found') {
      errorMessage = t('student.calendar.notFound')
    }
    
    alert(errorMessage)
  } finally {
    joiningRoom.value = false
  }
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function fetchMyCalendar() {
  loading.value = true
  error.value = null
  
  try {
    const weekStart = currentWeekStart.value
    const weekEnd = currentWeekEnd.value
    const from = weekStart.toDate().toISOString()
    const to = weekEnd.endOf('day').toDate().toISOString()

    const response = await calendarV055Api.getMyCalendar({
      from,
      to,
      tz: STUDENT_TIMEZONE
    })
    
    myEvents.value = response.results
    console.log('[StudentCalendarView] Fetched events:', response.results.length)
  } catch (err: any) {
    error.value = err.message || 'Failed to load calendar'
    console.error('[StudentCalendarView] Error fetching calendar:', err)
  } finally {
    loading.value = false
  }
}

watch(currentWeekStart, () => {
  fetchMyCalendar()
  console.log('[StudentCalendarView] Fetching week starting', currentWeekStart.value.format('YYYY-MM-DD'))
}, { immediate: true })

function goToPreviousWeek() {
  currentWeekStart.value = currentWeekStart.value.subtract(1, 'week')
}

function goToNextWeek() {
  currentWeekStart.value = currentWeekStart.value.add(1, 'week')
}

function goToCurrentWeek() {
  currentWeekStart.value = getMondayStart(dayjs())
}
</script>

<style scoped>
.student-calendar-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  background: var(--bg-primary, #ffffff);
}

.calendar-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.calendar-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.tutor-filter {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 0.375rem;
  background: var(--bg-primary, #ffffff);
  font-size: 0.875rem;
  cursor: pointer;
  min-width: 200px;
}

.tutor-filter:focus {
  outline: 2px solid var(--accent-color, #3b82f6);
  outline-offset: 2px;
}

/* Student Event Drawer */
.student-event-drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.student-event-drawer {
  background: var(--bg-primary, #ffffff);
  border-radius: 0.5rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.drawer-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  color: var(--text-secondary, #6b7280);
  transition: color 0.2s;
}

.btn-close:hover {
  color: var(--text-primary, #111827);
}

.drawer-body {
  padding: 1.5rem;
}

.event-detail {
  margin-bottom: 1.5rem;
}

.event-detail label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 0.5rem;
}

.event-detail p {
  font-size: 1rem;
  color: var(--text-primary, #111827);
  margin: 0;
}

.drawer-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 2rem;
}

.btn-primary,
.btn-secondary {
  flex: 1;
  padding: 0.75rem 1.5rem;
  border-radius: 0.375rem;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: var(--accent-color, #3b82f6);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover, #2563eb);
}

.btn-secondary {
  background: var(--bg-secondary, #f3f4f6);
  color: var(--text-primary, #111827);
  border: 1px solid var(--border-color, #e5e7eb);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-tertiary, #e5e7eb);
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.student-calendar-wrapper {
  padding: 24px;
  min-height: calc(100vh - 64px);
  background: var(--surface-calendar, #f5f7fa);
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 16px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-message {
  color: #dc2626;
  font-size: 16px;
}

.btn-retry {
  padding: 12px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
}

.btn-retry:hover {
  background: #2563eb;
}

.calendar-container {
  max-width: 1200px;
  margin: 0 auto;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.calendar-header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #111827;
}

.calendar-controls {
  display: flex;
  gap: 12px;
}

.tutor-filter {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  font-size: 14px;
  cursor: pointer;
}

.tutor-filter:focus {
  outline: none;
  border-color: #3b82f6;
}

.calendar-grid {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.week-navigation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.btn-nav {
  padding: 8px 16px;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s;
}

.btn-nav:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.week-label {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.event-card {
  padding: 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.event-card:hover {
  background: #f3f4f6;
  border-color: #3b82f6;
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.event-time {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
}

.event-tutor {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 8px;
}

.event-status {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-scheduled {
  background: #dbeafe;
  color: #1e40af;
}

.status-completed {
  background: #d1fae5;
  color: #065f46;
}

.status-cancelled {
  background: #fee2e2;
  color: #991b1b;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: #6b7280;
}

.event-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: flex-end;
  z-index: 1000;
}

.drawer-content {
  width: 100%;
  max-width: 480px;
  background: white;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.drawer-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.btn-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  font-size: 28px;
  color: #6b7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.btn-close:hover {
  background: #f3f4f6;
}

.drawer-body {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.event-detail {
  margin-bottom: 24px;
}

.event-detail label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: #6b7280;
  margin-bottom: 8px;
}

.event-detail p {
  margin: 0;
  font-size: 16px;
  color: #111827;
}

.drawer-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 32px;
}

.btn-primary,
.btn-secondary {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: white;
  color: #3b82f6;
  border: 1px solid #3b82f6;
}

.btn-secondary:hover {
  background: #eff6ff;
}
</style>
