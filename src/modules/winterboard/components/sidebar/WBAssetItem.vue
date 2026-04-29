<template>
  <div
    class="wb-asset-item"
    :class="`wb-asset-item--${deviceMode}`"
    :data-device-mode="deviceMode"
  >
    <img
      :src="asset.thumbnail_url || asset.cdn_url"
      :alt="asset.filename"
      class="wb-asset-item__thumb"
      loading="lazy"
      draggable="false"
    />
    <span class="wb-asset-item__name" :title="asset.filename">
      {{ asset.filename }}
    </span>

    <!-- Touch: кнопка додати на дошку (mobile + tablet) -->
    <button
      v-if="isTouchDevice"
      class="wb-asset-item__add-btn"
      @click.stop="addToBoard"
      :aria-label="t('winterboard.sidebar.addToBoard')"
      type="button"
    >
      <PlusIcon :size="16" aria-hidden="true" />
    </button>

    <!-- Desktop: drag handle для drag-and-drop -->
    <div
      v-else
      class="wb-asset-item__drag-handle"
      draggable="true"
      :aria-label="t('winterboard.sidebar.assets')"
      @dragstart="onDragStart"
    >
      <GripVerticalIcon :size="14" aria-hidden="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { PlusIcon, GripVerticalIcon } from 'lucide-vue-next'
import { useDeviceMode } from '../../composables/useDeviceMode'
import { useWBStore } from '../../board/state/boardStore'
import type { WBAsset } from '../../types/winterboard'

// ─── Props ───────────────────────────────────────────────────────────────────

interface SidebarAsset {
  id: string
  filename: string
  cdn_url: string
  thumbnail_url?: string
}

interface Props {
  asset: SidebarAsset
}

const props = defineProps<Props>()

// ─── Composables ─────────────────────────────────────────────────────────────

const { t } = useI18n()
const { deviceMode, isMobile, isTablet } = useDeviceMode()
const wbStore = useWBStore()

// ─── Touch device detection (INV-2: layout decision — from deviceMode) ───────

// isTouchDevice is a LAYOUT decision (which UI to show), so deviceMode is correct.
// inputMode (pointer-based) is used by canvas gestures — see INV-2.
const isTouchDevice = computed(() => isMobile.value || isTablet.value)

// ─── Viewport center in canvas coordinates ───────────────────────────────────

function getViewportCenterInCanvas(): { x: number; y: number } {
  const { containerWidth, containerHeight, zoom, pageWidth, pageHeight } = wbStore
  const offset = wbStore.viewportOffset

  if (containerWidth <= 0 || containerHeight <= 0 || zoom <= 0) {
    return { x: pageWidth / 2, y: pageHeight / 2 }
  }

  return {
    x: (containerWidth / 2 - offset.x) / zoom,
    y: (containerHeight / 2 - offset.y) / zoom,
  }
}

// ─── Add to board ─────────────────────────────────────────────────────────────

function addToBoard(): void {
  const { x: cx, y: cy } = getViewportCenterInCanvas()

  const newAsset: WBAsset = {
    id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'image',
    src: props.asset.cdn_url,
    x: cx - 100, // center: w/2 = 100
    y: cy - 100, // center: h/2 = 100
    w: 200,
    h: 200,
    rotation: 0,
  }

  wbStore.addAsset(newAsset, wbStore.currentPageId)

  // Haptic feedback on mobile devices (INV-2: inputMode agnostic here — vibrate is safe to call)
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(30)
  }
}

// ─── Desktop drag support (SIDEBAR_DRAG_MIME placeholder) ────────────────────

function onDragStart(e: DragEvent): void {
  // Desktop drag-and-drop: set a minimal payload so the canvas drop handler
  // can identify this as a sidebar asset drag. Full integration is handled
  // by the parent sidebar component.
  e.dataTransfer?.setData('application/wb-asset-id', props.asset.id)
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'copy'
  }
}
</script>

<style scoped>
.wb-asset-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
  min-height: 44px; /* WCAG 2.1 AA touch target (LAW-22) */
}

.wb-asset-item:hover {
  background: #f8fafc;
}

.wb-asset-item__thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
  background: #f1f5f9;
}

.wb-asset-item__name {
  flex: 1;
  font-size: 13px;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

/* Touch: + button — absolute so it doesn't shift layout */
.wb-asset-item__add-btn {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  background: var(--wb-primary, #3b82f6);
  border-radius: 50%;
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  touch-action: manipulation; /* Prevent double-tap zoom on button */
  flex-shrink: 0;
  padding: 0;
}

.wb-asset-item__add-btn:active {
  transform: translateY(-50%) scale(0.9);
}

@media (prefers-reduced-motion: reduce) {
  .wb-asset-item__add-btn:active {
    transform: translateY(-50%) scale(1);
  }
}

/* Desktop: drag handle */
.wb-asset-item__drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: #94a3b8;
  cursor: grab;
  flex-shrink: 0;
  border-radius: 4px;
}

.wb-asset-item__drag-handle:hover {
  color: #64748b;
  background: #f1f5f9;
}

.wb-asset-item__drag-handle:active {
  cursor: grabbing;
}

/* Display mode: larger touch targets (LAW-22, INV breakpoint) */
.wb-asset-item--display {
  padding: 12px 8px;
  min-height: 64px;
}

.wb-asset-item--display .wb-asset-item__thumb {
  width: 48px;
  height: 48px;
}

.wb-asset-item--display .wb-asset-item__add-btn {
  width: 36px;
  height: 36px;
}
</style>
