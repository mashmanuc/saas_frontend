<template>
  <span
    :class="[
      'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
      variantClass,
    ]"
  >
    <slot />
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'default', // default | success | warning | muted
  },
})

const variantClass = computed(() => {
  switch (props.variant) {
    case 'success':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/40'
    case 'warning':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/40'
    case 'muted':
      return 'bg-gray-500/10 text-gray-400 border-gray-500/30'
    default:
      return 'bg-primary/10 text-primary border-primary/40'
  }
})
</script>
