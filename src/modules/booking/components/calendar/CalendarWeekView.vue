<template>
  <div class="calendar-week-view" data-testid="calendar-week-view">
    <!-- Debug Panel (only in debug mode) -->
    <CalendarDebugPanel v-if="isDebugMode" />
    
    <!-- Connection status -->
    <transition name="fade">
      <div
        v-if="!connected && connectionAttempted"
        class="connection-warning"
      >
        <AlertCircleIcon class="w-4 h-4" />
        <span>{{ t('calendar.warnings.disconnected') }}</span>
        <Button variant="outline" size="sm" @click="handleReconnect">
          {{ t('calendar.realtime.status.retrying') }}
        </Button>
      </div>
    </transition>

    <div class="draft-changes-wrapper">
      <DraftChangesBar />
    </div>

    <div class="calendar-controls">
      <DebugToggleButton v-if="isDebugMode" />
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
      <Button variant="outline" @click="handleRetry">
        {{ t('calendar.retry') }}
      </Button>
    </div>

    <!-- Empty availability state - disabled: duplicate message exists elsewhere -->

    <!-- NEW Calendar Board V2 -->
    <div class="calendar-v055-layout">
      <!-- Week Navigation -->
      <WeekNavigation
        v-if="!isAvailabilityMode && props.mode === 'tutor'"
        :week-start="weekStartForNav"
        :week-end="weekEndForNav"
        :current-page="currentPageForNav"
        :is-loading="isLoadingV055"
        :total-available-hours="totalAvailableHours"
        :has-availability="hasAvailability"
        @navigate="handleNavigate"
        @today="handleToday"
        @scroll-first-available="handleScrollToFirstAvailable"
        @open-availability="handleSetupAvailability"
        @create-slot="handleCreateSlotFromToolbar"
        @show-guide="showGuideModal = true"
        @mark-free-time="handleEnterAvailabilityMode"
      />

      <div v-if="isLoadingV055" class="loading-state">
        <LoaderIcon class="w-8 h-8 animate-spin text-blue-500" />
        <p>{{ t('calendar.loading') }}</p>
      </div>
      <div v-else-if="errorV055" class="error-state">
        <AlertCircleIcon class="w-8 h-8 text-red-500" />
        <p>{{ errorV055 }}</p>
        <Button variant="outline" @click="fetchV055Snapshot()">
          {{ t('calendar.retry') }}
        </Button>
      </div>
      <template v-else>
        <CalendarBoardV2 
          :key="weekStartForNav"
          :days="daysToRender"
          :events="eventsToRender"
          :accessible-slots="accessibleSlotsComputed"
          :timezone="metaV055?.timezone || 'UTC'"
          :blocked-ranges="blockedRangesV055Computed"
          :current-time="currentTimeV055"
          :is-drag-enabled="dragEnabled && !isAvailabilityMode && props.mode === 'tutor'"
          :availability-mode="isAvailabilityMode"
          :draft-slots="draftStore.slots"
          @event-click="handleEventClick"
          @slot-click="handleSlotClick"
          @cell-click="handleCellClickRouter"
          @drag-complete="handleDragComplete"
        />
        <CalendarFooter v-if="!isAvailabilityMode && props.mode === 'tutor'" lesson-link="https://zoom.us/j/example" />
      </template>
    </div>
    
    <!-- Modals (tutor only) -->
    <CreateLessonModal
      v-if="showCreateModal && selectedCell && props.mode === 'tutor'"
      :visible="showCreateModal"
      :selected-cell="selectedCell"
      @close="showCreateModal = false"
      @success="handleLessonCreated"
    />

    <EditLessonModal
      v-if="showEventModal && selectedEventId && props.mode === 'tutor'"
      :visible="showEventModal"
      :event-id="selectedEventId"
      @close="showEventModal = false"
      @updated="handleEventUpdated"
      @deleted="handleEventDeleted"
    />

    <SlotEditorModal
      v-if="showSlotModal && selectedSlot && props.mode === 'tutor'"
      :visible="showSlotModal"
      :slot="selectedSlot"
      :timezone="calendarTimezone"
      @close="showSlotModal = false"
      @saved="handleSlotSaved"
      @deleted="handleSlotDeleted"
    />

    <CreateSlotModal
      v-if="showCreateSlotModal && createSlotData && props.mode === 'tutor'"
      :date="createSlotData.date"
      :start="createSlotData.start"
      :end="createSlotData.end"
      @created="handleSlotCreated"
      @cancelled="showCreateSlotModal = false"
      @error="handleSlotCreateError"
    />

    <BlockSlotModal
      v-if="showBlockSlotModal && selectedSlotForBlock && props.mode === 'tutor'"
      :slot="selectedSlotForBlock"
      @blocked="handleSlotBlocked"
      @cancelled="showBlockSlotModal = false"
      @error="handleSlotBlockError"
    />

    <LessonCardDrawer
      v-if="selectedLessonV055"
      v-model="showLessonDrawer"
      :lesson="selectedLessonV055"
      @mark-no-show="handleMarkNoShow"
      @reschedule-confirmed="handleRescheduleConfirmed"
    />

    <CalendarGuideModal
      v-if="showGuideModal"
      @close="showGuideModal = false"
    />

    <!-- Availability Legend Modal -->
    <Teleport to="body">
      <div v-if="showAvailabilityLegend" class="modal-overlay" @click="showAvailabilityLegend = false">
        <div class="modal-content" @click.stop>
          <AvailabilityLegend />
          <Button variant="outline" @click="showAvailabilityLegend = false">
            {{ t('common.close', 'Закрити') }}
          </Button>
        </div>
      </div>
    </Teleport>

    <!-- Availability Conflicts Drawer -->
    <AvailabilityConflictsDrawer
      :is-open="showConflictsDrawer"
      :conflicts="draftStore.conflicts"
      :allow-force="true"
      @close="showConflictsDrawer = false"
      @edit="handleEditConflicts"
      @force-apply="handleForceApplyDraft"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, defineAsyncComponent } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

// Props
const props = withDefaults(defineProps<{
  mode?: 'tutor' | 'student'
  externalDays?: DaySnapshot[]
  externalEvents?: CalendarEventV055[]
}>(), {
  mode: 'tutor',
  externalDays: () => [],
  externalEvents: () => [],
})
import { Loader as LoaderIcon, AlertCircle as AlertCircleIcon, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import { useAvailabilityDraftUnifiedStore } from '@/modules/booking/stores/availabilityDraftUnifiedStore'
import { useTutorLessonLinksStore } from '@/modules/booking/stores/tutorLessonLinksStore'
import { useCalendarWebSocket } from '@/modules/booking/composables/useCalendarWebSocket'
import { useErrorHandler } from '@/modules/booking/composables/useErrorHandler'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth/store/authStore'
import CalendarBoardV2 from './CalendarBoardV2.vue'
import CalendarFooter from './CalendarFooter.vue'
import WeekNavigation from './WeekNavigation.vue'
import LessonCardDrawer from './LessonCardDrawer.vue'
import CalendarSidebar from './CalendarSidebar.vue'
import AvailabilityLegend from './AvailabilityLegend.vue'
import AvailabilityConflictsDrawer from './AvailabilityConflictsDrawer.vue'
import CreateLessonModal from '../modals/CreateLessonModal.vue'
import EditLessonModal from '../modals/EditLessonModal.vue'
import CalendarGuideModal from './CalendarGuideModal.vue'
import SlotEditorModal from '../modals/SlotEditorModal.vue'
import CreateSlotModal from '../availability/CreateSlotModal.vue'
import BlockSlotModal from '../availability/BlockSlotModal.vue'
import DraftChangesBar from '../availability/DraftChangesBar.vue'
import type { CalendarCell, AccessibleSlot as AccessibleSlotLegacy } from '@/modules/booking/types/calendarWeek'
import type { CalendarEvent as CalendarEventV055, AccessibleSlot as AccessibleSlotV055, MyCalendarEvent, DaySnapshot } from '@/modules/booking/types/calendarV055'
import '@/modules/booking/styles/calendar-theme.css'
import '@/modules/booking/styles/calendar-layout.css'
import '@/modules/booking/styles/calendar-animations.css'
import '@/modules/booking/styles/calendar-responsive.css'
import { useSlotEditor } from '@/modules/booking/composables/useSlotEditor'

// Debug module (dynamic import)
const isDebugMode = false
const CalendarDebugPanel = isDebugMode ? defineAsyncComponent(() => import('@/modules/booking/debug').then(m => m.CalendarDebugPanel)) : null
const DebugToggleButton = isDebugMode ? defineAsyncComponent(() => import('@/modules/booking/debug').then(m => m.DebugToggleButton)) : null

const { t } = useI18n()
const isDebugLoggingEnabled = false
const logDebug = (...args: unknown[]) => {
  if (isDebugLoggingEnabled) {
    console.log(...args)
  }
}
const warnDebug = (...args: unknown[]) => {
  if (isDebugLoggingEnabled) {
    console.warn(...args)
  }
}
const router = useRouter()

const store = useCalendarWeekStore()
const draftStore = useAvailabilityDraftUnifiedStore()
const lessonLinksStore = useTutorLessonLinksStore()
const authStore = useAuthStore()
const { connected, connectionAttempted, connect } = useCalendarWebSocket()
const { handleError } = useErrorHandler()
const showV055 = computed(() => props.mode === 'tutor')

const {
  isLoading,
  error,
  days: daysV055,
  events: eventsV055,
  accessible: accessibleV055,
  blockedRanges: blockedRangesV055,
  daySummaries: daySummariesV055,
  meta: metaV055,
} = storeToRefs(store)

const isLoadingV055 = isLoading
const errorV055 = error

const daysV055Computed = computed(() => daySummariesV055.value || [])
const hiddenEventStatuses: Array<CalendarEventV055['status']> = ['cancelled']
const eventsV055Computed = computed(() => {
  const rawEvents = eventsV055.value || []
  return rawEvents.filter(event => !hiddenEventStatuses.includes(event.status))
})

// Step 1.2: Computed sources for rendering (student vs tutor mode)
const daysToRender = computed(() => {
  if (props.mode === 'student') {
    return props.externalDays || []
  }
  return daysV055Computed.value
})

const eventsToRender = computed(() => {
  if (props.mode === 'student') {
    return props.externalEvents || []
  }
  return eventsV055Computed.value
})
const accessibleSlotsComputed = computed(() => accessibleV055.value || [])
const blockedRangesV055Computed = computed(() => blockedRangesV055.value || [])
const currentTimeV055 = computed(() => metaV055.value?.currentTime || new Date().toISOString())
const dragEnabled = computed(() => props.mode === 'tutor')
const timezoneForNav = computed(() => metaV055.value?.timezone || 'Europe/Kiev')
const weekStartForNav = computed(
  () => metaV055.value?.weekStart || new Date().toISOString().slice(0, 10)
)
const weekEndForNav = computed(
  () => metaV055.value?.weekEnd || ''
)

const todayWeekStartComputed = computed(() => {
  const tz = timezoneForNav.value
  return dayjs().tz(tz).startOf('week').format('YYYY-MM-DD')
})

const currentPageForNav = computed(() => {
  const currentWeek = weekStartForNav.value
  const todayWeek = todayWeekStartComputed.value
  if (!currentWeek || !todayWeek) return 0
  return dayjs(currentWeek).diff(dayjs(todayWeek), 'week')
})

const weekRangeDisplay = computed(() => {
  const start = weekStartForNav.value
  const end = weekEndForNav.value
  if (!start || !end) return ''
  
  const startDate = new Date(start)
  const endDate = new Date(end)
  
  return `${startDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}`
})

const allEvents = computed(() => eventsV055Computed.value)

const totalAvailableMinutes = computed(() => {
  return (accessibleV055.value || []).reduce((sum, slot) => {
    const start = new Date(slot.start)
    const end = new Date(slot.end)
    const duration = (end.getTime() - start.getTime()) / 60000
    return sum + duration
  }, 0)
})

const totalAvailableHours = computed(() => totalAvailableMinutes.value / 60)

const hasAvailability = computed(() => {
  const minutes = totalAvailableMinutes.value || 0
  const hasSlots = (accessibleV055.value || []).length > 0
  
  // Show calendar if there are any slots or if there are minutes available
  // This indicates user has set up availability template and slots are generated
  return hasSlots || minutes > 0
})

const hasSetupAvailability = computed(() => {
  // Step 2: Student mode always shows calendar (no availability empty-state)
  if (props.mode === 'student') {
    return true
  }
  
  // Tutor mode: show calendar if there's any data
  const hasEvents = eventsV055Computed.value.length > 0
  const hasSlots = (accessibleV055.value || []).length > 0
  const hasMinutes = totalAvailableMinutes.value > 0
  
  return hasEvents || hasSlots || hasMinutes
})

const accessible = computed(() => store.accessible)

const emit = defineEmits<{
  cellClick: [cell: CalendarCell]
  eventClick: [eventId: number]
}>()

const { markSlotForDeletion, hasUnsavedChanges, applyDraft, clearDraft } = useSlotEditor()

const showCreateModal = ref(false)
const showEventModal = ref(false)
const showSlotModal = ref(false)
const showCreateSlotModal = ref(false)
const showBlockSlotModal = ref(false)
const selectedCell = ref<CalendarCell | null>(null)
const selectedEventId = ref<number | null>(null)
const selectedSlot = ref<AccessibleSlotV055 | null>(null)
const selectedSlotForBlock = ref<AccessibleSlotLegacy | null>(null)
const createSlotData = ref<{ date: string; start: string; end: string } | null>(null)
const showGuideModal = ref(false)
const showLessonDrawer = ref(false)
const selectedLessonV055 = ref<CalendarEventV055 | null>(null)
const showAvailabilityLegend = ref(false)
const showConflictsDrawer = ref(false)

// Availability mode computed
const isAvailabilityMode = computed(() => draftStore.isEditMode)

function formatDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseIsoDate(dateStr: string | undefined) {
  if (!dateStr) return null
  const parsed = new Date(`${dateStr}T00:00:00Z`)
  return Number.isNaN(parsed.valueOf()) ? null : parsed
}

const tutorId = computed(() => authStore.user?.id || null)

const fetchV055Snapshot = async (weekStartOverride?: string) => {
  if (!showV055.value) return
  
  const id = tutorId.value
  if (!id) return
  
  const weekStart =
    weekStartOverride ||
    metaV055.value?.weekStart ||
    new Date().toISOString().slice(0, 10)
  
  try {
    await store.fetchWeekSnapshot(id, weekStart)
  } catch (err: any) {
    handleError(err)
  }
}

// Add beforeunload warning for unsaved changes
const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (hasUnsavedChanges.value) {
    e.preventDefault()
    e.returnValue = ''
    return ''
  }
}

onMounted(async () => {
  try {
    // Use v055 API only
    if (showV055.value && authStore.user?.id) {
      const weekStart = new Date().toISOString().slice(0, 10)
      await fetchV055Snapshot(weekStart)
      
      // Fetch lesson links for tutor
      if (authStore.user.role === 'tutor') {
        try {
          await lessonLinksStore.fetchLessonLinks()
        } catch (err: any) {
          warnDebug('[CalendarWeekView] Failed to fetch lesson links:', err)
          // Non-critical, don't block calendar load
        }
      }
    }
  } catch (err: any) {
    handleError(err)
  }
  
  // Add beforeunload listener
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

function handleNavigate(direction: -1 | 1) {
  if (isLoadingV055.value) {
    warnDebug('[CalendarWeekView] handleNavigate: ignored because isLoadingV055 is true', {
      direction,
      currentWeekStart: weekStartForNav.value,
    })
    return
  }
  const base = weekStartForNav.value || new Date().toISOString().slice(0, 10)
  const nextWeekStart = dayjs(base).add(direction, 'week').format('YYYY-MM-DD')
  logDebug('[CalendarWeekView] handleNavigate -> fetchV055Snapshot', {
    direction,
    base,
    nextWeekStart,
  })
  fetchV055Snapshot(nextWeekStart)
}

function handleToday() {
  if (isLoadingV055.value) return
  const todayStart = todayWeekStartComputed.value
  const currentWeek = weekStartForNav.value
  
  // Only fetch if we're not already on today's week
  if (currentWeek === todayStart) {
    return
  }
  
  fetchV055Snapshot(todayStart)
}

function handleRetry() {
  if (store.currentTutorId && store.currentWeekStart) {
    store.fetchWeekSnapshot(store.currentTutorId, store.currentWeekStart)
  }
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

function handleCellClickRouter(data: any) {
  logDebug('[CalendarWeekView] handleCellClickRouter called with:', data)
  logDebug('[CalendarWeekView] isAvailabilityMode.value:', isAvailabilityMode.value)
  logDebug('[CalendarWeekView] draftStore.mode:', draftStore.mode)
  
  // Check if this is an availability cell click (has start/end/canAdd/canRemove)
  if (data && typeof data === 'object' && 'start' in data && 'end' in data) {
    logDebug('[CalendarWeekView] Routing to handleAvailabilityCellClick')
    handleAvailabilityCellClick(data)
  } else if (data && typeof data === 'object' && 'date' in data && 'hour' in data) {
    logDebug('[CalendarWeekView] Routing to handleCellClick')
    handleCellClick(data)
  } else {
    warnDebug('[CalendarWeekView] Unknown cell click data format:', data)
  }
}

function handleCellClick(data: { date: string; hour: number }) {
  const timezoneName = metaV055.value?.timezone || 'Europe/Kiev'
  const hourString = data.hour.toString().padStart(2, '0')
  const baseLocal = dayjs.tz(`${data.date}T${hourString}:00`, timezoneName)

  const startAtUTC = baseLocal.clone().utc().toISOString()
  const endAtUTC = baseLocal.clone().add(1, 'hour').utc().toISOString()

  selectedCell.value = {
    dayKey: data.date,
    slotIndex: data.hour * 2,
    startAtUTC,
    endAtUTC,
    status: 'available',
    slotId: undefined,
  }

  showCreateModal.value = true
  emit('cellClick', selectedCell.value)
}

function handleEventClick(event: CalendarEventV055) {
  selectedEventId.value = event.id
  showEventModal.value = true
  emit('eventClick', event.id)
}

async function handleLessonCreated(eventId: number) {
  logDebug('[CalendarWeekView] Lesson created:', eventId)
  showCreateModal.value = false
  if (store.currentTutorId && store.currentWeekStart) {
    await store.fetchWeekSnapshot(store.currentTutorId, store.currentWeekStart, true)
  }
}

async function handleEventUpdated() {
  logDebug('[CalendarWeekView] Event updated')
  showEventModal.value = false
  // Refetch snapshot to get updated data
  if (store.currentTutorId && store.currentWeekStart) {
    await store.fetchWeekSnapshot(store.currentTutorId, store.currentWeekStart, true)
  }
}

async function handleEventDeleted() {
  logDebug('[CalendarWeekView] Event deleted')
  showEventModal.value = false
  if (store.currentTutorId && store.currentWeekStart) {
    await store.fetchWeekSnapshot(store.currentTutorId, store.currentWeekStart, true)
  }
}

function handleSlotClick(slot: AccessibleSlotV055 & { slotId?: number }) {
  const resolvedId =
    typeof slot.id === 'number' && !Number.isNaN(slot.id)
      ? slot.id
      : typeof slot.slotId === 'number'
        ? slot.slotId
        : null

  if (!resolvedId) {
    warnDebug('[CalendarWeekView] Slot without id clicked:', slot)
    return
  }

  const normalizedSlot: AccessibleSlotV055 = {
    id: resolvedId,
    start: slot.start,
    end: slot.end,
    is_recurring: Boolean(slot.is_recurring),
  }

  selectedSlot.value = normalizedSlot
  showSlotModal.value = true
}

const calendarTimezone = computed(() => {
  return store.meta?.timezone || 'Europe/Kiev'
})

function handleSlotSaved() {
  logDebug('[CalendarWeekView] Slot saved')
  showSlotModal.value = false
  // No need to fetch - optimistic update already handled it
}

function handleSlotDeleted() {
  logDebug('[CalendarWeekView] Slot deleted')
  showSlotModal.value = false
  // No need to fetch - optimistic update already handled it
}

function handleSlotEdit(slotId: number) {
  const slot = (accessibleV055.value || []).find(s => s.id === slotId)
  if (!slot) {
    warnDebug('[CalendarWeekView] handleSlotEdit: slot not found for id', slotId)
    return
  }
  handleSlotClick(slot)
}

function handleSlotDeleteInline(slotId: number) {
  const confirmed = window.confirm(t('calendar.slotEditor.deleteConfirm'))
  if (!confirmed) return
  
  markSlotForDeletion(slotId)
}

function handleSlotCreated(slot: any) {
  logDebug('[CalendarWeekView] Slot created:', slot)
  showCreateSlotModal.value = false
  createSlotData.value = null
  
  // No need to fetch week - optimistic update already handled it
}

function handleSlotCreateError(error: any) {
  warnDebug('[CalendarWeekView] Failed to create slot:', error)
  showCreateSlotModal.value = false
  createSlotData.value = null
}

function handleCreateSlot(data: { date: string; start: string; end: string }) {
  logDebug('[CalendarWeekView] Create slot requested:', data)
  createSlotData.value = data
  showCreateSlotModal.value = true
}

function handleSlotBlock(slotId: number) {
  const slot = (accessibleV055.value || []).find(s => s.id === slotId)
  if (slot) {
    selectedSlotForBlock.value = slot as any
    showBlockSlotModal.value = true
  }
}

function handleSlotBlocked(slotId: number) {
  logDebug('[CalendarWeekView] Slot blocked:', slotId)
  showBlockSlotModal.value = false
  selectedSlotForBlock.value = null
  // No need to fetch - optimistic update should handle it
}

function handleSlotBlockError(error: any) {
  warnDebug('[CalendarWeekView] Failed to block slot:', error)
  showBlockSlotModal.value = false
  selectedSlotForBlock.value = null
}

function handleEventClickV055(event: any) {
  selectedLessonV055.value = event
  showLessonDrawer.value = true
}

function handleDragComplete(eventId: number, newStart: string, newEnd: string) {
  logDebug('[CalendarWeekView] Drag complete:', { eventId, newStart, newEnd })
  // Reschedule API integration handled by drag-drop composable
}

function handleOpenQuickBlock() {
  showCreateSlotModal.value = true
  createSlotData.value = {
    date: metaV055.value?.weekStart || new Date().toISOString().split('T')[0],
    start: '09:00',
    end: '10:00'
  }
}

function handleMarkNoShow(eventId: number) {
  showLessonDrawer.value = false
  // Refetch to update UI
  fetchV055Snapshot()
}

function handleRescheduleConfirmed() {
  showLessonDrawer.value = false
  // Refetch to update UI
  fetchV055Snapshot()
}

function handleCreateSlotFromToolbar() {
  const today = new Date()
  let dateStr = formatDateString(today)

  const weekStartDate = parseIsoDate(metaV055.value?.weekStart)
  const weekEndDate = parseIsoDate(metaV055.value?.weekEnd)

  if (weekStartDate && weekEndDate) {
    const inCurrentVisibleWeek = today >= weekStartDate && today <= weekEndDate
    if (!inCurrentVisibleWeek) {
      dateStr = metaV055.value!.weekStart
    }
  } else if (metaV055.value?.weekStart) {
    dateStr = metaV055.value.weekStart
  }

  const currentHour = today.getHours()
  const nextHour = currentHour + 1
  
  createSlotData.value = {
    date: dateStr,
    start: `${nextHour.toString().padStart(2, '0')}:00`,
    end: `${(nextHour + 1).toString().padStart(2, '0')}:00`
  }
  showCreateSlotModal.value = true
}

// Availability mode handlers
async function handleEnterAvailabilityMode() {
  const weekStart = metaV055.value?.weekStart || new Date().toISOString().slice(0, 10)
  draftStore.enterEditMode(weekStart)
  await draftStore.loadWorkloadProgress()
}

function handleExitAvailabilityMode() {
  if (draftStore.hasChanges) {
    const confirmed = window.confirm(t('calendar.availability.exitConfirm', 'У вас є незбережені зміни. Ви впевнені, що хочете вийти?'))
    if (!confirmed) return
  }
  draftStore.exitMode()
}

async function handleSaveAvailability() {
  try {
    const weekStart = metaV055.value?.weekStart || new Date().toISOString().slice(0, 10)
    const applyResponse = await draftStore.applyDraft(false, weekStart)
    
    if (applyResponse.status === 'conflicts') {
      showConflictsDrawer.value = true
      return
    }
    
    if (applyResponse.status === 'applied') {
      if (store.currentTutorId && store.currentWeekStart) {
        await store.fetchWeekSnapshot(store.currentTutorId, store.currentWeekStart, true)
      }
    }
  } catch (error: any) {
    handleError(error)
  }
}

function handleShowLegend() {
  showAvailabilityLegend.value = true
}

async function handleForceApplyDraft() {
  try {
    const applyResponse = await draftStore.applyDraft(true)
    if (applyResponse.status === 'applied') {
      showConflictsDrawer.value = false
      if (store.currentTutorId && store.currentWeekStart) {
        await store.fetchWeekSnapshot(store.currentTutorId, store.currentWeekStart, true)
      }
    }
  } catch (error: any) {
    handleError(error)
  }
}

function handleEditConflicts() {
  showConflictsDrawer.value = false
}

function handleAvailabilityCellClick(cellInfo: { start: string; end: string; canAdd: boolean; canRemove: boolean; slotId?: number }) {
  logDebug('[CalendarWeekView] handleAvailabilityCellClick called:', cellInfo)
  logDebug('[CalendarWeekView] isAvailabilityMode:', isAvailabilityMode.value)
  logDebug('[CalendarWeekView] draftStore.slots before:', JSON.parse(JSON.stringify(draftStore.slots)))
  
  if (cellInfo.canAdd) {
    const newSlot = draftStore.addSlot(cellInfo.start, cellInfo.end)
    logDebug('[CalendarWeekView] Added slot:', newSlot)
    logDebug('[CalendarWeekView] draftStore.slots after add:', JSON.parse(JSON.stringify(draftStore.slots)))
  } else if (cellInfo.canRemove && cellInfo.slotId) {
    draftStore.toggleSlot(cellInfo.slotId, cellInfo.start, cellInfo.end)
    logDebug('[CalendarWeekView] Toggled slot:', cellInfo.slotId)
    logDebug('[CalendarWeekView] draftStore.slots after toggle:', JSON.parse(JSON.stringify(draftStore.slots)))
  }
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
  justify-content: flex-end;
  margin-bottom: 16px;
}

.calendar-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  color: var(--text-secondary);
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
  background-color: var(--bg-secondary);
}

.legend-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--accent);
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  border: 2px solid transparent;
}

.legend-dot--lesson {
  background: var(--success);
  border-color: var(--success);
}

.legend-dot--availability {
  background: var(--warning);
  border-color: var(--warning);
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

.calendar-header-inline {
  background: var(--card-bg);
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 16px;
}

.week-nav-inline {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.nav-btn-inline {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-btn-inline:hover:not(:disabled) {
  background: var(--bg-tertiary, #e5e7eb);
  transform: scale(1.05);
}

.nav-btn-inline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.week-info-inline {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 200px;
}

.week-range-inline {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.today-btn-inline {
  padding: 4px 12px;
  border-radius: 9999px;
  background: var(--accent-bg, #dbeafe);
  color: var(--accent);
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.today-btn-inline:hover {
  background: var(--accent-bg-hover, #bfdbfe);
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
  background: var(--card-bg);
  cursor: pointer;
}

.btn-secondary:hover {
  background-color: var(--bg-secondary);
}

.connection-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--warning-bg, #fef3c7);
  border: 1px solid var(--warning, #fbbf24);
  border-radius: var(--radius-md);
  color: var(--warning);
  font-size: 14px;
  font-weight: 500;
}

.availability-empty-state {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}

.empty-state-card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
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
  color: var(--text-primary);
}

.empty-state-card p {
  color: var(--text-secondary);
  font-size: 14px;
}

.empty-state-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--accent-bg, #ecfeff);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
}

.btn-primary {
  padding: 10px 24px;
  border-radius: 999px;
  background: var(--accent);
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

.calendar-toggle {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 16px;
  background: var(--card-bg);
  border-radius: var(--radius-md);
  margin-bottom: 16px;
}

.toggle-btn {
  padding: 10px 20px;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.toggle-btn.active {
  border-color: var(--accent);
  background: var(--accent);
  color: white;
}

.calendar-v055-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--card-bg);
  border-radius: var(--radius-md);
  padding: 16px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.modal-content {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: 24px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.btn-close-modal {
  margin-top: 20px;
  width: 100%;
  padding: 12px;
  background: var(--bg-secondary);
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn-close-modal:hover {
  background: var(--bg-tertiary, #e0e0e0);
}
</style>
