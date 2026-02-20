<template>
  <div class="my-reviews-view">
    <div class="view-header">
      <h1>{{ $t('reviews.myReviews') }}</h1>
      <p class="subtitle">{{ $t('reviews.myReviewsSubtitle') }}</p>
    </div>

    <!-- Tabs -->
    <div class="reviews-tabs">
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'written' }"
        @click="activeTab = 'written'"
      >
        {{ $t('reviews.writtenByMe') }}
        <span v-if="store.myReviewsCount" class="tab-count">{{ store.myReviewsCount }}</span>
      </button>
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'pending' }"
        @click="activeTab = 'pending'"
      >
        {{ $t('reviews.pendingReviews') }}
        <span v-if="store.getPendingReviewCount" class="tab-count">{{ store.getPendingReviewCount }}</span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="store.loading" class="loading-state">
      <div class="spinner"></div>
      <p>{{ $t('common.loading') }}...</p>
    </div>

    <!-- Written Reviews Tab -->
    <div v-else-if="activeTab === 'written'" class="tab-content">
      <div v-if="store.myReviews.length === 0" class="empty-state">
        <i class="icon-reviews-empty"></i>
        <h3>{{ $t('reviews.noWrittenReviews') }}</h3>
        <p>{{ $t('reviews.noWrittenReviewsSubtitle') }}</p>
      </div>

      <div v-else class="reviews-list">
        <ReviewCard
          v-for="review in store.myReviews"
          :key="review.id"
          :review="review"
          :show-report="false"
          @update="refreshReviews"
          @delete="refreshReviews"
        />

        <!-- Load More -->
        <Button
          v-if="store.myReviewsHasMore"
          variant="outline"
          fullWidth
          @click="loadMoreMyReviews"
        >
          {{ $t('reviews.loadMore') }}
        </Button>
      </div>
    </div>

    <!-- Pending Reviews Tab -->
    <div v-else-if="activeTab === 'pending'" class="tab-content">
      <div v-if="store.pendingReviews.length === 0" class="empty-state">
        <i class="icon-check-circle"></i>
        <h3>{{ $t('reviews.noPendingReviews') }}</h3>
        <p>{{ $t('reviews.noPendingReviewsSubtitle') }}</p>
      </div>

      <div v-else class="pending-list">
        <div
          v-for="pending in store.pendingReviews"
          :key="pending.tutor_id"
          class="pending-card"
        >
          <div class="pending-tutor">
            <img
              v-if="pending.tutor_avatar"
              :src="pending.tutor_avatar"
              :alt="pending.tutor_name"
              class="tutor-avatar"
            />
            <div v-else class="avatar-placeholder">
              <i class="icon-user"></i>
            </div>
            <div class="tutor-info">
              <span class="tutor-name">{{ pending.tutor_name }}</span>
              <span class="lesson-date">
                {{ $t('reviews.completedLesson') }}: {{ formatDate(pending.completed_lesson_date) }}
              </span>
            </div>
          </div>

          <div class="pending-meta">
            <span class="deadline">
              {{ $t('reviews.canReviewUntil') }}: {{ formatDate(pending.can_review_until) }}
            </span>
          </div>

          <Button
            variant="primary"
            size="sm"
            @click="openReviewForm(pending)"
          >
            {{ $t('reviews.writeReview') }}
          </Button>
        </div>
      </div>
    </div>

    <!-- Review Form Modal -->
    <Modal
      :open="!!selectedPending"
      :title="$t('reviews.writeReview')"
      size="lg"
      @close="closeReviewForm"
    >
      <ReviewForm
        v-if="selectedPending"
        :tutor-id="selectedPending.tutor_id"
        :tutor-name="selectedPending.tutor_name"
        @success="onReviewSubmitted"
        @cancel="closeReviewForm"
      />
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useReviewsStore } from '../stores/reviewsStore'
import ReviewCard from '../components/ReviewCard.vue'
import ReviewForm from '../components/ReviewForm.vue'
import Button from '@/ui/Button.vue'
import Modal from '@/ui/Modal.vue'

const store = useReviewsStore()

// State
const activeTab = ref('written')
const currentPage = ref(1)
const selectedPending = ref(null)

// Methods
onMounted(async () => {
  await Promise.all([
    store.fetchMyReviews(),
    store.fetchPendingReviews()
  ])
})

async function refreshReviews() {
  currentPage.value = 1
  await store.fetchMyReviews(1, false)
}

async function loadMoreMyReviews() {
  currentPage.value++
  await store.fetchMyReviews(currentPage.value, true)
}

function openReviewForm(pending) {
  selectedPending.value = pending
}

function closeReviewForm() {
  selectedPending.value = null
}

async function onReviewSubmitted() {
  closeReviewForm()
  // Refresh both tabs
  await Promise.all([
    store.fetchMyReviews(1, false),
    store.fetchPendingReviews()
  ])
}

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
</script>

<style scoped>
.my-reviews-view {
  max-width: 900px;
  margin: 0 auto;
  padding: var(--space-lg);
}

.view-header {
  margin-bottom: var(--space-lg);
}

.view-header h1 {
  margin: 0 0 var(--space-xs);
  font-size: var(--text-2xl);
  color: var(--text-primary);
}

.subtitle {
  color: var(--text-secondary);
  margin: 0;
}

.reviews-tabs {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-lg);
  border-bottom: 1px solid var(--border-color);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-lg);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 15px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: -1px;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn--active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.tab-count {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
}

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
  animation: spin 1s linear infinite;
  margin: 0 auto var(--space-md);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.empty-state i {
  font-size: 48px;
  color: var(--border-color);
  margin-bottom: var(--space-md);
}

.empty-state h3 {
  margin: 0 0 var(--space-xs);
  color: var(--text-primary);
}

.empty-state p {
  margin: 0;
  color: var(--text-secondary);
}

.reviews-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.pending-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.pending-card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}

.pending-tutor {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.tutor-avatar,
.avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tutor-avatar {
  object-fit: cover;
}

.avatar-placeholder {
  color: var(--text-secondary);
}

.tutor-info {
  display: flex;
  flex-direction: column;
}

.tutor-name {
  font-weight: 500;
  color: var(--text-primary);
}

.lesson-date {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.pending-meta {
  flex: 1;
  text-align: center;
}

.deadline {
  font-size: var(--text-xs);
  color: var(--warning-bg);
  background: color-mix(in srgb, var(--warning-bg) 15%, transparent);
  padding: 4px 12px;
  border-radius: var(--radius-full);
}

@media (max-width: 640px) {
  .pending-card {
    flex-direction: column;
    align-items: stretch;
  }

  .pending-meta {
    text-align: left;
  }
}
</style>
