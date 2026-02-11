<template>
  <div class="background-picker" ref="pickerRef">
    <button
      class="background-trigger"
      :class="{ 'background-trigger--active': isOpen }"
      @click="toggleDropdown"
      :title="'Background: ' + currentLabel"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line v-if="modelValue?.type === 'ruled'" x1="3" y1="9" x2="21" y2="9" />
        <line v-if="modelValue?.type === 'ruled'" x1="3" y1="15" x2="21" y2="15" />
        <template v-if="modelValue?.type === 'grid' || modelValue?.type === 'graph'">
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
        </template>
        <template v-if="modelValue?.type === 'dots'">
          <circle cx="9" cy="9" r="1" fill="currentColor" />
          <circle cx="15" cy="9" r="1" fill="currentColor" />
          <circle cx="9" cy="15" r="1" fill="currentColor" />
          <circle cx="15" cy="15" r="1" fill="currentColor" />
        </template>
      </svg>
      <svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <Transition name="dropdown">
      <div v-if="isOpen" class="background-dropdown">
        <div class="dropdown-header">Background</div>

        <!-- Background type options -->
        <div class="background-options">
          <button
            v-for="option in backgroundOptions"
            :key="option.type"
            class="background-option"
            :class="{ 'background-option--active': currentType === option.type }"
            @click="selectBackground(option.type)"
          >
            <div class="option-preview" :style="option.previewStyle">
              <svg v-if="option.type === 'ruled'" width="100%" height="100%" class="preview-pattern">
                <line x1="0" y1="33%" x2="100%" y2="33%" stroke="#d1d5db" stroke-width="1" />
                <line x1="0" y1="66%" x2="100%" y2="66%" stroke="#d1d5db" stroke-width="1" />
              </svg>
              <svg v-else-if="option.type === 'grid'" width="100%" height="100%" class="preview-pattern">
                <line x1="33%" y1="0" x2="33%" y2="100%" stroke="#d1d5db" stroke-width="1" />
                <line x1="66%" y1="0" x2="66%" y2="100%" stroke="#d1d5db" stroke-width="1" />
                <line x1="0" y1="33%" x2="100%" y2="33%" stroke="#d1d5db" stroke-width="1" />
                <line x1="0" y1="66%" x2="100%" y2="66%" stroke="#d1d5db" stroke-width="1" />
              </svg>
              <svg v-else-if="option.type === 'dots'" width="100%" height="100%" class="preview-pattern">
                <circle cx="25%" cy="25%" r="2" fill="#9ca3af" />
                <circle cx="50%" cy="25%" r="2" fill="#9ca3af" />
                <circle cx="75%" cy="25%" r="2" fill="#9ca3af" />
                <circle cx="25%" cy="50%" r="2" fill="#9ca3af" />
                <circle cx="50%" cy="50%" r="2" fill="#9ca3af" />
                <circle cx="75%" cy="50%" r="2" fill="#9ca3af" />
                <circle cx="25%" cy="75%" r="2" fill="#9ca3af" />
                <circle cx="50%" cy="75%" r="2" fill="#9ca3af" />
                <circle cx="75%" cy="75%" r="2" fill="#9ca3af" />
              </svg>
              <svg v-else-if="option.type === 'graph'" width="100%" height="100%" class="preview-pattern">
                <line x1="20%" y1="0" x2="20%" y2="100%" stroke="#d1d5db" stroke-width="0.5" />
                <line x1="40%" y1="0" x2="40%" y2="100%" stroke="#d1d5db" stroke-width="0.5" />
                <line x1="60%" y1="0" x2="60%" y2="100%" stroke="#d1d5db" stroke-width="0.5" />
                <line x1="80%" y1="0" x2="80%" y2="100%" stroke="#d1d5db" stroke-width="0.5" />
                <line x1="0" y1="20%" x2="100%" y2="20%" stroke="#d1d5db" stroke-width="0.5" />
                <line x1="0" y1="40%" x2="100%" y2="40%" stroke="#d1d5db" stroke-width="0.5" />
                <line x1="0" y1="60%" x2="100%" y2="60%" stroke="#d1d5db" stroke-width="0.5" />
                <line x1="0" y1="80%" x2="100%" y2="80%" stroke="#d1d5db" stroke-width="0.5" />
              </svg>
            </div>
            <span class="option-label">{{ option.label }}</span>
          </button>
        </div>

        <!-- Color option (for 'color' type) -->
        <div v-if="currentType === 'color'" class="color-section">
          <div class="section-label">Background Color</div>
          <div class="color-presets">
            <button
              v-for="color in colorPresets"
              :key="color"
              class="color-preset"
              :class="{ 'color-preset--active': customColor === color }"
              :style="{ backgroundColor: color }"
              @click="selectColor(color)"
            />
          </div>
          <div class="custom-color">
            <input
              type="color"
              v-model="customColor"
              @change="selectColor(customColor)"
              class="color-input"
            />
            <input
              type="text"
              v-model="customColor"
              @change="selectColor(customColor)"
              class="hex-input"
              placeholder="#ffffff"
              maxlength="7"
            />
          </div>
        </div>

        <!-- Grid size (for grid types) -->
        <div v-if="['grid', 'dots', 'graph'].includes(currentType)" class="grid-size-section">
          <div class="section-label">Grid Size</div>
          <div class="grid-size-options">
            <button
              v-for="size in gridSizes"
              :key="size.value"
              class="grid-size-option"
              :class="{ 'grid-size-option--active': currentGridSize === size.value }"
              @click="selectGridSize(size.value)"
            >
              {{ size.label }}
            </button>
          </div>
        </div>

        <!-- Line color (for pattern types) -->
        <div v-if="['grid', 'dots', 'ruled', 'graph'].includes(currentType)" class="line-color-section">
          <div class="section-label">Line Color</div>
          <div class="color-presets color-presets--small">
            <button
              v-for="color in lineColorPresets"
              :key="color"
              class="color-preset color-preset--small"
              :class="{ 'color-preset--active': currentLineColor === color }"
              :style="{ backgroundColor: color }"
              @click="selectLineColor(color)"
            />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { PageBackground, BackgroundType } from '../../types/solo'

const props = defineProps<{
  modelValue?: PageBackground
}>()

const emit = defineEmits<{
  'update:modelValue': [value: PageBackground]
}>()

const pickerRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const customColor = ref('#f8fafc')

// Background type options
const backgroundOptions = [
  { type: 'white' as BackgroundType, label: 'White', previewStyle: { backgroundColor: '#ffffff' } },
  { type: 'ruled' as BackgroundType, label: 'Ruled', previewStyle: { backgroundColor: '#ffffff' } },
  { type: 'grid' as BackgroundType, label: 'Grid', previewStyle: { backgroundColor: '#ffffff' } },
  { type: 'dots' as BackgroundType, label: 'Dots', previewStyle: { backgroundColor: '#ffffff' } },
  { type: 'graph' as BackgroundType, label: 'Graph', previewStyle: { backgroundColor: '#ffffff' } },
  { type: 'color' as BackgroundType, label: 'Color', previewStyle: { background: 'linear-gradient(135deg, #fef3c7 0%, #dbeafe 50%, #fce7f3 100%)' } },
]

// Color presets for background
const colorPresets = [
  '#ffffff', '#f8fafc', '#fef3c7', '#fef9c3', '#dcfce7',
  '#dbeafe', '#e0e7ff', '#fce7f3', '#ffe4e6', '#f3f4f6',
]

// Line color presets
const lineColorPresets = [
  '#e5e7eb', '#d1d5db', '#9ca3af', '#6b7280',
  '#bfdbfe', '#fecaca', '#bbf7d0', '#fde68a',
]

// Grid size options
const gridSizes = [
  { value: 10, label: 'Small' },
  { value: 20, label: 'Medium' },
  { value: 40, label: 'Large' },
]

// Computed properties
const currentType = computed(() => props.modelValue?.type || 'white')
const currentLabel = computed(() => {
  const option = backgroundOptions.find(o => o.type === currentType.value)
  return option?.label || 'White'
})
const currentGridSize = computed(() => props.modelValue?.gridSize || 20)
const currentLineColor = computed(() => props.modelValue?.lineColor || '#e5e7eb')

// Methods
function toggleDropdown(): void {
  isOpen.value = !isOpen.value
}

function selectBackground(type: BackgroundType): void {
  const newBackground: PageBackground = {
    type,
    gridSize: props.modelValue?.gridSize || 20,
    lineColor: props.modelValue?.lineColor || '#e5e7eb',
  }

  if (type === 'color') {
    newBackground.color = customColor.value
  }

  emit('update:modelValue', newBackground)
}

function selectColor(color: string): void {
  customColor.value = color
  emit('update:modelValue', {
    ...props.modelValue,
    type: 'color',
    color,
  } as PageBackground)
}

function selectGridSize(size: number): void {
  emit('update:modelValue', {
    ...props.modelValue,
    type: props.modelValue?.type || 'grid',
    gridSize: size,
  } as PageBackground)
}

function selectLineColor(color: string): void {
  emit('update:modelValue', {
    ...props.modelValue,
    type: props.modelValue?.type || 'grid',
    lineColor: color,
  } as PageBackground)
}

function handleClickOutside(event: MouseEvent): void {
  if (pickerRef.value && !pickerRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  // Initialize customColor from props
  if (props.modelValue?.color) {
    customColor.value = props.modelValue.color
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.background-picker {
  position: relative;
}

.background-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  background: var(--color-bg-primary, #ffffff);
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.15s ease;
}

.background-trigger:hover {
  border-color: var(--color-brand, #2563eb);
  color: var(--color-text-primary, #1f2937);
}

.background-trigger--active {
  border-color: var(--color-brand, #2563eb);
  background: var(--color-bg-secondary, #f9fafb);
}

.chevron {
  transition: transform 0.2s ease;
}

.background-trigger--active .chevron {
  transform: rotate(180deg);
}

.background-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 280px;
  padding: 12px;
  background: var(--color-bg-primary, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
  z-index: 100;
}

.dropdown-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 10px;
}

.background-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.background-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border: 2px solid transparent;
  border-radius: 8px;
  background: var(--color-bg-secondary, #f9fafb);
  cursor: pointer;
  transition: all 0.15s ease;
}

.background-option:hover {
  border-color: var(--color-border, #e5e7eb);
}

.background-option--active {
  border-color: var(--color-brand, #2563eb);
  background: var(--color-brand-light, #eff6ff);
}

.option-preview {
  width: 48px;
  height: 36px;
  border-radius: 4px;
  border: 1px solid var(--color-border, #e5e7eb);
  overflow: hidden;
}

.preview-pattern {
  display: block;
}

.option-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
}

.background-option--active .option-label {
  color: var(--color-brand, #2563eb);
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary, #9ca3af);
  margin-bottom: 8px;
}

.color-section,
.grid-size-section,
.line-color-section {
  padding-top: 12px;
  border-top: 1px solid var(--color-border, #e5e7eb);
  margin-top: 4px;
}

.color-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.color-presets--small {
  margin-bottom: 0;
}

.color-preset {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.color-preset--small {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

.color-preset:hover {
  transform: scale(1.1);
}

.color-preset--active {
  border-color: var(--color-brand, #2563eb);
  box-shadow: 0 0 0 2px var(--color-brand-light, #eff6ff);
}

.custom-color {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-input {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  overflow: hidden;
}

.color-input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-input::-webkit-color-swatch {
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
}

.hex-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  font-size: 13px;
  font-family: monospace;
  color: var(--color-text-primary, #1f2937);
  background: var(--color-bg-primary, #ffffff);
}

.hex-input:focus {
  outline: none;
  border-color: var(--color-brand, #2563eb);
}

.grid-size-options {
  display: flex;
  gap: 6px;
}

.grid-size-option {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  background: var(--color-bg-primary, #ffffff);
  color: var(--color-text-secondary, #6b7280);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.grid-size-option:hover {
  border-color: var(--color-brand, #2563eb);
}

.grid-size-option--active {
  border-color: var(--color-brand, #2563eb);
  background: var(--color-brand, #2563eb);
  color: #ffffff;
}

/* Dropdown animation */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .background-trigger {
    background: var(--color-bg-primary, #1f2937);
    border-color: var(--color-border, #374151);
    color: var(--color-text-secondary, #9ca3af);
  }

  .background-dropdown {
    background: var(--color-bg-primary, #1f2937);
    border-color: var(--color-border, #374151);
  }

  .background-option {
    background: var(--color-bg-secondary, #374151);
  }

  .hex-input {
    background: var(--color-bg-secondary, #374151);
    border-color: var(--color-border, #4b5563);
    color: var(--color-text-primary, #f3f4f6);
  }

  .grid-size-option {
    background: var(--color-bg-secondary, #374151);
    border-color: var(--color-border, #4b5563);
    color: var(--color-text-secondary, #9ca3af);
  }
}
</style>
