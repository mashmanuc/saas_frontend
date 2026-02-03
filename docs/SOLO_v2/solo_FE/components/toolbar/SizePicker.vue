<template>
  <div class="size-picker" ref="containerRef">
    <!-- Trigger button showing current size preview -->
    <button
      class="size-picker__trigger"
      :title="`Size: ${modelValue}px`"
      @click="isOpen = !isOpen"
    >
      <span class="size-picker__preview-wrapper">
        <span
          class="size-picker__preview-dot"
          :style="{
            width: `${Math.min(modelValue * 2, 20)}px`,
            height: `${Math.min(modelValue * 2, 20)}px`
          }"
        />
      </span>
      <span class="size-picker__value">{{ modelValue }}px</span>
      <svg class="size-picker__chevron" :class="{ open: isOpen }" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </button>

    <!-- Dropdown -->
    <Transition name="dropdown">
      <div v-if="isOpen" class="size-picker__dropdown">
        <!-- Presets -->
        <div class="size-picker__presets">
          <button
            v-for="preset in PRESETS"
            :key="preset.value"
            class="size-picker__preset"
            :class="{ 'size-picker__preset--active': modelValue === preset.value }"
            @click="selectSize(preset.value)"
          >
            <span
              class="size-picker__preset-dot"
              :style="{
                width: `${preset.value * 2}px`,
                height: `${preset.value * 2}px`
              }"
            />
            <span class="size-picker__preset-label">{{ preset.label }}</span>
            <span class="size-picker__preset-value">{{ preset.value }}px</span>
          </button>
        </div>

        <!-- Custom slider -->
        <div class="size-picker__slider-section">
          <label class="size-picker__slider-label">
            Custom: <strong>{{ modelValue }}px</strong>
          </label>
          <div class="size-picker__slider-row">
            <input
              type="range"
              class="size-picker__slider"
              min="1"
              max="20"
              :value="modelValue"
              @input="handleSliderInput"
            />
            <input
              type="number"
              class="size-picker__number"
              min="1"
              max="50"
              :value="modelValue"
              @change="handleNumberInput"
            />
          </div>
          <div class="size-picker__slider-preview">
            <span
              class="size-picker__large-dot"
              :style="{
                width: `${modelValue * 2}px`,
                height: `${modelValue * 2}px`
              }"
            />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const PRESETS = [
  { label: 'Fine', value: 1 },
  { label: 'Small', value: 2 },
  { label: 'Medium', value: 5 },
  { label: 'Large', value: 10 },
  { label: 'Extra Large', value: 15 },
]

const props = defineProps<{
  modelValue: number
  presetSizes?: number[]
}>()

const emit = defineEmits<{
  'update:modelValue': [size: number]
}>()

const containerRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)

function selectSize(size: number) {
  emit('update:modelValue', size)
  isOpen.value = false
}

function handleSliderInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  emit('update:modelValue', value)
}

function handleNumberInput(event: Event) {
  const input = event.target as HTMLInputElement
  let value = Number(input.value)
  value = Math.max(1, Math.min(50, value))
  emit('update:modelValue', value)
}

function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.size-picker {
  position: relative;
}

.size-picker__trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--color-bg-primary, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.size-picker__trigger:hover {
  border-color: var(--color-border-hover, #cbd5e1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.size-picker__preview-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.size-picker__preview-dot {
  background: var(--color-text-primary, #1e293b);
  border-radius: 50%;
  transition: all 0.15s ease;
}

.size-picker__value {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary, #64748b);
  min-width: 36px;
}

.size-picker__chevron {
  width: 16px;
  height: 16px;
  color: var(--color-text-secondary, #64748b);
  transition: transform 0.15s ease;
}

.size-picker__chevron.open {
  transform: rotate(180deg);
}

.size-picker__dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 100;
  width: 220px;
  padding: 8px;
  background: var(--color-bg-primary, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
}

.size-picker__presets {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border, #e2e8f0);
}

.size-picker__preset {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.1s ease;
}

.size-picker__preset:hover {
  background: var(--color-bg-secondary, #f1f5f9);
}

.size-picker__preset--active {
  background: var(--color-brand-light, #dbeafe);
}

.size-picker__preset-dot {
  background: var(--color-text-primary, #1e293b);
  border-radius: 50%;
  flex-shrink: 0;
}

.size-picker__preset-label {
  flex: 1;
  text-align: left;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary, #1e293b);
}

.size-picker__preset-value {
  font-size: 12px;
  color: var(--color-text-secondary, #64748b);
  font-family: monospace;
}

.size-picker__slider-section {
  padding: 4px;
}

.size-picker__slider-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary, #64748b);
  margin-bottom: 8px;
}

.size-picker__slider-label strong {
  color: var(--color-text-primary, #1e293b);
}

.size-picker__slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.size-picker__slider {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-bg-tertiary, #e2e8f0);
  border-radius: 3px;
  outline: none;
}

.size-picker__slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: var(--color-brand, #2563eb);
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.size-picker__slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.size-picker__slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: var(--color-brand, #2563eb);
  border: none;
  border-radius: 50%;
  cursor: pointer;
}

.size-picker__number {
  width: 50px;
  height: 28px;
  padding: 0 6px;
  text-align: center;
  font-size: 13px;
  font-family: monospace;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  outline: none;
  transition: border-color 0.15s ease;
}

.size-picker__number:focus {
  border-color: var(--color-brand, #2563eb);
}

.size-picker__number::-webkit-inner-spin-button,
.size-picker__number::-webkit-outer-spin-button {
  opacity: 1;
}

.size-picker__slider-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50px;
  margin-top: 12px;
  background: var(--color-bg-secondary, #f8fafc);
  border-radius: 8px;
}

.size-picker__large-dot {
  background: var(--color-text-primary, #1e293b);
  border-radius: 50%;
  transition: all 0.15s ease;
}

/* Dropdown animation */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .size-picker__trigger {
    background: var(--color-bg-primary-dark, #1e293b);
    border-color: var(--color-border-dark, #334155);
  }

  .size-picker__dropdown {
    background: var(--color-bg-primary-dark, #1e293b);
    border-color: var(--color-border-dark, #334155);
  }

  .size-picker__preset:hover {
    background: var(--color-bg-secondary-dark, #334155);
  }

  .size-picker__preset-dot,
  .size-picker__preview-dot,
  .size-picker__large-dot {
    background: var(--color-text-dark, #f1f5f9);
  }

  .size-picker__number {
    background: var(--color-bg-secondary-dark, #334155);
    border-color: var(--color-border-dark, #475569);
    color: var(--color-text-dark, #f1f5f9);
  }

  .size-picker__slider-preview {
    background: var(--color-bg-secondary-dark, #334155);
  }
}
</style>
