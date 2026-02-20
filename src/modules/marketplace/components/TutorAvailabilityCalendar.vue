<template>
  <div 
    class="tutor-availability-calendar" 
    data-testid="tutor-availability-calendar"
    :class="{ 'compact-view': view === 'compact' }"
  >
    <div v-if="showHeader" class="calendar-header">
      <Button
        variant="ghost"
        iconOnly
        @click="previousWeek"
        :disabled="!canGoPrevious"
        :aria-label="$t('common.previousWeek')"
      >
        <ChevronLeftIcon class="w-5 h-5" />
      </Button>
      <span class="week-label">{{ formatWeekRange(weekStart) }}</span>
      <Button
        variant="ghost"
        iconOnly
        @click="nextWeek"
        :disabled="!canGoNext"
        :aria-label="$t('common.nextWeek')"
      >
        <ChevronRightIcon class="w-5 h-5" />
      </Button>
    </div>

    <div v-if="loading" class="loading-state" data-testid="availability-loading-state">
      <LoaderIcon class="w-8 h-8 animate-spin text-blue-500" />
      <p>{{ $t('common.loading') }}</p>
    </div>

    <div v-else-if="error" class="error-state" data-testid="availability-error-state">
      <AlertCircleIcon class="w-8 h-8 text-red-500" />
      <p>{{ error }}</p>
      <Button variant="outline" @click="loadAvailability">
        {{ $t('common.retry') }}
      </Button>
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
            :disabled="!props.interactive"
            :aria-disabled="!props.interactive"
          >
            {{ formatTime(slot.start_at) }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Loader as LoaderIcon,
  AlertCircle as AlertCircleIcon,
  Calendar as CalendarIcon,
} from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
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
    interactive?: boolean
  }>(),
  {
    timezone: 'Europe/Kyiv',
    view: 'full',
    maxWeeks: 4,
    showHeader: true,
    interactive: true,
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

// FE-1: Past navigation clamp - cannot go before current week
const canGoPrevious = computed(() => {
  const today = getCurrentMonday()
  return weekStart.value.getTime() > today.getTime()
})

// FE-2: Horizon limit - cannot go beyond maxWeeks (default 4)
const canGoNext = computed(() => currentWeekOffset.value < props.maxWeeks - 1)

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000

function clampWeekStartToAllowedRange() {
  const minWeek = getCurrentMonday()
  const maxWeek = new Date(minWeek.getTime() + (props.maxWeeks - 1) * WEEK_IN_MS)

  if (weekStart.value.getTime() < minWeek.getTime()) {
    weekStart.value = minWeek
    currentWeekOffset.value = 0
    return
  }

  if (weekStart.value.getTime() > maxWeek.getTime()) {
    weekStart.value = maxWeek
    currentWeekOffset.value = props.maxWeeks - 1
    return
  }

  const diff = Math.round((weekStart.value.getTime() - minWeek.getTime()) / WEEK_IN_MS)
  currentWeekOffset.value = Math.min(Math.max(diff, 0), props.maxWeeks - 1)
}

function resetToCurrentWeek() {
  weekStart.value = getCurrentMonday()
  currentWeekOffset.value = 0
  clampWeekStartToAllowedRange()
}

onMounted(() => {
  clampWeekStartToAllowedRange()
  loadAvailability()
})

watch(() => props.tutorId, () => {
  resetToCurrentWeek()
  loadAvailability()
})

async function loadAvailability() {
  loading.value = true
  error.value = null
  
  try {
    clampWeekStartToAllowedRange()
    const response = await marketplaceApi.getTutorCalendar({
      tutorId: props.tutorId,
      weekStart: toLocalDateString(weekStart.value),
      timezone: props.timezone,
    })
    
    console.log('[TutorAvailabilityCalendar] API response:', {
      tutor_id: response.tutor_id,
      week_start: response.week_start,
      cells_count: response.cells?.length,
      cells: response.cells,
      total_slots: response.cells?.reduce((sum, day) => sum + day.slots.length, 0)
    })
    
    // Синхронізуємо weekStart з відповіддю бекенду
    if (response.week_start) {
      weekStart.value = new Date(response.week_start + 'T00:00:00')
      clampWeekStartToAllowedRange()
    }
    
    dayCells.value = response.cells || []
    
    console.log('[TutorAvailabilityCalendar] dayCells after assignment:', {
      length: dayCells.value.length,
      hasAnySlots: dayCells.value.some(day => day.slots.length > 0),
      dayCells: dayCells.value
    })
    
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
    console.error('[TutorAvailabilityCalendar] API error:', err)
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
  if (!canGoPrevious.value) return // FE-1: Guard against past navigation
  
  currentWeekOffset.value--
  const newWeekStart = new Date(weekStart.value.getTime() - 7 * 24 * 60 * 60 * 1000)
  
  // FE-1: Clamp to current Monday (never allow past)
  const today = getCurrentMonday()
  if (newWeekStart.getTime() < today.getTime()) {
    weekStart.value = today
    currentWeekOffset.value = 0
  } else {
    weekStart.value = newWeekStart
  }
  
  loadAvailability()
}

function nextWeek() {
  if (!canGoNext.value) return // FE-2: Guard against horizon overflow
  
  currentWeekOffset.value++
  weekStart.value = new Date(weekStart.value.getTime() + 7 * 24 * 60 * 60 * 1000)
  loadAvailability()
}

function handleSlotClick(slot: CalendarSlot) {
  if (!props.interactive) return

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

function toLocalDateString(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
