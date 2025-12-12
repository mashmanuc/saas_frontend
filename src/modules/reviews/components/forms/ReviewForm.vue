<script setup lang="ts">
// F12: Review Form Component
import { ref, computed } from 'vue'
import StarRating from './StarRating.vue'
import DetailedRating from './DetailedRating.vue'

const props = defineProps<{
  isSubmitting?: boolean
  initialData?: {
    rating?: number
    title?: string
    content?: string
    is_anonymous?: boolean
    rating_communication?: number
    rating_knowledge?: number
    rating_punctuality?: number
  }
}>()

const emit = defineEmits<{
  submit: [data: {
    rating: number
    title?: string
    content: string
    is_anonymous?: boolean
    rating_communication?: number
    rating_knowledge?: number
    rating_punctuality?: number
  }]
  cancel: []
}>()

// Form state
const rating = ref(props.initialData?.rating || 0)
const title = ref(props.initialData?.title || '')
const content = ref(props.initialData?.content || '')
const isAnonymous = ref(props.initialData?.is_anonymous || false)
const showDetailedRatings = ref(false)
const detailedRatings = ref({
  communication: props.initialData?.rating_communication || 0,
  knowledge: props.initialData?.rating_knowledge || 0,
  punctuality: props.initialData?.rating_punctuality || 0,
})

const maxContentLength = 2000
const contentLength = computed(() => content.value.length)
const isValid = computed(() => rating.value > 0 && content.value.trim().length >= 10)

function handleSubmit() {
  if (!isValid.value) return

  const data: any = {
    rating: rating.value,
    content: content.value.trim(),
    is_anonymous: isAnonymous.value,
  }

  if (title.value.trim()) {
    data.title = title.value.trim()
  }

  if (showDetailedRatings.value) {
    if (detailedRatings.value.communication > 0) {
      data.rating_communication = detailedRatings.value.communication
    }
    if (detailedRatings.value.knowledge > 0) {
      data.rating_knowledge = detailedRatings.value.knowledge
    }
    if (detailedRatings.value.punctuality > 0) {
      data.rating_punctuality = detailedRatings.value.punctuality
    }
  }

  emit('submit', data)
}
</script>

<template>
  <form class="review-form" @submit.prevent="handleSubmit">
    <!-- Overall Rating -->
    <div class="form-section">
      <label class="section-label required">Overall Rating</label>
      <StarRating v-model="rating" size="lg" />
      <span v-if="rating === 0" class="hint error">Please select a rating</span>
    </div>

    <!-- Detailed Ratings Toggle -->
    <div class="form-section">
      <button
        type="button"
        class="toggle-detailed"
        @click="showDetailedRatings = !showDetailedRatings"
      >
        {{ showDetailedRatings ? 'Hide' : 'Add' }} detailed ratings (optional)
      </button>

      <DetailedRating
        v-if="showDetailedRatings"
        v-model="detailedRatings"
      />
    </div>

    <!-- Title -->
    <div class="form-section">
      <label class="section-label">Title (optional)</label>
      <input
        v-model="title"
        type="text"
        class="text-input"
        placeholder="Summarize your experience"
        maxlength="100"
      />
    </div>

    <!-- Content -->
    <div class="form-section">
      <label class="section-label required">Your Review</label>
      <textarea
        v-model="content"
        class="textarea"
        placeholder="Share your experience with this tutor..."
        :maxlength="maxContentLength"
        rows="5"
      />
      <div class="textarea-footer">
        <span v-if="content.length < 10" class="hint error">
          Minimum 10 characters
        </span>
        <span class="char-count" :class="{ warning: contentLength > maxContentLength * 0.9 }">
          {{ contentLength }}/{{ maxContentLength }}
        </span>
      </div>
    </div>

    <!-- Anonymous -->
    <div class="form-section">
      <label class="checkbox-label">
        <input type="checkbox" v-model="isAnonymous" />
        <span>Post anonymously</span>
      </label>
      <span class="hint">Your name won't be shown with this review</span>
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" @click="emit('cancel')">
        Cancel
      </button>
      <button
        type="submit"
        class="btn btn-primary"
        :disabled="!isValid || isSubmitting"
      >
        {{ isSubmitting ? 'Submitting...' : 'Submit Review' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.review-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.section-label.required::after {
  content: ' *';
  color: var(--color-danger, #ef4444);
}

.hint {
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}

.hint.error {
  color: var(--color-danger, #ef4444);
}

/* Toggle */
.toggle-detailed {
  align-self: flex-start;
  padding: 0;
  background: none;
  border: none;
  font-size: 14px;
  color: var(--color-primary, #3b82f6);
  cursor: pointer;
  text-decoration: underline;
}

.toggle-detailed:hover {
  color: var(--color-primary-dark, #2563eb);
}

/* Inputs */
.text-input {
  padding: 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.15s;
}

.text-input:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
}

.textarea {
  padding: 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  min-height: 120px;
  transition: border-color 0.15s;
}

.textarea:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
}

.textarea-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.char-count {
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}

.char-count.warning {
  color: var(--color-warning, #f59e0b);
}

/* Checkbox */
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input[type='checkbox'] {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary, #3b82f6);
}

/* Actions */
.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
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
</style>
