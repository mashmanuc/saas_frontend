<template>
  <div class="tutor-reviews-view">
    <!-- Back Navigation -->
    <div class="view-header">
      <Button variant="ghost" size="sm" @click="goBack">
        <i class="icon-arrow-left"></i>
        {{ $t('common.back') }}
      </Button>
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
          <Button 
            variant="primary"
            fullWidth
            :disabled="!canWriteReview"
            @click="showReviewForm = true"
          >
            {{ $t('reviews.writeReview') }}
          </Button>
          <p v-if="!canWriteReview && canReviewData" class="cannot-review-reason">
            {{ getCannotReviewReason }}
          </p>
        </div>
      </aside>
    </div>

    <!-- Review Form Modal -->
    <Modal
      :open="showReviewForm"
      :title="$t('reviews.writeReview')"
      size="lg"
      @close="showReviewForm = false"
    >
      <ReviewForm
        :tutor-id="tutorId"
        :tutor-name="tutorName"
        @success="onReviewSubmitted"
        @cancel="showReviewForm = false"
      />
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReviewsStore } from '../stores/reviewsStore'
import ReviewsList from '../components/ReviewsList.vue'
import TutorRatingWidget from '../components/TutorRatingWidget.vue'
import ReviewForm from '../components/ReviewForm.vue'
import Button from '@/ui/Button.vue'
import Modal from '@/ui/Modal.vue'

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
  padding: var(--space-lg);
}

.view-header {
  margin-bottom: var(--space-lg);
}

.view-header h1 {
  margin: 0;
  font-size: var(--text-2xl);
  color: var(--text-primary);
}

.reviews-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: var(--space-lg);
}

.reviews-main {
  min-width: 0;
}

.reviews-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.write-review-card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
}

.write-review-card h3 {
  margin: 0 0 var(--space-xs);
  font-size: var(--text-lg);
  color: var(--text-primary);
}

.write-review-card p {
  margin: 0 0 var(--space-md);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.cannot-review-reason {
  margin-top: var(--space-sm);
  padding: var(--space-sm);
  background: color-mix(in srgb, var(--warning-bg) 15%, transparent);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  color: var(--warning-bg);
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
