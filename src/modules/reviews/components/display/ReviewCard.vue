<script setup lang="ts">
// F6: Review Card Component
import { computed } from 'vue'
import { Star, MessageCircle } from 'lucide-vue-next'
import type { Review } from '../../api/reviews'
import RatingStars from './RatingStars.vue'
import ReviewResponse from './ReviewResponse.vue'
import HelpfulButton from '../actions/HelpfulButton.vue'
import ReportButton from '../actions/ReportButton.vue'
import Button from '@/ui/Button.vue'

const props = defineProps<{
  review: Review
  showResponseAction?: boolean
}>()

const emit = defineEmits<{
  helpful: []
  report: [reason: string, details?: string]
  respond: []
}>()

const hasDetailedRatings = computed(() =>
  props.review.rating_communication ||
  props.review.rating_knowledge ||
  props.review.rating_punctuality
)

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="review-card">
    <!-- Header -->
    <header class="review-header">
      <div class="reviewer-info">
        <div v-if="!review.is_anonymous" class="avatar">
          {{ review.student.first_name[0] }}
        </div>
        <div v-else class="avatar anonymous">?</div>

        <div class="reviewer-details">
          <span class="reviewer-name">
            {{ review.is_anonymous ? 'Anonymous' : review.student.first_name }}
          </span>
          <time class="review-date">{{ formatDate(review.created_at) }}</time>
        </div>
      </div>

      <RatingStars :rating="review.rating" size="md" />
    </header>

    <!-- Title -->
    <h4 v-if="review.title" class="review-title">{{ review.title }}</h4>

    <!-- Content -->
    <p class="review-content">{{ review.content }}</p>

    <!-- Detailed Ratings -->
    <div v-if="hasDetailedRatings" class="detailed-ratings">
      <div v-if="review.rating_communication" class="detail-item">
        <span class="detail-label">Communication</span>
        <RatingStars :rating="review.rating_communication" size="sm" />
      </div>
      <div v-if="review.rating_knowledge" class="detail-item">
        <span class="detail-label">Knowledge</span>
        <RatingStars :rating="review.rating_knowledge" size="sm" />
      </div>
      <div v-if="review.rating_punctuality" class="detail-item">
        <span class="detail-label">Punctuality</span>
        <RatingStars :rating="review.rating_punctuality" size="sm" />
      </div>
    </div>

    <!-- Tutor Response -->
    <ReviewResponse v-if="review.response" :response="review.response" />

    <!-- Footer -->
    <footer class="review-footer">
      <div class="footer-left">
        <HelpfulButton
          :count="review.helpful_count"
          :active="review.is_helpful_by_me"
          @click="emit('helpful')"
        />
        <ReportButton @report="(reason, details) => emit('report', reason, details)" />
      </div>

      <Button
        v-if="showResponseAction && !review.response"
        variant="primary"
        size="sm"
        @click="emit('respond')"
      >
        <MessageCircle :size="16" />
        Respond
      </Button>
    </footer>
  </div>
</template>

<style scoped>
.review-card {
  padding: 20px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
}

/* Header */
.review-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.reviewer-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary, #3b82f6);
  color: white;
  font-size: 16px;
  font-weight: 600;
  border-radius: 50%;
}

.avatar.anonymous {
  background: var(--color-bg-tertiary, #d1d5db);
  color: var(--color-text-secondary, #6b7280);
}

.reviewer-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.reviewer-name {
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.review-date {
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

/* Title */
.review-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

/* Content */
.review-content {
  margin: 0 0 16px;
  color: var(--color-text-primary, #111827);
  line-height: 1.6;
}

/* Detailed Ratings */
.detailed-ratings {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 8px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-label {
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

/* Footer */
.review-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.footer-left {
  display: flex;
  gap: 12px;
}

</style>
