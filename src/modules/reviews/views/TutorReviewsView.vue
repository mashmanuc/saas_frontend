<template>
  <div class="tutor-reviews-view">
    <!-- Back Navigation -->
    <div class="view-header">
      <button class="btn-back" @click="goBack">
        <i class="icon-arrow-left"></i>
        {{ $t('common.back') }}
      </button>
      <h1>{{ $t('reviews.allReviewsFor', { name: tutorName }) }}</h1>
    </div>

    <!-- Main Content -->
    <div class="reviews-layout">
      <!-- Left: Reviews List -->
      <div class="reviews-main">
        <ReviewsList
          :tutor-id="tutorId"
          :reviews="store.tutorReviews"
          :stats="store.tutorStats"
          :tags="store.tutorTags"
          :loading="store.loading"
          :has-more="store.reviewsHasMore"
          @load-more="loadMore"
          @filter-change="onFilterChange"
          @write-review="showReviewForm = true"
          show-write-button
        />
      </div>

      <!-- Right: Sidebar -->
      <aside class="reviews-sidebar">
        <TutorRatingWidget
          :rating="store.getAverageRating"
          :total-reviews="store.getTotalReviews"
          :stats="store.tutorStats"
          :tutor-id="tutorId"
          show-cta
          large
        />

        <!-- Write Review CTA -->
        <div class="write-review-card">
          <h3>{{ $t('reviews.writeAReview') }}</h3>
          <p>{{ $t('reviews.writeReviewHint') }}</p>
          <button 
            class="btn-write-review"
            @click="showReviewForm = true"
            :disabled="!canWriteReview"
          >
            {{ $t('reviews.writeReview') }}
          </button>
          <p v-if="!canWriteReview && canReviewData" class="cannot-review-reason">
            {{ getCannotReviewReason }}
          </p>
        </div>
      </aside>
    </div>

    <!-- Review Form Modal -->
    <div v-if="showReviewForm" class="modal-overlay" @click.self="showReviewForm = false">
      <div class="modal-content">
        <ReviewForm
          :tutor-id="tutorId"
          :tutor-name="tutorName"
          @success="onReviewSubmitted"
          @cancel="showReviewForm = false"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReviewsStore } from '../stores/reviewsStore'
import ReviewsList from '../components/ReviewsList.vue'
import TutorRatingWidget from '../components/TutorRatingWidget.vue'
import ReviewForm from '../components/ReviewForm.vue'

const route = useRoute()
const router = useRouter()
const store = useReviewsStore()

// State
const showReviewForm = ref(false)
const currentPage = ref(1)
const currentFilters = ref({})

// Computed
const tutorId = computed(() => parseInt(route.params.tutorId))
const tutorName = computed(() => route.query.name || $t('reviews.tutor'))

const canReviewData = computed(() => store.canReviewTutor(tutorId.value))
const canWriteReview = computed(() => canReviewData.value?.can_review)

const getCannotReviewReason = computed(() => {
  const reason = canReviewData.value?.reason
  if (!reason) return ''
  
  const reasons = {
    already_reviewed: $t('reviews.alreadyReviewed'),
    no_completed_lessons: $t('reviews.noCompletedLessons'),
    too_soon: $t('reviews.tooSoon'),
    blocked: $t('reviews.reviewBlocked')
  }
  return reasons[reason] || ''
})

// Methods
onMounted(async () => {
  await fetchInitialData()
})

async function fetchInitialData() {
  currentPage.value = 1
  await Promise.all([
    store.fetchTutorReviews(tutorId.value, currentFilters.value, currentPage.value),
    store.fetchTutorStats(tutorId.value),
    store.fetchTutorTags(tutorId.value),
    store.checkCanReview(tutorId.value)
  ])
}

async function loadMore() {
  currentPage.value++
  await store.fetchTutorReviews(tutorId.value, currentFilters.value, currentPage.value, true)
}

async function onFilterChange(filters) {
  currentFilters.value = filters
  currentPage.value = 1
  await store.fetchTutorReviews(tutorId.value, filters, 1, false)
}

async function onReviewSubmitted(review) {
  showReviewForm.value = false
  // Refresh data
  await fetchInitialData()
}

function goBack() {
  router.back()
}
</script>

<style scoped>
.tutor-reviews-view {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.view-header {
  margin-bottom: 24px;
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  color: #6b7280;
  font-size: 14px;
  cursor: pointer;
  margin-bottom: 16px;
}

.btn-back:hover {
  color: #374151;
}

.view-header h1 {
  margin: 0;
  font-size: 28px;
  color: #111827;
}

.reviews-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 24px;
}

.reviews-main {
  min-width: 0;
}

.reviews-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.write-review-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.write-review-card h3 {
  margin: 0 0 8px;
  font-size: 18px;
  color: #111827;
}

.write-review-card p {
  margin: 0 0 16px;
  font-size: 14px;
  color: #6b7280;
}

.btn-write-review {
  width: 100%;
  padding: 14px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-write-review:hover:not(:disabled) {
  background: #2563eb;
}

.btn-write-review:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.cannot-review-reason {
  margin-top: 12px;
  padding: 12px;
  background: #fef3c7;
  border-radius: 8px;
  font-size: 13px;
  color: #92400e;
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

@media (max-width: 1024px) {
  .reviews-layout {
    grid-template-columns: 1fr;
  }
  
  .reviews-sidebar {
    order: -1;
  }
}
</style>
