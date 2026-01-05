<template>
  <div 
    class="tutor-availability-calendar" 
    data-testid="tutor-availability-calendar"
    :class="{ 'compact-view': view === 'compact' }"
  >
    <div v-if="showHeader" class="calendar-header">
      <button 
        @click="previousWeek" 
        class="btn-icon" 
        :disabled="!canGoPrevious"
        :aria-label="$t('common.previousWeek')"
      >
        <ChevronLeftIcon class="w-5 h-5" />
      </button>
      <span class="week-label">{{ formatWeekRange(weekStart) }}</span>
      <button 
        @click="nextWeek" 
        class="btn-icon" 
        :disabled="!canGoNext"
        :aria-label="$t('common.nextWeek')"
      >
        <ChevronRightIcon class="w-5 h-5" />
      </button>
    </div>

    <div v-if="loading" class="loading-state" data-testid="availability-loading-state">
      <LoaderIcon class="w-8 h-8 animate-spin text-blue-500" />
      <p>{{ $t('common.loading') }}</p>
    </div>

    <div v-else-if="error" class="error-state" data-testid="availability-error-state">
      <AlertCircleIcon class="w-8 h-8 text-red-500" />
      <p>{{ error }}</p>
      <button @click="loadAvailability" class="btn-secondary">
        {{ $t('common.retry') }}
      </button>
    </div>

    <div v-else-if="!hasAnySlots" class="empty-state" data-testid="availability-empty-state">
      <CalendarIcon class="w-12 h-12 text-gray-400" />
      <p>{{ emptyState || $t('marketplace.noAvailableSlots') }}</p>
    </div>

    <div v-else class="slots-grid">
      <div
        v-for="day in dayCells"
        :key="day.date"
        class="day-column"
      >
        <div class="day-header">
          {{ formatDate(day.date) }}
        </div>
        <div class="day-slots">
          <button
            v-for="slot in day.slots"
            :key="slot.slot_id"
            @click="handleSlotClick(slot)"
            @keydown.enter="handleSlotClick(slot)"
            @keydown.space.prevent="handleSlotClick(slot)"
            class="time-slot-btn"
            data-testid="marketplace-slot"
            :data-slot-id="slot.slot_id"
            tabindex="0"
            :aria-label="getSlotAriaLabel(slot)"
          >
            {{ formatTime(slot.start_at) }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Loader as LoaderIcon,
  AlertCircle as AlertCircleIcon,
  Calendar as CalendarIcon,
} from 'lucide-vue-next'
import marketplaceApi from '@/modules/marketplace/api/marketplace'

const { t } = useI18n()

interface CalendarSlot {
  slot_id: string
  start_at: string
  duration_min: number
  status: string
}

interface DayCell {
  date: string
  day_status: string
  slots: CalendarSlot[]
}

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}

const props = withDefaults(
  defineProps<{
    tutorId: number
    timezone?: string
    view?: 'full' | 'compact'
    maxWeeks?: number
    showHeader?: boolean
    emptyState?: string
  }>(),
  {
    timezone: 'Europe/Kyiv',
    view: 'full',
    maxWeeks: 4,
    showHeader: true,
  }
)

const emit = defineEmits<{
  slotClick: [slot: CalendarSlot]
}>()

const weekStart = ref(getCurrentMonday())
const loading = ref(true)
const error = ref<string | null>(null)
const dayCells = ref<DayCell[]>([])
const currentWeekOffset = ref(0)

const hasAnySlots = computed(() => {
  return dayCells.value.some(day => day.slots.length > 0)
})

const canGoPrevious = computed(() => true) // Allow going back to previous weeks
const canGoNext = computed(() => currentWeekOffset.value < props.maxWeeks - 1)

onMounted(() => {
  loadAvailability()
})

async function loadAvailability() {
  loading.value = true
  error.value = null
  
  // DEBUG: Check if method exists
  console.log('[TutorAvailabilityCalendar] marketplaceApi:', marketplaceApi)
  console.log('[TutorAvailabilityCalendar] getTutorCalendar exists:', typeof marketplaceApi.getTutorCalendar)
  console.log('[TutorAvailabilityCalendar] marketplaceApi keys:', Object.keys(marketplaceApi))
  
  try {
    const response = await marketplaceApi.getTutorCalendar({
      tutorId: props.tutorId,
      weekStart: weekStart.value.toISOString().split('T')[0],
      timezone: props.timezone,
    })
    
    // Синхронізуємо weekStart з відповіддю бекенду
    if (response.week_start) {
      weekStart.value = new Date(response.week_start + 'T00:00:00')
    }
    
    dayCells.value = response.cells || []
    
    // Telemetry: availability_viewed
    if (window.gtag) {
      const totalSlots = dayCells.value.reduce((sum, day) => sum + day.slots.length, 0)
      window.gtag('event', 'availability_viewed', {
        tutor_id: props.tutorId,
        week_start: response.week_start,
        slot_count: totalSlots,
      })
    }
  } catch (err: any) {
    if (err.response?.status === 422) {
      error.value = t('marketplace.calendar.errorHorizon')
    } else {
      error.value = err instanceof Error ? err.message : t('marketplace.calendar.errorLoad')
    }
  } finally {
    loading.value = false
  }
}

function previousWeek() {
  currentWeekOffset.value--
  weekStart.value = new Date(weekStart.value.getTime() - 7 * 24 * 60 * 60 * 1000)
  loadAvailability()
}

function nextWeek() {
  if (!canGoNext.value) return
  currentWeekOffset.value++
  weekStart.value = new Date(weekStart.value.getTime() + 7 * 24 * 60 * 60 * 1000)
  loadAvailability()
}

function handleSlotClick(slot: CalendarSlot) {
  // Telemetry: availability_slot_clicked
  if (window.gtag) {
    window.gtag('event', 'availability_slot_clicked', {
      tutor_id: props.tutorId,
      slot_id: slot.slot_id,
    })
  }
  emit('slotClick', slot)
}

function getCurrentMonday(): Date {
  const today = new Date()
  const dayOfWeek = today.getDay()
  // If Sunday (0), go back 6 days; otherwise go back (dayOfWeek - 1) days
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  return new Date(today.getTime() - daysToMonday * 24 * 60 * 60 * 1000)
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
  return date.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: props.timezone,
  })
}

function getSlotAriaLabel(slot: CalendarSlot): string {
  const time = formatTime(slot.start_at)
  return t('marketplace.calendar.bookSlotAria', { time })
}

// Нормалізація більше не потрібна - бекенд повертає правильний контракт
// Залишаємо тільки для backward compatibility, якщо щось прийде в старому форматі
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
