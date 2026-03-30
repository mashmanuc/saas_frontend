<template>
  <div class="text-properties">
    <div class="text-properties__section">
      <div class="text-properties__label">{{ t('winterboard.properties.text') }}</div>

      <!-- Text content -->
      <textarea
        :value="object.text || ''"
        :disabled="isLocked"
        class="text-properties__textarea"
        :placeholder="t('winterboard.properties.textPlaceholder')"
        rows="4"
        @input="onTextChange"
      />

      <!-- Formatting toolbar: Bold + Italic + Align -->
      <div class="text-properties__toolbar">
        <button
          type="button"
          class="text-properties__tool-btn"
          :class="{ 'text-properties__tool-btn--active': object.fontWeight === 700 }"
          :disabled="isLocked"
          title="Bold"
          @click="toggleBold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          class="text-properties__tool-btn"
          :class="{ 'text-properties__tool-btn--active': object.fontStyle === 'italic' }"
          :disabled="isLocked"
          title="Italic"
          @click="toggleItalic"
        >
          <em>I</em>
        </button>

        <span class="text-properties__divider" />

        <button
          type="button"
          class="text-properties__tool-btn"
          :class="{ 'text-properties__tool-btn--active': (object.textAlign || 'left') === 'left' }"
          :disabled="isLocked"
          title="Align left"
          @click="setAlign('left')"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2" y="3" width="12" height="1.5" rx="0.5"/>
            <rect x="2" y="6.5" width="8" height="1.5" rx="0.5"/>
            <rect x="2" y="10" width="12" height="1.5" rx="0.5"/>
          </svg>
        </button>
        <button
          type="button"
          class="text-properties__tool-btn"
          :class="{ 'text-properties__tool-btn--active': object.textAlign === 'center' }"
          :disabled="isLocked"
          title="Align center"
          @click="setAlign('center')"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2" y="3" width="12" height="1.5" rx="0.5"/>
            <rect x="4" y="6.5" width="8" height="1.5" rx="0.5"/>
            <rect x="2" y="10" width="12" height="1.5" rx="0.5"/>
          </svg>
        </button>
      </div>

      <!-- Font size dropdown -->
      <label class="text-properties__input-group">
        <span>{{ t('winterboard.properties.fontSize') }}</span>
        <select
          :value="object.size || 16"
          :disabled="isLocked"
          class="text-properties__select"
          @change="onFontSizeSelect"
        >
          <option v-for="s in FONT_SIZES" :key="s" :value="s">{{ s }}px</option>
        </select>
      </label>

      <!-- Width (for text wrapping) -->
      <label class="text-properties__input-group">
        <span>{{ t('winterboard.properties.width') || 'Width' }}</span>
        <input
          type="number"
          :value="object.width || 200"
          :disabled="isLocked"
          min="50"
          max="2000"
          step="10"
          class="text-properties__number-input"
          @change="onWidthChange"
        />
      </label>

      <!-- Color picker -->
      <label class="text-properties__color-group">
        <span>{{ t('winterboard.properties.color') }}</span>
        <input
          type="color"
          :value="object.color || '#000000'"
          :disabled="isLocked"
          @input="onColorChange"
        />
      </label>
    </div>

    <CommonProperties
      :object-id="object.id"
      :store="store"
      :is-locked="isLocked"
      :x="object.points?.[0]?.x ?? 0"
      :y="object.points?.[0]?.y ?? 0"
      :width="object.width"
      :height="object.height"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { useWBStore } from '../../../board/state/boardStore'
import type { WBStroke } from '../../../types/winterboard'
import CommonProperties from './CommonProperties.vue'

type WBStore = ReturnType<typeof useWBStore>

const { t } = useI18n()

const props = defineProps<{
  object: WBStroke
  objectType: string
  isLocked: boolean
  store: WBStore
}>()

const FONT_SIZES = [12, 16, 20, 24, 32, 48, 64]

let textDebounceTimer: ReturnType<typeof setTimeout> | null = null

function onTextChange(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value
  if (textDebounceTimer) clearTimeout(textDebounceTimer)
  textDebounceTimer = setTimeout(() => {
    props.store.updateObject(props.object.id, { text: value })
  }, 300)
}

function onFontSizeSelect(event: Event) {
  const val = Number((event.target as HTMLSelectElement).value)
  if (val >= 8 && val <= 128) {
    props.store.updateObject(props.object.id, { size: val })
  }
}

function onWidthChange(event: Event) {
  const val = Number((event.target as HTMLInputElement).value)
  if (val >= 50 && val <= 2000) {
    props.store.updateObject(props.object.id, { width: val })
  }
}

function toggleBold() {
  const current = props.object.fontWeight || 400
  props.store.updateObject(props.object.id, { fontWeight: current === 700 ? 400 : 700 })
}

function toggleItalic() {
  const current = props.object.fontStyle || 'normal'
  props.store.updateObject(props.object.id, { fontStyle: current === 'italic' ? 'normal' : 'italic' })
}

function setAlign(align: string) {
  props.store.updateObject(props.object.id, { textAlign: align })
}

function onColorChange(event: Event) {
  const value = (event.target as HTMLInputElement).value
  props.store.updateObject(props.object.id, { color: value })
}
</script>

<style scoped>
.text-properties {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.text-properties__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.text-properties__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-text-primary, #111827);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.text-properties__textarea {
  padding: 8px 10px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  background: var(--wb-bg-primary, #ffffff);
  color: var(--wb-text-primary, #111827);
  resize: vertical;
  min-height: 80px;
}

.text-properties__textarea:disabled {
  background: var(--wb-bg-secondary, #f3f4f6);
  color: var(--wb-text-tertiary, #9ca3af);
  cursor: not-allowed;
}

.text-properties__textarea:focus {
  outline: none;
  border-color: var(--wb-brand, #0066ff);
}

/* Formatting toolbar */
.text-properties__toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 8px;
  background: var(--wb-bg-secondary, #f9fafb);
}

.text-properties__tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 28px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--wb-text-secondary, #6b7280);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.12s ease;
}

.text-properties__tool-btn:hover:not(:disabled) {
  background: var(--wb-bg-primary, #ffffff);
  color: var(--wb-text-primary, #111827);
}

.text-properties__tool-btn--active {
  background: var(--wb-brand, #0066ff) !important;
  color: #ffffff !important;
}

.text-properties__tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.text-properties__divider {
  width: 1px;
  height: 20px;
  background: var(--wb-border-color, #e5e7eb);
  margin: 0 2px;
}

/* Font size select */
.text-properties__select {
  width: 90px;
  padding: 6px 8px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 13px;
  background: var(--wb-bg-primary, #ffffff);
  color: var(--wb-text-primary, #111827);
  cursor: pointer;
}

.text-properties__select:disabled {
  background: var(--wb-bg-secondary, #f3f4f6);
  color: var(--wb-text-tertiary, #9ca3af);
  cursor: not-allowed;
}

.text-properties__select:focus {
  outline: none;
  border-color: var(--wb-brand, #0066ff);
}

/* Number input for width */
.text-properties__number-input {
  width: 80px;
  padding: 6px 8px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 13px;
  background: var(--wb-bg-primary, #ffffff);
  color: var(--wb-text-primary, #111827);
}

.text-properties__number-input:disabled {
  background: var(--wb-bg-secondary, #f3f4f6);
  color: var(--wb-text-tertiary, #9ca3af);
  cursor: not-allowed;
}

.text-properties__number-input:focus {
  outline: none;
  border-color: var(--wb-brand, #0066ff);
}

.text-properties__input-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--wb-text-secondary, #6b7280);
}

.text-properties__color-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--wb-text-secondary, #6b7280);
}

.text-properties__color-group input[type="color"] {
  width: 48px;
  height: 32px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  cursor: pointer;
}

.text-properties__color-group input[type="color"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
