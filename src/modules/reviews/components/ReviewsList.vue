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
      <Button 
        v-if="showWriteButton"
        variant="primary"
        @click="$emit('write-review')"
      >
        {{ $t('reviews.writeFirst') }}
      </Button>
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
      <Button 
        v-if="hasMore && !loadingMore"
        variant="outline"
        fullWidth
        @click="loadMore"
      >
        {{ $t('reviews.loadMore') }}
      </Button>
      
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
import Button from '@/ui/Button.vue'

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
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  margin-bottom: var(--space-lg);
  box-shadow: var(--shadow-sm);
}

.rating-summary {
  display: flex;
  gap: 40px;
  margin-bottom: var(--space-lg);
}

.average-rating {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.rating-number {
  font-size: 48px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.rating-stars {
  display: flex;
  gap: var(--space-2xs);
  margin: var(--space-xs) 0;
}

.star {
  font-size: 20px;
  color: var(--border-color);
}

.star--filled {
  color: var(--warning-bg);
}

.total-reviews {
  font-size: var(--text-sm);
  color: var(--text-secondary);
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
  gap: var(--space-sm);
}

.bar-label {
  width: 60px;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  text-align: right;
}

.bar-track {
  flex: 1;
  height: 8px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: var(--warning-bg);
  border-radius: var(--radius-sm);
  transition: width 0.3s ease;
}

.bar-count {
  width: 40px;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.strength-tags {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--border-color);
}

.tags-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.tag {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  padding: 6px 12px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
}

.reviews-filters {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
  padding: var(--space-md);
  background: var(--card-bg);
  border-radius: var(--radius-md);
}

.filter-group {
  display: flex;
  gap: var(--space-md);
  align-items: center;
}

.filter-select,
.sort-select {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.filter-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-sm);
  color: var(--text-primary);
  cursor: pointer;
}

.filter-checkbox input {
  width: 16px;
  height: 16px;
}

.loading-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
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
  margin: 0 0 var(--space-lg);
  color: var(--text-secondary);
}

.reviews-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.loading-more {
  text-align: center;
  padding: var(--space-lg);
}

.spinner-small {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .rating-summary {
    flex-direction: column;
    gap: var(--space-lg);
  }
  
  .reviews-filters {
    flex-direction: column;
    gap: var(--space-sm);
    align-items: stretch;
  }
  
  .filter-group {
    flex-wrap: wrap;
  }
}
</style>
