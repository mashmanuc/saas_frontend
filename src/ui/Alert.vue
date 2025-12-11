<template>
  <div
    class="alert"
    :class="variantClass"
    role="status"
    :aria-live="variant === 'danger' ? 'assertive' : 'polite'"
  >
    <div class="alert__icon" aria-hidden="true">
      <slot name="icon">
        <span>{{ icon }}</span>
      </slot>
    </div>
    <div class="alert__content">
      <p class="alert__title">{{ title }}</p>
      <p v-if="description" class="alert__description">
        {{ description }}
      </p>
      <div v-if="$slots.default" class="alert__actions">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const VARIANT_ICONS = {
  success: '🎉',
  warning: '⚠️',
  danger: '⛔',
  info: '💡',
}

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  variant: {
    type: String,
    default: 'info', // info | success | warning | danger
  },
})

const icon = computed(() => VARIANT_ICONS[props.variant] || VARIANT_ICONS.info)

const variantClass = computed(() => `alert--${props.variant}`)
</script>

<style scoped>
.alert {
  width: 100%;
  display: flex;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-lg, 16px);
  border: 1px solid transparent;
  background: color-mix(in srgb, var(--bg-secondary, #f4f6fb) 65%, transparent);
}

.alert__icon {
  width: 3rem;
  height: 3rem;
  border-radius: 1rem;
  display: grid;
  place-items: center;
  font-size: 1.25rem;
  background: color-mix(in srgb, var(--card-bg, #fff) 85%, transparent);
}

.alert__content {
  flex: 1;
  min-width: 0;
}

.alert__title {
  margin: 0;
  font-weight: 600;
  color: var(--text-primary, #0f172a);
}

.alert__description {
  margin: 0.25rem 0 0;
  color: var(--text-secondary, #475467);
  font-size: 0.95rem;
}

.alert__actions {
  margin-top: 0.75rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.alert--info {
  border-color: color-mix(in srgb, var(--accent, #16a34a) 35%, transparent);
  background: color-mix(in srgb, var(--accent, #16a34a) 12%, transparent);
}

.alert--success {
  border-color: color-mix(in srgb, var(--success-bg, #0ea355) 35%, transparent);
  background: color-mix(in srgb, var(--success-bg, #0ea355) 12%, transparent);
}

.alert--warning {
  border-color: color-mix(in srgb, var(--warning-bg, #fbbf24) 45%, transparent);
  background: color-mix(in srgb, var(--warning-bg, #fbbf24) 18%, transparent);
}

.alert--danger {
  border-color: color-mix(in srgb, var(--danger-bg, #ef4444) 40%, transparent);
  background: color-mix(in srgb, var(--danger-bg, #ef4444) 16%, transparent);
}
</style>
