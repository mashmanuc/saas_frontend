<template>
  <button
    class="tool-btn"
    :class="{
      'tool-btn--active': active,
      'tool-btn--disabled': disabled
    }"
    :disabled="disabled"
    @click="$emit('click')"
    @mouseenter="showTooltip = true"
    @mouseleave="showTooltip = false"
  >
    <!-- SVG Icon slot or emoji fallback -->
    <span class="tool-btn__icon">
      <slot name="icon">{{ icon }}</slot>
    </span>

    <!-- Tooltip -->
    <Transition name="tooltip">
      <span v-if="showTooltip && tooltip" class="tool-btn__tooltip">
        <span class="tool-btn__tooltip-text">{{ tooltip }}</span>
        <span v-if="shortcut" class="tool-btn__shortcut">{{ shortcut }}</span>
      </span>
    </Transition>
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  icon?: string
  tooltip?: string
  shortcut?: string
  active?: boolean
  disabled?: boolean
}>()

defineEmits<{
  click: []
}>()

const showTooltip = ref(false)
</script>

<style scoped>
.tool-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 8px;
  background: var(--color-bg-primary, #ffffff);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tool-btn:hover {
  background: var(--color-bg-secondary, #f1f5f9);
  border-color: var(--color-border, #e2e8f0);
}

.tool-btn--active {
  background: var(--color-brand-light, #dbeafe);
  border-color: var(--color-brand, #2563eb);
  color: var(--color-brand, #2563eb);
}

.tool-btn--active:hover {
  background: var(--color-brand-light, #dbeafe);
}

.tool-btn--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tool-btn__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  line-height: 1;
}

.tool-btn__icon :deep(svg) {
  width: 20px;
  height: 20px;
  stroke-width: 2;
}

.tool-btn__tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  background: var(--color-bg-inverse, #1e293b);
  color: var(--color-text-inverse, #ffffff);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: none;
}

.tool-btn__tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: var(--color-bg-inverse, #1e293b);
}

.tool-btn__shortcut {
  font-size: 10px;
  opacity: 0.7;
  font-family: monospace;
}

/* Tooltip animation */
.tooltip-enter-active,
.tooltip-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .tool-btn {
    background: var(--color-bg-primary-dark, #1e293b);
    color: var(--color-text-dark, #f1f5f9);
  }

  .tool-btn:hover {
    background: var(--color-bg-secondary-dark, #334155);
  }

  .tool-btn--active {
    background: var(--color-brand-dark, #1d4ed8);
    border-color: var(--color-brand, #3b82f6);
    color: #ffffff;
  }
}
</style>
