<script setup lang="ts">
// F10: Rating Distribution Component (Histogram)
import { computed } from 'vue'
import { Star } from 'lucide-vue-next'

const props = defineProps<{
  distribution: Record<number, number>
  total: number
}>()

const emit = defineEmits<{
  filter: [rating: number | null]
}>()

const bars = computed(() => {
  const result = []
  for (let i = 5; i >= 1; i--) {
    const count = props.distribution[i] || 0
    const percentage = props.total > 0 ? (count / props.total) * 100 : 0
    result.push({
      rating: i,
      count,
      percentage,
    })
  }
  return result
})
</script>

<template>
  <div class="rating-distribution">
    <div
      v-for="bar in bars"
      :key="bar.rating"
      class="distribution-row"
      @click="emit('filter', bar.rating)"
    >
      <span class="rating-label">
        {{ bar.rating }}
        <Star :size="12" fill="currentColor" />
      </span>

      <div class="bar-container">
        <div
          class="bar-fill"
          :style="{ width: `${bar.percentage}%` }"
        />
      </div>

      <span class="count-label">{{ bar.count }}</span>
    </div>
  </div>
</template>

<style scoped>
.rating-distribution {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.distribution-row {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 4px 0;
  transition: opacity 0.15s;
}

.distribution-row:hover {
  opacity: 0.8;
}

.rating-label {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 32px;
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

.rating-label svg {
  color: var(--color-warning, #f59e0b);
}

.bar-container {
  flex: 1;
  height: 8px;
  background: var(--color-bg-tertiary, #e5e7eb);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: var(--color-warning, #f59e0b);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.count-label {
  width: 32px;
  text-align: right;
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}
</style>
