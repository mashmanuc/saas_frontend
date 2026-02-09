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
        <button
          v-if="store.myReviewsHasMore"
          class="btn-load-more"
          @click="loadMoreMyReviews"
        >
          {{ $t('reviews.loadMore') }}
        </button>
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

          <button
            class="btn-write-review"
            @click="openReviewForm(pending)"
          >
            {{ $t('reviews.writeReview') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Review Form Modal -->
    <div v-if="selectedPending" class="modal-overlay" @click.self="closeReviewForm">
      <div class="modal-content">
        <ReviewForm
          :tutor-id="selectedPending.tutor_id"
          :tutor-name="selectedPending.tutor_name"
          @success="onReviewSubmitted"
          @cancel="closeReviewForm"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useReviewsStore } from '../stores/reviewsStore'
import ReviewCard from '../components/ReviewCard.vue'
import ReviewForm from '../components/ReviewForm.vue'

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
  padding: 24px;
}

.view-header {
  margin-bottom: 24px;
}

.view-header h1 {
  margin: 0 0 8px;
  font-size: 28px;
  color: #111827;
}

.subtitle {
  color: #6b7280;
  margin: 0;
}

.reviews-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 15px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: -1px;
}

.tab-btn:hover {
  color: #374151;
}

.tab-btn--active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.tab-count {
  background: #dbeafe;
  color: #1e40af;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.loading-state {
  text-align: center;
  padding: 60px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.empty-state i {
  font-size: 48px;
  color: #d1d5db;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px;
  color: #374151;
}

.empty-state p {
  margin: 0;
  color: #6b7280;
}

.reviews-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.btn-load-more {
  width: 100%;
  padding: 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  color: #374151;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;
}

.btn-load-more:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

.pending-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pending-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.pending-tutor {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tutor-avatar,
.avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tutor-avatar {
  object-fit: cover;
}

.avatar-placeholder {
  color: #9ca3af;
}

.tutor-info {
  display: flex;
  flex-direction: column;
}

.tutor-name {
  font-weight: 500;
  color: #111827;
}

.lesson-date {
  font-size: 13px;
  color: #6b7280;
}

.pending-meta {
  flex: 1;
  text-align: center;
}

.deadline {
  font-size: 13px;
  color: #92400e;
  background: #fef3c7;
  padding: 4px 12px;
  border-radius: 12px;
}

.btn-write-review {
  padding: 10px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-write-review:hover {
  background: #2563eb;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 24px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
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
