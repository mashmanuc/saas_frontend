<template>
  <div class="calendar-cell-grid">
    <DSTWarningBanner :week-start="weekStart" :timezone="timezone" />

    <!-- Error state -->
    <template v-if="error">
      <Transition name="fade">
        <div class="error-state">
          <WifiOffIcon class="w-12 h-12 text-gray-400" />
          <h3 class="error-title">{{ $t('errors.networkError') }}</h3>
          <p class="error-message">{{ error }}</p>
          <button @click="handleRetry" class="btn-primary">
            <RefreshCwIcon class="w-4 h-4" />
            {{ $t('common.retry') }}
          </button>
        </div>
      </Transition>
    </template>

    <!-- Loading skeleton -->
    <template v-else-if="loading">
      <Transition name="fade">
        <CalendarSkeleton />
      </Transition>
    </template>

    <!-- Empty state -->
    <template v-else-if="cells.length === 0">
      <Transition name="fade">
        <div class="empty-state">
          <CalendarIcon class="empty-icon" />
          <h3 class="empty-title">{{ $t('booking.calendar.noSchedule') }}</h3>
          <p class="empty-message">
            {{ $t('booking.calendar.noScheduleDesc') }}
          </p>
          <div class="empty-actions">
            <button @click="goToSettings" class="btn-primary">
              <SettingsIcon class="w-4 h-4" />
              {{ $t('booking.calendar.setupSchedule') }}
            </button>
            <button @click="handleRetry" class="btn-secondary">
              <RefreshCwIcon class="w-4 h-4" />
              {{ $t('common.retry') }}
            </button>
          </div>
        </div>
      </Transition>
    </template>

    <!-- Success state -->
    <template v-else>
      <Transition name="fade" mode="out-in">
        <div>
          <WeekHeader :week-start="weekStart" :timezone="timezone" />

          <div class="grid-container">
            <TimeColumn :timezone="timezone" />

            <CellGrid
              :cells="cells"
              :week-start="weekStart"
              :timezone="timezone"
              @cell-click="handleCellClick"
            />
          </div>
        </div>
      </Transition>
    </template>
    
    <CalendarPopover
      v-if="popoverCell"
      :cell="popoverCell"
      :visible="popoverVisible"
      :anchor-el="popoverAnchor"
      @close="handlePopoverClose"
      @block-time="handleBlockTime"
      @make-available="handleMakeAvailable"
      @clear-availability="handleClearAvailability"
      @book-lesson="handleBookLessonFromPopover"
      @view-lesson="handleViewLesson"
      @cancel-lesson="handleCancelLesson"
    />
    
    <ManualBookingModal
      v-if="bookingCell"
      :visible="showBookingModal"
      :cell="bookingCell"
      @close="handleBookingModalClose"
      @success="handleBookingSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { WifiOff as WifiOffIcon, RefreshCw as RefreshCwIcon, Calendar as CalendarIcon, Settings as SettingsIcon } from 'lucide-vue-next'
import { useCalendarStore } from '@/modules/booking/stores/calendarStore'
import { useDraftStore } from '@/modules/booking/stores/draftStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { CalendarCell } from '@/modules/booking/types/calendar'
import WeekHeader from './WeekHeader.vue'
import TimeColumn from './TimeColumn.vue'
import CellGrid from './CellGrid.vue'
import CalendarPopover from './CalendarPopover.vue'
import DSTWarningBanner from './DSTWarningBanner.vue'
import CalendarSkeleton from './CalendarSkeleton.vue'
import ManualBookingModal from '../modals/ManualBookingModal.vue'

const props = defineProps<{
  tutorId?: number
  weekStart: string
  timezone: string
}>()

const emit = defineEmits<{
  cellClick: [cell: CalendarCell]
  bookLesson: [cell: CalendarCell]
}>()

const router = useRouter()
const calendarStore = useCalendarStore()
const draftStore = useDraftStore()
const { isV046CalendarClickMode } = useFeatureFlags()

const loading = ref(false)
const error = ref<string | null>(null)
const cells = computed(() => calendarStore.effectiveCells || [])

const popoverVisible = ref(false)
const popoverCell = ref<CalendarCell | null>(null)
const popoverAnchor = ref<HTMLElement | null>(null)

const showBookingModal = ref(false)
const bookingCell = ref<CalendarCell | null>(null)

onMounted(async () => {
  await loadWeekView()
})

watch(() => props.weekStart, async () => {
  await loadWeekView()
})

async function loadWeekView() {
  loading.value = true
  error.value = null
  try {
    console.log('[CalendarCellGrid] Loading week view:', {
      tutorId: props.tutorId,
      weekStart: props.weekStart,
      timezone: props.timezone,
    })
    
    await calendarStore.loadWeekView({
      tutorId: props.tutorId,
      weekStart: props.weekStart,
      timezone: props.timezone,
    })
    
    console.log('[CalendarCellGrid] Loaded cells:', cells.value.length)
    console.log('[CalendarCellGrid] Cells data:', cells.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load calendar'
    console.error('[CalendarCellGrid] Failed to load week view:', err)
  } finally {
    loading.value = false
  }
}

async function handleRetry() {
  await loadWeekView()
}

function goToSettings() {
  // Navigate to availability settings page
  router.push('/booking/availability')
}

function handleCellClick(cell: CalendarCell, event: MouseEvent) {
  if (!isV046CalendarClickMode.value) return
  
  if (cell.status === 'empty') return
  
  popoverCell.value = cell
  popoverAnchor.value = event.currentTarget as HTMLElement
  popoverVisible.value = true
  
  emit('cellClick', cell)
}

function handlePopoverClose() {
  popoverVisible.value = false
}

function handleBlockTime(cell: CalendarCell) {
  draftStore.addPatch(cell, 'set_blocked')
}

function handleMakeAvailable(cell: CalendarCell) {
  draftStore.addPatch(cell, 'set_available')
}

function handleClearAvailability(cell: CalendarCell) {
  draftStore.removePatch(cell.startAtUTC)
}

function handleBookLessonFromPopover(cell: CalendarCell) {
  popoverVisible.value = false
  bookingCell.value = cell
  showBookingModal.value = true
}

function handleBookLesson(cell: CalendarCell) {
  emit('bookLesson', cell)
}

function handleBookingModalClose() {
  showBookingModal.value = false
  bookingCell.value = null
}

function handleBookingSuccess(lessonId: number) {
  console.log('[CalendarCellGrid] Booking created:', lessonId)
  showBookingModal.value = false
  bookingCell.value = null
  loadWeekView()
}

function handleViewLesson(lessonId: number) {
  console.log('View lesson:', lessonId)
}

function handleCancelLesson(lessonId: number) {
  console.log('Cancel lesson:', lessonId)
}
</script>

<style scoped>
.calendar-cell-grid {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  position: relative;
}

.grid-container {
  display: flex;
  flex: 1;
  overflow: auto;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px;
  text-align: center;
  min-height: 400px;
}

.error-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.error-message {
  font-size: 14px;
  color: #6b7280;
  max-width: 500px;
  margin: 0;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background-color: #2563eb;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px;
  text-align: center;
  min-height: 400px;
}

.empty-icon {
  width: 64px;
  height: 64px;
  color: #9ca3af;
  margin-bottom: 8px;
}

.empty-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.empty-message {
  font-size: 14px;
  color: #6b7280;
  max-width: 500px;
  margin: 0;
}

.btn-secondary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background-color: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-secondary:hover {
  background-color: #e5e7eb;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
