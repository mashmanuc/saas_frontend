<template>
  <div
    :class="[
      'inline-flex items-center justify-center rounded-full bg-surface-muted text-xs font-semibold uppercase select-none',
      sizeClass,
    ]"
  >
    <span class="truncate" :title="text">
      {{ initials }}
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  text: {
    type: String,
    default: '',
  },
  size: {
    type: String,
    default: 'md', // sm | md | lg
  },
})

const initials = computed(() => {
  const value = (props.text || '').trim()
  if (!value) return '?'

  const parts = value.split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const second = parts[1]?.[0] ?? ''
  const base = `${first}${second}`.toUpperCase()
  return base || value[0].toUpperCase()
})

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'h-7 w-7 text-[10px]'
    case 'lg':
      return 'h-10 w-10 text-sm'
    default:
      return 'h-8 w-8 text-xs'
  }
})
</script>
