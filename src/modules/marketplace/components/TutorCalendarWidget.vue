<template>
  <div class="tutor-calendar-widget">
    <h3 class="widget-title">{{ $t('marketplace.availableTimes') }}</h3>

    <div v-if="loading" class="loading-skeleton">
      <div class="skeleton-header"></div>
      <div class="skeleton-grid">
        <div v-for="i in 7" :key="i" class="skeleton-day"></div>
      </div>
    </div>

    <div v-else-if="error" class="error-state">
      <AlertCircleIcon class="w-12 h-12 text-red-500" />
      <p>{{ $t('marketplace.failedToLoadCalendar') }}</p>
      <button @click="loadCalendar" class="retry-btn">
        <RefreshCwIcon class="w-4 h-4" />
        {{ $t('common.retry') }}
      </button>
    </div>

    <div v-else-if="availableCells.length === 0" class="empty-state">
      <CalendarIcon class="w-12 h-12 text-gray-400" />
      <p>{{ $t('marketplace.noAvailableTimes') }}</p>
    </div>

    <div v-else class="calendar-container">
      <div class="week-header">
        <div v-for="day in weekDays" :key="day.date" class="day-header">
          <span class="day-name">{{ day.name }}</span>
          <span class="day-date">{{ day.date }}</span>
        </div>
      </div>

      <div class="time-grid">
        <div v-for="day in 7" :key="day" class="day-column">
          <button
            v-for="cell in getCellsForDay(day - 1)"
            :key="cell.start"
            @click="handleCellClick(cell)"
            class="time-slot"
          >
            {{ formatTime(cell.start) }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Calendar as CalendarIcon, AlertCircle as AlertCircleIcon, RefreshCw as RefreshCwIcon } from 'lucide-vue-next'
import { marketplaceApi } from '@/modules/marketplace/api/marketplace'
import type { AvailableSlot } from '@/modules/marketplace/api/marketplace'
import type { AccessibleSlot } from '@/modules/booking/types/calendarWeek'

const props = defineProps<{
  tutorId: number
  timezone: string
}>()

const emit = defineEmits<{
  bookingRequest: [cell: AccessibleSlot]
}>()

const cells = ref<AccessibleSlot[]>([])
const loading = ref(true)
const error = ref(false)
const weekStart = ref('')

const availableCells = computed(() => {
  return cells.value
})

const weekDays = computed(() => {
  if (!weekStart.value) return []
  
  const start = new Date(weekStart.value)
  const days = []
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    
    days.push({
      name: date.toLocaleDateString('uk-UA', { weekday: 'short' }),
      date: date.getDate().toString(),
    })
  }
  
  return days
})

function getWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

function getCellsForDay(dayOffset: number): AccessibleSlot[] {
  const targetDate = new Date(weekStart.value)
  targetDate.setDate(targetDate.getDate() + dayOffset)
  const dateStr = targetDate.toISOString().split('T')[0]
  
  return availableCells.value.filter(cell => {
    const cellDate = new Date(cell.start).toISOString().split('T')[0]
    return cellDate === dateStr
  })
}

function formatTime(isoTime: string): string {
  const date = new Date(isoTime)
  return date.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Adapter function to convert AvailableSlot to AccessibleSlot
function adaptAvailableSlotToAccessible(slot: AvailableSlot, index: number): AccessibleSlot {
  const startDate = new Date(slot.startAtUTC)
  const endDate = new Date(startDate.getTime() + slot.duration * 60000)
  
  return {
    id: index, // Use index as temporary ID since AvailableSlot doesn't have id
    type: 'available_slot',
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    regularity: 'single'
  }
}

async function loadCalendar() {
  loading.value = true
  error.value = false
  
  try {
    weekStart.value = getWeekStart()
    
    const data = await marketplaceApi.getTutorCalendar({
      tutorId: props.tutorId,
      weekStart: weekStart.value,
      timezone: props.timezone,
    })
    
    // Convert AvailableSlot[] to AccessibleSlot[]
    cells.value = (data.cells || []).map((slot, index) => adaptAvailableSlotToAccessible(slot, index))
  } catch (err) {
    error.value = true
    console.error('Failed to load tutor calendar:', err)
  } finally {
    loading.value = false
  }
}

function handleCellClick(cell: AccessibleSlot) {
  emit('bookingRequest', cell)
}

onMounted(() => {
  loadCalendar()
})
</script>

<style scoped>
.tutor-calendar-widget {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.widget-title {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 20px 0;
}

.loading-skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-header {
  height: 40px;
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 8px;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.skeleton-day {
  height: 200px;
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 8px;
}

@keyframes loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px 24px;
  text-align: center;
}

.error-state p,
.empty-state p {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.retry-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background-color: #3b82f6;
  color: white;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.15s;
}

.retry-btn:hover {
  background-color: #2563eb;
}

.calendar-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.week-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.day-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background-color: #f9fafb;
  border-radius: 8px;
}

.day-name {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
}

.day-date {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin-top: 4px;
}

.time-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.day-column {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.time-slot {
  padding: 8px;
  background-color: #dbeafe;
  border: 1px solid #93c5fd;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #1e40af;
  transition: all 0.15s;
  cursor: pointer;
}

.time-slot:hover {
  background-color: #bfdbfe;
  border-color: #60a5fa;
  transform: translateY(-2px);
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
}

.time-slot:active {
  transform: translateY(0);
}
</style>
