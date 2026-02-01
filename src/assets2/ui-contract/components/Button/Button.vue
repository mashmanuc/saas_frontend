<script setup lang="ts">
import { computed } from 'vue';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  active?: boolean;
  fullWidth?: boolean;
  iconOnly?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

const props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  active: false,
  fullWidth: false,
  iconOnly: false,
  type: 'button',
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const isDisabled = computed(() => props.disabled || props.loading);

const classes = computed(() => [
  $style.button,
  $style[props.variant],
  $style[props.size],
  {
    [$style.loading]: props.loading,
    [$style.disabled]: isDisabled.value,
    [$style.active]: props.active,
    [$style.fullWidth]: props.fullWidth,
    [$style.iconOnly]: props.iconOnly,
  },
]);

const handleClick = (e: MouseEvent) => {
  if (!isDisabled.value) {
    emit('click', e);
  }
};
</script>

<template>
  <button
    :type="type"
    :class="classes"
    :disabled="isDisabled"
    :aria-disabled="isDisabled"
    :aria-busy="loading"
    @click="handleClick"
  >
    <span v-if="$slots.iconLeft" :class="$style.icon">
      <slot name="iconLeft" />
    </span>
    <slot v-if="!iconOnly" />
    <span v-if="$slots.iconRight" :class="$style.icon">
      <slot name="iconRight" />
    </span>
  </button>
</template>

<style module>
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-sm, 0.5rem);
  font-family: var(--ui-font-family, inherit);
  font-weight: var(--ui-font-weight-medium, 500);
  line-height: 1;
  border: 1px solid transparent;
  border-radius: var(--ui-radius-full, 25px);
  cursor: pointer;
  transition: all var(--ui-transition-fast, 150ms ease);
  user-select: none;
  white-space: nowrap;
  outline: none;
}

.button:focus-visible {
  outline: 2px solid var(--ui-color-primary, #059669);
  outline-offset: 2px;
}

/* Sizes */
.sm { height: var(--ui-btn-height-sm, 2rem); padding: 0 var(--ui-space-md, 0.75rem); font-size: var(--ui-font-size-sm, 0.875rem); }
.md { height: var(--ui-btn-height-md, 2.5rem); padding: 0 var(--ui-space-lg, 1rem); font-size: var(--ui-font-size-md, 1rem); }
.lg { height: var(--ui-btn-height-lg, 3rem); padding: 0 var(--ui-space-xl, 1.5rem); font-size: var(--ui-font-size-lg, 1.125rem); }

/* Variants */
.primary {
  background: linear-gradient(135deg, var(--ui-color-primary, #059669), var(--ui-color-primary-hover, #047857));
  color: var(--ui-color-primary-contrast, #ffffff);
  box-shadow: 0 4px 15px color-mix(in srgb, var(--ui-color-primary, #059669) 30%, transparent);
}
.primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px color-mix(in srgb, var(--ui-color-primary, #059669) 40%, transparent); }
.primary:active:not(:disabled) { transform: translateY(0); }

.secondary {
  background-color: var(--ui-color-surface, rgba(255, 255, 255, 0.9));
  color: var(--ui-color-text, #0d4a3e);
  border-color: var(--ui-color-border, rgba(5, 150, 105, 0.2));
}
.secondary:hover:not(:disabled) { background-color: color-mix(in srgb, var(--ui-color-surface, #fff) 85%, var(--ui-color-primary, #059669) 15%); border-color: var(--ui-color-primary, #059669); }

.danger {
  background-color: var(--ui-color-danger, #ef4444);
  color: var(--ui-color-primary-contrast, #ffffff);
}
.danger:hover:not(:disabled) { background-color: color-mix(in srgb, var(--ui-color-danger, #ef4444) 90%, #000 10%); }

.outline {
  background-color: transparent;
  color: var(--ui-color-text, #0d4a3e);
  border-color: var(--ui-color-border, rgba(5, 150, 105, 0.2));
}
.outline:hover:not(:disabled) { border-color: var(--ui-color-primary, #059669); color: var(--ui-color-primary, #059669); }

.ghost {
  background-color: transparent;
  color: var(--ui-color-primary, #059669);
  border-color: color-mix(in srgb, var(--ui-color-primary, #059669) 25%, transparent);
}
.ghost:hover:not(:disabled) { background-color: color-mix(in srgb, var(--ui-color-primary, #059669) 10%, transparent); }

/* States */
.disabled, .button:disabled { opacity: 0.6; cursor: not-allowed; pointer-events: none; }

.loading { position: relative; color: transparent !important; pointer-events: none; }
.loading::after {
  content: '';
  position: absolute;
  width: 1em;
  height: 1em;
  border: 2px solid var(--ui-color-primary-contrast, #fff);
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
.loading.secondary::after, .loading.outline::after, .loading.ghost::after {
  border-color: var(--ui-color-primary, #059669);
  border-right-color: transparent;
}

.active { background-color: color-mix(in srgb, var(--ui-color-primary, #059669) 20%, transparent); }
.fullWidth { width: 100%; }

.iconOnly { padding: 0; aspect-ratio: 1; }
.iconOnly.sm { width: var(--ui-btn-height-sm, 2rem); }
.iconOnly.md { width: var(--ui-btn-height-md, 2.5rem); }
.iconOnly.lg { width: var(--ui-btn-height-lg, 3rem); }

.icon { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }

@keyframes spin { to { transform: rotate(360deg); } }
</style>
