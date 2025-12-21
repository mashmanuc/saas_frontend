<template>
  <div class="student-availability-calendar">
    <div v-if="error" class="error-banner">
      <AlertCircle :size="20" />
      <span>{{ error }}</span>
      <button @click="loadAvailability" class="btn btn-sm">{{ t('common.retry') }}</button>
    </div>

    <div class="calendar-header">
      <button @click="navigateWeek(-1)" class="btn btn-ghost" :disabled="loading">
        <ChevronLeft :size="20" />
      </button>
      
      <div class="week-info">
        <h3>{{ t('calendar.weekOf', { date: formatDate(currentWeekStart) }) }}</h3>
        <span class="timezone">{{ timezone }}</span>
      </div>
      
      <button @click="navigateWeek(1)" class="btn btn-ghost" :disabled="loading">
        <ChevronRight :size="20" />
      </button>
      
      <button @click="goToToday" class="btn btn-outline btn-sm">
        {{ t('common.today') }}
      </button>
    </div>

    <div v-if="loading" class="calendar-skeleton">
      <div v-for="i in 7" :key="i" class="day-skeleton">
        <div class="skeleton-header"></div>
        <div class="skeleton-slot"></div>
        <div class="skeleton-slot"></div>
      </div>
    </div>

    <div v-else-if="slots.length === 0" class="empty-state">
      <Calendar :size="48" class="empty-icon" />
      <h4>{{ t('calendar.noSlots') }}</h4>
      <p>{{ t('calendar.noSlotsDescription') }}</p>
    </div>

    <div v-else class="calendar-grid">
      <div v-for="day in weekDays" :key="day.toISOString()" class="calendar-day">
        <div class="day-header">
          <span class="day-name">{{ formatDayName(day) }}</span>
          <span class="day-date">{{ formatDayDate(day) }}</span>
        </div>
        
        <div class="day-slots">
          <button
            v-for="slot in getSlotsForDay(day)"
            :key="slot.id"
            class="slot-button"
            :class="{ 
              'slot-selected': selectedSlot?.id === slot.id,
              'slot-available': slot.status === 'available'
            }"
            :disabled="slot.status !== 'available'"
            @click="selectSlot(slot)"
          >
            <span class="slot-time">{{ formatSlotTime(slot) }}</span>
            <span class="slot-duration">{{ slot.duration_minutes }} {{ t('common.min') }}</span>
          </button>
          
          <div v-if="getSlotsForDay(day).length === 0" class="no-slots">
            {{ t('calendar.noSlotsThisDay') }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedSlot" class="selected-slot-info">
      <div class="slot-details">
        <Calendar :size="16" />
        <span>{{ formatSlotDateTime(selectedSlot) }}</span>
      </div>
      <button @click="$emit('slot-selected', selectedSlot)" class="btn btn-primary">
        {{ t('booking.bookLesson') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Calendar, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-vue-next'
import { availabilityApi } from '../../api/availabilityApi'
import { useWebSocket } from '@/composables/useWebSocket'
import { useAuthStore } from '@/modules/auth/store/authStore'
import type { TimeSlot } from '../../api/availabilityApi'

interface Props {
  tutorSlug: string
  matchId?: string
  preselectedDate?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'slot-selected': [slot: TimeSlot]
}>()

const { t } = useI18n()
const authStore = useAuthStore()
const { subscribeStudentAvailability } = useWebSocket()

const currentWeekStart = ref<string>(getMonday(new Date()))
const selectedSlot = ref<TimeSlot | null>(null)
const timezone = ref<string>(Intl.DateTimeFormat().resolvedOptions().timeZone)
const slots = ref<TimeSlot[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
let wsUnsubscribe: (() => void) | null = null

const weekDays = computed(() => {
  const start = new Date(currentWeekStart.value)
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    return date
  })
})

function getMonday(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

function getSlotsForDay(day: Date): TimeSlot[] {
  const dateStr = day.toISOString().split('T')[0]
  return slots.value.filter(slot => slot.date === dateStr)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  })
}

function formatDayName(day: Date): string {
  return day.toLocaleDateString(undefined, { weekday: 'short' })
}

function formatDayDate(day: Date): string {
  return day.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function formatSlotTime(slot: TimeSlot): string {
  return slot.start_time.substring(0, 5)
}

function formatSlotDateTime(slot: TimeSlot): string {
  const date = new Date(slot.start_datetime)
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function selectSlot(slot: TimeSlot): void {
  selectedSlot.value = slot
}

function navigateWeek(direction: number): void {
  const current = new Date(currentWeekStart.value)
  current.setDate(current.getDate() + direction * 7)
  currentWeekStart.value = getMonday(current)
}

function goToToday(): void {
  currentWeekStart.value = getMonday(new Date())
}

async function loadAvailability(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const response = await availabilityApi.getTutorAvailability(
      props.tutorSlug,
      {
        week_start: currentWeekStart.value,
        timezone: timezone.value
      }
    )
    slots.value = response.slots
  } catch (err: any) {
    const errorMsg = err.response?.data?.detail || err.message || t('calendar.errors.loadFailed')
    error.value = errorMsg
    console.error('[calendar] Failed to load availability:', err)
  } finally {
    loading.value = false
  }
}

watch(currentWeekStart, () => {
  loadAvailability()
})

onMounted(() => {
  if (props.preselectedDate) {
    currentWeekStart.value = getMonday(new Date(props.preselectedDate))
  }
  loadAvailability()
  
  // Subscribe to availability updates via WebSocket
  if (authStore.user?.id) {
    wsUnsubscribe = subscribeStudentAvailability(
      authStore.user.id,
      props.tutorSlug,
      (event) => {
        if (event.event === 'availability.updated') {
          loadAvailability()
        } else if (event.event === 'slot.unavailable') {
          const slotId = event.data.slot_id
          slots.value = slots.value.filter(s => s.id !== slotId)
          if (selectedSlot.value?.id === slotId) {
            selectedSlot.value = null
          }
        }
      }
    )
  }
})

onUnmounted(() => {
  if (wsUnsubscribe) {
    wsUnsubscribe()
  }
})
</script>

<style scoped>
.student-availability-calendar {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background-color: var(--error-bg);
  color: var(--error-text);
  border-radius: 0.5rem;
  border: 1px solid var(--error-border);
}

.calendar-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background-color: var(--surface);
  border-radius: 0.5rem;
}

.week-info {
  flex: 1;
  text-align: center;
}

.week-info h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.timezone {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.calendar-skeleton {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
}

.day-skeleton {
  padding: 1rem;
  background-color: var(--surface);
  border-radius: 0.5rem;
}

.skeleton-header,
.skeleton-slot {
  height: 1.5rem;
  background-color: var(--border-color);
  border-radius: 0.25rem;
  margin-bottom: 0.5rem;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
}

.empty-icon {
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.empty-state h4 {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
}

.empty-state p {
  color: var(--text-secondary);
  margin: 0;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
}

.calendar-day {
  background-color: var(--surface);
  border-radius: 0.5rem;
  overflow: hidden;
}

.day-header {
  padding: 0.75rem;
  background-color: var(--surface-muted);
  border-bottom: 1px solid var(--border-color);
  text-align: center;
}

.day-name {
  display: block;
  font-weight: 600;
  font-size: 0.875rem;
}

.day-date {
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.day-slots {
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 8rem;
}

.slot-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem;
  background-color: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
}

.slot-button.slot-available:hover {
  background-color: var(--primary-bg);
  border-color: var(--primary);
}

.slot-button.slot-selected {
  background-color: var(--primary);
  color: white;
  border-color: var(--primary);
}

.slot-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.slot-time {
  font-weight: 600;
  font-size: 0.875rem;
}

.slot-duration {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.slot-selected .slot-duration {
  color: rgba(255, 255, 255, 0.8);
}

.no-slots {
  padding: 1rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.selected-slot-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background-color: var(--surface);
  border-radius: 0.5rem;
  border: 1px solid var(--primary);
}

.slot-details {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}

@media (max-width: 768px) {
  .calendar-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 480px) {
  .calendar-grid {
    grid-template-columns: 1fr;
  }
}
</style>
