<template>
  <div
    class="wb-grid-settings"
    role="group"
    :aria-label="t('wb.grid.settings', 'Grid Settings')"
  >
    <!-- Toggle row -->
    <label class="wb-grid-settings__row">
      <span class="wb-grid-settings__label">{{ t('wb.grid.enabled', 'Grid') }}</span>
      <input
        type="checkbox"
        class="wb-grid-settings__checkbox"
        :checked="localGrid.enabled"
        aria-label="Toggle grid visibility"
        @change="handleToggle"
      />
    </label>

    <!-- Collapsible settings — shown only when grid is enabled -->
    <template v-if="localGrid.enabled">
      <!-- Size selector -->
      <label class="wb-grid-settings__row">
        <span class="wb-grid-settings__label">{{ t('wb.grid.size', 'Size') }}</span>
        <select
          v-model.number="localGrid.size"
          class="wb-grid-settings__select"
          :aria-label="t('wb.grid.size', 'Grid cell size')"
          @change="save"
        >
          <option :value="20">20px</option>
          <option :value="40">40px</option>
          <option :value="60">60px</option>
        </select>
      </label>

      <!-- Style selector -->
      <label class="wb-grid-settings__row">
        <span class="wb-grid-settings__label">{{ t('wb.grid.style', 'Style') }}</span>
        <select
          v-model="localGrid.style"
          class="wb-grid-settings__select"
          :aria-label="t('wb.grid.style', 'Grid visual style')"
          @change="save"
        >
          <option value="dots">{{ t('wb.grid.dots', 'Dots') }}</option>
          <option value="lines">{{ t('wb.grid.lines', 'Lines') }}</option>
        </select>
      </label>

      <!-- Opacity slider -->
      <label class="wb-grid-settings__row wb-grid-settings__row--opacity">
        <span class="wb-grid-settings__label">{{ t('wb.grid.opacity', 'Opacity') }}</span>
        <div class="wb-grid-settings__slider-wrap">
          <input
            v-model.number="localGrid.opacity"
            type="range"
            class="wb-grid-settings__range"
            min="0.05"
            max="0.5"
            step="0.05"
            :aria-label="t('wb.grid.opacity', 'Grid opacity')"
            :aria-valuenow="localGrid.opacity"
            :aria-valuemin="0.05"
            :aria-valuemax="0.5"
            @input="save"
          />
          <span class="wb-grid-settings__value" aria-live="polite">
            {{ Math.round(localGrid.opacity * 100) }}%
          </span>
        </div>
      </label>
    </template>
  </div>
</template>

<script setup lang="ts">
// WBGridSettings — per-page grid settings popup (toolbar panel)
// Ref: responsive/prompts/active/DAY12-13_PHASE6.md A9
// Zone: AGENT-A (toolbar/WBGridSettings.vue — listed in A9 responsibility)

import { reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePageGrid } from '../../composables/usePageGrid'

const { t } = useI18n({ useScope: 'global' })

const { currentPageGrid, updatePageGrid } = usePageGrid()

// Local reactive copy — avoids committing intermediate slider drags to the store
const localGrid = reactive({ ...currentPageGrid.value })

// Sync local copy when page switches (currentPageGrid is per-page)
watch(currentPageGrid, (grid) => {
  Object.assign(localGrid, grid)
}, { deep: true })

function handleToggle(e: Event): void {
  localGrid.enabled = (e.target as HTMLInputElement).checked
  save()
}

function save(): void {
  updatePageGrid({
    enabled: localGrid.enabled,
    size:    localGrid.size    as 20 | 40 | 60,
    style:   localGrid.style   as 'dots' | 'lines',
    color:   localGrid.color,
    opacity: localGrid.opacity,
  })
}
</script>

<style scoped>
.wb-grid-settings {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  min-width: 210px;
}

.wb-grid-settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.wb-grid-settings__row--opacity {
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.wb-grid-settings__label {
  font-size: 13px;
  color: var(--color-text-secondary, #64748b);
  flex-shrink: 0;
}

.wb-grid-settings__checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--color-primary, #3b82f6);
}

.wb-grid-settings__select {
  font-size: 13px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 4px;
  padding: 3px 6px;
  background: var(--color-surface, #ffffff);
  color: var(--color-text, #1e293b);
  cursor: pointer;
}

.wb-grid-settings__select:focus-visible {
  outline: 2px solid var(--color-primary, #3b82f6);
  outline-offset: 1px;
}

.wb-grid-settings__slider-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.wb-grid-settings__range {
  flex: 1;
  cursor: pointer;
  accent-color: var(--color-primary, #3b82f6);
  height: 4px;
}

.wb-grid-settings__value {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary, #64748b);
  min-width: 34px;
  text-align: right;
}
</style>
