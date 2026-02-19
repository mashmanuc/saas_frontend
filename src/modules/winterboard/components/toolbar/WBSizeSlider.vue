<!-- WB: Size slider popover — range input + preview circle + presets
     Ref: TASK_BOARD.md B6.1 — Size slider з preview -->
<template>
  <div class="wb-size-slider" ref="rootEl">
    <!-- Trigger button: shows current size -->
    <button
      type="button"
      class="wb-size-slider__trigger"
      :aria-label="t('winterboard.toolbar.strokeSize')"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <span
        class="wb-size-slider__preview-dot"
        :style="{ width: `${clampedSize}px`, height: `${clampedSize}px` }"
      />
    </button>

    <!-- Popover (position:fixed to escape toolbar overflow clipping) -->
    <Transition name="wb-popover">
      <div
        v-if="isOpen"
        class="wb-size-slider__popover"
        :style="popoverStyle"
        role="dialog"
        :aria-label="t('winterboard.toolbar.strokeSize')"
        @keydown.escape="close"
      >
        <!-- Live preview -->
        <div class="wb-size-slider__preview">
          <span
            class="wb-size-slider__circle"
            :style="{
              width: `${modelValue * 2}px`,
              height: `${modelValue * 2}px`,
              background: currentColor,
            }"
          />
          <span class="wb-size-slider__value">{{ modelValue }}px</span>
        </div>

        <!-- Range slider -->
        <input
          type="range"
          class="wb-size-slider__range"
          :value="modelValue"
          min="1"
          max="20"
          step="1"
          :aria-label="t('winterboard.toolbar.strokeSize')"
          @input="handleInput(($event.target as HTMLInputElement).value)"
        />

        <!-- Presets -->
        <div class="wb-size-slider__presets">
          <button
            v-for="preset in SIZE_PRESETS"
            :key="preset.value"
            type="button"
            class="wb-size-slider__preset"
            :class="{ 'wb-size-slider__preset--active': modelValue === preset.value }"
            @click="selectSize(preset.value)"
          >
            <span
              class="wb-size-slider__preset-dot"
              :style="{ width: `${preset.value}px`, height: `${preset.value}px` }"
            />
            <span class="wb-size-slider__preset-label">{{ t(preset.labelKey) }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
// WB: WBSizeSlider — stroke size picker with range slider + preview + presets
// Ref: TASK_BOARD.md B6.1

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const SIZE_PRESETS = [
  { value: 2, labelKey: 'winterboard.sizePresets.thin' },
  { value: 5, labelKey: 'winterboard.sizePresets.medium' },
  { value: 10, labelKey: 'winterboard.sizePresets.thick' },
  { value: 15, labelKey: 'winterboard.sizePresets.extra' },
]

const props = defineProps<{
  modelValue: number
  currentColor?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [size: number]
}>()

const { t } = useI18n()
const rootEl = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const popoverPos = ref<{ top: number; left: number }>({ top: 0, left: 0 })

const clampedSize = computed(() => Math.max(4, Math.min(16, props.modelValue * 1.5)))

const popoverStyle = computed(() => ({
  position: 'fixed' as const,
  top: `${popoverPos.value.top}px`,
  left: `${popoverPos.value.left}px`,
}))

function handleInput(val: string): void {
  emit('update:modelValue', Number(val))
}

function selectSize(size: number): void {
  emit('update:modelValue', size)
}

function toggle(): void {
  if (!isOpen.value) {
    updatePopoverPosition()
  }
  isOpen.value = !isOpen.value
}

function updatePopoverPosition(): void {
  const el = rootEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  // Position to the right of the trigger, vertically aligned
  popoverPos.value = {
    top: rect.top,
    left: rect.right + 8,
  }
}

function close(): void {
  isOpen.value = false
}

function handleOutsideClick(e: MouseEvent): void {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleOutsideClick)
})
</script>

<style scoped>
.wb-size-slider {
  position: relative;
}

.wb-size-slider__trigger {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.wb-size-slider__trigger:hover {
  background: var(--wb-btn-hover, #f1f5f9);
}

.wb-size-slider__trigger:focus-visible {
  outline: 2px solid var(--wb-brand, #0066FF);
  outline-offset: -2px;
}

.wb-size-slider__preview-dot {
  border-radius: 50%;
  background: var(--wb-fg, #0f172a);
  min-width: 4px;
  min-height: 4px;
}

/* Popover — position:fixed set via inline style to escape overflow clipping */
.wb-size-slider__popover {
  z-index: 200;
  width: 180px;
  padding: 12px;
  background: var(--wb-toolbar-bg, #ffffff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

/* Preview */
.wb-size-slider__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px 0 12px;
}

.wb-size-slider__circle {
  border-radius: 50%;
  min-width: 2px;
  min-height: 2px;
  transition: width 0.1s ease, height 0.1s ease;
}

.wb-size-slider__value {
  font-size: 13px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
  min-width: 32px;
}

/* Range slider */
.wb-size-slider__range {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--wb-toolbar-border, #e2e8f0);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.wb-size-slider__range::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--wb-brand, #0066FF);
  border: 2px solid #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  cursor: pointer;
}

.wb-size-slider__range::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--wb-brand, #0066FF);
  border: 2px solid #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  cursor: pointer;
}

.wb-size-slider__range:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 3px rgba(0, 102, 255, 0.3);
}

/* Presets */
.wb-size-slider__presets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--wb-toolbar-border, #e2e8f0);
}

.wb-size-slider__preset {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 2px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.wb-size-slider__preset:hover {
  background: var(--wb-btn-hover, #f1f5f9);
}

.wb-size-slider__preset--active {
  background: var(--wb-brand-light, #dbeafe);
  border-color: var(--wb-brand, #0066FF);
}

.wb-size-slider__preset-dot {
  border-radius: 50%;
  background: var(--wb-fg, #0f172a);
  min-width: 2px;
  min-height: 2px;
}

.wb-size-slider__preset-label {
  font-size: 10px;
  color: var(--wb-fg-secondary, #64748b);
  font-weight: 500;
}

/* Popover transition */
.wb-popover-enter-active,
.wb-popover-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.wb-popover-enter-from,
.wb-popover-leave-to {
  opacity: 0;
  transform: translateX(-4px);
}

/* Mobile: popover opens above trigger when toolbar is at bottom */
@media (max-width: 768px) {
  .wb-size-slider__popover {
    /* position:fixed overrides handled in JS for mobile */
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .wb-size-slider__trigger,
  .wb-size-slider__circle,
  .wb-size-slider__preset {
    transition: none;
  }

  .wb-popover-enter-active,
  .wb-popover-leave-active {
    transition: none;
  }
}
</style>
