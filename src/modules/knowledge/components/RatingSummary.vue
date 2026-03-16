<!-- Knowledge: Rating summary — average score + star + count
     Ref: Phase 15 B1.2 -->
<template>
  <div
    v-if="ratingCount > 0"
    class="rating-summary inline-flex items-center gap-1.5"
    role="img"
    :aria-label="$t('knowledge.rating.summaryAria', { score: formattedScore, count: ratingCount })"
  >
    <Star :size="size === 'sm' ? 14 : 16" class="text-yellow-400 fill-yellow-400" />
    <span :class="['font-medium', size === 'sm' ? 'text-xs' : 'text-sm']">
      {{ formattedScore }}
    </span>
    <span :class="['text-gray-400', size === 'sm' ? 'text-xs' : 'text-sm']">
      ({{ ratingCount }})
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Star } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  averageRating: number | null
  ratingCount: number
  size?: 'sm' | 'md'
}>(), {
  size: 'md',
})

const formattedScore = computed(() =>
  props.averageRating != null ? props.averageRating.toFixed(1) : '—'
)
</script>
