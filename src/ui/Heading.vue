<template>
  <component
    :is="tag"
    :class="[
      baseClass,
      alignClass,
      className,
    ]"
  >
    <slot />
  </component>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  level: {
    type: Number,
    default: 1, // 1..3
  },
  align: {
    type: String,
    default: 'left', // left | center | right
  },
  className: {
    type: String,
    default: '',
  },
})

const tag = computed(() => {
  if (props.level === 2) return 'h2'
  if (props.level === 3) return 'h3'
  return 'h1'
})

const baseClass = computed(() => {
  switch (props.level) {
    case 2:
      return 'text-lg font-semibold text-foreground'
    case 3:
      return 'text-base font-semibold text-foreground'
    default:
      return 'text-2xl font-semibold text-foreground'
  }
})

const alignClass = computed(() => {
  if (props.align === 'center') return 'text-center'
  if (props.align === 'right') return 'text-right'
  return 'text-left'
})
</script>
