<script setup lang="ts">
// F5: Tutor Reviews View (Dashboard)
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { MessageCircle, TrendingUp, Filter, ChevronDown } from 'lucide-vue-next'
import { useReviewStore } from '../stores/reviewStore'
import { useAuthStore } from '@/modules/auth/store/authStore'
import RatingSummary from '../components/display/RatingSummary.vue'
import RatingDistribution from '../components/display/RatingDistribution.vue'
import ReviewCard from '../components/display/ReviewCard.vue'
import ResponseForm from '../components/forms/ResponseForm.vue'

const store = useReviewStore()
const authStore = useAuthStore()

const {
  reviews,
  tutorRating,
  isLoading,
  error,
  hasMore,
  sortBy,
  filterRating,
  averageRating,
  totalReviews,
} = storeToRefs(store)

const tutorId = computed(() => authStore.user?.id || 0)
const respondingTo = ref<number | null>(null)
const showFilters = ref(false)

const sortOptions = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'rating_high', label: 'Highest Rating' },
  { value: 'rating_low', label: 'Lowest Rating' },
  { value: 'helpful', label: 'Most Helpful' },
]

const pendingResponses = computed(() =>
  reviews.value.filter((r) => !r.response).length
)

onMounted(async () => {
  if (tutorId.value) {
    await Promise.all([
      store.loadTutorRating(tutorId.value),
      store.loadTutorReviews(tutorId.value, true),
    ])
  }
})

watch(sortBy, () => {
  if (tutorId.value) {
    store.loadTutorReviews(tutorId.value, true)
  }
})

watch(filterRating, () => {
  if (tutorId.value) {
    store.loadTutorReviews(tutorId.value, true)
  }
})

function handleSortChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as typeof sortBy.value
  store.setSortBy(value)
}

function handleFilterRating(rating: number | null) {
  store.setFilterRating(rating)
}

function loadMore() {
  if (tutorId.value) {
    store.loadMoreReviews(tutorId.value)
  }
}

function openResponseForm(reviewId: number) {
  respondingTo.value = reviewId
}

function closeResponseForm() {
  respondingTo.value = null
}

async function submitResponse(content: string) {
  if (!respondingTo.value) return

  try {
    await store.respondToReview(respondingTo.value, content)
    respondingTo.value = null
  } catch (e) {
    console.error('Failed to submit response:', e)
  }
}

function toggleHelpful(reviewId: number) {
  store.toggleHelpful(reviewId)
}
</script>

<template>
  <div class="tutor-reviews-view">
    <header class="view-header">
      <h1>Reviews Dashboard</h1>
      <p class="subtitle">Manage and respond to your reviews</p>
    </header>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <RatingSummary
          v-if="tutorRating"
          :average="averageRating"
          :total="totalReviews"
          :detailed="tutorRating.detailed"
        />
      </div>

      <div class="stat-card">
        <RatingDistribution
          v-if="tutorRating"
          :distribution="tutorRating.distribution"
          :total="totalReviews"
          @filter="handleFilterRating"
        />
      </div>

      <div class="stat-card mini">
        <div class="mini-stat">
          <MessageCircle :size="24" />
          <div class="mini-stat-content">
            <span class="mini-stat-value">{{ pendingResponses }}</span>
            <span class="mini-stat-label">Pending Responses</span>
          </div>
        </div>
      </div>

      <div class="stat-card mini">
        <div class="mini-stat">
          <TrendingUp :size="24" />
          <div class="mini-stat-content">
            <span class="mini-stat-value">
              {{ tutorRating?.response_rate || 0 }}%
            </span>
            <span class="mini-stat-label">Response Rate</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-bar">
      <div class="filter-group">
        <label>Sort by:</label>
        <select :value="sortBy" @change="handleSortChange">
          <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <button
        v-if="filterRating"
        class="clear-filter"
        @click="handleFilterRating(null)"
      >
        Clear filter ({{ filterRating }} stars)
      </button>
    </div>

    <!-- Loading -->
    <div v-if="isLoading && reviews.length === 0" class="loading-state">
      <div class="spinner" />
    </div>

    <!-- Reviews List -->
    <div v-else class="reviews-list">
      <div v-for="review in reviews" :key="review.id" class="review-wrapper">
        <ReviewCard
          :review="review"
          show-response-action
          @helpful="toggleHelpful(review.id)"
          @respond="openResponseForm(review.id)"
        />

        <!-- Response Form -->
        <ResponseForm
          v-if="respondingTo === review.id"
          :existing-response="review.response?.content"
          @submit="submitResponse"
          @cancel="closeResponseForm"
        />
      </div>

      <!-- Load More -->
      <button
        v-if="hasMore"
        class="load-more-btn"
        :disabled="isLoading"
        @click="loadMore"
      >
        {{ isLoading ? 'Loading...' : 'Load More Reviews' }}
      </button>

      <!-- Empty State -->
      <div v-if="reviews.length === 0 && !isLoading" class="empty-state">
        <MessageCircle :size="48" />
        <h3>No Reviews Yet</h3>
        <p>You haven't received any reviews yet.</p>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.tutor-reviews-view {
  max-width: 1200px;
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

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  padding: 24px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
}

.stat-card.mini {
  display: flex;
  align-items: center;
}

.mini-stat {
  display: flex;
  align-items: center;
  gap: 16px;
}

.mini-stat svg {
  color: var(--color-primary, #3b82f6);
}

.mini-stat-content {
  display: flex;
  flex-direction: column;
}

.mini-stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary, #111827);
}

.mini-stat-label {
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

/* Filters */
.filters-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 8px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group label {
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
}

.filter-group select {
  padding: 8px 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
  background: var(--color-bg-primary, white);
}

.clear-filter {
  padding: 6px 12px;
  background: var(--color-primary-light, #dbeafe);
  border: none;
  border-radius: 20px;
  font-size: 13px;
  color: var(--color-primary, #3b82f6);
  cursor: pointer;
  transition: all 0.15s;
}

.clear-filter:hover {
  background: var(--color-primary, #3b82f6);
  color: white;
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

/* Reviews List */
.reviews-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.review-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.load-more-btn {
  padding: 12px 24px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
  cursor: pointer;
  transition: all 0.15s;
  align-self: center;
}

.load-more-btn:hover:not(:disabled) {
  background: var(--color-bg-secondary, #f5f5f5);
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.empty-state h3 {
  margin: 0 0 8px;
  font-size: 18px;
  color: var(--color-text-primary, #111827);
}

.empty-state p {
  margin: 0;
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
