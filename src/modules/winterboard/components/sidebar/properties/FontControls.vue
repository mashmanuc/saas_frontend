<template>
  <div class="font-controls" :class="{ 'font-controls--locked': isLocked }">
    <!-- Font family dropdown -->
    <div class="font-controls__row">
      <label class="font-controls__label">Font</label>
      <select
        class="font-controls__select"
        :value="fontFamily"
        :disabled="isLocked"
        @change="onFontFamilyChange"
      >
        <option
          v-for="font in AVAILABLE_FONTS"
          :key="font.value"
          :value="font.value"
          :style="{ fontFamily: font.value }"
        >
          {{ font.label }}
        </option>
      </select>
    </div>

    <!-- Size + Bold + Italic -->
    <div class="font-controls__row font-controls__row--inline">
      <label class="font-controls__label">Size</label>
      <input
        type="number"
        class="font-controls__number"
        :value="fontSize"
        :disabled="isLocked"
        min="8"
        max="128"
        step="1"
        @change="onFontSizeChange"
      />
      <button
        type="button"
        class="font-controls__toggle"
        :class="{ 'font-controls__toggle--active': fontWeight === 700 }"
        :disabled="isLocked"
        title="Bold"
        @click="toggleBold"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        class="font-controls__toggle"
        :class="{ 'font-controls__toggle--active': fontStyle === 'italic' }"
        :disabled="isLocked"
        title="Italic"
        @click="toggleItalic"
      >
        <em>I</em>
      </button>
    </div>

    <!-- Text align -->
    <div class="font-controls__row">
      <label class="font-controls__label">Align</label>
      <div class="font-controls__align-group">
        <button
          v-for="option in ALIGN_OPTIONS"
          :key="option.value"
          type="button"
          class="font-controls__align-btn"
          :class="{ 'font-controls__align-btn--active': textAlign === option.value }"
          :disabled="isLocked"
          :title="option.label"
          @click="onAlignChange(option.value)"
        >
          {{ option.icon }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Phase 35 B1: FontControls — reusable font control block.
 * Used by TextProperties (WBStroke) and StickyProperties (WBAsset).
 */
import { AVAILABLE_FONTS } from '../../../constants/fonts'

const props = defineProps<{
  fontFamily: string
  fontSize: number
  fontWeight: number
  fontStyle: string
  textAlign: string
  isLocked: boolean
}>()

const emit = defineEmits<{
  (e: 'update', field: string, value: string | number): void
}>()

const ALIGN_OPTIONS = [
  { value: 'left', label: 'Align Left', icon: '◁' },
  { value: 'center', label: 'Align Center', icon: '≡' },
  { value: 'right', label: 'Align Right', icon: '▷' },
]

function onFontFamilyChange(e: Event) {
  emit('update', 'fontFamily', (e.target as HTMLSelectElement).value)
}

function onFontSizeChange(e: Event) {
  const val = Number((e.target as HTMLInputElement).value)
  if (val >= 8 && val <= 128) {
    emit('update', 'fontSize', val)
  }
}

function toggleBold() {
  emit('update', 'fontWeight', props.fontWeight === 700 ? 400 : 700)
}

function toggleItalic() {
  emit('update', 'fontStyle', props.fontStyle === 'italic' ? 'normal' : 'italic')
}

function onAlignChange(value: string) {
  emit('update', 'textAlign', value)
}
</script>

<style scoped>
.font-controls__row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.font-controls__row--inline {
  flex-wrap: nowrap;
}
.font-controls__label {
  font-size: 12px;
  color: var(--wb-text-secondary, #6b7280);
  min-width: 36px;
}
.font-controls__select {
  flex: 1;
  height: 32px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  padding: 0 8px;
  font-size: 13px;
  background: var(--wb-bg-primary, #fff);
  color: var(--wb-text-primary, #111827);
}
.font-controls__number {
  width: 56px;
  height: 32px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  padding: 0 6px;
  font-size: 13px;
  text-align: center;
  background: var(--wb-bg-primary, #fff);
  color: var(--wb-text-primary, #111827);
}
.font-controls__toggle {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  background: var(--wb-bg-primary, #fff);
  color: var(--wb-text-primary, #111827);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: background 0.15s ease;
}
.font-controls__toggle:hover:not(:disabled) {
  background: var(--wb-bg-secondary, #f3f4f6);
}
.font-controls__toggle--active {
  background: var(--wb-brand, #0066ff);
  color: white;
  border-color: var(--wb-brand, #0066ff);
}
.font-controls__align-group {
  display: flex;
  gap: 0;
}
.font-controls__align-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  background: var(--wb-bg-primary, #fff);
  color: var(--wb-text-primary, #111827);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: background 0.15s ease;
}
.font-controls__align-btn:first-child { border-radius: 6px 0 0 6px; }
.font-controls__align-btn:last-child { border-radius: 0 6px 6px 0; }
.font-controls__align-btn:not(:first-child) { border-left: none; }
.font-controls__align-btn:hover:not(:disabled) {
  background: var(--wb-bg-secondary, #f3f4f6);
}
.font-controls__align-btn--active {
  background: var(--wb-brand, #0066ff);
  color: white;
  border-color: var(--wb-brand, #0066ff);
}
.font-controls--locked .font-controls__select,
.font-controls--locked .font-controls__number,
.font-controls--locked .font-controls__toggle,
.font-controls--locked .font-controls__align-btn {
  opacity: 0.5;
  pointer-events: none;
}
</style>
