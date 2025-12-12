<script setup lang="ts">
// F28: Onboarding Tooltip Component
import { ref, onMounted, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  target: string // CSS selector
  title: string
  description: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  step?: number
  totalSteps?: number
}>()

const emit = defineEmits<{
  next: []
  skip: []
  close: []
}>()

const tooltipRef = ref<HTMLElement | null>(null)
const targetRect = ref<DOMRect | null>(null)

function updatePosition() {
  const targetEl = document.querySelector(props.target)
  if (targetEl) {
    targetRect.value = targetEl.getBoundingClientRect()
  }
}

onMounted(() => {
  updatePosition()
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition)
})

onUnmounted(() => {
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition)
})
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div class="tooltip-backdrop" @click="emit('close')" />

    <!-- Highlight -->
    <div
      v-if="targetRect"
      class="tooltip-highlight"
      :style="{
        top: `${targetRect.top - 4}px`,
        left: `${targetRect.left - 4}px`,
        width: `${targetRect.width + 8}px`,
        height: `${targetRect.height + 8}px`,
      }"
    />

    <!-- Tooltip -->
    <div
      ref="tooltipRef"
      class="onboarding-tooltip"
      :class="position || 'bottom'"
      :style="
        targetRect
          ? {
              top: `${targetRect.bottom + 12}px`,
              left: `${targetRect.left + targetRect.width / 2}px`,
            }
          : {}
      "
    >
      <button class="close-btn" @click="emit('close')">
        <X :size="16" />
      </button>

      <h4 class="tooltip-title">{{ title }}</h4>
      <p class="tooltip-description">{{ description }}</p>

      <div class="tooltip-footer">
        <span v-if="step && totalSteps" class="step-counter">
          {{ step }} / {{ totalSteps }}
        </span>

        <div class="tooltip-actions">
          <button class="btn-skip" @click="emit('skip')">Skip</button>
          <button class="btn-next" @click="emit('next')">Next</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.tooltip-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

.tooltip-highlight {
  position: fixed;
  border: 2px solid var(--color-primary, #3b82f6);
  border-radius: 8px;
  background: transparent;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  pointer-events: none;
}

.onboarding-tooltip {
  position: fixed;
  width: 300px;
  padding: 20px;
  background: var(--color-bg-primary, white);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  z-index: 1001;
  transform: translateX(-50%);
}

.onboarding-tooltip.bottom::before {
  content: '';
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  border: 8px solid transparent;
  border-bottom-color: var(--color-bg-primary, white);
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  padding: 4px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
}

.close-btn:hover {
  background: var(--color-bg-secondary, #f5f5f5);
}

.tooltip-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.tooltip-description {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
  line-height: 1.5;
}

.tooltip-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.step-counter {
  font-size: 12px;
  color: var(--color-text-tertiary, #9ca3af);
}

.tooltip-actions {
  display: flex;
  gap: 8px;
}

.btn-skip {
  padding: 8px 12px;
  background: none;
  border: none;
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
}

.btn-skip:hover {
  text-decoration: underline;
}

.btn-next {
  padding: 8px 16px;
  background: var(--color-primary, #3b82f6);
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: white;
  cursor: pointer;
}

.btn-next:hover {
  background: var(--color-primary-dark, #2563eb);
}
</style>
