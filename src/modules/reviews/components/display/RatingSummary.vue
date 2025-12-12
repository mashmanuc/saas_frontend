<script setup lang="ts">
// F8: Rating Summary Component
import { computed } from 'vue'
import { Star } from 'lucide-vue-next'
import RatingStars from './RatingStars.vue'

const props = defineProps<{
  average: number
  total: number
  detailed?: {
    communication: number
    knowledge: number
    punctuality: number
  }
}>()

const formattedAverage = computed(() => props.average.toFixed(1))
</script>

<template>
  <div class="rating-summary">
    <!-- Main Rating -->
    <div class="main-rating">
      <span class="rating-value">{{ formattedAverage }}</span>
      <div class="rating-meta">
        <RatingStars :rating="average" size="lg" />
        <span class="total-reviews">{{ total }} reviews</span>
      </div>
    </div>

    <!-- Detailed Ratings -->
    <div v-if="detailed" class="detailed-section">
      <div class="detail-row">
        <span class="detail-label">Communication</span>
        <div class="detail-rating">
          <RatingStars :rating="detailed.communication" size="sm" />
          <span class="detail-value">{{ detailed.communication.toFixed(1) }}</span>
        </div>
      </div>

      <div class="detail-row">
        <span class="detail-label">Knowledge</span>
        <div class="detail-rating">
          <RatingStars :rating="detailed.knowledge" size="sm" />
          <span class="detail-value">{{ detailed.knowledge.toFixed(1) }}</span>
        </div>
      </div>

      <div class="detail-row">
        <span class="detail-label">Punctuality</span>
        <div class="detail-rating">
          <RatingStars :rating="detailed.punctuality" size="sm" />
          <span class="detail-value">{{ detailed.punctuality.toFixed(1) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rating-summary {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Main Rating */
.main-rating {
  display: flex;
  align-items: center;
  gap: 16px;
}

.rating-value {
  font-size: 48px;
  font-weight: 700;
  color: var(--color-text-primary, #111827);
  line-height: 1;
}

.rating-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.total-reviews {
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
}

/* Detailed Section */
.detailed-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
}

.detail-rating {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
  min-width: 28px;
  text-align: right;
}
</style>
