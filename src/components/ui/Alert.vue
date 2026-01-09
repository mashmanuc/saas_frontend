<template>
  <div class="ui-alert" :class="variantClass">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Variant = 'success' | 'warning' | 'error' | 'info'

const props = defineProps<{ variant?: Variant }>()

const variantClass = computed(() => {
  switch (props.variant) {
    case 'success':
      return 'alert-success'
    case 'warning':
      return 'alert-warning'
    case 'error':
      return 'alert-error'
    case 'info':
    default:
      return 'alert-info'
  }
})
</script>

<style scoped>
.ui-alert {
  @apply px-4 py-3 rounded-lg text-sm font-medium;
}
.alert-success {
  @apply bg-green-50 text-green-800;
}
.alert-warning {
  @apply bg-yellow-50 text-yellow-800;
}
.alert-error {
  @apply bg-red-50 text-red-800;
}
.alert-info {
  @apply bg-blue-50 text-blue-800;
}
</style>
