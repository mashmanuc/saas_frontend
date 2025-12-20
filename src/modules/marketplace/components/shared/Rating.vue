<script setup lang="ts">
import { Star } from 'lucide-vue-next'
import { computed } from 'vue'

interface Props {
  value?: number | null
  count?: number
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  value: 0,
  count: 0,
  size: 'md',
})

const displayValue = computed(() => {
  const v = typeof props.value === 'number' ? props.value : Number(props.value)
  if (!Number.isFinite(v)) return '—'
  return v.toFixed(1)
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
    <span class="value">{{ displayValue }}</span>
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
  color: color-mix(in srgb, var(--warning-bg) 72%, var(--text-primary));
}

.value {
  font-weight: 600;
  color: var(--text-primary);
}

.count {
  color: var(--text-muted);
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
