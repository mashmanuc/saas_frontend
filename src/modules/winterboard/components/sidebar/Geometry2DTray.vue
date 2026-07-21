<!--
  Phase G v2 — Geometry 2D v2 drag-source tray (bundle-backed).

  Refs:
    - vendor/geo2d/index.ts — engine + GEO_PRESETS registry
    - Mirror pattern: SolidsTray.vue, GraphCalculatorTray.vue

  EXTENSIBILITY:
    - Список карток приходить з window.GEO_PRESETS (set by geo2d-card.js).
    - Додавання нової картки → редагувати vendor/geo2d/geo2d-presets.js
      (add Geo2D.PRESETS[name] = { build, toggles, defaults })
      + vendor/geo2d/geo2d-card.js (add metadata у GEO_PRESETS array).
    - Цей tray НЕ потребує змін при додаванні нової картки.

  HARD RULES:
    - Tray ONLY initiates drag з MIME 'application/x-geo2d' + payload {preset, name}.
    - NO local asset create — payload preset; default data hydrates у drop handler.
    - Tray не знає про boardStore/ops — pure presentational drag source.
-->
<template>
  <div class="geo2dv2-tray" data-testid="geometry-2d-v2-tray">
    <div class="geo2dv2-tray__header">
      {{ t('winterboard.contentSidebar.geo2dHeader') }}
    </div>
    <div v-if="!loaded" class="geo2dv2-tray__loading">
      {{ t('winterboard.contentSidebar.loading') }}
    </div>
    <div v-else class="geo2dv2-tray__grid">
      <div
        v-for="item in items"
        :key="item.type"
        class="geo2dv2-tray__card-wrap"
      >
        <button
          type="button"
          class="geo2dv2-tray__btn"
          :data-testid="`geometry-2d-v2-tray-${item.type}`"
          :draggable="true"
          :title="`${presetLabel(item)} — ${presetDesc(item)}`"
          @dragstart="onDragStart($event, item.type, presetLabel(item))"
          v-bind="dragHandlers(GEOMETRY_2D_V2_DRAG_MIME, JSON.stringify({ preset: item.type }), presetLabel(item))"
        >
          <span class="geo2dv2-tray__icon" aria-hidden="true">
            <InsertIcon family="planimetry" :icon-key="item.type" />
          </span>
          <span class="geo2dv2-tray__label">{{ presetLabel(item) }}</span>
        </button>
        <button
          type="button"
          class="tray-add-btn"
          :title="`Додати «${presetLabel(item)}» на дошку`"
          @click.stop="addToolToBoard(GEOMETRY_2D_V2_DRAG_MIME, JSON.stringify({ preset: item.type }))"
        >+</button>
      </div>
    </div>
    <div class="geo2dv2-tray__hint">
      {{ t('winterboard.contentSidebar.trayDragHint') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  GEOMETRY_2D_V2_DRAG_MIME,
  type Geometry2DV2DragPayload,
} from '../../constants/geometry2dV2Defaults'
import type { GeoPresetMeta } from '../../vendor/geo2d'
import { useAddToolToBoard } from '../../composables/useAddToolToBoard'
import { useTouchDragFromTray } from '../../composables/useTouchDragFromTray'
import { InsertIcon } from './insertIcons'

const addToolToBoard = useAddToolToBoard()
const { dragHandlers } = useTouchDragFromTray()

const { t, te } = useI18n()
const items = ref<GeoPresetMeta[]>([])
const loaded = ref(false)

// Translated preset name з fallback на bundle's GEO_PRESETS.full (українська).
// Це дозволяє додавати нові presets у bundle без обов'язкового оновлення i18n
// одразу — буде показано українська назва до додавання ключа.
function presetLabel(item: GeoPresetMeta): string {
  const key = `winterboard.geo2dV2.preset.${item.type}.full`
  return te(key) ? t(key) : item.full
}

function presetDesc(item: GeoPresetMeta): string {
  const key = `winterboard.geo2dV2.preset.${item.type}.desc`
  return te(key) ? t(key) : item.desc
}

onMounted(async () => {
  // Lazy-import vendor так саме як renderer — bundle parse тільки коли tray mounted
  // (sidebar відкрита). Це zero overhead для replay сесій без tray.
  await import('../../vendor/geo2d')
  items.value = window.GEO_PRESETS || []
  loaded.value = true
})

function onDragStart(e: DragEvent, preset: string, name: string): void {
  if (!e.dataTransfer) return
  const payload: Geometry2DV2DragPayload = { preset, name }
  e.dataTransfer.setData(GEOMETRY_2D_V2_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'copy'
}

</script>

<style scoped>
.geo2dv2-tray {
  border-top: 1px solid #e5e7eb;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.geo2dv2-tray__header {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.geo2dv2-tray__loading {
  font-size: 11px;
  color: #94a3b8;
  padding: 4px;
}

.geo2dv2-tray__grid {
  display: grid;
  /* auto-fill: drops to 1 column when sidebar < ~260px (e.g. desktop narrow resize) */
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 4px;
}

.geo2dv2-tray__btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  line-height: 1.2;
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #f8fafc;
  color: #1e293b;
  cursor: grab;
  user-select: none;
  touch-action: pan-y;
  transition: background 0.12s, border-color 0.12s;
  text-align: left;
  min-height: 36px;
}

.geo2dv2-tray__btn:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
}

.geo2dv2-tray__btn:active {
  cursor: grabbing;
}

.geo2dv2-tray__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #3b82f6;
  flex-shrink: 0;
}

.geo2dv2-tray__label {
  font-weight: 600;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.geo2dv2-tray__hint {
  font-size: 11px;
  color: #94a3b8;
  padding: 0 2px;
}

/* ── Card wrapper + add button ── */
.geo2dv2-tray__card-wrap {
  position: relative;
}

.geo2dv2-tray__card-wrap .geo2dv2-tray__btn {
  width: 100%;
}

.tray-add-btn {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 18px;
  height: 18px;
  background: #f5f3ff;
  color: #6366f1;
  border: 1px solid #c7d2fe;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  z-index: 2;
  opacity: 0;
  transition: opacity 0.12s, background 0.12s, border-color 0.12s, color 0.12s;
  pointer-events: none;
}

.geo2dv2-tray__card-wrap:hover .tray-add-btn {
  opacity: 1;
  pointer-events: auto;
}

.tray-add-btn:hover {
  background: #ede9fe;
  border-color: #818cf8;
  color: #4338ca;
}

/* ── Touch / coarse pointer ── */
@media (any-pointer: coarse) {
  .geo2dv2-tray__grid {
    grid-template-columns: 1fr;
  }

  /* FIX Android repaint: position:static flex-sibling замість position:absolute */
  .geo2dv2-tray__card-wrap {
    display: flex;
    align-items: stretch;
    gap: 2px;
  }

  .geo2dv2-tray__card-wrap .geo2dv2-tray__btn {
    flex: 1;
    min-width: 0;
  }

  .tray-add-btn {
    position: static;
    opacity: 1;
    pointer-events: auto;
    width: 36px;
    height: auto;
    flex-shrink: 0;
    font-size: 20px;
    border-radius: 6px;
    z-index: auto;
  }

  .geo2dv2-tray__btn {
    font-size: 13px;
    min-height: 44px;
    padding: 8px 10px;
  }

  .geo2dv2-tray__label {
    font-size: 13px;
  }
}
</style>
