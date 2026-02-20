<template>
  <div class="student-availability-calendar">
    <!-- WebSocket Disconnected Banner -->
    <div v-if="!wsConnected" class="ws-banner">
      <AlertCircle :size="20" />
      <span>{{ t('calendar.realtime.status.disconnected') }}</span>
      <Button variant="outline" size="sm" @click="reconnectWebSocket">{{ t('common.retry') }}</Button>
    </div>

    <!-- Cache Stale Banner -->
    <div v-if="state === 'cache_stale'" class="cache-banner">
      <span>{{ t('calendar.cache.staleLabel') }}</span>
      <Button variant="outline" size="sm" @click="loadAvailability">{{ t('common.retry') }}</Button>
    </div>

    <!-- Error Banner -->
    <div v-if="error && state === 'error'" class="error-banner">
      <AlertCircle :size="20" />
      <span>{{ error }}</span>
      <Button variant="outline" size="sm" @click="loadAvailability">{{ t('common.retry') }}</Button>
    </div>

    <div class="calendar-header">
      <Button variant="ghost" iconOnly :disabled="state === 'loading'" @click="navigateWeek(-1)">
        <ChevronLeft :size="20" />
      </Button>
      
      <div class="week-info">
        <h3>{{ t('calendar.weekOf', { date: formatDate(currentWeekStart) }) }}</h3>
        <span class="timezone">{{ timezone }}</span>
        <span v-if="lastSuccessfulFetch" class="last-sync">
          {{ t('calendar.lastSync') }}: {{ formatLastSync(lastSuccessfulFetch) }}
        </span>
      </div>
      
      <Button variant="ghost" iconOnly :disabled="state === 'loading'" @click="navigateWeek(1)">
        <ChevronRight :size="20" />
      </Button>
      
      <Button variant="outline" size="sm" @click="goToToday">
        {{ t('common.today') }}
      </Button>
    </div>

    <div v-if="state === 'loading'" class="calendar-skeleton">
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
      <Button variant="primary" @click="$emit('slot-selected', selectedSlot)">
        {{ t('booking.bookLesson') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Calendar, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import { availabilityApi } from '../../api/availabilityApi'
import { useWebSocket } from '@/composables/useWebSocket'
import { useCalendarDeepLink } from '@/composables/useCalendarDeepLink'
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
const { selectedDate: deepLinkDate, selectedSlotId: deepLinkSlotId, updateDeepLink } = useCalendarDeepLink()

type CalendarState = 'idle' | 'loading' | 'success' | 'cache_stale' | 'error'

const currentWeekStart = ref<string>(getMonday(new Date()))
const selectedSlot = ref<TimeSlot | null>(null)
const timezone = ref<string>(Intl.DateTimeFormat().resolvedOptions().timeZone)
const slots = ref<TimeSlot[]>([])
const state = ref<CalendarState>('idle')
const error = ref<string | null>(null)
const wsConnected = ref(true)
const lastSuccessfulFetch = ref<Date | null>(null)
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

function formatLastSync(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  
  if (minutes < 1) return t('calendar.justNow')
  if (minutes === 1) return t('calendar.oneMinuteAgo')
  if (minutes < 60) return t('calendar.minutesAgo', { count: minutes })
  return date.toLocaleTimeString()
}

function reconnectWebSocket(): void {
  wsConnected.value = true
  // Telemetry
  if (typeof window !== 'undefined' && (window as any).telemetry) {
    (window as any).telemetry.track('calendar.ws_status', { status: 'reconnecting' })
  }
}

function selectSlot(slot: TimeSlot): void {
  selectedSlot.value = slot
  
  // Update deep link
  updateDeepLink({
    calendar: props.tutorSlug,
    date: slot.date,
    slot: slot.id.toString()
  })
}

function navigateWeek(direction: number): void {
  const current = new Date(currentWeekStart.value)
  current.setDate(current.getDate() + direction * 7)
  currentWeekStart.value = getMonday(current)
  
  // Update deep link
  updateDeepLink({
    calendar: props.tutorSlug,
    date: currentWeekStart.value
  })
}

function goToToday(): void {
  currentWeekStart.value = getMonday(new Date())
}

async function loadAvailability(): Promise<void> {
  state.value = 'loading'
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
    state.value = 'success'
    lastSuccessfulFetch.value = new Date()
    
    // Save to localStorage for offline mode
    saveToCache(response.slots)
    
    // Telemetry
    if (typeof window !== 'undefined' && (window as any).telemetry) {
      (window as any).telemetry.track('calendar.week_loaded', {
        tutor_slug: props.tutorSlug,
        week_start: currentWeekStart.value,
        slot_count: response.slots.length,
        timezone: timezone.value
      })
    }
  } catch (err: any) {
    const errorMsg = err.response?.data?.detail || err.message || t('calendar.errors.loadFailed')
    error.value = errorMsg
    state.value = 'error'
    console.error('[calendar] Failed to load availability:', err)
    
    // Try to load from cache
    loadFromCache()
  }
}

function getCacheKey(): string {
  return `calendar_${props.tutorSlug}_${currentWeekStart.value}_${timezone.value}`
}

function saveToCache(slotsData: TimeSlot[]): void {
  try {
    const cacheData = {
      slots: slotsData,
      timestamp: Date.now(),
      weekStart: currentWeekStart.value,
      timezone: timezone.value
    }
    localStorage.setItem(getCacheKey(), JSON.stringify(cacheData))
  } catch (err) {
    console.warn('[calendar] Failed to save cache:', err)
  }
}

function loadFromCache(): void {
  try {
    const cached = localStorage.getItem(getCacheKey())
    if (cached) {
      const cacheData = JSON.parse(cached)
      slots.value = cacheData.slots
      state.value = 'cache_stale'
      console.info('[calendar] Loaded from cache')
    }
  } catch (err) {
    console.warn('[calendar] Failed to load cache:', err)
  }
}

watch(currentWeekStart, () => {
  loadAvailability()
})

onMounted(() => {
  // Deep link takes priority over preselectedDate
  if (deepLinkDate.value) {
    currentWeekStart.value = getMonday(deepLinkDate.value)
  } else if (props.preselectedDate) {
    currentWeekStart.value = getMonday(new Date(props.preselectedDate))
  }
  
  loadAvailability()
  
  // If deep link has slot ID, try to select it after loading
  if (deepLinkSlotId.value) {
    watch(() => slots.value, (newSlots) => {
      const slot = newSlots.find(s => s.id === deepLinkSlotId.value)
      if (slot) {
        selectSlot(slot)
      }
    }, { immediate: true })
  }
  
  // Subscribe to availability updates via WebSocket
  if (authStore.user?.id) {
    wsUnsubscribe = subscribeStudentAvailability(
      authStore.user.id,
      props.tutorSlug,
      (event) => {
        wsConnected.value = true
        
        // Telemetry
        if (typeof window !== 'undefined' && (window as any).telemetry) {
          (window as any).telemetry.track('calendar.ws_status', { status: 'connected' })
        }
        
        if (event.event === 'availability.updated') {
          loadAvailability()
        } else if (event.event === 'slot.unavailable') {
          const slotId = event.data.slot_id
          slots.value = slots.value.filter(s => s.id !== slotId)
          
          // Show toast if selected slot became unavailable
          if (selectedSlot.value?.id === slotId) {
            selectedSlot.value = null
            if (typeof window !== 'undefined' && (window as any).toast) {
              (window as any).toast.warning(t('calendar.slotBecameUnavailable'))
            }
          }
        }
      }
    )
    
    // Monitor WebSocket connection status
    const wsStatusInterval = setInterval(() => {
      // This would be enhanced with actual WebSocket status from useWebSocket
      // For now, we assume connection is good if we're subscribed
    }, 5000)
    
    // Cleanup interval on unmount
    onUnmounted(() => {
      clearInterval(wsStatusInterval)
    })
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

.error-banner,
.ws-banner,
.cache-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background-color: var(--error-bg);
  color: var(--error-text);
  border-radius: 0.5rem;
  border: 1px solid var(--error-border);
}

.ws-banner {
  background-color: var(--warning-bg);
  color: var(--warning-text);
  border-color: var(--warning-border);
}

.cache-banner {
  background-color: var(--info-bg);
  color: var(--info-text);
  border-color: var(--info-border);
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

.last-sync {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
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
