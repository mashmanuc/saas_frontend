<template>
  <div class="color-picker" ref="containerRef">
    <!-- Trigger button showing current color -->
    <button
      class="color-picker__trigger"
      :title="`Color: ${modelValue}`"
      @click="isOpen = !isOpen"
    >
      <span
        class="color-picker__current"
        :style="{ backgroundColor: modelValue }"
      />
      <svg class="color-picker__chevron" :class="{ open: isOpen }" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </button>

    <!-- Dropdown -->
    <Transition name="dropdown">
      <div v-if="isOpen" class="color-picker__dropdown">
        <!-- Recent colors -->
        <div v-if="recentColors.length > 0" class="color-picker__section">
          <span class="color-picker__label">Recent</span>
          <div class="color-picker__grid color-picker__grid--recent">
            <button
              v-for="color in recentColors"
              :key="color"
              class="color-picker__swatch"
              :class="{ 'color-picker__swatch--active': modelValue === color }"
              :style="{ backgroundColor: color }"
              :title="color"
              @click="selectColor(color)"
            />
          </div>
        </div>

        <!-- Preset palette -->
        <div class="color-picker__section">
          <span class="color-picker__label">Palette</span>
          <div class="color-picker__grid">
            <button
              v-for="color in PRESET_PALETTE"
              :key="color"
              class="color-picker__swatch"
              :class="{ 'color-picker__swatch--active': modelValue === color }"
              :style="{ backgroundColor: color }"
              :title="color"
              @click="selectColor(color)"
            />
          </div>
        </div>

        <!-- Custom color picker -->
        <div class="color-picker__section">
          <span class="color-picker__label">Custom</span>
          <div class="color-picker__custom-row">
            <input
              type="color"
              class="color-picker__input"
              :value="modelValue"
              @input="selectColor(($event.target as HTMLInputElement).value)"
            />
            <input
              type="text"
              class="color-picker__hex"
              :value="modelValue"
              placeholder="#000000"
              maxlength="7"
              @change="handleHexInput"
            />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const STORAGE_KEY = 'solo-board-recent-colors'
const MAX_RECENT = 5

const PRESET_PALETTE = [
  '#000000', '#374151', '#6B7280', '#9CA3AF',
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#EC4899',
]

const props = defineProps<{
  modelValue: string
  presetColors?: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [color: string]
}>()

const containerRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const recentColors = ref<string[]>([])

function loadRecentColors() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      recentColors.value = JSON.parse(stored)
    }
  } catch {
    recentColors.value = []
  }
}

function saveRecentColors() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recentColors.value))
  } catch {
    // localStorage not available
  }
}

function addToRecent(color: string) {
  const normalized = color.toLowerCase()
  const filtered = recentColors.value.filter(c => c.toLowerCase() !== normalized)
  recentColors.value = [normalized, ...filtered].slice(0, MAX_RECENT)
  saveRecentColors()
}

function selectColor(color: string) {
  emit('update:modelValue', color)
  addToRecent(color)
  isOpen.value = false
}

function handleHexInput(event: Event) {
  const input = event.target as HTMLInputElement
  let value = input.value.trim()
  if (!value.startsWith('#')) {
    value = '#' + value
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
    selectColor(value)
  }
}

function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  loadRecentColors()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.color-picker {
  position: relative;
}

.color-picker__trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  background: var(--color-bg-primary, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.color-picker__trigger:hover {
  border-color: var(--color-border-hover, #cbd5e1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.color-picker__current {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.color-picker__chevron {
  width: 16px;
  height: 16px;
  color: var(--color-text-secondary, #64748b);
  transition: transform 0.15s ease;
}

.color-picker__chevron.open {
  transform: rotate(180deg);
}

.color-picker__dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 100;
  min-width: 200px;
  padding: 12px;
  background: var(--color-bg-primary, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
}

.color-picker__section {
  margin-bottom: 12px;
}

.color-picker__section:last-child {
  margin-bottom: 0;
}

.color-picker__label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary, #64748b);
  margin-bottom: 8px;
}

.color-picker__grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
}

.color-picker__grid--recent {
  grid-template-columns: repeat(5, 1fr);
}

.color-picker__swatch {
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.1s ease;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.color-picker__swatch:hover {
  transform: scale(1.15);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.color-picker__swatch--active {
  border-color: var(--color-brand, #2563eb);
  box-shadow: 0 0 0 2px var(--color-brand-light, #dbeafe);
}

.color-picker__custom-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-picker__input {
  width: 40px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  cursor: pointer;
}

.color-picker__input::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.color-picker__input::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}

.color-picker__hex {
  flex: 1;
  height: 32px;
  padding: 0 8px;
  font-size: 13px;
  font-family: monospace;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  outline: none;
  transition: border-color 0.15s ease;
}

.color-picker__hex:focus {
  border-color: var(--color-brand, #2563eb);
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
  .color-picker__trigger {
    background: var(--color-bg-primary-dark, #1e293b);
    border-color: var(--color-border-dark, #334155);
  }

  .color-picker__dropdown {
    background: var(--color-bg-primary-dark, #1e293b);
    border-color: var(--color-border-dark, #334155);
  }

  .color-picker__hex {
    background: var(--color-bg-secondary-dark, #334155);
    border-color: var(--color-border-dark, #475569);
    color: var(--color-text-dark, #f1f5f9);
  }
}
</style>
