<script setup lang="ts">
// TASK F11: RatingFilter component
import { Star } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

defineProps<{
  value: number | null
}>()

const emit = defineEmits<{
  update: [value: number | null]
}>()

const ratings = [4.5, 4.0, 3.5, 3.0]

const { t } = useI18n()

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
      {{ t('marketplace.filters.any') }}
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
  background: var(--surface-card-muted);
  border: 1px solid transparent;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s;
}

.rating-option:hover {
  background: color-mix(in srgb, var(--border-color) 65%, transparent);
}

.rating-option.is-selected {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-color: var(--accent);
  color: var(--accent);
}

.star {
  color: color-mix(in srgb, var(--warning-bg) 72%, var(--text-primary));
}

.star.filled {
  fill: color-mix(in srgb, var(--warning-bg) 72%, var(--text-primary));
}

.clear-btn {
  padding: 8px 12px;
  background: none;
  border: 1px dashed var(--border-color);
  border-radius: 20px;
  font-size: 13px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.clear-btn:hover {
  border-color: var(--text-muted);
  color: var(--text-primary);
}
</style>
