<script setup lang="ts">
// F3: Write Review View
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ArrowLeft, CheckCircle } from 'lucide-vue-next'
import { useReviewStore } from '../stores/reviewStore'
import type { Booking, ReviewInput } from '../api/reviews'
import ReviewForm from '../components/forms/ReviewForm.vue'
import Button from '@/ui/Button.vue'

const route = useRoute()
const router = useRouter()
const store = useReviewStore()

const { eligibility, isLoading, error, canWriteReview, eligibleBookings } =
  storeToRefs(store)

const tutorId = computed(() => Number(route.params.tutorId))
const selectedBooking = ref<Booking | null>(null)
const isSubmitting = ref(false)
const isSuccess = ref(false)

onMounted(async () => {
  await store.checkEligibility(tutorId.value)

  // Auto-select if only one booking
  if (eligibleBookings.value.length === 1) {
    selectedBooking.value = eligibleBookings.value[0]
  }
})

function selectBooking(booking: Booking) {
  selectedBooking.value = booking
}

async function handleSubmit(formData: Partial<ReviewInput>) {
  if (!selectedBooking.value) return

  isSubmitting.value = true

  try {
    const data: ReviewInput = {
      booking_id: selectedBooking.value.id,
      tutor_id: tutorId.value,
      rating: formData.rating!,
      content: formData.content!,
      title: formData.title,
      rating_communication: formData.rating_communication,
      rating_knowledge: formData.rating_knowledge,
      rating_punctuality: formData.rating_punctuality,
      is_anonymous: formData.is_anonymous,
    }

    await store.createReview(data)
    isSuccess.value = true
  } catch (e) {
    console.error('Failed to submit review:', e)
  } finally {
    isSubmitting.value = false
  }
}

function goToTutor() {
  router.push(`/tutors/${tutorId.value}`)
}

function goBack() {
  router.back()
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="write-review-view">
    <!-- Header -->
    <header class="view-header">
      <Button variant="ghost" size="sm" iconOnly @click="goBack">
        <ArrowLeft :size="20" />
      </Button>
      <h1>Write a Review</h1>
    </header>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner" />
      <p>Checking eligibility...</p>
    </div>

    <!-- Not Eligible -->
    <div v-else-if="!canWriteReview" class="not-eligible">
      <div class="message-card">
        <h2>Cannot Write Review</h2>
        <p>{{ eligibility?.reason || 'You are not eligible to review this tutor.' }}</p>
        <Button variant="primary" @click="goBack">Go Back</Button>
      </div>
    </div>

    <!-- Success -->
    <div v-else-if="isSuccess" class="success-state">
      <div class="success-card">
        <CheckCircle :size="64" class="success-icon" />
        <h2>Thank You!</h2>
        <p>Your review has been submitted successfully.</p>
        <Button variant="primary" @click="goToTutor">
          View Tutor Profile
        </Button>
      </div>
    </div>

    <!-- Select Booking -->
    <div v-else-if="!selectedBooking && eligibleBookings.length > 1" class="select-booking">
      <h2>Select a Lesson to Review</h2>
      <p class="hint">Choose which lesson you'd like to review</p>

      <div class="bookings-list">
        <div
          v-for="booking in eligibleBookings"
          :key="booking.id"
          class="booking-option"
          @click="selectBooking(booking)"
        >
          <div class="booking-info">
            <span class="subject">{{ booking.subject }}</span>
            <span class="date">{{ formatDate(booking.date) }}</span>
          </div>
          <span class="booking-id">#{{ booking.booking_id }}</span>
        </div>
      </div>
    </div>

    <!-- Review Form -->
    <div v-else-if="selectedBooking" class="review-form-container">
      <!-- Booking Info -->
      <div class="booking-summary">
        <div class="tutor-info">
          <div class="avatar">
            {{ (selectedBooking.tutor.display_name || selectedBooking.tutor.full_name)?.charAt(0) || '?' }}
          </div>
          <div class="details">
            <span class="name">
              {{ selectedBooking.tutor.display_name || selectedBooking.tutor.full_name }}
            </span>
            <span class="lesson">
              {{ selectedBooking.subject }} • {{ formatDate(selectedBooking.date) }}
            </span>
          </div>
        </div>

        <Button
          v-if="eligibleBookings.length > 1"
          variant="outline"
          size="sm"
          @click="selectedBooking = null"
        >
          Change
        </Button>
      </div>

      <!-- Form -->
      <ReviewForm
        :is-submitting="isSubmitting"
        @submit="handleSubmit"
        @cancel="goBack"
      />
    </div>

    <!-- Error -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.write-review-view {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px 16px;
}

.view-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}


.view-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

/* Loading */
.loading-state {
  text-align: center;
  padding: 64px 0;
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

/* Not Eligible */
.not-eligible,
.success-state {
  display: flex;
  justify-content: center;
  padding: 64px 0;
}

.message-card,
.success-card {
  text-align: center;
  padding: 32px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  max-width: 400px;
}

.message-card h2,
.success-card h2 {
  margin: 0 0 8px;
  font-size: 20px;
}

.message-card p,
.success-card p {
  margin: 0 0 24px;
  color: var(--color-text-secondary, #6b7280);
}

.success-icon {
  color: var(--color-success, #10b981);
  margin-bottom: 16px;
}

/* Select Booking */
.select-booking h2 {
  margin: 0 0 4px;
  font-size: 18px;
}

.select-booking .hint {
  margin: 0 0 24px;
  color: var(--color-text-secondary, #6b7280);
}

.bookings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.booking-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.booking-option:hover {
  border-color: var(--color-primary, #3b82f6);
  background: var(--color-primary-light, #eff6ff);
}

.booking-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.subject {
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.date {
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
}

.booking-id {
  font-size: 12px;
  color: var(--color-text-tertiary, #9ca3af);
}

/* Booking Summary */
.booking-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 12px;
  margin-bottom: 24px;
}

.tutor-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary, #3b82f6);
  color: white;
  font-size: 18px;
  font-weight: 600;
  border-radius: 50%;
}

.details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name {
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.lesson {
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
}


/* Error */
.error-message {
  margin-top: 16px;
  padding: 12px;
  background: var(--color-danger-light, #fee2e2);
  color: var(--color-danger, #ef4444);
  border-radius: 8px;
  font-size: 14px;
}
</style>
