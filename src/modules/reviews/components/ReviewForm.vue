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
      <Textarea
        v-model="reviewText"
        :placeholder="$t('reviews.reviewPlaceholder')"
        :rows="6"
        :maxlength="2000"
      />
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
      <Button
        variant="primary"
        :disabled="!canSubmit"
        :loading="submitting"
        fullWidth
        @click="submitReview"
      >
        {{ $t('reviews.submitReview') }}
      </Button>
      <Button
        variant="secondary"
        @click="$emit('cancel')"
      >
        {{ $t('common.cancel') }}
      </Button>
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
import Button from '@/ui/Button.vue'
import Textarea from '@/ui/Textarea.vue'

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
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.form-header {
  margin-bottom: var(--space-lg);
}

.form-header h3 {
  margin: 0 0 var(--space-xs);
  font-size: var(--text-xl);
  color: var(--text-primary);
}

.subtitle {
  color: var(--text-secondary);
  margin: 0;
}

.rating-section {
  margin-bottom: var(--space-lg);
}

.section-label {
  display: block;
  font-weight: 500;
  margin-bottom: var(--space-sm);
  color: var(--text-primary);
}

.star-rating {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-xs);
}

.star-btn {
  font-size: 32px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--border-color);
  transition: color 0.2s;
  padding: 0;
  line-height: 1;
}

.star-btn:hover,
.star-btn--hover,
.star-btn--active {
  color: var(--warning-bg);
}

.rating-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.text-section {
  margin-bottom: var(--space-lg);
}

.char-count {
  float: right;
  font-weight: normal;
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.error-message {
  color: var(--danger-bg);
  font-size: var(--text-sm);
  margin: var(--space-xs) 0 0;
}

.anonymous-section {
  margin-bottom: var(--space-lg);
}

.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  cursor: pointer;
}

.checkbox-label input {
  display: none;
}

.checkmark {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  margin-top: 2px;
}

.checkbox-label input:checked + .checkmark {
  background: var(--accent);
  border-color: var(--accent);
}

.label-text {
  display: flex;
  flex-direction: column;
  font-size: 15px;
  color: var(--text-primary);
}

.label-text small {
  color: var(--text-secondary);
  font-size: var(--text-xs);
}

.warnings {
  margin-bottom: var(--space-lg);
  padding: var(--space-sm) var(--space-md);
  background: color-mix(in srgb, var(--success-bg) 10%, transparent);
  border-radius: var(--radius-md);
}

.edit-warning {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--success-bg);
}

.form-actions {
  display: flex;
  gap: var(--space-sm);
}

.already-reviewed {
  margin-top: var(--space-lg);
  padding: var(--space-md);
  background: color-mix(in srgb, var(--warning-bg) 15%, transparent);
  border-radius: var(--radius-md);
  color: var(--warning-bg);
}

.already-reviewed p {
  margin: 0;
}
</style>
