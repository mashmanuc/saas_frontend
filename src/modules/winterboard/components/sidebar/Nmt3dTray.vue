<!--
  Nmt3dTray — drag-source секція «Стереометрія НМТ»:
    21 параметричний 3D шаблон (куб, піраміди, призми, тіла обертання, комбіновані).
    Замінює старий SolidsTray (Phase O geometry_solid / Three.js WebGL).

  Кожна картка:
    - drag: HTML5 DnD + touch (Pointer Events)
    - click "+": додати на дошку у центр

  HARD RULES:
    - Tray ONLY initiates drag з MIME 'application/x-nmt3d' + payload { templateKey }.
    - NO local asset create — default data hydrates у drop handler.
    - Tray не знає про boardStore/ops — pure presentational drag source.

  Mirror pattern: TrigCircleTray.vue / CalculusTray.vue.
-->
<template>
  <div class="nmt3d-tray" data-testid="nmt3d-tray">
    <div class="nmt3d-tray__header">
      {{ t('winterboard.nmt3d.trayHeader') }}
    </div>

    <div v-if="!bundleLoaded" class="nmt3d-tray__loading">
      {{ t('winterboard.nmt3d.loading') }}
    </div>

    <div class="nmt3d-tray__grid">
      <div
        v-for="key in NMT3D_TEMPLATE_ORDER"
        :key="key"
        class="nmt3d-tray__card-wrap"
      >
        <button
          type="button"
          class="nmt3d-tray__btn"
          :data-testid="`nmt3d-tray-${key}`"
          :draggable="true"
          :title="templateLabel(key)"
          @dragstart="onDragStart($event, key)"
          v-bind="dragHandlers(NMT3D_DRAG_MIME, JSON.stringify({ templateKey: key }), templateLabel(key))"
        >
          <span class="nmt3d-tray__icon" aria-hidden="true">
            <InsertIcon family="stereo" :icon-key="key" />
          </span>
          <span class="nmt3d-tray__label">{{ templateLabel(key) }}</span>
        </button>
        <button
          type="button"
          class="tray-add-btn"
          :title="t('winterboard.nmt3d.addToBoard', { name: templateLabel(key) })"
          @click.stop="addToolToBoard(NMT3D_DRAG_MIME, JSON.stringify({ templateKey: key }))"
        >+</button>
      </div>
    </div>

    <div class="nmt3d-tray__hint">
      {{ t('winterboard.nmt3d.trayHint') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NMT3D_DRAG_MIME,
  NMT3D_TEMPLATE_ORDER,
  NMT3D_TEMPLATE_LABELS,
  type Nmt3dDragPayload,
} from '../../constants/nmt3dDefaults'
import { useAddToolToBoard } from '../../composables/useAddToolToBoard'
import { useTouchDragFromTray } from '../../composables/useTouchDragFromTray'
import { InsertIcon } from './insertIcons'

const { t } = useI18n()
const addToolToBoard = useAddToolToBoard()
const { dragHandlers } = useTouchDragFromTray()

const bundleLoaded = ref(false)

/** Return runtime name from bundle, or Ukrainian fallback. */
function templateLabel(key: string): string {
  const W = window as any
  return W.NMT3D?.TEMPLATES?.[key]?.name ?? NMT3D_TEMPLATE_LABELS[key] ?? key
}

function onDragStart(e: DragEvent, templateKey: string): void {
  if (!e.dataTransfer) return
  const payload: Nmt3dDragPayload = { templateKey }
  e.dataTransfer.setData(NMT3D_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'copy'
}

onMounted(async () => {
  // Lazy-load bundle so sidebar renders instantly — 3D workspace builds on demand
  await import('../../vendor/nmt3d')
  bundleLoaded.value = true
})

</script>

<style scoped>
.nmt3d-tray {
  border-top: 1px solid #e5e7eb;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nmt3d-tray__header {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.nmt3d-tray__loading {
  font-size: 11px;
  color: #94a3b8;
  padding: 2px 0;
}

.nmt3d-tray__grid {
  display: grid;
  /* auto-fill: drops to 1 column when sidebar < ~260px (e.g. desktop narrow resize) */
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 4px;
}

.nmt3d-tray__btn {
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
  width: 100%;
}

.nmt3d-tray__btn:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
}

.nmt3d-tray__btn:active {
  cursor: grabbing;
}

.nmt3d-tray__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #c4622a;
  flex-shrink: 0;
}

.nmt3d-tray__label {
  font-weight: 600;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.nmt3d-tray__hint {
  font-size: 11px;
  color: #94a3b8;
  padding: 0 2px;
}

/* ── Card wrapper + add button ── */
.nmt3d-tray__card-wrap {
  position: relative;
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

.nmt3d-tray__card-wrap:hover .tray-add-btn {
  opacity: 1;
  pointer-events: auto;
}

.tray-add-btn:hover {
  background: #ede9fe;
  border-color: #818cf8;
  color: #4338ca;
}

/* ── Touch / coarse pointer ── */
@media (pointer: coarse) {
  .nmt3d-tray__grid {
    grid-template-columns: 1fr;
  }

  /* FIX Android repaint bug: position:absolute+z-index promoted tray-add-btn
     to its own GPU layer → воно перемальовувалось після скролу, а нормальні
     кнопки (main-btn) — ні → на місці кнопок були "шуми"/артефакти.
     Рішення: на touch прибираємо absolute, робимо flex-sibling поряд з кнопкою.
     Обидва елементи — на одному compositing layer → обидва перемальовуються. */
  .nmt3d-tray__card-wrap {
    display: flex;
    align-items: stretch;
    gap: 2px;
  }

  .nmt3d-tray__card-wrap .nmt3d-tray__btn {
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

  .nmt3d-tray__btn {
    font-size: 13px;
    min-height: 44px;
    padding: 8px 10px;
  }

  .nmt3d-tray__label {
    font-size: 13px;
  }
}
</style>
