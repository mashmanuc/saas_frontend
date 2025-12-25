<template>
  <div class="calendar-week-view">
    <!-- Connection status -->
    <transition name="fade">
      <div
        v-if="!connected && connectionAttempted"
        class="connection-warning"
      >
        <AlertCircleIcon class="w-4 h-4" />
        <span>{{ t('calendar.warnings.disconnected') }}</span>
        <button class="retry-btn" @click="handleReconnect">
          {{ t('calendar.realtime.status.retrying') }}
        </button>
      </div>
    </transition>

    <!-- Week Navigation -->
    <WeekNavigation
      :week-start="weekMeta?.weekStart"
      :week-end="weekMeta?.weekEnd"
      :current-page="weekMeta?.page ?? 0"
      :is-loading="isLoading"
      :total-available-hours="totalAvailableHours"
      :has-availability="hasAvailability"
      @navigate="handleNavigate"
      @today="handleToday"
      @scroll-first-available="handleScrollToFirstAvailable"
      @open-availability="handleSetupAvailability"
    />

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <LoaderIcon class="w-8 h-8 animate-spin text-blue-500" />
      <p>{{ t('calendar.loading') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <AlertCircleIcon class="w-8 h-8 text-red-500" />
      <p>{{ error }}</p>
      <button @click="handleRetry" class="btn-secondary">
        {{ t('calendar.retry') }}
      </button>
    </div>

    <!-- Empty availability state - show only if user hasn't set up availability at all -->
    <EmptyAvailabilityState v-else-if="!hasSetupAvailability" />

    <!-- Calendar Board -->
    <CalendarBoard
      v-else
      :days="daysOrdered"
      :cells="computedCells336"
      :event-layouts="eventLayouts"
      :timezone="weekMeta?.timezone ?? 'Europe/Kiev'"
      :day-availability="availableMinutesByDay"
      @cell-click="handleCellClick"
      @event-click="handleEventClick"
    />

    <!-- Modals -->
    <CreateLessonModal
      v-if="showCreateModal && selectedCell"
      :visible="showCreateModal"
      :selected-cell="selectedCell"
      @close="showCreateModal = false"
      @success="handleLessonCreated"
    />

    <EventModal
      v-if="showEventModal && selectedEventId"
      :visible="showEventModal"
      :event-id="selectedEventId"
      @close="showEventModal = false"
      @deleted="handleEventDeleted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { Loader as LoaderIcon, AlertCircle as AlertCircleIcon } from 'lucide-vue-next'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import { useCalendarWebSocket } from '@/modules/booking/composables/useCalendarWebSocket'
import { useErrorHandler } from '@/modules/booking/composables/useErrorHandler'
import { useRouter } from 'vue-router'
import CalendarBoard from './CalendarBoard.vue'
import WeekNavigation from './WeekNavigation.vue'
import EmptyAvailabilityState from './EmptyAvailabilityState.vue'
import CreateLessonModal from '../modals/CreateLessonModal.vue'
import EventModal from '../modals/EventModal.vue'
import type { CalendarCell } from '@/modules/booking/types/calendarWeek'
import '@/modules/booking/styles/calendar-theme.css'
import '@/modules/booking/styles/calendar-layout.css'
import '@/modules/booking/styles/calendar-animations.css'
import '@/modules/booking/styles/calendar-responsive.css'

const { t } = useI18n()
const router = useRouter()

const store = useCalendarWeekStore()
const { connected, connectionAttempted, connect } = useCalendarWebSocket()
const { handleError } = useErrorHandler()

const {
  weekMeta,
  daysOrdered,
  computedCells336,
  eventLayouts,
  isLoading,
  error,
  totalAvailableHours,
  totalAvailableMinutes,
  availableMinutesByDay,
  allAccessibleIds,
  allEventIds,
} = storeToRefs(store)

const hasAvailability = computed(() => {
  const minutes = totalAvailableMinutes.value || 0
  const hasSlots = allAccessibleIds.value.length > 0
  
  // Show calendar if there are any slots or if there are minutes available
  // This indicates user has set up availability template and slots are generated
  return hasSlots || minutes > 0
})

const hasSetupAvailability = computed(() => {
  // Check if user has set up availability template
  // This is a proxy check - if there are any events or slots, user has been active
  const hasEvents = allEventIds.value.length > 0
  const hasSlots = allAccessibleIds.value.length > 0
  const hasMinutes = totalAvailableMinutes.value > 0
  
  console.log('[CalendarWeekView] hasSetupAvailability check:', {
    hasEvents,
    hasSlots,
    hasMinutes,
    allEventIds: allEventIds.value.length,
    weekMeta: weekMeta.value
  })
  
  // If user has any events or slots, they've set up availability
  // Even if no slots this week, show calendar (it will be empty)
  return hasEvents || hasSlots || hasMinutes
})

const emit = defineEmits<{
  cellClick: [cell: CalendarCell]
  eventClick: [eventId: number]
}>()

const showCreateModal = ref(false)
const showEventModal = ref(false)
const selectedCell = ref<CalendarCell | null>(null)
const selectedEventId = ref<number | null>(null)

onMounted(async () => {
  try {
    await store.fetchWeek(0)
  } catch (err: any) {
    handleError(err)
  }
})

function handleNavigate(direction: -1 | 1) {
  const currentPage = weekMeta.value?.page ?? 0
  store.fetchWeek(currentPage + direction)
}

function handleToday() {
  store.fetchWeek(0)
}

function handleRetry() {
  store.fetchWeek(weekMeta.value?.page ?? 0)
}

function handleScrollToFirstAvailable() {
  const el = document.querySelector('.calendar-cell--available')
  if (el instanceof HTMLElement) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('calendar-cell--scrolled')
    setTimeout(() => el.classList.remove('calendar-cell--scrolled'), 1200)
  }
}

function handleSetupAvailability() {
  router.push({ name: 'booking-availability' }).catch(() => {})
}

function handleReconnect() {
  connect()
}

function handleCellClick(cell: CalendarCell) {
  if (cell.status === 'available' || cell.status === 'empty') {
    selectedCell.value = cell
    showCreateModal.value = true
  }
  emit('cellClick', cell)
}

function handleEventClick(eventId: number) {
  selectedEventId.value = eventId
  showEventModal.value = true
  emit('eventClick', eventId)
}

function handleLessonCreated(eventId: number) {
  console.info('[CalendarWeekView] Lesson created:', eventId)
  showCreateModal.value = false
}

function handleEventDeleted() {
  console.info('[CalendarWeekView] Event deleted')
  showEventModal.value = false
}
</script>

<style scoped>
.calendar-week-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: var(--surface-calendar, #fafafa);
  min-height: 600px;
}

.loading-state,
.error-state {
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
  background: white;
  cursor: pointer;
}

.btn-secondary:hover {
  background-color: #f3f4f6;
}

.connection-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 8px;
  color: #92400e;
  font-size: 14px;
  font-weight: 500;
}

.availability-empty-state {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}

.empty-state-card {
  background: white;
  border-radius: 16px;
  padding: 32px;
  max-width: 480px;
  text-align: center;
  box-shadow: 0 6px 24px rgba(15, 118, 110, 0.1);
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.empty-state-card h3 {
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
}

.empty-state-card p {
  color: #475569;
  font-size: 14px;
}

.empty-state-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #ecfeff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0e7490;
}

.btn-primary {
  padding: 10px 24px;
  border-radius: 999px;
  background: linear-gradient(135deg, #0ea5e9, #14b8a6);
  color: white;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.calendar-cell--scrolled {
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.4);
  transition: box-shadow 0.3s ease;
}
</style>
