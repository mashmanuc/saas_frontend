<template>
  <div class="tutor-availability-calendar">
    <div class="calendar-header">
      <button @click="previousWeek" class="btn-icon" aria-label="Previous week">
        <ChevronLeftIcon class="w-5 h-5" />
      </button>
      <span class="week-label">{{ formatWeekRange(weekStart) }}</span>
      <button @click="nextWeek" class="btn-icon" aria-label="Next week">
        <ChevronRightIcon class="w-5 h-5" />
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <LoaderIcon class="w-8 h-8 animate-spin text-blue-500" />
      <p>{{ $t('common.loading') }}</p>
    </div>

    <div v-else-if="error" class="error-state">
      <AlertCircleIcon class="w-8 h-8 text-red-500" />
      <p>{{ error }}</p>
      <button @click="loadAvailability" class="btn-secondary">
        {{ $t('common.retry') }}
      </button>
    </div>

    <div v-else-if="groupedSlots.length === 0" class="empty-state">
      <CalendarIcon class="w-12 h-12 text-gray-400" />
      <p>{{ $t('marketplace.noAvailableSlots') }}</p>
    </div>

    <div v-else class="slots-grid">
      <div
        v-for="day in groupedSlots"
        :key="day.date"
        class="day-column"
      >
        <div class="day-header">
          {{ formatDate(day.date) }}
        </div>
        <div class="day-slots">
          <button
            v-for="slot in day.slots"
            :key="slot.startAtUTC"
            @click="handleSlotClick(slot)"
            class="time-slot-btn"
          >
            {{ formatTime(slot.startAtUTC) }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Loader as LoaderIcon,
  AlertCircle as AlertCircleIcon,
  Calendar as CalendarIcon,
} from 'lucide-vue-next'
import { marketplaceApi, type AvailableSlot } from '@/modules/marketplace/api/marketplace'

const props = defineProps<{
  tutorId: number
  timezone?: string
}>()

const emit = defineEmits<{
  slotClick: [slot: AvailableSlot]
}>()

const weekStart = ref(getNextMonday())
const loading = ref(false)
const error = ref<string | null>(null)
const slots = ref<AvailableSlot[]>([])

const groupedSlots = computed(() => {
  const groups = new Map<string, AvailableSlot[]>()
  
  for (const slot of slots.value) {
    const date = slot.startAtUTC.split('T')[0]
    if (!groups.has(date)) {
      groups.set(date, [])
    }
    groups.get(date)!.push(slot)
  }
  
  return Array.from(groups.entries())
    .map(([date, slots]) => ({
      date,
      slots: slots.sort((a, b) => a.startAtUTC.localeCompare(b.startAtUTC)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
})

onMounted(() => {
  loadAvailability()
})

async function loadAvailability() {
  loading.value = true
  error.value = null
  
  try {
    const response = await marketplaceApi.getTutorCalendar({
      tutorId: props.tutorId,
      weekStart: weekStart.value.toISOString().split('T')[0],
      timezone: props.timezone || 'Europe/Kiev',
    })
    
    slots.value = response.cells || []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load availability'
  } finally {
    loading.value = false
  }
}

function previousWeek() {
  weekStart.value = new Date(weekStart.value.getTime() - 7 * 24 * 60 * 60 * 1000)
  loadAvailability()
}

function nextWeek() {
  weekStart.value = new Date(weekStart.value.getTime() + 7 * 24 * 60 * 60 * 1000)
  loadAvailability()
}

function handleSlotClick(slot: AvailableSlot) {
  emit('slotClick', slot)
}

function getNextMonday(): Date {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  return new Date(today.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000)
}

function formatWeekRange(start: Date): string {
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000)
  return `${start.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatTime(utcTime: string): string {
  const date = new Date(utcTime)
  const tz = props.timezone || 'Europe/Kiev'
  return date.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  })
}
</script>

<style scoped>
.tutor-availability-calendar {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.week-label {
  font-size: 16px;
  font-weight: 600;
}

.btn-icon {
  padding: 8px;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.btn-icon:hover {
  background-color: #f3f4f6;
}

.slots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 16px;
}

.day-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.day-header {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.day-slots {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.time-slot-btn {
  padding: 8px 12px;
  background-color: #10b981;
  color: white;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.time-slot-btn:hover {
  background-color: #059669;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px;
  text-align: center;
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-secondary:hover {
  background-color: #f3f4f6;
}
</style>
