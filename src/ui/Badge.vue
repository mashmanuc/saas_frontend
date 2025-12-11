<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
    :style="variantStyle"
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

const variantStyle = computed(() => {
  switch (props.variant) {
    case 'success':
      return 'background: color-mix(in srgb, var(--success-bg) 15%, transparent); color: var(--success-bg); border: 1px solid color-mix(in srgb, var(--success-bg) 40%, transparent);'
    case 'warning':
      return 'background: color-mix(in srgb, var(--warning-bg) 15%, transparent); color: var(--warning-bg); border: 1px solid color-mix(in srgb, var(--warning-bg) 40%, transparent);'
    case 'danger':
      return 'background: color-mix(in srgb, var(--danger-bg) 15%, transparent); color: var(--danger-bg); border: 1px solid color-mix(in srgb, var(--danger-bg) 40%, transparent);'
    case 'muted':
      return 'background: color-mix(in srgb, var(--text-secondary) 10%, transparent); color: var(--text-secondary); border: 1px solid color-mix(in srgb, var(--text-secondary) 30%, transparent);'
    default:
      return 'background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);'
  }
})
</script>
