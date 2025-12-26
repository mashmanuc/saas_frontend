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
    
    <div class="calendar-controls">
      <div class="calendar-legend">
        <label class="legend-item legend-item--interactive">
          <input
            v-model="showEvents"
            type="checkbox"
            class="legend-checkbox"
          />
          <span class="legend-dot legend-dot--lesson"></span>
          <span>{{ t('calendar.legend.lesson') }}</span>
        </label>
        <label class="legend-item legend-item--interactive">
          <input
            v-model="showAvailability"
            type="checkbox"
            class="legend-checkbox"
          />
          <span class="legend-dot legend-dot--availability"></span>
          <span>{{ t('calendar.legend.availability') }}</span>
        </label>
      </div>
    </div>

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

    <!-- Calendar Board with Sidebar -->
    <div v-else class="calendar-layout">
      <CalendarBoard
        class="calendar-layout__board"
        :days="daysOrdered"
        :cells="computedCells336"
        :event-layouts="showEvents ? eventLayouts : []"
        :timezone="weekMeta?.timezone ?? 'Europe/Kiev'"
        :day-availability="availableMinutesByDay"
        :availability-layouts="showAvailability ? availabilityLayouts : []"
        :slots-by-id="accessibleById"
        @cell-click="handleCellClick"
        @event-click="handleEventClick"
        @slot-click="handleSlotClick"
        @slot-edit="handleSlotEdit"
        @slot-delete="handleSlotDeleteInline"
        @slot-block="handleSlotBlock"
        @create-slot="handleCreateSlot"
      />
      <CalendarSidebar
        :events="allEvents"
        :selected-event-id="selectedEventId"
        @event-click="handleEventClick"
      />
    </div>

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

    <SlotEditorModal
      v-if="showSlotModal && selectedSlot"
      :visible="showSlotModal"
      :slot="selectedSlot"
      @close="showSlotModal = false"
      @saved="handleSlotSaved"
      @deleted="handleSlotDeleted"
    />

    <CreateSlotModal
      v-if="showCreateSlotModal && createSlotData"
      :date="createSlotData.date"
      :start="createSlotData.start"
      :end="createSlotData.end"
      @created="handleSlotCreated"
      @cancelled="showCreateSlotModal = false"
      @error="handleSlotCreateError"
    />

    <BlockSlotModal
      v-if="showBlockSlotModal && selectedSlotForBlock"
      :slot="selectedSlotForBlock"
      @blocked="handleSlotBlocked"
      @cancelled="showBlockSlotModal = false"
      @error="handleSlotBlockError"
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
import CalendarSidebar from './CalendarSidebar.vue'
import WeekNavigation from './WeekNavigation.vue'
import EmptyAvailabilityState from './EmptyAvailabilityState.vue'
import CreateLessonModal from '../modals/CreateLessonModal.vue'
import EventModal from '../modals/EventModal.vue'
import SlotEditorModal from '../modals/SlotEditorModal.vue'
import CreateSlotModal from '../availability/CreateSlotModal.vue'
import BlockSlotModal from '../availability/BlockSlotModal.vue'
import type { CalendarCell, AccessibleSlot } from '@/modules/booking/types/calendarWeek'
import '@/modules/booking/styles/calendar-theme.css'
import '@/modules/booking/styles/calendar-layout.css'
import '@/modules/booking/styles/calendar-animations.css'
import '@/modules/booking/styles/calendar-responsive.css'
import { useSlotEditor } from '@/modules/booking/composables/useSlotEditor'

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
  availabilityLayouts,
  accessibleById,
  eventsById,
  isLoading,
  error,
  totalAvailableHours,
  totalAvailableMinutes,
  availableMinutesByDay,
  allAccessibleIds,
  allEventIds,
} = storeToRefs(store)

const allEvents = computed(() => {
  return Object.values(eventsById.value)
})

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

const { deleteSlot } = useSlotEditor()

const showCreateModal = ref(false)
const showEventModal = ref(false)
const showSlotModal = ref(false)
const showCreateSlotModal = ref(false)
const showBlockSlotModal = ref(false)
const selectedCell = ref<CalendarCell | null>(null)
const selectedEventId = ref<number | null>(null)
const selectedSlot = ref<AccessibleSlot | null>(null)
const selectedSlotForBlock = ref<AccessibleSlot | null>(null)
const createSlotData = ref<{ date: string; start: string; end: string } | null>(null)

// View filters
const showEvents = ref(true)
const showAvailability = ref(true)

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

function handleSlotClick(slotId: number) {
  const slot = accessibleById.value[slotId]
  if (slot) {
    selectedSlot.value = slot
    showSlotModal.value = true
  }
}

function handleSlotSaved() {
  console.info('[CalendarWeekView] Slot saved')
  showSlotModal.value = false
  store.fetchWeek(weekMeta.value?.page ?? 0)
}

function handleSlotDeleted() {
  console.info('[CalendarWeekView] Slot deleted')
  showSlotModal.value = false
  store.fetchWeek(weekMeta.value?.page ?? 0)
}

function handleSlotEdit(slotId: number) {
  handleSlotClick(slotId)
}

async function handleSlotDeleteInline(slotId: number) {
  try {
    await deleteSlot(slotId)
    store.fetchWeek(weekMeta.value?.page ?? 0)
  } catch (error) {
    console.error('[CalendarWeekView] Failed to delete slot:', error)
  }
}

function handleSlotCreated(slot: any) {
  console.info('[CalendarWeekView] Slot created:', slot)
  showCreateSlotModal.value = false
  createSlotData.value = null
  store.fetchWeek(weekMeta.value?.page ?? 0)
}

function handleSlotCreateError(error: any) {
  console.error('[CalendarWeekView] Failed to create slot:', error)
  showCreateSlotModal.value = false
  createSlotData.value = null
}

function handleCreateSlot(data: { date: string; start: string; end: string }) {
  console.info('[CalendarWeekView] Create slot requested:', data)
  createSlotData.value = data
  showCreateSlotModal.value = true
}

function handleSlotBlock(slotId: number) {
  const slot = accessibleById.value[slotId]
  if (slot) {
    selectedSlotForBlock.value = slot as any
    showBlockSlotModal.value = true
  }
}

function handleSlotBlocked(slotId: number) {
  console.info('[CalendarWeekView] Slot blocked:', slotId)
  showBlockSlotModal.value = false
  selectedSlotForBlock.value = null
  store.fetchWeek(weekMeta.value?.page ?? 0)
}

function handleSlotBlockError(error: any) {
  console.error('[CalendarWeekView] Failed to block slot:', error)
  showBlockSlotModal.value = false
  selectedSlotForBlock.value = null
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

.calendar-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.calendar-layout__board {
  flex: 1;
  min-width: 0;
}

.calendar-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 8px;
}

.calendar-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  color: #475569;
  font-size: 13px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.legend-item--interactive {
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.legend-item--interactive:hover {
  background-color: #f1f5f9;
}

.legend-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #3b82f6;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  border: 2px solid transparent;
}

.legend-dot--lesson {
  background: #22c55e;
  border-color: #16a34a;
}

.legend-dot--availability {
  background: #fbbf24;
  border-color: #d97706;
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
