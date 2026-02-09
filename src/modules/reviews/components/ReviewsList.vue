<template>
  <div class="reviews-list">
    <!-- Header with Stats -->
    <div class="reviews-header" v-if="showStats && stats">
      <div class="rating-summary">
        <div class="average-rating">
          <span class="rating-number">{{ averageRating }}</span>
          <div class="rating-stars">
            <span 
              v-for="n in 5" 
              :key="n"
              class="star"
              :class="{ 'star--filled': n <= Math.round(averageRating) }"
            >
              ★
            </span>
          </div>
          <span class="total-reviews">{{ stats.total_reviews }} {{ $t('reviews.reviewsCount') }}</span>
        </div>
        
        <div class="rating-distribution">
          <div 
            v-for="n in [5, 4, 3, 2, 1]" 
            :key="n"
            class="distribution-bar"
          >
            <span class="bar-label">{{ n }} {{ $t('reviews.stars') }}</span>
            <div class="bar-track">
              <div 
                class="bar-fill"
                :style="{ width: getBarWidth(n) + '%' }"
              ></div>
            </div>
            <span class="bar-count">{{ stats.distribution[n] || 0 }}</span>
          </div>
        </div>
      </div>
      
      <!-- Tags -->
      <div class="strength-tags" v-if="tags.length">
        <span class="tags-label">{{ $t('reviews.strengths') }}:</span>
        <span 
          v-for="tag in tags" 
          :key="tag"
          class="tag"
        >
          {{ tag }}
        </span>
      </div>
    </div>

    <!-- Filters -->
    <div class="reviews-filters" v-if="showFilters">
      <div class="filter-group">
        <select v-model="selectedFilter" class="filter-select">
          <option value="">{{ $t('reviews.filters.all') }}</option>
          <option value="5">5 {{ $t('reviews.stars') }}</option>
          <option value="4">4 {{ $t('reviews.stars') }}</option>
          <option value="3">3 {{ $t('reviews.stars') }}</option>
          <option value="2">2 {{ $t('reviews.stars') }}</option>
          <option value="1">1 {{ $t('reviews.star') }}</option>
        </select>
        
        <label class="filter-checkbox">
          <input type="checkbox" v-model="verifiedOnly" />
          <span>{{ $t('reviews.filters.verifiedOnly') }}</span>
        </label>
        
        <label class="filter-checkbox">
          <input type="checkbox" v-model="withResponseOnly" />
          <span>{{ $t('reviews.filters.withResponse') }}</span>
        </label>
      </div>
      
      <div class="sort-group">
        <select v-model="sortBy" class="sort-select">
          <option value="newest">{{ $t('reviews.sort.newest') }}</option>
          <option value="oldest">{{ $t('reviews.sort.oldest') }}</option>
          <option value="highest">{{ $t('reviews.sort.highest') }}</option>
          <option value="lowest">{{ $t('reviews.sort.lowest') }}</option>
          <option value="helpful">{{ $t('reviews.sort.helpful') }}</option>
        </select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>{{ $t('common.loading') }}...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="reviews.length === 0" class="empty-state">
      <i class="icon-reviews-empty"></i>
      <h3>{{ $t('reviews.noReviews') }}</h3>
      <p>{{ $t('reviews.noReviewsSubtitle') }}</p>
      <button 
        v-if="showWriteButton"
        class="btn-write-first"
        @click="$emit('write-review')"
      >
        {{ $t('reviews.writeFirst') }}
      </button>
    </div>

    <!-- Reviews List -->
    <div v-else class="reviews-container">
      <ReviewCard
        v-for="review in reviews"
        :key="review.id"
        :review="review"
        :show-report="showReport"
        @update="onReviewUpdate"
        @delete="onReviewDelete"
      />
      
      <!-- Load More -->
      <button 
        v-if="hasMore && !loadingMore"
        class="btn-load-more"
        @click="loadMore"
      >
        {{ $t('reviews.loadMore') }}
      </button>
      
      <div v-if="loadingMore" class="loading-more">
        <div class="spinner-small"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useReviewsStore } from '../stores/reviewsStore'
import ReviewCard from './ReviewCard.vue'

const props = defineProps({
  tutorId: {
    type: Number,
    required: true
  },
  reviews: {
    type: Array,
    default: () => []
  },
  stats: {
    type: Object,
    default: null
  },
  tags: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  loadingMore: {
    type: Boolean,
    default: false
  },
  hasMore: {
    type: Boolean,
    default: false
  },
  showStats: {
    type: Boolean,
    default: true
  },
  showFilters: {
    type: Boolean,
    default: true
  },
  showReport: {
    type: Boolean,
    default: true
  },
  showWriteButton: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['load-more', 'filter-change', 'write-review'])

const store = useReviewsStore()

// Filter state
const selectedFilter = ref('')
const verifiedOnly = ref(false)
const withResponseOnly = ref(false)
const sortBy = ref('newest')

// Computed
const averageRating = computed(() => {
  return props.stats?.average_rating?.toFixed(1) || '0.0'
})

// Watch for filter changes
watch([selectedFilter, verifiedOnly, withResponseOnly, sortBy], () => {
  const filters = {
    rating: selectedFilter.value ? parseInt(selectedFilter.value) : undefined,
    is_verified: verifiedOnly.value || undefined,
    has_response: withResponseOnly.value || undefined,
    sort_by: sortBy.value
  }
  emit('filter-change', filters)
}, { immediate: false })

// Methods
function getBarWidth(stars) {
  if (!props.stats?.total_reviews) return 0
  const count = props.stats.distribution[stars] || 0
  return (count / props.stats.total_reviews) * 100
}

function loadMore() {
  emit('load-more')
}

function onReviewUpdate() {
  // Refresh stats after update
  store.fetchTutorStats(props.tutorId, true)
}

function onReviewDelete(reviewId) {
  // Refresh stats after delete
  store.fetchTutorStats(props.tutorId, true)
}
</script>

<style scoped>
.reviews-list {
  width: 100%;
}

.reviews-header {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.rating-summary {
  display: flex;
  gap: 40px;
  margin-bottom: 20px;
}

.average-rating {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.rating-number {
  font-size: 48px;
  font-weight: 700;
  color: #111827;
  line-height: 1;
}

.rating-stars {
  display: flex;
  gap: 4px;
  margin: 8px 0;
}

.star {
  font-size: 20px;
  color: #e5e7eb;
}

.star--filled {
  color: #fbbf24;
}

.total-reviews {
  font-size: 14px;
  color: #6b7280;
}

.rating-distribution {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.distribution-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bar-label {
  width: 60px;
  font-size: 14px;
  color: #6b7280;
  text-align: right;
}

.bar-track {
  flex: 1;
  height: 8px;
  background: #f3f4f6;
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: #fbbf24;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.bar-count {
  width: 40px;
  font-size: 14px;
  color: #6b7280;
}

.strength-tags {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.tags-label {
  font-size: 14px;
  color: #6b7280;
}

.tag {
  background: #dbeafe;
  color: #1e40af;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.reviews-filters {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.filter-group {
  display: flex;
  gap: 16px;
  align-items: center;
}

.filter-select,
.sort-select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 14px;
}

.filter-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
}

.filter-checkbox input {
  width: 16px;
  height: 16px;
}

.loading-state {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
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
  margin: 0 0 20px;
  color: #6b7280;
}

.btn-write-first {
  padding: 12px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-write-first:hover {
  background: #2563eb;
}

.reviews-container {
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
}

.btn-load-more:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

.loading-more {
  text-align: center;
  padding: 20px;
}

.spinner-small {
  width: 24px;
  height: 24px;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .rating-summary {
    flex-direction: column;
    gap: 24px;
  }
  
  .reviews-filters {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .filter-group {
    flex-wrap: wrap;
  }
}
</style>
