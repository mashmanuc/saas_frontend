<script setup lang="ts">
import { Star } from 'lucide-vue-next'

interface Props {
  value: number
  count?: number
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
  size: 'md',
})

function getStarSize(): number {
  switch (props.size) {
    case 'sm':
      return 12
    case 'lg':
      return 18
    default:
      return 14
  }
}
</script>

<template>
  <div class="rating" :class="`rating--${size}`">
    <Star :size="getStarSize()" class="star" fill="currentColor" />
    <span class="value">{{ value.toFixed(1) }}</span>
    <span v-if="count > 0" class="count">({{ count }})</span>
  </div>
</template>

<style scoped>
.rating {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.star {
  color: #f59e0b;
}

.value {
  font-weight: 600;
  color: #111827;
}

.count {
  color: #6b7280;
}

.rating--sm {
  font-size: 0.75rem;
}

.rating--md {
  font-size: 0.875rem;
}

.rating--lg {
  font-size: 1rem;
}

.rating--lg .value {
  font-size: 1.125rem;
}
</style>
