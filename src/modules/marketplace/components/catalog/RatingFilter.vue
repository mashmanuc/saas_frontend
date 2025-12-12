<script setup lang="ts">
// TASK F11: RatingFilter component
import { Star } from 'lucide-vue-next'

defineProps<{
  value: number | null
}>()

const emit = defineEmits<{
  update: [value: number | null]
}>()

const ratings = [4.5, 4.0, 3.5, 3.0]

const handleClick = (rating: number) => {
  emit('update', rating)
}

const handleClear = () => {
  emit('update', null)
}
</script>

<template>
  <div class="rating-filter">
    <button
      v-for="rating in ratings"
      :key="rating"
      class="rating-option"
      :class="{ 'is-selected': value === rating }"
      type="button"
      @click="handleClick(rating)"
    >
      <Star :size="16" class="star" :class="{ filled: true }" />
      <span>{{ rating }}+</span>
    </button>
    <button
      v-if="value !== null"
      class="clear-btn"
      type="button"
      @click="handleClear"
    >
      Any
    </button>
  </div>
</template>

<style scoped>
.rating-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rating-option {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: var(--color-bg-secondary, #f3f4f6);
  border: 1px solid transparent;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
  cursor: pointer;
  transition: all 0.15s;
}

.rating-option:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.rating-option.is-selected {
  background: var(--color-primary-light, #eff6ff);
  border-color: var(--color-primary, #3b82f6);
  color: var(--color-primary, #3b82f6);
}

.star {
  color: var(--color-warning, #f59e0b);
}

.star.filled {
  fill: var(--color-warning, #f59e0b);
}

.clear-btn {
  padding: 8px 12px;
  background: none;
  border: 1px dashed var(--color-border, #d1d5db);
  border-radius: 20px;
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.15s;
}

.clear-btn:hover {
  border-color: var(--color-text-secondary, #6b7280);
  color: var(--color-text-primary, #111827);
}
</style>
