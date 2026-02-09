<template>
  <div class="tutor-rating-widget" :class="{ 'widget--compact': compact, 'widget--large': large }">
    <!-- Main Rating Display -->
    <div class="rating-main">
      <div class="rating-score">
        <span class="score-value">{{ formattedRating }}</span>
        <div class="score-stars">
          <span 
            v-for="n in 5" 
            :key="n"
            class="star"
            :class="{ 'star--filled': n <= roundedRating, 'star--partial': isPartialStar(n) }"
          >
            ★
          </span>
        </div>
        <span v-if="showCount" class="score-count">
          {{ totalReviews }} {{ $t('reviews.reviewsCount') }}
        </span>
      </div>
    </div>

    <!-- Distribution Bars (if not compact) -->
    <div v-if="!compact && showDistribution && stats" class="rating-distribution">
      <div 
        v-for="n in [5, 4, 3, 2, 1]" 
        :key="n"
        class="dist-bar"
      >
        <span class="dist-label">{{ n }}</span>
        <div class="dist-track">
          <div 
            class="dist-fill"
            :style="{ width: getDistributionWidth(n) + '%' }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Breakdown (if not compact) -->
    <div v-if="!compact && showBreakdown && stats" class="rating-breakdown">
      <div class="breakdown-item verified">
        <i class="icon-check-circle"></i>
        <span>{{ stats.verified_count }} {{ $t('reviews.verifiedReviews') }}</span>
      </div>
    </div>

    <!-- CTA Button (if showCta) -->
    <button 
      v-if="showCta && tutorId"
      class="btn-view-reviews"
      @click="navigateToReviews"
    >
      {{ $t('reviews.viewAllReviews') }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  rating: {
    type: Number,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  stats: {
    type: Object,
    default: null
  },
  tutorId: {
    type: Number,
    default: null
  },
  compact: {
    type: Boolean,
    default: false
  },
  large: {
    type: Boolean,
    default: false
  },
  showCount: {
    type: Boolean,
    default: true
  },
  showDistribution: {
    type: Boolean,
    default: true
  },
  showBreakdown: {
    type: Boolean,
    default: true
  },
  showCta: {
    type: Boolean,
    default: false
  }
})

const router = useRouter()

// Computed
const formattedRating = computed(() => {
  return props.rating?.toFixed(1) || '0.0'
})

const roundedRating = computed(() => {
  return Math.round(props.rating || 0)
})

function isPartialStar(n) {
  const decimal = (props.rating || 0) - Math.floor(props.rating || 0)
  return n === Math.ceil(props.rating || 0) && decimal > 0 && decimal < 1
}

function getDistributionWidth(stars) {
  if (!props.stats?.total_reviews) return 0
  const count = props.stats.distribution?.[stars] || 0
  return (count / props.stats.total_reviews) * 100
}

function navigateToReviews() {
  if (props.tutorId) {
    router.push(`/tutor/${props.tutorId}/reviews`)
  }
}
</script>

<style scoped>
.tutor-rating-widget {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.widget--compact {
  padding: 12px 16px;
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.widget--compact .rating-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.widget--compact .score-value {
  font-size: 20px;
}

.widget--compact .score-stars {
  gap: 2px;
}

.widget--compact .star {
  font-size: 16px;
}

.widget--compact .score-count {
  font-size: 13px;
}

.widget--large {
  padding: 32px;
}

.widget--large .score-value {
  font-size: 56px;
}

.widget--large .star {
  font-size: 28px;
}

.rating-main {
  text-align: center;
}

.score-value {
  font-size: 36px;
  font-weight: 700;
  color: #111827;
  line-height: 1;
}

.score-stars {
  display: flex;
  justify-content: center;
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

.star--partial {
  background: linear-gradient(90deg, #fbbf24 50%, #e5e7eb 50%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.score-count {
  display: block;
  font-size: 14px;
  color: #6b7280;
}

.rating-distribution {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.dist-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.dist-label {
  width: 16px;
  font-size: 13px;
  color: #6b7280;
  text-align: right;
}

.dist-track {
  flex: 1;
  height: 6px;
  background: #f3f4f6;
  border-radius: 3px;
  overflow: hidden;
}

.dist-fill {
  height: 100%;
  background: #fbbf24;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.rating-breakdown {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.breakdown-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #22c55e;
}

.breakdown-item i {
  font-size: 14px;
}

.btn-view-reviews {
  width: 100%;
  margin-top: 16px;
  padding: 12px;
  background: #f3f4f6;
  color: #374151;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-view-reviews:hover {
  background: #e5e7eb;
}
</style>
