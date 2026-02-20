<script setup lang="ts">
// F4: Book Lesson View
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ArrowLeft, Clock, DollarSign, CheckCircle } from 'lucide-vue-next'
import { useBookingStore } from '../stores/bookingStore'
import marketplaceApi from '@/modules/marketplace/api/marketplace'
import type { TutorProfileFull } from '@/modules/marketplace/api/marketplace'
import type { BookingInput } from '../api/booking'

// Components
import SlotPicker from '../components/booking/SlotPicker.vue'
import BookingForm from '../components/booking/BookingForm.vue'
import Button from '@/ui/Button.vue'

const route = useRoute()
const router = useRouter()
const bookingStore = useBookingStore()

const tutorSlug = computed(() => route.params.slug as string)
const tutor = ref<TutorProfileFull | null>(null)
const isLoadingTutor = ref(false)
const selectedSlot = ref<any>(null)
const isLoadingSlots = ref(false)

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
    return tutor.value.pricing?.trial_lesson_price || 0
  }
  return tutor.value.pricing?.hourly_rate || 0
})

// Load tutor
onMounted(async () => {
  isLoadingTutor.value = true
  try {
    tutor.value = await marketplaceApi.getTutorProfile(tutorSlug.value)
    if (tutor.value) {
      // Note: Calendar loading would require tutor ID from a separate endpoint
      // TutorProfileFull doesn't include id, only slug
      // For now, skip calendar loading until we have proper public calendar API
      isLoadingSlots.value = false
      
      // Set default subject if tutor has subjects
      if (tutor.value.subjects?.length) {
        // v0.60.1: Use 'title' instead of 'name' for SubjectPublic
        subject.value = tutor.value.subjects[0].title || tutor.value.subjects[0].code
      }
    }
  } catch (e) {
    console.error('Failed to load tutor:', e)
  } finally {
    isLoadingTutor.value = false
  }
})

// Submit booking
async function handleSubmit() {
  if (!canSubmit.value || !tutor.value || !selectedSlot.value) return

  isSubmitting.value = true

  try {
    // Note: TutorProfileFull doesn't have id field
    // Need to get tutor ID from slug or use different booking flow
    const data: BookingInput = {
      tutor_id: 0, // TODO: Get tutor ID from slug or use slug-based booking
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
      <Button variant="ghost" size="sm" @click="goBack">
        <template #iconLeft><ArrowLeft :size="20" /></template>
        Back
      </Button>
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
        <Button variant="primary" @click="viewBooking">
          View Booking
        </Button>
        <Button variant="secondary" @click="goToLessons">
          My Lessons
        </Button>
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
            :src="tutor.media?.photo_url || '/default-avatar.png'"
            :alt="tutor.slug"
            class="tutor-photo"
          />
          <div class="tutor-details">
            <h2>{{ tutor.slug }}</h2>
            <p class="tutor-headline">{{ tutor.headline }}</p>
            <div class="tutor-meta">
              <span class="price">
                <DollarSign :size="16" />
                ${{ tutor.pricing?.hourly_rate }}/hour
              </span>
              <span class="duration">
                <Clock :size="16" />
                {{ selectedSlot?.duration_minutes || 60 }} min
              </span>
            </div>
          </div>
        </section>

        <!-- Slot Picker -->
        <section class="slot-section">
          <h3>Select a Time</h3>
          <!-- Note: SlotPicker needs tutor ID, but TutorProfileFull only has slug -->
          <p class="text-muted">Slot picker temporarily disabled - TutorProfileFull migration in progress</p>
        </section>

        <!-- Booking Form -->
        <section v-if="selectedSlot" class="form-section">
          <h3>Lesson Details</h3>
          <BookingForm
            v-model:subject="subject"
            v-model:lesson-type="lessonType"
            v-model:notes="notes"
            :subjects="tutor.subjects || []"
            :trial-available="!!tutor.pricing?.trial_lesson_price"
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

          <Button
            variant="primary"
            fullWidth
            :disabled="!canSubmit"
            :loading="isSubmitting"
            @click="handleSubmit"
          >
            Confirm Booking
          </Button>
        </section>
      </template>

      <!-- Error -->
      <div v-else class="error-state">
        <p>Tutor not found</p>
        <Button variant="secondary" @click="goBack">Go Back</Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.book-lesson-view {
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

/* Success State */
.success-state {
  text-align: center;
  padding: 60px 20px;
}

.success-icon {
  color: var(--success);
  margin-bottom: var(--space-lg);
}

.success-state h2 {
  font-size: 1.5rem;
  margin: 0 0 8px;
}

.success-state p {
  color: var(--text-secondary);
  margin: 0 0 var(--space-xl);
}

.success-actions {
  display: flex;
  gap: var(--space-sm);
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

/* Tutor Info */
.tutor-info {
  display: flex;
  gap: 16px;
  padding: 20px;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  margin-bottom: var(--space-lg);
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
  color: var(--text-secondary);
  margin: 0 0 var(--space-sm);
  font-size: var(--text-sm);
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
  color: var(--text-secondary);
}

.tutor-meta .price {
  color: var(--accent);
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
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  margin-bottom: var(--space-md);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
}

.summary-row:not(:last-child) {
  border-bottom: 1px solid var(--border-color);
}

.summary-row.total {
  font-weight: 600;
  font-size: 16px;
  color: var(--accent);
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
