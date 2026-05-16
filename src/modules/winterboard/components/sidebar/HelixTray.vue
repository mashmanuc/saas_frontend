<!--
  Helix — drag-source tray для 3D гелікс-тригонометрії.
  Mirror pattern: TrigCircleTray.vue.
-->
<template>
  <div class="helix-tray" data-testid="helix-tray">
    <div class="helix-tray__header">
      {{ t('winterboard.contentSidebar.helixHeader') }}
    </div>
    <div class="helix-tray__grid">
      <button
        type="button"
        class="helix-tray__btn"
        data-testid="helix-tray-btn"
        :draggable="true"
        :title="t('winterboard.helix.btnTitle')"
        @dragstart="onDragStart"
      >
        <span class="helix-tray__icon" aria-hidden="true">
          <HelixIcon />
        </span>
        <span class="helix-tray__labels">
          <span class="helix-tray__label">{{ t('winterboard.helix.btnLabel') }}</span>
          <span class="helix-tray__sublabel">P = (θ, sin θ, cos θ)</span>
        </span>
      </button>
    </div>
    <div class="helix-tray__hint">
      {{ t('winterboard.contentSidebar.trayDragHint') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, type FunctionalComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { HELIX_DRAG_MIME, type HelixDragPayload } from '../../constants/helixDefaults'

const { t } = useI18n()

function onDragStart(e: DragEvent): void {
  if (!e.dataTransfer) return
  const payload: HelixDragPayload = { type: 'helix' }
  e.dataTransfer.setData(HELIX_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'copy'
}

// Simple helix spiral icon: 3D ellipse + sine wave
const HelixIcon: FunctionalComponent = () => {
  return h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    // Ellipse (unit circle end-on)
    h('ellipse', { cx: 6, cy: 12, rx: 3.5, ry: 5, stroke: '#2b2118', 'stroke-width': '1.4' }),
    // Helix curve (orange)
    h('path', { d: 'M9.5 7 Q14 4 17 7 Q20 10 17 14 Q14 18 9.5 17', stroke: '#c4622a', 'stroke-width': '2', fill: 'none' }),
    // sin shadow on back wall (red dashed)
    h('path', { d: 'M9.5 7 Q13 7 15.5 12 Q18 17 21 17', stroke: '#a83a5b', 'stroke-width': '1.2', fill: 'none', 'stroke-dasharray': '2 1.5' }),
    // Point P
    h('circle', { cx: 17, cy: 7, r: 1.8, fill: '#c4622a', stroke: 'none' }),
  ])
}
</script>

<style scoped>
.helix-tray {
  border-top: 1px solid #e5e7eb;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.helix-tray__header {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.helix-tray__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
}

.helix-tray__btn {
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
  transition: background 0.12s, border-color 0.12s;
  text-align: left;
  min-height: 36px;
  width: 100%;
}

.helix-tray__btn:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
}

.helix-tray__btn:active { cursor: grabbing; }

.helix-tray__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #c4622a;
  flex-shrink: 0;
}

.helix-tray__labels {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.helix-tray__label {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.helix-tray__sublabel {
  font-size: 9px;
  color: #64748b;
  white-space: nowrap;
  font-family: 'JetBrains Mono', monospace;
}

.helix-tray__hint {
  font-size: 11px;
  color: #94a3b8;
  padding: 0 2px;
}
</style>
