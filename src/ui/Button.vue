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
  pill: {
    type: Boolean,
    default: false,
  },
  iconOnly: {
    type: Boolean,
    default: false,
  },
  fullWidth: {
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
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
}

const classes = computed(() => {
  return [
    variantClasses[props.variant] || variantClasses.primary,
    sizeClasses[props.size] || sizeClasses.md,
    props.pill ? 'btn-pill' : '',
    props.iconOnly ? 'btn-icon-only' : '',
    props.fullWidth ? 'btn-full' : '',
  ].filter(Boolean).join(' ')
})
</script>

<style scoped>
/* ─── Base ─── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  border-radius: var(--radius-md, 6px);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1.4;
}

.btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ─── Sizes ─── */
.btn-sm { padding: 6px 12px; font-size: 0.8125rem; }
.btn-md { padding: 8px 16px; font-size: 0.875rem; }
.btn-lg { padding: 12px 20px; font-size: 1rem; }

/* ─── Primary ─── */
.btn-primary {
  background: var(--accent);
  color: var(--accent-contrast, #fff);
}
.btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
}

/* ─── Secondary ─── */
.btn-secondary {
  background: var(--surface-card, var(--bg-secondary, #f3f4f6));
  color: var(--text-primary, #111827);
  border: 1px solid var(--border-color, #e5e7eb);
}
.btn-secondary:hover:not(:disabled) {
  background: var(--bg-secondary, #e5e7eb);
  border-color: var(--accent);
  color: var(--accent);
}

/* ─── Outline ─── */
.btn-outline {
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--accent);
}
.btn-outline:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

/* ─── Danger ─── */
.btn-danger {
  background: var(--danger-bg, #ef4444);
  color: var(--accent-contrast, #fff);
}
.btn-danger:hover:not(:disabled) {
  filter: brightness(1.1);
}

/* ─── Ghost ─── */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: none;
}
.btn-ghost:hover:not(:disabled) {
  background: var(--bg-secondary, #f3f4f6);
  color: var(--text-primary);
}

/* ─── Modifiers ─── */
.btn-pill {
  border-radius: var(--radius-full) !important;
}
.btn-icon-only {
  padding: 0.5rem !important;
  aspect-ratio: 1;
}
.btn-full {
  width: 100%;
}
</style>
