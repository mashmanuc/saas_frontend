<template>
  <div class="calendar-week-view">
    <!-- Connection status -->
    <div v-if="!connected" class="connection-warning">
      <AlertCircleIcon class="w-4 h-4" />
      <span>{{ t('calendar.warnings.disconnected') }}</span>
    </div>

    <!-- Week Navigation -->
    <WeekNavigation
      :week-start="weekMeta?.weekStart"
      :week-end="weekMeta?.weekEnd"
      :current-page="weekMeta?.page ?? 0"
      :is-loading="isLoading"
      @navigate="handleNavigate"
      @today="handleToday"
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

    <!-- Calendar Board -->
    <CalendarBoard
      v-else
      :days="daysOrdered"
      :cells="computedCells336"
      :event-layouts="eventLayouts"
      :timezone="weekMeta?.timezone ?? 'Europe/Kiev'"
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
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { Loader as LoaderIcon, AlertCircle as AlertCircleIcon } from 'lucide-vue-next'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import { useCalendarWebSocket } from '@/modules/booking/composables/useCalendarWebSocket'
import { useErrorHandler } from '@/modules/booking/composables/useErrorHandler'
import CalendarBoard from './CalendarBoard.vue'
import WeekNavigation from './WeekNavigation.vue'
import CreateLessonModal from '../modals/CreateLessonModal.vue'
import EventModal from '../modals/EventModal.vue'
import type { CalendarCell } from '@/modules/booking/types/calendarWeek'
import '@/modules/booking/styles/calendar-theme.css'
import '@/modules/booking/styles/calendar-layout.css'
import '@/modules/booking/styles/calendar-animations.css'
import '@/modules/booking/styles/calendar-responsive.css'

const { t } = useI18n()

const store = useCalendarWeekStore()
const { connected } = useCalendarWebSocket()
const { handleError } = useErrorHandler()

const {
  weekMeta,
  daysOrdered,
  computedCells336,
  eventLayouts,
  isLoading,
  error,
} = storeToRefs(store)

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
</style>
