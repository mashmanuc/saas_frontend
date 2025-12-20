<script setup lang="ts">
// TASK F12: CategoryGrid component
import type { Category } from '../../api/marketplace'
import CategoryCard from './CategoryCard.vue'

defineProps<{
  categories: Category[]
  loading?: boolean
}>()
</script>

<template>
  <div class="category-grid">
    <!-- Loading skeleton -->
    <template v-if="loading">
      <div v-for="i in 8" :key="i" class="category-skeleton">
        <div class="skeleton-icon" />
        <div class="skeleton-text" />
        <div class="skeleton-count" />
      </div>
    </template>

    <!-- Categories -->
    <template v-else>
      <CategoryCard
        v-for="category in categories"
        :key="category.slug"
        :category="category"
      />
    </template>
  </div>
</template>

<style scoped>
.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.category-skeleton {
  background: var(--surface-card);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.skeleton-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--border-color) 35%, transparent) 25%,
    color-mix(in srgb, var(--border-color) 55%, transparent) 50%,
    color-mix(in srgb, var(--border-color) 35%, transparent) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-text {
  width: 80%;
  height: 16px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--border-color) 35%, transparent) 25%,
    color-mix(in srgb, var(--border-color) 55%, transparent) 50%,
    color-mix(in srgb, var(--border-color) 35%, transparent) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-count {
  width: 50%;
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--border-color) 35%, transparent) 25%,
    color-mix(in srgb, var(--border-color) 55%, transparent) 50%,
    color-mix(in srgb, var(--border-color) 35%, transparent) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (max-width: 640px) {
  .category-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
}
</style>
