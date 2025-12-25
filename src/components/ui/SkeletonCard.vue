<template>
  <div class="skeleton-card" :class="variant">
    <div v-if="showHeader" class="skeleton-header">
      <div class="skeleton-avatar" />
      <div class="skeleton-text skeleton-title" />
    </div>
    <div class="skeleton-body">
      <div v-for="i in lines" :key="i" class="skeleton-text" :style="{ width: getLineWidth(i) }" />
    </div>
    <div v-if="showFooter" class="skeleton-footer">
      <div class="skeleton-button" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'default' | 'slot' | 'booking'
    lines?: number
    showHeader?: boolean
    showFooter?: boolean
  }>(),
  {
    variant: 'default',
    lines: 3,
    showHeader: false,
    showFooter: false,
  }
)

function getLineWidth(index: number): string {
  const widths = ['100%', '90%', '75%', '85%', '95%']
  return widths[(index - 1) % widths.length]
}
</script>

<style scoped>
.skeleton-card {
  padding: 16px;
  background: var(--color-bg-primary, #fff);
  border-radius: 8px;
  border: 1px solid var(--color-border, #e5e7eb);
}

.skeleton-card.slot {
  padding: 12px;
  min-height: 80px;
}

.skeleton-card.booking {
  padding: 20px;
}

.skeleton-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-text {
  height: 16px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-text.skeleton-title {
  height: 20px;
  width: 60%;
}

.skeleton-footer {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.skeleton-button {
  width: 100px;
  height: 36px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .skeleton-avatar,
  .skeleton-text,
  .skeleton-button {
    background: linear-gradient(90deg, #2a2a2a 25%, #3a3a3a 50%, #2a2a2a 75%);
    background-size: 200% 100%;
  }
}
</style>
