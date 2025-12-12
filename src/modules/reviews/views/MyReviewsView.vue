<script setup lang="ts">
// F4: My Reviews View
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { Star, Edit, Trash2, MessageCircle } from 'lucide-vue-next'
import { useReviewStore } from '../stores/reviewStore'
import type { Review } from '../api/reviews'
import ReviewCard from '../components/display/ReviewCard.vue'
import ReviewResponse from '../components/display/ReviewResponse.vue'

const router = useRouter()
const store = useReviewStore()
const { myReviews, isLoading, error } = storeToRefs(store)

onMounted(() => {
  store.loadMyReviews()
})

function editReview(review: Review) {
  router.push(`/reviews/${review.id}/edit`)
}

async function deleteReview(review: Review) {
  if (confirm('Are you sure you want to delete this review?')) {
    await store.deleteReview(review.id)
  }
}

function canEdit(review: Review): boolean {
  const created = new Date(review.created_at)
  const now = new Date()
  const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60)
  return hoursDiff <= 24 && review.status !== 'rejected'
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'approved':
      return 'status-approved'
    case 'pending':
      return 'status-pending'
    case 'rejected':
      return 'status-rejected'
    default:
      return ''
  }
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
  <div class="my-reviews-view">
    <header class="view-header">
      <h1>My Reviews</h1>
      <p class="subtitle">Reviews you've written for tutors</p>
    </header>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner" />
    </div>

    <!-- Empty State -->
    <div v-else-if="myReviews.length === 0" class="empty-state">
      <Star :size="48" />
      <h2>No Reviews Yet</h2>
      <p>You haven't written any reviews yet. After completing a lesson, you can share your experience.</p>
    </div>

    <!-- Reviews List -->
    <div v-else class="reviews-list">
      <div v-for="review in myReviews" :key="review.id" class="review-item">
        <!-- Status Badge -->
        <div class="review-status" :class="getStatusClass(review.status)">
          {{ review.status }}
        </div>

        <!-- Tutor Info -->
        <div class="tutor-header">
          <div class="tutor-avatar">
            {{ review.tutor.first_name[0] }}
          </div>
          <div class="tutor-details">
            <span class="tutor-name">
              {{ review.tutor.first_name }} {{ review.tutor.last_name }}
            </span>
            <span class="review-date">{{ formatDate(review.created_at) }}</span>
          </div>
        </div>

        <!-- Rating -->
        <div class="rating-row">
          <div class="stars">
            <Star
              v-for="i in 5"
              :key="i"
              :size="18"
              :fill="i <= review.rating ? '#f59e0b' : 'none'"
              :stroke="i <= review.rating ? '#f59e0b' : '#d1d5db'"
            />
          </div>
        </div>

        <!-- Content -->
        <h4 v-if="review.title" class="review-title">{{ review.title }}</h4>
        <p class="review-content">{{ review.content }}</p>

        <!-- Tutor Response -->
        <ReviewResponse v-if="review.response" :response="review.response" />

        <!-- Actions -->
        <div class="review-actions">
          <button
            v-if="canEdit(review)"
            class="action-btn"
            @click="editReview(review)"
          >
            <Edit :size="16" />
            Edit
          </button>
          <button
            v-if="canEdit(review)"
            class="action-btn danger"
            @click="deleteReview(review)"
          >
            <Trash2 :size="16" />
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.my-reviews-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 16px;
}

.view-header {
  margin-bottom: 32px;
}

.view-header h1 {
  margin: 0 0 4px;
  font-size: 28px;
  font-weight: 700;
}

.subtitle {
  margin: 0;
  color: var(--color-text-secondary, #6b7280);
}

/* Loading */
.loading-state {
  display: flex;
  justify-content: center;
  padding: 64px 0;
}

.spinner {
  width: 40px;
  height: 40px;
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
  padding: 64px 0;
  color: var(--color-text-secondary, #6b7280);
}

.empty-state svg {
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state h2 {
  margin: 0 0 8px;
  font-size: 20px;
  color: var(--color-text-primary, #111827);
}

.empty-state p {
  margin: 0;
  max-width: 400px;
  margin: 0 auto;
}

/* Reviews List */
.reviews-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.review-item {
  position: relative;
  padding: 24px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
}

/* Status Badge */
.review-status {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  text-transform: capitalize;
}

.status-approved {
  background: var(--color-success-light, #d1fae5);
  color: var(--color-success-dark, #065f46);
}

.status-pending {
  background: var(--color-warning-light, #fef3c7);
  color: var(--color-warning-dark, #92400e);
}

.status-rejected {
  background: var(--color-danger-light, #fee2e2);
  color: var(--color-danger-dark, #991b1b);
}

/* Tutor Header */
.tutor-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.tutor-avatar {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary, #3b82f6);
  color: white;
  font-size: 16px;
  font-weight: 600;
  border-radius: 50%;
}

.tutor-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tutor-name {
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.review-date {
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

/* Rating */
.rating-row {
  margin-bottom: 12px;
}

.stars {
  display: flex;
  gap: 2px;
}

/* Content */
.review-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}

.review-content {
  margin: 0 0 16px;
  color: var(--color-text-primary, #111827);
  line-height: 1.6;
}

/* Actions */
.review-actions {
  display: flex;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: none;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text-primary, #111827);
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  background: var(--color-bg-secondary, #f5f5f5);
}

.action-btn.danger {
  color: var(--color-danger, #ef4444);
  border-color: var(--color-danger, #ef4444);
}

.action-btn.danger:hover {
  background: var(--color-danger-light, #fee2e2);
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
