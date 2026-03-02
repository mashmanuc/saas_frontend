<template>
  <div class="wb-content-preview">
    <!-- Header -->
    <header class="wb-content-preview__header">
      <div class="wb-content-preview__title">
        <span class="wb-logo" aria-label="M4SH">
          <svg width="60" height="20" viewBox="0 0 200 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="48" font-family="'Arial Black', sans-serif" font-weight="900" font-size="52" letter-spacing="-2" fill="#ffffff">M4</text>
            <text x="88" y="48" font-family="'Arial Black', sans-serif" font-weight="900" font-size="52" letter-spacing="-2" fill="#1DB954">SH</text>
          </svg>
        </span>
        <span class="wb-content-preview__label">
          {{ t('learningContent.panel.title') }} — Dev Preview
        </span>
      </div>
      <div class="wb-content-preview__actions">
        <button type="button" class="wb-header-btn" :disabled="!store.canUndo" @click="store.undo()">↩</button>
        <button type="button" class="wb-header-btn" :disabled="!store.canRedo" @click="store.redo()">↪</button>
        <button type="button" class="wb-header-btn wb-header-btn--exit" @click="$router.push('/winterboard')">
          {{ t('winterboard.room.exit') }}
        </button>
      </div>
    </header>

    <!-- Main: Sidebar + Toolbar + Canvas -->
    <div class="wb-content-preview__main">
      <!-- Materials sidebar (resizable) -->
      <aside
        class="wb-content-preview__sidebar"
        :style="{ width: sidebarWidth + 'px' }"
      >
        <ContentPanel
          :session-id="mockSessionId"
          @drag-start="onContentDragStart"
        />
      </aside>

      <!-- Resize handle -->
      <div
        class="wb-resize-handle"
        @mousedown="startResize"
        @touchstart.prevent="startResizeTouch"
      >
        <div class="wb-resize-handle__grip" />
      </div>

      <!-- Toolbar -->
      <aside class="wb-content-preview__toolbar">
        <WBToolbar
          :current-tool="store.currentTool"
          :current-color="store.currentColor"
          :current-size="store.currentSize"
          :can-undo="store.canUndo"
          :can-redo="store.canRedo"
          @tool-change="(t) => store.setTool(t)"
          @color-change="(c) => store.setColor(c)"
          @size-change="(s) => store.setSize(s)"
          @undo="store.undo()"
          @redo="store.redo()"
          @clear="store.clearPage()"
        />
      </aside>

      <!-- Canvas -->
      <div
        ref="canvasContainerRef"
        class="wb-content-preview__canvas"
        tabindex="-1"
        @dragover.prevent
        @drop="contentDrop.handleCanvasDrop($event)"
      >
        <WBCanvas
          ref="canvasRef"
          :tool="store.currentTool"
          :color="store.currentColor"
          :size="store.currentSize"
          :strokes="store.currentStrokes"
          :assets="store.currentAssets"
          :width="store.pageWidth"
          :height="store.pageHeight"
          :zoom="store.zoom"
          @stroke-add="handleStrokeAdd"
          @stroke-update="(s) => store.updateStroke(s)"
          @stroke-delete="(id) => store.deleteStroke(id)"
          @asset-add="handleAssetAdd"
          @asset-update="(a) => store.updateAsset(a)"
          @asset-delete="(id) => store.deleteAsset(id)"
          @zoom-change="(z) => store.setZoom(z)"
          @scroll-change="(x, y) => store.setScroll(x, y)"
        />

        <!-- Drop hint overlay -->
        <Transition name="wb-fade">
          <div
            v-if="store.currentStrokes.length === 0 && store.currentAssets.length === 0"
            class="wb-drop-hint"
          >
            <div class="wb-drop-hint__icon">📚</div>
            <div class="wb-drop-hint__text">
              {{ t('learningContent.panel.dragHint') }}
            </div>
            <div class="wb-drop-hint__sub">
              Drag materials from the left panel onto this canvas
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Footer: Zoom controls -->
    <footer class="wb-content-preview__footer">
      <div class="wb-zoom-controls">
        <button type="button" class="wb-zoom-btn" @click="store.setZoom(store.zoom - 0.25)">−</button>
        <span class="wb-zoom-level">{{ Math.round(store.zoom * 100) }}%</span>
        <button type="button" class="wb-zoom-btn" @click="store.setZoom(store.zoom + 0.25)">+</button>
        <button type="button" class="wb-zoom-btn" @click="store.setZoom(1)">⊙</button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWBStore } from '../board/state/boardStore'
import { useContentDrop } from '../composables/useContentDrop'
import type { WBStroke, WBAsset } from '../types/winterboard'
import type { ContentDragPayload } from '@/modules/learning-content'

import WBCanvas from '../components/canvas/WBCanvas.vue'
import WBToolbar from '../components/toolbar/WBToolbar.vue'
import ContentPanel from '@/modules/learning-content/components/ContentPanel.vue'

const { t } = useI18n()
const store = useWBStore()

const canvasRef = ref<InstanceType<typeof WBCanvas> | null>(null)
const canvasContainerRef = ref<HTMLElement | null>(null)

const mockSessionId = ref<string>('dev-preview-' + Date.now())

// ── Resizable sidebar ────────────────────────────────────────
const SIDEBAR_MIN = 240
const SIDEBAR_MAX = 800
const sidebarWidth = ref(340)
let isResizing = false

function startResize(e: MouseEvent) {
  isResizing = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function startResizeTouch(e: TouchEvent) {
  isResizing = true
  document.body.style.userSelect = 'none'
  document.addEventListener('touchmove', onResizeTouch)
  document.addEventListener('touchend', stopResize)
}

function onResize(e: MouseEvent) {
  if (!isResizing) return
  const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX))
  sidebarWidth.value = newWidth
}

function onResizeTouch(e: TouchEvent) {
  if (!isResizing || !e.touches[0]) return
  const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.touches[0].clientX))
  sidebarWidth.value = newWidth
}

function stopResize() {
  isResizing = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('touchmove', onResizeTouch)
  document.removeEventListener('touchend', stopResize)
}

onBeforeUnmount(() => {
  stopResize()
})

const contentDrop = useContentDrop({
  sessionId: mockSessionId,
  canDraw: computed(() => true),
  onAssetAdd: (asset: WBAsset) => {
    store.addAsset(asset)
  },
  screenToCanvas: (x: number, y: number) => {
    const rect = canvasContainerRef.value?.getBoundingClientRect()
    if (rect) {
      return {
        x: (x - rect.left) / (store.zoom || 1),
        y: (y - rect.top) / (store.zoom || 1),
      }
    }
    return { x: (store.pageWidth ?? 800) / 2, y: 100 }
  },
})

function handleStrokeAdd(stroke: WBStroke): void {
  store.addStroke(stroke)
}

function handleAssetAdd(asset: WBAsset): void {
  store.addAsset(asset)
}

function onContentDragStart(_payload: ContentDragPayload): void {
  // Drag data set via dataTransfer in ContentItemCard
}
</script>

<style scoped>
.wb-content-preview {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f1f5f9;
}

/* Header */
.wb-content-preview__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: #0f172a;
  color: white;
  height: 56px;
  flex-shrink: 0;
  z-index: 30;
}

.wb-content-preview__title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wb-content-preview__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.wb-content-preview__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.wb-header-btn {
  min-width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.15s ease;
}
.wb-header-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.2); }
.wb-header-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.wb-header-btn--exit {
  padding: 0 14px;
  font-size: 0.75rem;
}

/* Main layout */
.wb-content-preview__main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Sidebar (resizable) */
.wb-content-preview__sidebar {
  flex-shrink: 0;
  background: white;
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 240px;
  max-width: 800px;
}

/* Resize handle */
.wb-resize-handle {
  width: 6px;
  flex-shrink: 0;
  cursor: col-resize;
  background: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  position: relative;
  z-index: 10;
}
.wb-resize-handle:hover,
.wb-resize-handle:active {
  background: #94a3b8;
}
.wb-resize-handle__grip {
  width: 2px;
  height: 32px;
  border-radius: 1px;
  background: #94a3b8;
}
.wb-resize-handle:hover .wb-resize-handle__grip,
.wb-resize-handle:active .wb-resize-handle__grip {
  background: white;
}

/* Toolbar */
.wb-content-preview__toolbar {
  flex-shrink: 0;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
}

/* Canvas */
.wb-content-preview__canvas {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: white;
}

/* Drop hint */
.wb-drop-hint {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 5;
}
.wb-drop-hint__icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}
.wb-drop-hint__text {
  font-size: 16px;
  font-weight: 600;
  color: #64748b;
}
.wb-drop-hint__sub {
  font-size: 13px;
  color: #94a3b8;
  margin-top: 8px;
}

/* Footer */
.wb-content-preview__footer {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 24px;
  background: #0f172a;
  color: white;
  flex-shrink: 0;
}

.wb-zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wb-zoom-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 0.875rem;
}
.wb-zoom-btn:hover { background: rgba(255, 255, 255, 0.2); }

.wb-zoom-level {
  font-size: 0.75rem;
  min-width: 40px;
  text-align: center;
}

.wb-fade-enter-active,
.wb-fade-leave-active {
  transition: opacity 0.3s ease;
}
.wb-fade-enter-from,
.wb-fade-leave-to {
  opacity: 0;
}
</style>
