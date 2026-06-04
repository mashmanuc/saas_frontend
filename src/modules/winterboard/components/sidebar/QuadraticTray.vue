<!--
  QuadraticTray — секція «Квадратне рівняння» у ContentSidebar.

  One drag-source button → drops a quadratic_card asset on the board.

  HARD RULES:
    - Tray ONLY initiates drag з QUAD_DRAG_MIME.
    - NO local asset create — default data hydrates у drop handler.
    - Pure presentational drag source, no store knowledge.
-->
<template>
  <div class="quad-tray" data-testid="quad-tray">
    <div class="quad-tray__header">{{ t('winterboard.quadratic.trayHeader') }}</div>

    <div class="quad-tray__card-wrap">
      <button
        type="button"
        class="quad-tray__btn"
        data-testid="quad-tray-btn"
        :draggable="true"
        :title="t('winterboard.quadratic.trayTitle')"
        @dragstart="onDragStart"
        v-bind="dragHandlers(QUAD_DRAG_MIME, '{}', t('winterboard.quadratic.trayHeader'))"
      >
        <!-- Tiny parabola SVG icon -->
        <span class="quad-tray__icon" aria-hidden="true">
          <svg width="22" height="20" viewBox="0 0 24 22" fill="none" stroke="currentColor" stroke-width="1.7">
            <!-- parabola arc -->
            <path d="M2 20 Q 12 0 22 20" stroke="#3b7b9b" fill="none"/>
            <!-- x-axis -->
            <line x1="1" y1="20" x2="23" y2="20" stroke="#c4622a" stroke-width="1.2"/>
            <!-- two root dots -->
            <circle cx="5"  cy="20" r="2" fill="#3b7b9b"/>
            <circle cx="19" cy="20" r="2" fill="#3b7b9b"/>
            <!-- vertex dot -->
            <circle cx="12" cy="2.5" r="2" fill="#c4622a"/>
          </svg>
        </span>
        <span class="quad-tray__labels">
          <span class="quad-tray__label">ax² + bx + c = 0</span>
          <span class="quad-tray__sublabel">{{ t('winterboard.quadratic.traySublabel') }}</span>
        </span>
      </button>
      <button
        type="button"
        class="tray-add-btn"
        :title="t('winterboard.quadratic.addToBoard')"
        @click.stop="addToolToBoard(QUAD_DRAG_MIME, '{}')"
      >+</button>
    </div>

    <div class="quad-tray__hint">{{ t('winterboard.contentSidebar.trayDragHint') }}</div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { QUAD_DRAG_MIME } from '../../constants/quadDefaults'
import { useAddToolToBoard } from '../../composables/useAddToolToBoard'
import { useTouchDragFromTray } from '../../composables/useTouchDragFromTray'

const { t } = useI18n()
const addToolToBoard = useAddToolToBoard()
const { dragHandlers } = useTouchDragFromTray()

function onDragStart(e: DragEvent): void {
  if (!e.dataTransfer) return
  e.dataTransfer.setData(QUAD_DRAG_MIME, JSON.stringify({}))
  e.dataTransfer.effectAllowed = 'copy'
}
</script>

<style scoped>
.quad-tray {
  border-top: 1px solid #e5e7eb;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.quad-tray__header {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.quad-tray__card-wrap {
  position: relative;
}

.quad-tray__btn {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  line-height: 1.25;
  padding: 7px 9px;
  border: 1px solid rgba(59, 123, 155, 0.4);
  border-radius: 6px;
  background: #f8fafc;
  color: #1e293b;
  cursor: grab;
  user-select: none;
  touch-action: pan-y;
  transition: background 0.12s, border-color 0.12s;
  text-align: left;
  min-height: 40px;
  width: 100%;
}
.quad-tray__btn:hover { background: #e8f4f8; border-color: #3b7b9b; }
.quad-tray__btn:active { cursor: grabbing; }

.quad-tray__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  color: #3b7b9b;
}

.quad-tray__labels {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.quad-tray__label {
  font-size: 12px;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #3b7b9b;
}
.quad-tray__sublabel {
  font-size: 11px;
  color: #64748b;
  font-family: 'JetBrains Mono', monospace;
}

.quad-tray__hint {
  font-size: 11px;
  color: #94a3b8;
  padding: 0 2px;
}

/* Add button — matches .tray-add-btn in CalculusTray */
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
.quad-tray__card-wrap:hover .tray-add-btn {
  opacity: 1;
  pointer-events: auto;
}
.tray-add-btn:hover { background: #ede9fe; border-color: #818cf8; color: #4338ca; }

@media (pointer: coarse) {
  /* FIX Android repaint: position:static flex-sibling замість position:absolute */
  .quad-tray__card-wrap {
    display: flex;
    align-items: stretch;
    gap: 2px;
  }
  .quad-tray__card-wrap .quad-tray__btn {
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
  .quad-tray__btn { min-height: 44px; padding: 9px 11px; }
}
</style>
