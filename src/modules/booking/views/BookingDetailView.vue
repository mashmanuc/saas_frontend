<script setup lang="ts">
// F7: Booking Detail View
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  BookOpen,
  DollarSign,
  Video,
} from 'lucide-vue-next'
import { useBookingStore } from '../stores/bookingStore'
import { useBooking } from '../composables/useBooking'

// Components
import BookingStatus from '../components/booking/BookingStatus.vue'
import BookingActions from '../components/booking/BookingActions.vue'
import ClassroomButton from '@/components/buttons/ClassroomButton.vue'
import Button from '@/ui/Button.vue'

const route = useRoute()
const router = useRouter()
const store = useBookingStore()

const bookingId = computed(() => Number(route.params.id))
const { booking, isLoading, canCancel, canReschedule, canJoin, cancel, joinLesson } =
  useBooking(bookingId.value)

const { currentBooking } = storeToRefs(store)

// v0.24.2: Determine if current user is student
const isStudent = computed(() => {
  // This would typically come from auth store
  // For now, check if user is not the tutor
  return true // Default to student view
})

// Format helpers
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function goBack() {
  router.back()
}

async function handleCancel() {
  if (confirm('Are you sure you want to cancel this booking?')) {
    await cancel()
  }
}

function handleReschedule() {
  if (booking.value) {
    router.push(`/bookings/${booking.value.id}/reschedule`)
  }
}
</script>

<template>
  <div class="booking-detail-view">
    <!-- Header -->
    <header class="view-header">
      <Button variant="ghost" size="sm" @click="goBack">
        <template #iconLeft><ArrowLeft :size="20" /></template>
        Back
      </Button>
      <h1>Booking Details</h1>
    </header>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner" />
      <p>Loading booking...</p>
    </div>

    <!-- Content -->
    <div v-else-if="currentBooking" class="booking-content">
      <!-- Status Card -->
      <div class="status-card">
        <BookingStatus :status="currentBooking.status" large />
        <p class="booking-id">Booking #{{ currentBooking.booking_id }}</p>
      </div>

      <!-- Main Info -->
      <div class="info-grid">
        <!-- Date & Time -->
        <div class="info-card">
          <div class="info-icon">
            <Calendar :size="24" />
          </div>
          <div class="info-content">
            <h3>Date & Time</h3>
            <p class="info-primary">
              {{ formatDate(currentBooking.time_slot.start_datetime) }}
            </p>
            <p class="info-secondary">
              {{ formatTime(currentBooking.time_slot.start_datetime) }} -
              {{ formatTime(currentBooking.time_slot.end_datetime) }}
            </p>
          </div>
        </div>

        <!-- Duration -->
        <div class="info-card">
          <div class="info-icon">
            <Clock :size="24" />
          </div>
          <div class="info-content">
            <h3>Duration</h3>
            <p class="info-primary">
              {{ currentBooking.time_slot.duration_minutes }} minutes
            </p>
            <p class="info-secondary">
              {{ currentBooking.lesson_type === 'trial' ? 'Trial Lesson' : 'Regular Lesson' }}
            </p>
          </div>
        </div>

        <!-- Subject -->
        <div class="info-card">
          <div class="info-icon">
            <BookOpen :size="24" />
          </div>
          <div class="info-content">
            <h3>Subject</h3>
            <p class="info-primary">{{ currentBooking.subject }}</p>
          </div>
        </div>

        <!-- Price -->
        <div class="info-card">
          <div class="info-icon">
            <DollarSign :size="24" />
          </div>
          <div class="info-content">
            <h3>Price</h3>
            <p class="info-primary">
              {{ currentBooking.currency }}{{ currentBooking.price }}
            </p>
          </div>
        </div>
      </div>

      <!-- Participants -->
      <section class="participants-section">
        <h2>Participants</h2>
        <div class="participants-grid">
          <!-- Tutor -->
          <div class="participant-card">
            <div class="participant-avatar">
              <img
                v-if="currentBooking.tutor.photo"
                :src="currentBooking.tutor.photo"
                :alt="currentBooking.tutor.first_name"
              />
              <User v-else :size="32" />
            </div>
            <div class="participant-info">
              <span class="participant-role">Tutor</span>
              <span class="participant-name">
                {{ currentBooking.tutor.first_name }}
                {{ currentBooking.tutor.last_name }}
              </span>
            </div>
          </div>

          <!-- Student -->
          <div class="participant-card">
            <div class="participant-avatar">
              <img
                v-if="currentBooking.student.photo"
                :src="currentBooking.student.photo"
                :alt="currentBooking.student.first_name"
              />
              <User v-else :size="32" />
            </div>
            <div class="participant-info">
              <span class="participant-role">Student</span>
              <span class="participant-name">
                {{ currentBooking.student.first_name }}
                {{ currentBooking.student.last_name }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Notes -->
      <section v-if="currentBooking.student_notes" class="notes-section">
        <h2>Notes</h2>
        <div class="notes-card">
          <p>{{ currentBooking.student_notes }}</p>
        </div>
      </section>

      <!-- Classroom Entry -->
      <section v-if="currentBooking.classroom_session" class="classroom-section">
        <h2>Classroom</h2>
        <ClassroomButton
          :booking-id="currentBooking.id"
          :session-id="currentBooking.classroom_session.uuid"
          :session-status="currentBooking.classroom_session.status"
          :scheduled-start="currentBooking.time_slot.start_datetime"
          :user-role="isStudent ? 'student' : 'tutor'"
        />
      </section>

      <!-- Actions -->
      <section class="actions-section">
        <BookingActions
          :can-cancel="canCancel"
          :can-reschedule="canReschedule"
          :can-join="canJoin"
          @cancel="handleCancel"
          @reschedule="handleReschedule"
          @join="joinLesson"
        />
      </section>
    </div>

    <!-- Not Found -->
    <div v-else class="error-state">
      <p>Booking not found</p>
      <Button variant="secondary" @click="goBack">Go Back</Button>
    </div>
  </div>
</template>

<style scoped>
.booking-detail-view {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--space-lg);
}

.view-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}

.view-header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

/* Loading */
.loading-state {
  text-align: center;
  padding: 60px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Status Card */
.status-card {
  text-align: center;
  padding: 24px;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  margin-bottom: var(--space-lg);
}

.booking-id {
  margin: 12px 0 0;
  font-size: 14px;
  color: var(--text-secondary);
}

/* Info Grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.info-card {
  display: flex;
  gap: 16px;
  padding: 20px;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
}

.info-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  color: var(--accent);
  border-radius: 12px;
  flex-shrink: 0;
}

.info-content h3 {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.info-primary {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.info-secondary {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--text-secondary);
}

/* Sections */
section {
  margin-bottom: 24px;
}

section h2 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 16px;
}

/* Participants */
.participants-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.participant-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
}

.participant-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--text-secondary);
}

.participant-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.participant-info {
  display: flex;
  flex-direction: column;
}

.participant-role {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.participant-name {
  font-weight: 600;
  color: var(--text-primary);
}

/* Notes */
.notes-card {
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
}

.notes-card p {
  margin: 0;
  font-size: 14px;
  color: var(--text-primary);
  white-space: pre-wrap;
}

/* Actions */
.actions-section {
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

/* Error */
.error-state {
  text-align: center;
  padding: 60px 20px;
}


@media (max-width: 640px) {
  .booking-detail-view {
    padding: 16px;
  }

  .info-grid,
  .participants-grid {
    grid-template-columns: 1fr;
  }
}
</style>
