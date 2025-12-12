<script setup lang="ts">
// F9: Rating Stars Display Component
import { computed } from 'vue'
import { Star, StarHalf } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    rating: number
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    size: 'md',
  }
)

const sizeMap = {
  sm: 14,
  md: 18,
  lg: 24,
}

const iconSize = computed(() => sizeMap[props.size])

// Calculate full, half, and empty stars
const stars = computed(() => {
  const result: ('full' | 'half' | 'empty')[] = []
  const fullStars = Math.floor(props.rating)
  const hasHalf = props.rating % 1 >= 0.5

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      result.push('full')
    } else if (i === fullStars && hasHalf) {
      result.push('half')
    } else {
      result.push('empty')
    }
  }

  return result
})
</script>

<template>
  <div class="rating-stars" :class="size">
    <template v-for="(star, index) in stars" :key="index">
      <Star
        v-if="star === 'full'"
        :size="iconSize"
        class="star full"
        fill="currentColor"
      />
      <div v-else-if="star === 'half'" class="star-half-wrapper">
        <Star :size="iconSize" class="star empty" />
        <Star :size="iconSize" class="star half" fill="currentColor" />
      </div>
      <Star v-else :size="iconSize" class="star empty" />
    </template>
  </div>
</template>

<style scoped>
.rating-stars {
  display: flex;
  align-items: center;
  gap: 2px;
}

.star {
  flex-shrink: 0;
}

.star.full {
  color: var(--color-warning, #f59e0b);
}

.star.empty {
  color: var(--color-border, #d1d5db);
}

.star-half-wrapper {
  position: relative;
  display: flex;
}

.star-half-wrapper .star.empty {
  position: absolute;
}

.star-half-wrapper .star.half {
  color: var(--color-warning, #f59e0b);
  clip-path: inset(0 50% 0 0);
}
</style>
