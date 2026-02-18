<!-- WB: Color picker popover — preset colors + custom picker + recent colors
     Ref: TASK_BOARD.md B6.1 — Color picker з presets + custom
     Layout: 2 rows × 6 colors grid, custom input, recent 3 colors (localStorage) -->
<template>
  <div class="wb-color-picker" ref="rootEl">
    <!-- Trigger button: shows current color -->
    <button
      type="button"
      class="wb-color-picker__trigger"
      :aria-label="t('winterboard.toolbar.selectColor', { color: modelValue })"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <span class="wb-color-picker__current" :style="{ background: modelValue }" />
    </button>

    <!-- Popover -->
    <Transition name="wb-popover">
      <div
        v-if="isOpen"
        class="wb-color-picker__popover"
        role="dialog"
        :aria-label="t('winterboard.toolbar.colorPalette')"
        @keydown.escape="close"
      >
        <!-- Preset grid: 2 rows × 6 -->
        <div class="wb-color-picker__grid">
          <button
            v-for="color in PRESET_COLORS"
            :key="color"
            type="button"
            class="wb-color-picker__swatch"
            :class="{ 'wb-color-picker__swatch--active': modelValue === color }"
            :style="{ '--swatch-color': color }"
            :aria-label="t('winterboard.toolbar.selectColor', { color })"
            :aria-pressed="modelValue === color"
            @click="selectColor(color)"
          >
            <span v-if="modelValue === color" class="wb-color-picker__check" aria-hidden="true">✓</span>
          </button>
        </div>

        <!-- Recent colors -->
        <div v-if="recentColors.length > 0" class="wb-color-picker__section">
          <span class="wb-color-picker__label">{{ t('winterboard.colorPicker.recent') }}</span>
          <div class="wb-color-picker__recent">
            <button
              v-for="color in recentColors"
              :key="'recent-' + color"
              type="button"
              class="wb-color-picker__swatch wb-color-picker__swatch--small"
              :class="{ 'wb-color-picker__swatch--active': modelValue === color }"
              :style="{ '--swatch-color': color }"
              :aria-label="t('winterboard.toolbar.selectColor', { color })"
              @click="selectColor(color)"
            />
          </div>
        </div>

        <!-- Custom color -->
        <div class="wb-color-picker__section">
          <label class="wb-color-picker__custom">
            <span class="wb-color-picker__label">{{ t('winterboard.colorPicker.custom') }}</span>
            <input
              type="color"
              class="wb-color-picker__input"
              :value="modelValue"
              @input="handleCustomColor(($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
// WB: WBColorPicker — color picker popover with presets + custom + recent
// Ref: TASK_BOARD.md B6.1

import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const PRESET_COLORS = [
  '#111111', '#ffffff', '#ef4444', '#2563eb', '#22c55e', '#eab308',
  '#f97316', '#8b5cf6', '#ec4899', '#92400e', '#6b7280', '#06b6d4',
]

const STORAGE_KEY = 'wb-recent-colors'
const MAX_RECENT = 3

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [color: string]
}>()

const { t } = useI18n()
const rootEl = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const recentColors = ref<string[]>([])

function loadRecent(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      recentColors.value = JSON.parse(stored).slice(0, MAX_RECENT)
    }
  } catch {
    // Ignore localStorage errors
  }
}

function saveRecent(color: string): void {
  // Only save custom colors (not presets)
  if (PRESET_COLORS.includes(color)) return
  const updated = [color, ...recentColors.value.filter((c) => c !== color)].slice(0, MAX_RECENT)
  recentColors.value = updated
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Ignore localStorage errors
  }
}

function selectColor(color: string): void {
  emit('update:modelValue', color)
  close()
}

function handleCustomColor(color: string): void {
  emit('update:modelValue', color)
  saveRecent(color)
}

function toggle(): void {
  isOpen.value = !isOpen.value
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
  loadRecent()
  document.addEventListener('mousedown', handleOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleOutsideClick)
})
</script>

<style scoped>
.wb-color-picker {
  position: relative;
}

.wb-color-picker__trigger {
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

.wb-color-picker__trigger:hover {
  background: var(--wb-btn-hover, #f1f5f9);
}

.wb-color-picker__trigger:focus-visible {
  outline: 2px solid var(--wb-brand, #0066FF);
  outline-offset: -2px;
}

.wb-color-picker__current {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.12);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Popover */
.wb-color-picker__popover {
  position: absolute;
  left: calc(100% + 8px);
  top: 0;
  z-index: 50;
  width: 200px;
  padding: 12px;
  background: var(--wb-toolbar-bg, #ffffff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

/* Grid: 2 rows × 6 */
.wb-color-picker__grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
}

.wb-color-picker__swatch {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 2px solid transparent;
  background: var(--swatch-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease, border-color 0.15s ease;
  position: relative;
}

.wb-color-picker__swatch:hover {
  transform: scale(1.12);
}

.wb-color-picker__swatch--active {
  border-color: var(--wb-brand, #0066FF);
  box-shadow: 0 0 0 1px var(--wb-brand, #0066FF);
}

.wb-color-picker__swatch--small {
  width: 24px;
  height: 24px;
  border-radius: 4px;
}

.wb-color-picker__check {
  font-size: 12px;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

/* Section */
.wb-color-picker__section {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--wb-toolbar-border, #e2e8f0);
}

.wb-color-picker__label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: var(--wb-fg-secondary, #64748b);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.wb-color-picker__recent {
  display: flex;
  gap: 4px;
}

/* Custom color input */
.wb-color-picker__custom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.wb-color-picker__input {
  width: 32px;
  height: 28px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 4px;
  padding: 0;
  cursor: pointer;
  background: none;
}

.wb-color-picker__input::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.wb-color-picker__input::-webkit-color-swatch {
  border: none;
  border-radius: 2px;
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
  .wb-color-picker__popover {
    left: 0;
    top: auto;
    bottom: calc(100% + 8px);
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .wb-color-picker__trigger,
  .wb-color-picker__swatch {
    transition: none;
  }

  .wb-popover-enter-active,
  .wb-popover-leave-active {
    transition: none;
  }
}
</style>
