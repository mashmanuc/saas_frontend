<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border"
    :style="variantStyle"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'error' | 'muted'

const props = withDefaults(
  defineProps<{
    variant?: BadgeVariant
  }>(),
  {
    variant: 'default',
  }
)

const palette: Record<Exclude<BadgeVariant, 'default'>, string> = {
  success: '--success-bg',
  warning: '--warning-bg',
  danger: '--danger-bg',
  error: '--danger-bg',
  muted: '--text-secondary',
}

const variantStyle = computed(() => {
  const token = palette[props.variant] || '--accent'
  return `background: color-mix(in srgb, var(${token}) 15%, transparent); color: var(${token}); border-color: color-mix(in srgb, var(${token}) 40%, transparent);`
})
</script>
