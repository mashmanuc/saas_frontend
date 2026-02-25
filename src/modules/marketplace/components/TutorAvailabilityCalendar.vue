<template>
  <div 
    class="tutor-availability-calendar" 
    data-testid="tutor-availability-calendar"
    :class="{ 'compact-view': view === 'compact' }"
  >
    <h3 class="cal-title">{{ $t('marketplace.calendar.scheduleTitle') || 'Розклад викладача' }}</h3>

    <div v-if="showHeader" class="calendar-header">
      <span class="week-label">{{ formatWeekRange(weekStart) }}</span>
      <div class="cal-nav">
        <Button
          variant="ghost"
          iconOnly
          @click="previousWeek"
          :disabled="!canGoPrevious"
          :aria-label="$t('common.previousWeek')"
        >
          <ChevronLeftIcon class="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          iconOnly
          @click="nextWeek"
          :disabled="!canGoNext"
          :aria-label="$t('common.nextWeek')"
        >
          <ChevronRightIcon class="w-4 h-4" />
        </Button>
      </div>
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

    <div v-else class="schedule-table">
      <div class="schedule-header">
        <div
          v-for="day in dayCells"
          :key="'h-' + day.date"
          class="schedule-col-header"
          :class="{ 'is-today': isToday(day.date) }"
        >
          <span class="day-weekday">{{ formatDayWeekday(day.date) }}</span>
          <span class="day-number">{{ formatDayNumber(day.date) }}</span>
        </div>
      </div>
      <div class="schedule-body">
        <div
          v-for="day in dayCells"
          :key="day.date"
          class="schedule-column"
        >
          <button
            v-for="slot in day.slots"
            :key="slot.slot_id"
            @click="handleSlotClick(slot)"
            @keydown.enter="handleSlotClick(slot)"
            @keydown.space.prevent="handleSlotClick(slot)"
            class="schedule-slot"
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
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
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
let isMounted = false

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
  isMounted = true
  clampWeekStartToAllowedRange()
  loadAvailability()
})

onUnmounted(() => {
  isMounted = false
})

watch(() => props.tutorId, (newId, oldId) => {
  // Не тригеримо якщо id не змінився (захист від зайвих рендерів)
  if (!isMounted || newId === oldId) return
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
    
    // Синхронізуємо weekStart з відповіддю бекенду
    if (response.week_start) {
      weekStart.value = new Date(response.week_start + 'T00:00:00')
      clampWeekStartToAllowedRange()
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
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const yearStr = end.getFullYear()
  return `${start.toLocaleDateString('uk-UA', opts)}-${end.toLocaleDateString('uk-UA', opts)}, ${yearStr}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatDayWeekday(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('uk-UA', { weekday: 'short' }).toUpperCase()
}

function formatDayNumber(dateStr: string): string {
  const date = new Date(dateStr)
  return String(date.getDate())
}

function isToday(dateStr: string): boolean {
  const date = new Date(dateStr)
  const today = new Date()
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
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
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px;
  padding: 16px;
  background: var(--bg-primary, #fff);
}

.cal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0 0 12px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.week-label {
  font-size: 0.8125rem;
  color: var(--text-secondary, #6b7280);
}

.cal-nav {
  display: flex;
  gap: 2px;
}

/* ─── Schedule table (7-column grid) ─── */
.schedule-table {
  overflow-x: auto;
}

.schedule-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0;
  border-bottom: 2px solid var(--border-color, #e5e7eb);
  margin-bottom: 4px;
}

.schedule-col-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 4px;
  gap: 2px;
}

.schedule-col-header.is-today .day-number {
  background: var(--accent, #16a34a);
  color: #fff;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.day-weekday {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary, #6b7280);
  letter-spacing: 0.02em;
}

.day-number {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-primary, #111827);
}

.schedule-body {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0;
}

.schedule-column {
  display: flex;
  flex-direction: column;
  min-height: 40px;
  border-right: 1px solid var(--border-color, #f3f4f6);
}

.schedule-column:last-child {
  border-right: none;
}

.schedule-slot {
  padding: 4px 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary, #374151);
  text-align: center;
  background: transparent;
  border: none;
  cursor: default;
  transition: background-color 0.15s;
  border-radius: 4px;
  margin: 1px 2px;
}

.schedule-slot:not(:disabled):hover {
  background-color: color-mix(in srgb, var(--accent, #16a34a) 8%, transparent);
  cursor: pointer;
}

.schedule-slot:disabled {
  cursor: default;
  opacity: 1;
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

@media (max-width: 480px) {
  .schedule-header,
  .schedule-body {
    grid-template-columns: repeat(7, minmax(44px, 1fr));
  }

  .schedule-slot {
    font-size: 0.75rem;
    padding: 3px 2px;
  }
}
</style>
