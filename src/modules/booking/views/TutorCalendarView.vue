<script setup lang="ts">
// F6: Tutor Calendar View
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Settings, Calendar as CalendarIcon, List } from 'lucide-vue-next'
import { useCalendarStore } from '../stores/calendarStore'
import { useBookingStore } from '../stores/bookingStore'
import { useAuthStore } from '@/modules/auth/store/authStore'

// Components
import WeekCalendar from '../components/calendar/WeekCalendar.vue'
import MonthCalendar from '../components/calendar/MonthCalendar.vue'
import CalendarHeader from '../components/calendar/CalendarHeader.vue'
import BookingCard from '../components/booking/BookingCard.vue'
import AvailabilityEditor from '../components/availability/AvailabilityEditor.vue'
import BookingSettings from '../components/settings/BookingSettings.vue'

const calendarStore = useCalendarStore()
const bookingStore = useBookingStore()
const authStore = useAuthStore()

const {
  slots,
  slotsByDate,
  selectedDate,
  viewMode,
  isLoading: isLoadingSlots,
  settings,
} = storeToRefs(calendarStore)

const { pendingBookings, isLoading: isLoadingBookings } = storeToRefs(bookingStore)

type SidebarTab = 'pending' | 'availability' | 'settings'
const sidebarTab = ref<SidebarTab>('pending')

const tutorId = computed(() => authStore.user?.id || 0)

onMounted(async () => {
  if (tutorId.value) {
    await Promise.all([
      calendarStore.loadWeekSlots(tutorId.value),
      calendarStore.loadSettings(),
      calendarStore.loadAvailability(),
      bookingStore.loadBookings({ role: 'tutor', status: 'pending' }),
    ])
  }
})

// Reload slots when date changes
watch(selectedDate, async () => {
  if (tutorId.value) {
    await calendarStore.loadWeekSlots(tutorId.value)
  }
})

async function handleSlotClick(slot: any) {
  if (slot.status === 'available') {
    await calendarStore.blockSlot(slot.id)
  } else if (slot.status === 'blocked') {
    await calendarStore.unblockSlot(slot.id)
  }
}

async function handleConfirmBooking(bookingId: number) {
  await bookingStore.confirmBooking(bookingId)
  // Reload slots to reflect changes
  if (tutorId.value) {
    await calendarStore.loadWeekSlots(tutorId.value)
  }
}

async function handleCancelBooking(bookingId: number) {
  await bookingStore.cancelBooking(bookingId, 'Cancelled by tutor')
  if (tutorId.value) {
    await calendarStore.loadWeekSlots(tutorId.value)
  }
}
</script>

<template>
  <div class="tutor-calendar-view">
    <!-- Main Calendar -->
    <main class="calendar-main">
      <CalendarHeader
        :date="selectedDate"
        :view-mode="viewMode"
        @prev="calendarStore.navigateWeek(-1)"
        @next="calendarStore.navigateWeek(1)"
        @today="calendarStore.goToToday()"
        @view-change="calendarStore.setViewMode"
      />

      <div class="calendar-container">
        <WeekCalendar
          v-if="viewMode === 'week'"
          :slots-by-date="slotsByDate"
          :week-days="calendarStore.weekDays"
          :loading="isLoadingSlots"
          @slot-click="handleSlotClick"
        />
        <MonthCalendar
          v-else
          :calendar-days="calendarStore.calendarDays"
          :selected-date="selectedDate"
          @date-select="calendarStore.setSelectedDate"
        />
      </div>

      <!-- Legend -->
      <div class="calendar-legend">
        <div class="legend-item">
          <span class="legend-dot available" />
          Available
        </div>
        <div class="legend-item">
          <span class="legend-dot booked" />
          Booked
        </div>
        <div class="legend-item">
          <span class="legend-dot blocked" />
          Blocked
        </div>
      </div>
    </main>

    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-tabs">
        <button
          class="sidebar-tab"
          :class="{ active: sidebarTab === 'pending' }"
          @click="sidebarTab = 'pending'"
        >
          <List :size="18" />
          Pending
          <span v-if="pendingBookings.length" class="badge">
            {{ pendingBookings.length }}
          </span>
        </button>
        <button
          class="sidebar-tab"
          :class="{ active: sidebarTab === 'availability' }"
          @click="sidebarTab = 'availability'"
        >
          <CalendarIcon :size="18" />
          Schedule
        </button>
        <button
          class="sidebar-tab"
          :class="{ active: sidebarTab === 'settings' }"
          @click="sidebarTab = 'settings'"
        >
          <Settings :size="18" />
          Settings
        </button>
      </div>

      <div class="sidebar-content">
        <!-- Pending Bookings -->
        <div v-if="sidebarTab === 'pending'" class="pending-section">
          <div v-if="isLoadingBookings" class="loading">
            <div class="spinner" />
          </div>
          <div v-else-if="pendingBookings.length === 0" class="empty">
            No pending bookings
          </div>
          <div v-else class="pending-list">
            <BookingCard
              v-for="booking in pendingBookings"
              :key="booking.id"
              :booking="booking"
              compact
              @confirm="handleConfirmBooking(booking.id)"
              @cancel="handleCancelBooking(booking.id)"
            />
          </div>
        </div>

        <!-- Availability Editor -->
        <div v-if="sidebarTab === 'availability'" class="availability-section">
          <AvailabilityEditor />
        </div>

        <!-- Settings -->
        <div v-if="sidebarTab === 'settings'" class="settings-section">
          <BookingSettings :settings="settings" />
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.tutor-calendar-view {
  display: flex;
  gap: 24px;
  padding: 24px;
  min-height: calc(100vh - 64px);
}

.calendar-main {
  flex: 1;
  min-width: 0;
}

.calendar-container {
  background: var(--color-bg-primary, white);
  border-radius: 12px;
  border: 1px solid var(--color-border, #e5e7eb);
  overflow: hidden;
  margin-bottom: 16px;
}

.calendar-legend {
  display: flex;
  gap: 24px;
  justify-content: center;
  padding: 12px;
  background: var(--color-bg-primary, white);
  border-radius: 8px;
  border: 1px solid var(--color-border, #e5e7eb);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.legend-dot.available {
  background: var(--color-success, #10b981);
}

.legend-dot.booked {
  background: var(--color-primary, #3b82f6);
}

.legend-dot.blocked {
  background: var(--color-text-secondary, #9ca3af);
}

/* Sidebar */
.sidebar {
  width: 360px;
  flex-shrink: 0;
  background: var(--color-bg-primary, white);
  border-radius: 12px;
  border: 1px solid var(--color-border, #e5e7eb);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.sidebar-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 8px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: -1px;
}

.sidebar-tab:hover {
  color: var(--color-text-primary, #111827);
}

.sidebar-tab.active {
  color: var(--color-primary, #3b82f6);
  border-bottom-color: var(--color-primary, #3b82f6);
}

.badge {
  background: var(--color-primary, #3b82f6);
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.loading,
.empty {
  text-align: center;
  padding: 32px 16px;
  color: var(--color-text-secondary, #6b7280);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.pending-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (max-width: 1024px) {
  .tutor-calendar-view {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .tutor-calendar-view {
    padding: 16px;
  }

  .calendar-legend {
    flex-wrap: wrap;
    gap: 12px;
  }
}
</style>
