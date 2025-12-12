<script setup lang="ts">
// F4: Book Lesson View
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ArrowLeft, Clock, DollarSign, CheckCircle } from 'lucide-vue-next'
import { useCalendarStore } from '../stores/calendarStore'
import { useBookingStore } from '../stores/bookingStore'
import { marketplaceApi } from '@/modules/marketplace/api/marketplace'
import type { TutorProfile } from '@/modules/marketplace/api/marketplace'
import type { BookingInput } from '../api/booking'

// Components
import SlotPicker from '../components/booking/SlotPicker.vue'
import BookingForm from '../components/booking/BookingForm.vue'

const route = useRoute()
const router = useRouter()
const calendarStore = useCalendarStore()
const bookingStore = useBookingStore()

const tutorSlug = computed(() => route.params.slug as string)
const tutor = ref<TutorProfile | null>(null)
const isLoadingTutor = ref(false)

const { selectedSlot, isLoading: isLoadingSlots } = storeToRefs(calendarStore)

// Booking form state
const subject = ref('')
const lessonType = ref<'trial' | 'regular'>('regular')
const notes = ref('')
const isSubmitting = ref(false)
const bookingSuccess = ref(false)
const createdBookingId = ref<number | null>(null)

// Computed
const canSubmit = computed(() => {
  return selectedSlot.value && subject.value && !isSubmitting.value
})

const price = computed(() => {
  if (!tutor.value || !selectedSlot.value) return 0
  if (lessonType.value === 'trial') {
    return tutor.value.trial_price || 0
  }
  return tutor.value.hourly_rate || 0
})

// Load tutor
onMounted(async () => {
  isLoadingTutor.value = true
  try {
    tutor.value = await marketplaceApi.getTutorBySlug(tutorSlug.value)
    if (tutor.value) {
      // Load slots for this tutor
      await calendarStore.loadWeekSlots(tutor.value.id)
      // Set default subject if tutor has subjects
      if (tutor.value.subjects?.length) {
        subject.value = tutor.value.subjects[0].name
      }
    }
  } catch (e) {
    console.error('Failed to load tutor:', e)
  } finally {
    isLoadingTutor.value = false
  }
})

// Reload slots when week changes
watch(
  () => calendarStore.selectedDate,
  async () => {
    if (tutor.value) {
      await calendarStore.loadWeekSlots(tutor.value.id)
    }
  }
)

// Submit booking
async function handleSubmit() {
  if (!canSubmit.value || !tutor.value || !selectedSlot.value) return

  isSubmitting.value = true

  try {
    const data: BookingInput = {
      tutor_id: tutor.value.id,
      slot_id: selectedSlot.value.id,
      subject: subject.value,
      lesson_type: lessonType.value,
      student_notes: notes.value,
    }

    const booking = await bookingStore.createBooking(data)
    createdBookingId.value = booking.id
    bookingSuccess.value = true
  } catch (e) {
    console.error('Failed to create booking:', e)
  } finally {
    isSubmitting.value = false
  }
}

function goBack() {
  router.back()
}

function viewBooking() {
  if (createdBookingId.value) {
    router.push(`/bookings/${createdBookingId.value}`)
  }
}

function goToLessons() {
  router.push('/my-lessons')
}
</script>

<template>
  <div class="book-lesson-view">
    <!-- Header -->
    <header class="view-header">
      <button class="back-btn" @click="goBack">
        <ArrowLeft :size="20" />
        Back
      </button>
      <h1>Book a Lesson</h1>
    </header>

    <!-- Success State -->
    <div v-if="bookingSuccess" class="success-state">
      <div class="success-icon">
        <CheckCircle :size="64" />
      </div>
      <h2>Booking Confirmed!</h2>
      <p>Your lesson has been booked successfully.</p>
      <div class="success-actions">
        <button class="btn btn-primary" @click="viewBooking">
          View Booking
        </button>
        <button class="btn btn-secondary" @click="goToLessons">
          My Lessons
        </button>
      </div>
    </div>

    <!-- Booking Flow -->
    <div v-else class="booking-flow">
      <!-- Loading -->
      <div v-if="isLoadingTutor" class="loading-state">
        <div class="spinner" />
        <p>Loading tutor information...</p>
      </div>

      <!-- Content -->
      <template v-else-if="tutor">
        <!-- Tutor Info -->
        <section class="tutor-info">
          <img
            :src="tutor.photo || '/default-avatar.png'"
            :alt="tutor.display_name"
            class="tutor-photo"
          />
          <div class="tutor-details">
            <h2>{{ tutor.display_name }}</h2>
            <p class="tutor-headline">{{ tutor.headline }}</p>
            <div class="tutor-meta">
              <span class="price">
                <DollarSign :size="16" />
                ${{ tutor.hourly_rate }}/hour
              </span>
              <span class="duration">
                <Clock :size="16" />
                {{ tutor.lesson_duration || 60 }} min
              </span>
            </div>
          </div>
        </section>

        <!-- Slot Picker -->
        <section class="slot-section">
          <h3>Select a Time</h3>
          <SlotPicker :tutor-id="tutor.id" :loading="isLoadingSlots" />
        </section>

        <!-- Booking Form -->
        <section v-if="selectedSlot" class="form-section">
          <h3>Lesson Details</h3>
          <BookingForm
            v-model:subject="subject"
            v-model:lesson-type="lessonType"
            v-model:notes="notes"
            :subjects="tutor.subjects || []"
            :trial-available="!!tutor.trial_price"
          />
        </section>

        <!-- Price Summary -->
        <section v-if="selectedSlot" class="summary-section">
          <h3>Summary</h3>
          <div class="summary-card">
            <div class="summary-row">
              <span>Date & Time</span>
              <span>{{ new Date(selectedSlot.start_datetime).toLocaleString() }}</span>
            </div>
            <div class="summary-row">
              <span>Duration</span>
              <span>{{ selectedSlot.duration_minutes }} minutes</span>
            </div>
            <div class="summary-row">
              <span>Lesson Type</span>
              <span>{{ lessonType === 'trial' ? 'Trial Lesson' : 'Regular Lesson' }}</span>
            </div>
            <div class="summary-row total">
              <span>Total</span>
              <span>${{ price }}</span>
            </div>
          </div>

          <button
            class="btn btn-primary btn-block"
            :disabled="!canSubmit"
            @click="handleSubmit"
          >
            {{ isSubmitting ? 'Booking...' : 'Confirm Booking' }}
          </button>
        </section>
      </template>

      <!-- Error -->
      <div v-else class="error-state">
        <p>Tutor not found</p>
        <button class="btn btn-secondary" @click="goBack">Go Back</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.book-lesson-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

.view-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: none;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--color-bg-secondary, #f5f5f5);
}

.view-header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

/* Success State */
.success-state {
  text-align: center;
  padding: 60px 20px;
}

.success-icon {
  color: var(--color-success, #10b981);
  margin-bottom: 24px;
}

.success-state h2 {
  font-size: 1.5rem;
  margin: 0 0 8px;
}

.success-state p {
  color: var(--color-text-secondary, #6b7280);
  margin: 0 0 32px;
}

.success-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

/* Loading */
.loading-state {
  text-align: center;
  padding: 60px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Tutor Info */
.tutor-info {
  display: flex;
  gap: 16px;
  padding: 20px;
  background: var(--color-bg-primary, white);
  border-radius: 12px;
  border: 1px solid var(--color-border, #e5e7eb);
  margin-bottom: 24px;
}

.tutor-photo {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
}

.tutor-details h2 {
  margin: 0 0 4px;
  font-size: 1.25rem;
}

.tutor-headline {
  color: var(--color-text-secondary, #6b7280);
  margin: 0 0 12px;
  font-size: 14px;
}

.tutor-meta {
  display: flex;
  gap: 16px;
}

.tutor-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
}

.tutor-meta .price {
  color: var(--color-primary, #3b82f6);
  font-weight: 600;
}

/* Sections */
section {
  margin-bottom: 24px;
}

section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 16px;
}

/* Summary */
.summary-card {
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
}

.summary-row:not(:last-child) {
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.summary-row.total {
  font-weight: 600;
  font-size: 16px;
  color: var(--color-primary, #3b82f6);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark, #2563eb);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-bg-secondary, #f5f5f5);
  color: var(--color-text-primary, #111827);
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.btn-block {
  width: 100%;
}

/* Error */
.error-state {
  text-align: center;
  padding: 60px 20px;
}

@media (max-width: 640px) {
  .book-lesson-view {
    padding: 16px;
  }

  .tutor-info {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .tutor-meta {
    justify-content: center;
  }

  .success-actions {
    flex-direction: column;
  }
}
</style>
