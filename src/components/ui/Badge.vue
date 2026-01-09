<template>
  <span class="ui-badge" :class="variantClass">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Variant = 'success' | 'warning' | 'error' | 'default'

const props = defineProps<{ variant?: Variant }>()

const variantClass = computed(() => {
  switch (props.variant) {
    case 'success':
      return 'badge-success'
    case 'warning':
      return 'badge-warning'
    case 'error':
      return 'badge-error'
    default:
      return 'badge-default'
  }
})
</script>

<style scoped>
.ui-badge {
  @apply inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium;
}
.badge-success {
  @apply bg-green-100 text-green-700;
}
.badge-warning {
  @apply bg-yellow-100 text-yellow-700;
}
.badge-error {
  @apply bg-red-100 text-red-700;
}
.badge-default {
  @apply bg-gray-100 text-gray-700;
}
</style>
