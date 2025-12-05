<template>
  <button
    :class="classes"
    :disabled="disabled || loading"
    v-bind="$attrs"
  >
    <!-- Іконка ліворуч -->
    <span v-if="$slots.iconLeft" class="mr-2 inline-flex">
      <slot name="iconLeft" />
    </span>

    <!-- Текст кнопки -->
    <span v-if="!loading">
      <slot />
    </span>

    <!-- Loader -->
    <span v-if="loading" class="inline-block animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>

    <!-- Іконка праворуч -->
    <span v-if="$slots.iconRight" class="ml-2 inline-flex">
      <slot name="iconRight" />
    </span>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'primary', // primary, secondary, outline, danger, ghost
  },
  size: {
    type: String,
    default: 'md', // sm, md, lg
  },
  loading: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const variantClasses = {
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
  outline: 'btn btn-outline',
  danger: 'btn btn-danger',
  ghost: 'btn btn-ghost',
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-5 py-3 text-lg',
}

const classes = computed(() => {
  return [
    variantClasses[props.variant] || variantClasses.primary,
    sizeClasses[props.size] || sizeClasses.md,
  ].join(' ')
})
</script>
