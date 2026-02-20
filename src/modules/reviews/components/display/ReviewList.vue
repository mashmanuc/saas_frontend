<script setup lang="ts">
// F7: Review List Component
import { computed } from 'vue'
import type { Review } from '../../api/reviews'
import ReviewCard from './ReviewCard.vue'
import Button from '@/ui/Button.vue'

const props = defineProps<{
  reviews: Review[]
  isLoading?: boolean
  hasMore?: boolean
  showResponseAction?: boolean
}>()

const emit = defineEmits<{
  loadMore: []
  helpful: [reviewId: number]
  report: [reviewId: number, reason: string, details?: string]
  respond: [reviewId: number]
}>()

const isEmpty = computed(() => props.reviews.length === 0 && !props.isLoading)
</script>

<template>
  <div class="review-list">
    <!-- Loading Initial -->
    <div v-if="isLoading && reviews.length === 0" class="loading-state">
      <div class="spinner" />
    </div>

    <!-- Empty State -->
    <div v-else-if="isEmpty" class="empty-state">
      <slot name="empty">
        <p>No reviews yet.</p>
      </slot>
    </div>

    <!-- Reviews -->
    <template v-else>
      <ReviewCard
        v-for="review in reviews"
        :key="review.id"
        :review="review"
        :show-response-action="showResponseAction"
        @helpful="emit('helpful', review.id)"
        @report="(reason, details) => emit('report', review.id, reason, details)"
        @respond="emit('respond', review.id)"
      />

      <!-- Load More -->
      <Button
        v-if="hasMore"
        variant="outline"
        :loading="isLoading"
        @click="emit('loadMore')"
      >
        Load More Reviews
      </Button>
    </template>
  </div>
</template>

<style scoped>
.review-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Loading */
.loading-state {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 48px 0;
  color: var(--color-text-secondary, #6b7280);
}

</style>
