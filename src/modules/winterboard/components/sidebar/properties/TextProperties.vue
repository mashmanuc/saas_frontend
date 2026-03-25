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

      <!-- Font size -->
      <label class="text-properties__input-group">
        <span>{{ t('winterboard.properties.fontSize') }}</span>
        <input
          type="number"
          :value="object.size || 16"
          :disabled="isLocked"
          min="8"
          max="128"
          step="1"
          @change="onFontSizeChange"
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
/**
 * Phase 34 B3.2: TextProperties — simplified: textarea, font size, color.
 */
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

let textDebounceTimer: ReturnType<typeof setTimeout> | null = null

function onTextChange(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value
  if (textDebounceTimer) clearTimeout(textDebounceTimer)
  textDebounceTimer = setTimeout(() => {
    props.store.updateObject(props.object.id, { text: value })
  }, 300)
}

function onFontSizeChange(event: Event) {
  const val = Number((event.target as HTMLInputElement).value)
  if (val >= 8 && val <= 128) {
    props.store.updateObject(props.object.id, { size: val })
  }
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

.text-properties__input-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--wb-text-secondary, #6b7280);
}

.text-properties__input-group input {
  width: 80px;
  padding: 6px 8px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 13px;
  background: var(--wb-bg-primary, #ffffff);
  color: var(--wb-text-primary, #111827);
}

.text-properties__input-group input:disabled {
  background: var(--wb-bg-secondary, #f3f4f6);
  color: var(--wb-text-tertiary, #9ca3af);
  cursor: not-allowed;
}

.text-properties__input-group input:focus {
  outline: none;
  border-color: var(--wb-brand, #0066ff);
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
