<template>
  <div class="student-calendar-view">
    <!-- Header with navigation & filters -->
    <div class="calendar-header">
      <div class="week-navigation">
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          @click="goToPreviousWeek"
          :disabled="loading"
          :title="$t('calendar.weekNavigation.prevWeek')"
        >
          <ChevronLeftIcon :size="20" />
        </Button>
        <span class="week-range">{{ weekRangeLabel }}</span>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          @click="goToNextWeek"
          :disabled="loading"
          :title="$t('calendar.weekNavigation.nextWeek')"
        >
          <ChevronRightIcon :size="20" />
        </Button>
      </div>
      <div class="header-toolbar">
        <Button variant="outline" size="sm" @click="goToCurrentWeek" :disabled="isCurrentWeek || loading">
          {{ $t('calendar.weekNavigation.today') }}
        </Button>
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
      <Button variant="primary" @click="fetchMyCalendar">{{ $t('common.retry') }}</Button>
    </div>
    
    <!-- Unified Calendar Grid (student mode) -->
    <CalendarWeekView 
      v-else 
      mode="student" 
      :external-days="studentDays"
      :external-events="studentEvents"
    />

    <!-- Student Event Drawer -->
    <Modal :open="!!selectedEvent" :title="$t('student.calendar.eventDetails')" size="sm" @close="closeEventDrawer">
      <template v-if="selectedEvent">
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
      </template>

      <template #footer>
        <Button
          v-if="selectedEvent?.permissions?.can_message"
          variant="primary"
          @click="handleMessageTutor"
        >
          {{ $t('student.calendar.messageTutor') }}
        </Button>
        <Button
          v-if="selectedEvent?.permissions?.can_join_room"
          variant="secondary"
          :loading="joiningRoom"
          @click="handleJoinLesson"
        >
          {{ $t('student.calendar.joinLesson') }}
        </Button>
      </template>
    </Modal>
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
import 'dayjs/locale/uk'
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import Modal from '@/ui/Modal.vue'
import CalendarWeekView from '@/modules/booking/components/calendar/CalendarWeekView.vue'
import type { MyCalendarEvent, DaySnapshot, CalendarEvent as CalendarEventV055 } from '@/modules/booking/types/calendarV055'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.locale('uk')

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
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--border-color);
  background: var(--card-bg);
}

.week-navigation {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.week-range {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  min-width: 200px;
  text-align: center;
}

.header-toolbar {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.tutor-filter {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  font-size: var(--text-sm);
  cursor: pointer;
  min-width: 200px;
}

.tutor-filter:focus {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Event detail (inside Modal) */
.event-detail {
  margin-bottom: var(--space-lg);
}

.event-detail label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: var(--space-xs);
}

.event-detail p {
  font-size: var(--text-base);
  color: var(--text-primary);
  margin: 0;
}

/* Loading / Error */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: var(--space-md);
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
