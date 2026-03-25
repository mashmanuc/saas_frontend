<template>
  <div class="sticky-properties">
    <div class="sticky-properties__section">
      <div class="sticky-properties__label">{{ t('winterboard.properties.stickyNote') }}</div>

      <!-- Text content -->
      <textarea
        :value="object.text || ''"
        :disabled="isLocked"
        class="sticky-properties__textarea"
        :placeholder="t('winterboard.properties.notePlaceholder')"
        rows="4"
        @input="onTextChange"
      />

      <!-- Background color presets -->
      <div class="sticky-properties__bg-section">
        <span class="sticky-properties__sublabel">{{ t('winterboard.properties.background') }}</span>
        <div class="sticky-properties__color-grid">
          <button
            v-for="preset in STICKY_COLORS"
            :key="preset.value"
            type="button"
            class="sticky-properties__color-btn"
            :class="{ 'sticky-properties__color-btn--active': object.bgColor === preset.value }"
            :style="{ backgroundColor: preset.value }"
            :disabled="isLocked"
            :title="preset.label"
            @click="onBgColorChange(preset.value)"
          >
            <span v-if="object.bgColor === preset.value" class="sticky-properties__check">✓</span>
          </button>
        </div>
      </div>

      <!-- Font size -->
      <label class="sticky-properties__input-group">
        <span>{{ t('winterboard.properties.fontSize') }}</span>
        <input
          type="number"
          :value="object.fontSize || 14"
          :disabled="isLocked"
          min="8"
          max="128"
          step="1"
          @change="onFontSizeChange"
        />
      </label>

      <!-- Text color -->
      <label class="sticky-properties__color-group">
        <span>{{ t('winterboard.properties.textColor') }}</span>
        <input
          type="color"
          :value="object.textColor || '#000000'"
          :disabled="isLocked"
          @input="onTextColorChange"
        />
      </label>
    </div>

    <CommonProperties
      :object-id="object.id"
      :store="store"
      :is-locked="isLocked"
      :x="object.x"
      :y="object.y"
      :width="object.w"
      :height="object.h"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Phase 34 B3.3: StickyProperties — simplified: textarea, bg colors, font size, text color.
 */
import { useI18n } from 'vue-i18n'
import type { useWBStore } from '../../../board/state/boardStore'
import type { WBAsset } from '../../../types/winterboard'
import CommonProperties from './CommonProperties.vue'

type WBStore = ReturnType<typeof useWBStore>

const { t } = useI18n()

const props = defineProps<{
  object: WBAsset
  objectType: string
  isLocked: boolean
  store: WBStore
}>()

const STICKY_COLORS = [
  { label: 'Yellow', value: '#FFFDE7' },
  { label: 'Green', value: '#E8F5E9' },
  { label: 'Blue', value: '#E3F2FD' },
  { label: 'Purple', value: '#F3E5F5' },
  { label: 'Pink', value: '#FCE4EC' },
]

let textDebounceTimer: ReturnType<typeof setTimeout> | null = null

function onTextChange(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value
  if (textDebounceTimer) clearTimeout(textDebounceTimer)
  textDebounceTimer = setTimeout(() => {
    props.store.updateObject(props.object.id, { text: value })
  }, 300)
}

function onBgColorChange(value: string) {
  props.store.updateObject(props.object.id, { bgColor: value })
}

function onFontSizeChange(event: Event) {
  const val = Number((event.target as HTMLInputElement).value)
  if (val >= 8 && val <= 128) {
    props.store.updateObject(props.object.id, { fontSize: val })
  }
}

function onTextColorChange(event: Event) {
  const value = (event.target as HTMLInputElement).value
  props.store.updateObject(props.object.id, { textColor: value })
}
</script>

<style scoped>
.sticky-properties {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sticky-properties__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sticky-properties__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-text-primary, #111827);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sticky-properties__sublabel {
  font-size: 13px;
  color: var(--wb-text-secondary, #6b7280);
}

.sticky-properties__textarea {
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

.sticky-properties__textarea:disabled {
  background: var(--wb-bg-secondary, #f3f4f6);
  color: var(--wb-text-tertiary, #9ca3af);
  cursor: not-allowed;
}

.sticky-properties__textarea:focus {
  outline: none;
  border-color: var(--wb-brand, #0066ff);
}

.sticky-properties__bg-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sticky-properties__color-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.sticky-properties__color-btn {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.1s ease;
}

.sticky-properties__color-btn:hover:not(:disabled) {
  border-color: var(--wb-brand, #0066ff);
  transform: scale(1.05);
}

.sticky-properties__color-btn--active {
  border-color: var(--wb-brand, #0066ff);
  border-width: 3px;
}

.sticky-properties__color-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sticky-properties__check {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 16px;
  font-weight: bold;
  color: var(--wb-brand, #0066ff);
}

.sticky-properties__input-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--wb-text-secondary, #6b7280);
}

.sticky-properties__input-group input {
  width: 80px;
  padding: 6px 8px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 13px;
  background: var(--wb-bg-primary, #ffffff);
  color: var(--wb-text-primary, #111827);
}

.sticky-properties__input-group input:disabled {
  background: var(--wb-bg-secondary, #f3f4f6);
  color: var(--wb-text-tertiary, #9ca3af);
  cursor: not-allowed;
}

.sticky-properties__input-group input:focus {
  outline: none;
  border-color: var(--wb-brand, #0066ff);
}

.sticky-properties__color-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--wb-text-secondary, #6b7280);
}

.sticky-properties__color-group input[type="color"] {
  width: 48px;
  height: 32px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  cursor: pointer;
}

.sticky-properties__color-group input[type="color"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
