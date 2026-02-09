<template>
  <div class="review-form">
    <div class="form-header">
      <h3>{{ $t('reviews.writeReview') }}</h3>
      <p class="subtitle">{{ $t('reviews.writeReviewSubtitle') }}</p>
    </div>

    <!-- Rating Selection -->
    <div class="rating-section">
      <label class="section-label">{{ $t('reviews.yourRating') }}</label>
      <div class="star-rating">
        <button
          v-for="n in 5"
          :key="n"
          type="button"
          class="star-btn"
          :class="{ 'star-btn--active': n <= rating, 'star-btn--hover': n <= hoverRating }"
          @mouseenter="hoverRating = n"
          @mouseleave="hoverRating = 0"
          @click="rating = n"
        >
          ★
        </button>
      </div>
      <span class="rating-label">{{ ratingLabel }}</span>
    </div>

    <!-- Text Input -->
    <div class="text-section">
      <label class="section-label">
        {{ $t('reviews.yourReview') }}
        <span class="char-count">{{ reviewText.length }}/2000</span>
      </label>
      <textarea
        v-model="reviewText"
        class="review-textarea"
        :placeholder="$t('reviews.reviewPlaceholder')"
        rows="6"
        maxlength="2000"
      ></textarea>
      <p v-if="textError" class="error-message">{{ textError }}</p>
    </div>

    <!-- Anonymous Option -->
    <div class="anonymous-section">
      <label class="checkbox-label">
        <input
          type="checkbox"
          v-model="isAnonymous"
        />
        <span class="checkmark"></span>
        <span class="label-text">
          {{ $t('reviews.anonymousLabel') }}
          <small>{{ $t('reviews.anonymousHint') }}</small>
        </span>
      </label>
    </div>

    <!-- Warnings -->
    <div class="warnings">
      <p class="edit-warning">
        <i class="icon-info"></i>
        {{ $t('reviews.editWarning') }}
      </p>
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <button
        type="button"
        class="btn-submit"
        :disabled="!canSubmit || submitting"
        @click="submitReview"
      >
        <span v-if="submitting">{{ $t('common.sending') }}...</span>
        <span v-else>{{ $t('reviews.submitReview') }}</span>
      </button>
      <button
        type="button"
        class="btn-cancel"
        @click="$emit('cancel')"
      >
        {{ $t('common.cancel') }}
      </button>
    </div>

    <!-- Already Reviewed Message -->
    <div v-if="canReviewData && !canReviewData.can_review" class="already-reviewed">
      <p v-if="canReviewData.reason === 'already_reviewed'">
        {{ $t('reviews.alreadyReviewed') }}
      </p>
      <p v-else-if="canReviewData.reason === 'no_completed_lessons'">
        {{ $t('reviews.noCompletedLessons') }}
      </p>
      <p v-else-if="canReviewData.reason === 'too_soon'">
        {{ $t('reviews.tooSoon') }}
      </p>
      <p v-else-if="canReviewData.reason === 'blocked'">
        {{ $t('reviews.reviewBlocked') }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useReviewsStore } from '../stores/reviewsStore'

const props = defineProps({
  tutorId: {
    type: Number,
    required: true
  },
  tutorName: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['success', 'cancel'])

const store = useReviewsStore()

// Form state
const rating = ref(0)
const hoverRating = ref(0)
const reviewText = ref('')
const isAnonymous = ref(false)
const submitting = ref(false)
const textError = ref('')

// Check eligibility on mount
const canReviewData = computed(() => store.canReviewTutor(props.tutorId))

onMounted(async () => {
  await store.checkCanReview(props.tutorId)
})

// Computed
const ratingLabel = computed(() => {
  const labels = {
    0: $t('reviews.selectRating'),
    1: $t('reviews.rating.poor'),
    2: $t('reviews.rating.fair'),
    3: $t('reviews.rating.average'),
    4: $t('reviews.rating.good'),
    5: $t('reviews.rating.excellent')
  }
  return labels[rating.value] || ''
})

const canSubmit = computed(() => {
  return rating.value > 0 && 
         reviewText.value.trim().length >= 50 && 
         reviewText.value.trim().length <= 2000 &&
         canReviewData.value?.can_review
})

// Watch for text validation
watch(reviewText, (val) => {
  if (val.length < 50 && val.length > 0) {
    textError.value = $t('reviews.minLengthError', { min: 50 })
  } else {
    textError.value = ''
  }
})

// Methods
async function submitReview() {
  if (!canSubmit.value || submitting.value) return
  
  submitting.value = true
  
  try {
    const review = await store.createReview({
      tutor_id: props.tutorId,
      rating: rating.value,
      text: reviewText.value.trim(),
      is_anonymous: isAnonymous.value
    })
    
    emit('success', review)
    
    // Reset form
    rating.value = 0
    reviewText.value = ''
    isAnonymous.value = false
  } catch (error) {
    console.error('Failed to submit review:', error)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.review-form {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
}

.form-header {
  margin-bottom: 24px;
}

.form-header h3 {
  margin: 0 0 8px;
  font-size: 20px;
  color: #111827;
}

.subtitle {
  color: #6b7280;
  margin: 0;
}

.rating-section {
  margin-bottom: 24px;
}

.section-label {
  display: block;
  font-weight: 500;
  margin-bottom: 12px;
  color: #374151;
}

.star-rating {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.star-btn {
  font-size: 32px;
  background: none;
  border: none;
  cursor: pointer;
  color: #e5e7eb;
  transition: color 0.2s;
  padding: 0;
  line-height: 1;
}

.star-btn:hover,
.star-btn--hover,
.star-btn--active {
  color: #fbbf24;
}

.rating-label {
  font-size: 14px;
  color: #6b7280;
}

.text-section {
  margin-bottom: 20px;
}

.review-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  resize: vertical;
  font-family: inherit;
  font-size: 15px;
}

.review-textarea:focus {
  outline: none;
  border-color: #3b82f6;
}

.char-count {
  float: right;
  font-weight: normal;
  color: #9ca3af;
  font-size: 14px;
}

.error-message {
  color: #ef4444;
  font-size: 14px;
  margin: 8px 0 0;
}

.anonymous-section {
  margin-bottom: 20px;
}

.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
}

.checkbox-label input {
  display: none;
}

.checkmark {
  width: 20px;
  height: 20px;
  border: 2px solid #d1d5db;
  border-radius: 4px;
  flex-shrink: 0;
  margin-top: 2px;
}

.checkbox-label input:checked + .checkmark {
  background: #3b82f6;
  border-color: #3b82f6;
}

.label-text {
  display: flex;
  flex-direction: column;
  font-size: 15px;
  color: #374151;
}

.label-text small {
  color: #9ca3af;
  font-size: 13px;
}

.warnings {
  margin-bottom: 24px;
  padding: 12px 16px;
  background: #f0fdf4;
  border-radius: 8px;
}

.edit-warning {
  margin: 0;
  font-size: 14px;
  color: #166534;
}

.form-actions {
  display: flex;
  gap: 12px;
}

.btn-submit {
  flex: 1;
  padding: 12px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-submit:hover:not(:disabled) {
  background: #2563eb;
}

.btn-submit:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.btn-cancel {
  padding: 12px 24px;
  background: #f3f4f6;
  color: #6b7280;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-cancel:hover {
  background: #e5e7eb;
}

.already-reviewed {
  margin-top: 24px;
  padding: 16px;
  background: #fef3c7;
  border-radius: 8px;
  color: #92400e;
}

.already-reviewed p {
  margin: 0;
}
</style>
