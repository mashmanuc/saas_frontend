<template>
  <div class="student-calendar-wrapper">
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>{{ $t('calendar.loading') }}</p>
    </div>

    <div v-else-if="error" class="error-state">
      <p class="error-message">{{ error }}</p>
      <button @click="fetchCalendar" class="btn-retry">
        {{ $t('common.retry') }}
      </button>
    </div>

    <div v-else class="calendar-container">
      <div class="calendar-header">
        <h1>{{ $t('student.calendar.title') }}</h1>
        <div class="calendar-controls">
          <select v-model="selectedTutorId" class="tutor-filter">
            <option :value="null">{{ $t('student.calendar.allTutors') }}</option>
            <option v-for="tutor in uniqueTutors" :key="tutor.id" :value="tutor.id">
              {{ tutor.name }}
            </option>
          </select>
        </div>
      </div>

      <div class="calendar-grid">
        <div class="week-navigation">
          <button @click="previousWeek" class="btn-nav">
            <span>←</span>
          </button>
          <div class="week-label">
            {{ weekLabel }}
          </div>
          <button @click="nextWeek" class="btn-nav">
            <span>→</span>
          </button>
        </div>

        <div class="events-list">
          <div
            v-for="event in filteredEvents"
            :key="event.id"
            class="event-card"
            @click="openEventDrawer(event)"
          >
            <div class="event-time">
              {{ formatTime(event.start) }} - {{ formatTime(event.end) }}
            </div>
            <div class="event-tutor">
              {{ event.tutor?.name || $t('common.unknown') }}
            </div>
            <div class="event-status" :class="`status-${event.status}`">
              {{ $t(`calendar.status.${event.status}`) }}
            </div>
          </div>

          <div v-if="filteredEvents.length === 0" class="empty-state">
            <p>{{ $t('student.calendar.noEvents') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Event Drawer -->
    <div v-if="selectedEvent" class="event-drawer" @click.self="closeEventDrawer">
      <div class="drawer-content">
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
              @click="openChat"
              class="btn-primary"
            >
              {{ $t('student.calendar.messageTutor') }}
            </button>

            <button
              v-if="selectedEvent.permissions?.can_join_room"
              @click="joinRoom"
              class="btn-secondary"
            >
              {{ $t('student.calendar.joinRoom') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { calendarV055Api } from '@/modules/booking/api/calendarV055Api'
import type { MyCalendarEvent } from '@/modules/booking/types/calendarV055'

const router = useRouter()

const loading = ref(false)
const error = ref<string | null>(null)
const events = ref<MyCalendarEvent[]>([])
const selectedEvent = ref<MyCalendarEvent | null>(null)
const selectedTutorId = ref<number | null>(null)
const currentWeekStart = ref(new Date())

const uniqueTutors = computed(() => {
  const tutorMap = new Map<number, { id: number; name: string }>()
  events.value.forEach(event => {
    if (event.tutor) {
      tutorMap.set(event.tutor.id, event.tutor)
    }
  })
  return Array.from(tutorMap.values()).sort((a, b) => a.name.localeCompare(b.name))
})

const filteredEvents = computed(() => {
  if (selectedTutorId.value === null) {
    return events.value
  }
  return events.value.filter(event => event.tutor?.id === selectedTutorId.value)
})

const weekLabel = computed(() => {
  const start = new Date(currentWeekStart.value)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
  }
  
  return `${formatDate(start)} - ${formatDate(end)}`
})

async function fetchCalendar() {
  loading.value = true
  error.value = null

  try {
    const start = new Date(currentWeekStart.value)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)

    const response = await calendarV055Api.getMyCalendar({
      from: start.toISOString(),
      to: end.toISOString(),
      tz: 'Europe/Kiev'
    })

    events.value = response.results
  } catch (err: any) {
    error.value = err.message || 'Failed to load calendar'
    console.error('[StudentCalendarView] Error fetching calendar:', err)
  } finally {
    loading.value = false
  }
}

function previousWeek() {
  const newStart = new Date(currentWeekStart.value)
  newStart.setDate(newStart.getDate() - 7)
  currentWeekStart.value = newStart
  fetchCalendar()
}

function nextWeek() {
  const newStart = new Date(currentWeekStart.value)
  newStart.setDate(newStart.getDate() + 7)
  currentWeekStart.value = newStart
  fetchCalendar()
}

function openEventDrawer(event: MyCalendarEvent) {
  selectedEvent.value = event
}

function closeEventDrawer() {
  selectedEvent.value = null
}

function openChat() {
  if (!selectedEvent.value?.tutor) return
  
  // Navigate to chat with tutor
  router.push({
    name: 'chat',
    params: { userId: selectedEvent.value.tutor.id }
  })
}

function joinRoom() {
  if (!selectedEvent.value?.room) return
  
  // Open room (future implementation)
  console.log('[StudentCalendarView] Join room:', selectedEvent.value.room)
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

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

onMounted(() => {
  currentWeekStart.value = getMonday(new Date())
  fetchCalendar()
})
</script>

<style scoped>
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
