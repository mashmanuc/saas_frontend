<!--
  Phase O PR-O4: Геометричні фігури — drag source tray.

  Refs:
    - saas_docs/domains/winterboard/phase_O_solid_objects/PLAN.md PR-O4
    - saas_docs/domains/winterboard/WINTERBOARD_SSOT.md §3.7.1

  HARD RULES:
    - Tray ONLY initiates drag з MIME 'application/x-solid' + payload {src}.
    - NO local asset create — payload contains ONLY src; default state hydrates
      у drop handler через DEFAULT_SOLID_STATE constant (single source).
    - NO reuse `placeOnBoard` чи будь-якого demo code.
    - Tray не знає про boardStore/ops — це pure presentational drag source.
-->
<template>
  <div class="solids-tray" data-testid="solids-tray">
    <div class="solids-tray__header">
      {{ t('winterboard.contentSidebar.solidsHeader') }}
    </div>
    <div class="solids-tray__grid">
      <button
        v-for="item in items"
        :key="item.type"
        type="button"
        class="solids-tray__btn"
        :data-testid="`solid-tray-${item.type}`"
        :draggable="true"
        :title="solidName(item)"
        @dragstart="onDragStart($event, item.type)"
      >
        {{ solidName(item) }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  SOLID_TYPES,
  SOLID_DRAG_MIME,
  type SolidDragPayload,
} from '../../constants/solidDefaults'
import type { SolidType } from '../../types/winterboard'

const { t, te } = useI18n()
const items = SOLID_TYPES

/**
 * Translated solid name з fallback на hardcoded українську (item.label).
 * Дозволяє додавати нові solid types без обов'язкового i18n update.
 */
function solidName(item: { type: SolidType; label: string }): string {
  const key = `winterboard.solid.${item.type}`
  return te(key) ? t(key) : item.label
}

function onDragStart(e: DragEvent, src: SolidType): void {
  if (!e.dataTransfer) return
  const payload: SolidDragPayload = { src }
  e.dataTransfer.setData(SOLID_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'copy'
}
</script>

<style scoped>
.solids-tray {
  border-top: 1px solid #e5e7eb;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.solids-tray__header {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.solids-tray__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.solids-tray__btn {
  font-size: 12px;
  line-height: 1.2;
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #f8fafc;
  color: #1e293b;
  cursor: grab;
  text-align: center;
  user-select: none;
  transition: background 0.12s, border-color 0.12s;
}

.solids-tray__btn:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
}

.solids-tray__btn:active {
  cursor: grabbing;
}
</style>
