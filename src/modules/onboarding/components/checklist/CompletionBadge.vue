<script setup lang="ts">
// F27: Completion Badge Component
import { computed } from 'vue'

const props = defineProps<{
  percentage: number
  size?: 'sm' | 'md' | 'lg'
}>()

const tier = computed(() => {
  if (props.percentage >= 100) return 'complete'
  if (props.percentage >= 75) return 'good'
  if (props.percentage >= 50) return 'progress'
  return 'starting'
})

const sizeClass = computed(() => props.size || 'md')

const circleSize = computed(() => {
  switch (props.size) {
    case 'sm':
      return 32
    case 'lg':
      return 64
    default:
      return 48
  }
})

const strokeWidth = computed(() => {
  switch (props.size) {
    case 'sm':
      return 3
    case 'lg':
      return 5
    default:
      return 4
  }
})

const radius = computed(() => (circleSize.value - strokeWidth.value) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const offset = computed(() => circumference.value - (props.percentage / 100) * circumference.value)
</script>

<template>
  <div :class="['completion-badge', tier, sizeClass]">
    <svg :width="circleSize" :height="circleSize" class="progress-ring">
      <circle
        class="progress-ring-bg"
        :stroke-width="strokeWidth"
        fill="transparent"
        :r="radius"
        :cx="circleSize / 2"
        :cy="circleSize / 2"
      />
      <circle
        class="progress-ring-fill"
        :stroke-width="strokeWidth"
        fill="transparent"
        :r="radius"
        :cx="circleSize / 2"
        :cy="circleSize / 2"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
      />
    </svg>
    <span class="badge-label">{{ percentage }}%</span>
  </div>
</template>

<style scoped>
.completion-badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.progress-ring {
  transform: rotate(-90deg);
}

.progress-ring-bg {
  stroke: var(--color-bg-secondary, #e5e7eb);
}

.progress-ring-fill {
  transition: stroke-dashoffset 0.3s ease;
}

/* Tiers */
.completion-badge.starting .progress-ring-fill {
  stroke: var(--color-text-tertiary, #9ca3af);
}

.completion-badge.progress .progress-ring-fill {
  stroke: var(--color-warning, #f59e0b);
}

.completion-badge.good .progress-ring-fill {
  stroke: var(--color-primary, #3b82f6);
}

.completion-badge.complete .progress-ring-fill {
  stroke: var(--color-success, #10b981);
}

.badge-label {
  position: absolute;
  font-weight: 700;
}

/* Sizes */
.completion-badge.sm .badge-label {
  font-size: 10px;
}

.completion-badge.md .badge-label {
  font-size: 12px;
}

.completion-badge.lg .badge-label {
  font-size: 16px;
}
</style>
