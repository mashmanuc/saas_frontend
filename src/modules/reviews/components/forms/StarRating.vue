<script setup lang="ts">
// F13: Interactive Star Rating Component
import { ref, computed } from 'vue'
import { Star } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    modelValue: number
    size?: 'sm' | 'md' | 'lg'
    readonly?: boolean
  }>(),
  {
    size: 'md',
    readonly: false,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const hoverRating = ref(0)

const sizeMap = {
  sm: 20,
  md: 28,
  lg: 36,
}

const iconSize = computed(() => sizeMap[props.size])

const displayRating = computed(() =>
  hoverRating.value > 0 ? hoverRating.value : props.modelValue
)

function handleClick(rating: number) {
  if (props.readonly) return
  emit('update:modelValue', rating)
}

function handleMouseEnter(rating: number) {
  if (props.readonly) return
  hoverRating.value = rating
}

function handleMouseLeave() {
  hoverRating.value = 0
}
</script>

<template>
  <div
    class="star-rating"
    :class="[size, { readonly, interactive: !readonly }]"
    @mouseleave="handleMouseLeave"
  >
    <button
      v-for="i in 5"
      :key="i"
      type="button"
      class="star-btn"
      :class="{ active: i <= displayRating }"
      :disabled="readonly"
      @click="handleClick(i)"
      @mouseenter="handleMouseEnter(i)"
    >
      <Star
        :size="iconSize"
        :fill="i <= displayRating ? 'currentColor' : 'none'"
      />
    </button>
  </div>
</template>

<style scoped>
.star-rating {
  display: flex;
  gap: 4px;
}

.star-rating.lg {
  gap: 8px;
}

.star-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: none;
  border: none;
  color: var(--color-border, #d1d5db);
  cursor: pointer;
  transition: all 0.15s;
}

.star-btn:disabled {
  cursor: default;
}

.star-btn.active {
  color: var(--color-warning, #f59e0b);
}

.star-rating.interactive .star-btn:hover {
  transform: scale(1.1);
}

.star-rating.interactive .star-btn:not(.active):hover {
  color: var(--color-warning-light, #fcd34d);
}
</style>
