<template>
  <div class="space-y-1">
    <p class="text-xs uppercase tracking-wide text-muted-foreground">
      {{ label }}
    </p>
    <p class="text-base text-foreground font-medium">
      <slot>{{ displayValue }}</slot>
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  value: {
    type: [String, Number],
    default: '',
  },
  placeholder: {
    type: String,
    default: '—',
  },
})

const displayValue = computed(() => {
  if (props.value === null || props.value === undefined || props.value === '') {
    return props.placeholder
  }
  return props.value
})
</script>
