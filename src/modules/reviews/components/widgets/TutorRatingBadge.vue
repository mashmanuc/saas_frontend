<script setup lang="ts">
// F20: Tutor Rating Badge Component (Compact)
import { Star } from 'lucide-vue-next'

defineProps<{
  rating: number
  count: number
}>()
</script>

<template>
  <div class="rating-badge">
    <Star :size="16" class="star-icon" fill="currentColor" />
    <span class="rating-value">{{ rating.toFixed(1) }}</span>
    <span class="review-count">({{ count }})</span>
  </div>
</template>

<style scoped>
.rating-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--color-warning-light, #fef3c7);
  border-radius: 6px;
}

.star-icon {
  color: var(--color-warning, #f59e0b);
}

.rating-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.review-count {
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}
</style>
