<template>
  <div class="wb-solo-room">
    <!-- B5.1: Skip to canvas link for keyboard/screen reader users -->
    <a href="#wb-canvas" class="wb-skip-link">{{ t('winterboard.a11y.skipToCanvas') }}</a>
    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <header class="wb-solo-room__header">
      <!-- Left: Editable title -->
      <div class="wb-solo-room__title">
        <input
          v-model="sessionName"
          class="wb-title-input"
          :placeholder="t('winterboard.room.untitled')"
          @blur="handleTitleBlur"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
      </div>

      <!-- Center: Save status -->
      <div class="wb-solo-room__status">
        <span class="wb-save-indicator" :class="`wb-save-indicator--${store.syncStatus}`">
          <span class="wb-save-indicator__dot" />
          <span class="wb-save-indicator__text">{{ saveStatusText }}</span>
        </span>
      </div>

      <!-- A5.1: Follow mode indicator -->
      <div v-if="followMode.canFollow.value" class="wb-follow-controls">
        <button
          v-if="!followMode.isFollowing.value"
          type="button"
          class="wb-follow-btn"
          @click="followMode.startFollowing()"
        >
          {{ t('winterboard.room.followTeacher') }}
        </button>
        <div v-else class="wb-follow-indicator">
          <span class="wb-follow-indicator__dot" />
          <span>{{ t('winterboard.room.following', { name: followMode.followingDisplayName.value }) }}</span>
          <button type="button" class="wb-follow-stop-btn" @click="followMode.stopFollowing()">
            {{ t('winterboard.room.stopFollowing') }}
          </button>
        </div>
      </div>

      <!-- Right: Actions -->
      <div class="wb-solo-room__actions">
        <button
          type="button"
          class="wb-header-btn"
          :disabled="!store.canUndo"
          :title="t('winterboard.room.undoShortcut')"
          @click="handleUndo"
        >
          ↩
        </button>
        <button
          type="button"
          class="wb-header-btn"
          :disabled="!store.canRedo"
          :title="t('winterboard.room.redoShortcut')"
          @click="handleRedo"
        >
          ↪
        </button>
        <button type="button" class="wb-header-btn wb-header-btn--exit" @click="handleExit">
          {{ t('winterboard.room.exit') }}
        </button>
      </div>
    </header>

    <!-- ── Main content: Toolbar + Canvas ──────────────────────────────────── -->
    <div class="wb-solo-room__main">
      <!-- Left Toolbar (AGENT-B: WBToolbar) -->
      <aside class="wb-solo-room__toolbar">
        <WBToolbar
          :current-tool="store.currentTool"
          :current-color="store.currentColor"
          :current-size="store.currentSize"
          :can-undo="store.canUndo"
          :can-redo="store.canRedo"
          @tool-change="handleToolChange"
          @color-change="handleColorChange"
          @size-change="handleSizeChange"
          @undo="handleUndo"
          @redo="handleRedo"
          @clear="handleClear"
        />
      </aside>

      <!-- Canvas area -->
      <div id="wb-canvas" ref="canvasContainerRef" class="wb-solo-room__canvas" tabindex="-1">
        <!-- B6.2: Loading state -->
        <Transition name="wb-fade">
          <WBCanvasLoader v-if="isLoading" />
        </Transition>

        <WBCanvas
          v-show="!isLoading"
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
          @stroke-update="handleStrokeUpdate"
          @stroke-delete="handleStrokeDelete"
          @asset-add="handleAssetAdd"
          @asset-update="handleAssetUpdate"
          @asset-delete="handleAssetDelete"
          @select="handleSelect"
          @cursor-move="handleCursorMove"
          @zoom-change="handleZoomChange"
          @scroll-change="handleScrollChange"
        />

        <!-- B6.3: Empty canvas hint — shown when page has no strokes/assets -->
        <Transition name="wb-fade">
          <div
            v-if="!isLoading && isCanvasEmpty"
            class="wb-empty-canvas-hint"
            aria-hidden="true"
          >
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" class="wb-empty-canvas-hint__icon">
              <path d="M8 32l6-6 4 4-2 2H8v0z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M30.5 5.5a2.121 2.121 0 013 3L15 27l-4 1 1-4L30.5 5.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="wb-empty-canvas-hint__text">{{ t('winterboard.emptyCanvas.hint') }}</span>
          </div>
        </Transition>

        <!-- Remote cursors overlay (A3.1) -->
        <WBRemoteCursors
          :cursors="presence.remoteCursors.value"
          :zoom="store.zoom"
          :current-page-id="store.currentPage?.id ?? ''"
        />
      </div>
    </div>

    <!-- ── Footer: Page nav + Zoom ─────────────────────────────────────────── -->
    <footer class="wb-solo-room__footer">
      <!-- Page navigation -->
      <div class="wb-page-nav">
        <button
          type="button"
          class="wb-page-btn"
          :disabled="store.currentPageIndex <= 0"
          :title="t('winterboard.room.prevPage')"
          @click="handlePagePrev"
        >
          ←
        </button>
        <span class="wb-page-indicator">
          {{ store.currentPageIndex + 1 }} / {{ store.pageCount }}
        </span>
        <button
          type="button"
          class="wb-page-btn"
          :disabled="store.currentPageIndex >= store.pageCount - 1"
          :title="t('winterboard.room.nextPage')"
          @click="handlePageNext"
        >
          →
        </button>
        <button
          type="button"
          class="wb-page-btn wb-page-btn--add"
          :disabled="store.pageCount >= 20"
          :title="t('winterboard.room.addPage')"
          @click="handlePageAdd"
        >
          +
        </button>
      </div>

      <!-- Zoom controls -->
      <div class="wb-zoom-controls">
        <button type="button" class="wb-zoom-btn" :title="t('winterboard.room.zoomOut')" @click="handleZoomOut">−</button>
        <span class="wb-zoom-level">{{ Math.round(store.zoom * 100) }}%</span>
        <button type="button" class="wb-zoom-btn" :title="t('winterboard.room.zoomIn')" @click="handleZoomIn">+</button>
        <button type="button" class="wb-zoom-btn" :title="t('winterboard.room.zoomReset')" @click="handleZoomReset">⊙</button>
        <button type="button" class="wb-zoom-btn" :title="t('winterboard.room.fitToPage')" @click="handleFitToPage">⧉</button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
// WB: WBSoloRoom — main solo whiteboard view
// Ref: TASK_BOARD.md A2.1, ManifestWinterboard_v2.md LAW-01/03/08/09

import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useWBStore } from '../board/state/boardStore'
import { useHistory } from '../composables/useHistory'
import { useKeyboard } from '../composables/useKeyboard'
import { useAutosave } from '../composables/useAutosave'
import { usePresence } from '../composables/usePresence'
import { useFollowMode } from '../composables/useFollowMode'
import { useAnnouncer } from '../composables/useAnnouncer'
import { winterboardApi } from '../api/winterboardApi'
import type { WBStroke, WBAsset, WBToolType } from '../types/winterboard'

// Components
import WBCanvas from '../components/canvas/WBCanvas.vue'
import WBToolbar from '../components/toolbar/WBToolbar.vue'
import WBRemoteCursors from '../components/cursors/WBRemoteCursors.vue'
import WBCanvasLoader from '../components/loading/WBCanvasLoader.vue'

// ─── Store & Composables ────────────────────────────────────────────────────

const router = useRouter()
const route = useRoute()
const store = useWBStore()
const { t } = useI18n()
const { announce } = useAnnouncer()

const history = useHistory({ maxSize: 100 })

// Session ID ref for autosave + presence
const sessionId = ref<string | null>(null)

// Autosave (AGENT-C: C2.1)
const autosave = useAutosave(sessionId)

// Presence / remote cursors (A3.2)
// TODO(7.A1): Replace hardcoded userId/displayName/color with real auth data (needs auth integration)
const presence = usePresence({
  sessionId,
  userId: `user-${Date.now()}`,
  displayName: 'Anonymous',
  color: '#2563eb',
})

// A5.1: Follow mode composable
const followMode = useFollowMode({
  remoteCursors: presence.remoteCursors,
  zoom: computed(() => store.zoom),
  scrollX: computed(() => store.scrollX),
  scrollY: computed(() => store.scrollY),
  currentPageIndex: computed(() => store.currentPageIndex),
  pageIds: computed(() => store.pages.map((p) => p.id)),
  setZoom: (z: number) => store.setZoom(z),
  setScroll: (x: number, y: number) => {
    store.setScroll(x, y)
    // Apply scroll to canvas container
    if (canvasContainerRef.value) {
      canvasContainerRef.value.scrollLeft = x
      canvasContainerRef.value.scrollTop = y
    }
  },
  goToPage: (index: number) => store.goToPage(index),
})

// A5.2: Send viewport updates when scroll/zoom changes
watch(
  () => [store.scrollX, store.scrollY, store.zoom, store.currentPageIndex],
  () => {
    if (!sessionId.value) return
    const pageId = store.currentPage?.id ?? ''
    presence.sendViewport(store.scrollX, store.scrollY, store.zoom, pageId)
  },
)

// ─── Refs ───────────────────────────────────────────────────────────────────────

const canvasRef = ref<InstanceType<typeof WBCanvas> | null>(null)
const canvasContainerRef = ref<HTMLElement | null>(null)
const sessionName = ref('Untitled')
const selectedId = ref<string | null>(null)
const isLoading = ref(true)

// ─── Computed ───────────────────────────────────────────────────────────────

// B6.3: Check if current page is empty (no strokes, no assets)
const isCanvasEmpty = computed(() => {
  const page = store.currentPage
  if (!page) return true
  return page.strokes.length === 0 && page.assets.length === 0
})

const saveStatusText = computed(() => {
  // Prefer autosave status when active
  if (autosave.isSaving.value) return t('winterboard.room.saving')
  switch (autosave.status.value) {
    case 'saved': return t('winterboard.room.saved')
    case 'syncing': return t('winterboard.room.saving')
    case 'error': return autosave.lastError.value ?? t('winterboard.room.saveError')
    case 'offline': return t('winterboard.room.offline')
    default: return store.isDirty ? t('winterboard.room.unsavedChanges') : t('winterboard.room.ready')
  }
})

// ─── Keyboard shortcuts (AGENT-B: useKeyboard) ─────────────────────────────

useKeyboard({
  onToolChange: (tool: WBToolType) => store.setTool(tool),
  onUndo: () => handleUndo(),
  onRedo: () => handleRedo(),
  onDelete: () => handleDeleteSelected(),
  onEscape: () => { selectedId.value = null },
  onPagePrev: () => handlePagePrev(),
  onPageNext: () => handlePageNext(),
  onPageFirst: () => store.goToPage(0),
  onPageLast: () => store.goToPage(store.pageCount - 1),
  onZoomReset: () => handleZoomReset(),
})

// ─── Handlers: Drawing ──────────────────────────────────────────────────────

function handleStrokeAdd(stroke: WBStroke): void {
  store.addStroke(stroke)

  // Record in external history (AGENT-B composable)
  const page = store.currentPage
  if (page) {
    history.recordAdd(page.id, stroke, 'stroke')
  }
}

function handleStrokeUpdate(stroke: WBStroke): void {
  store.updateStroke(stroke)
}

function handleStrokeDelete(strokeId: string): void {
  // Find stroke before deleting for history
  const page = store.currentPage
  if (page) {
    const existing = page.strokes.find((s) => s.id === strokeId)
    if (existing) {
      history.recordRemove(page.id, existing, 'stroke')
    }
  }
  store.deleteStroke(strokeId)
}

function handleAssetAdd(asset: WBAsset): void {
  store.addAsset(asset)

  // A4.3: Record in history for undo/redo
  const page = store.currentPage
  if (page) {
    history.recordAdd(page.id, asset, 'asset')
  }
}

function handleAssetUpdate(asset: WBAsset): void {
  store.updateAsset(asset)
}

function handleAssetDelete(assetId: string): void {
  // A4.3: Record in history for undo/redo
  const page = store.currentPage
  if (page) {
    const existing = page.assets.find((a) => a.id === assetId)
    if (existing) {
      history.recordRemove(page.id, existing, 'asset')
    }
  }
  store.deleteAsset(assetId)
}

function handleSelect(id: string | null): void {
  selectedId.value = id
}

// ─── Handlers: Presence / Cursors (A3.2) ─────────────────────────────────────

function handleCursorMove(payload: { x: number; y: number; tool: WBToolType; color: string }): void {
  const pageId = store.currentPage?.id ?? ''
  presence.sendCursor(payload.x, payload.y, pageId, payload.tool, payload.color)
}

function handleDeleteSelected(): void {
  if (!selectedId.value) return
  // Try stroke first, then asset
  const page = store.currentPage
  if (!page) return

  const isStroke = page.strokes.some((s) => s.id === selectedId.value)
  if (isStroke) {
    store.deleteStroke(selectedId.value)
  } else {
    store.deleteAsset(selectedId.value)
  }
  selectedId.value = null
}

// ─── Handlers: Tool / Color / Size ──────────────────────────────────────────

function handleToolChange(tool: WBToolType): void {
  store.setTool(tool)
  // B5.1: Announce tool change to screen readers
  announce(t('winterboard.a11y.toolSelected', { tool: t(`winterboard.tools.${tool}`) }))
}

function handleColorChange(color: string): void {
  store.setColor(color)
}

function handleSizeChange(size: number): void {
  store.setSize(size)
}

// ─── Handlers: Undo / Redo / Clear ──────────────────────────────────────────

function handleUndo(): void {
  store.undo()
  // B5.1: Announce undo to screen readers
  announce(t('winterboard.a11y.undoAction', { action: t('winterboard.a11y.strokeRemoved') }))
}

function handleRedo(): void {
  store.redo()
  // B5.1: Announce redo to screen readers
  announce(t('winterboard.a11y.redoAction', { action: t('winterboard.a11y.strokeRestored') }))
}

function handleClear(): void {
  store.clearPage()
}

// ─── Handlers: Pages ────────────────────────────────────────────────────────

function handlePagePrev(): void {
  if (store.currentPageIndex > 0) {
    store.goToPage(store.currentPageIndex - 1)
  }
}

function handlePageNext(): void {
  if (store.currentPageIndex < store.pageCount - 1) {
    store.goToPage(store.currentPageIndex + 1)
  }
}

function handlePageAdd(): void {
  store.addPage()
}

// ─── Handlers: Zoom ─────────────────────────────────────────────────────────

function handleZoomIn(): void {
  store.setZoom(store.zoom + 0.25)
  followMode.onUserInteraction()
}

function handleZoomOut(): void {
  store.setZoom(store.zoom - 0.25)
  followMode.onUserInteraction()
}

function handleZoomReset(): void {
  store.setZoom(1)
  followMode.onUserInteraction()
}

// A5.3: Handle zoom/scroll from WBCanvas (Ctrl+scroll, pinch, etc.)
function handleZoomChange(zoom: number): void {
  store.setZoom(zoom)
  followMode.onUserInteraction()
}

function handleScrollChange(scrollX: number, scrollY: number): void {
  store.setScroll(scrollX, scrollY)
  followMode.onUserInteraction()
}

function handleFitToPage(): void {
  canvasRef.value?.fitToPage?.()
}

// ─── Handlers: Header ───────────────────────────────────────────────────────

function handleTitleBlur(): void {
  if (!sessionName.value.trim()) {
    sessionName.value = t('winterboard.room.untitled')
  }
  store.workspaceName = sessionName.value
  store.markDirty()
}

function handleExit(): void {
  router.push('/winterboard')
}

// ─── Presence: graceful WebSocket connect ────────────────────────────────────

function connectPresenceSafe(sid: string): void {
  try {
    presence.connect(sid)
  } catch (err) {
    console.warn('[WBSoloRoom] Presence WebSocket unavailable (non-blocking):', err)
  }
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

onMounted(async () => {
  const id = route.params.id as string | undefined

  // New session flow: /winterboard/new → create via API → redirect to /winterboard/:id
  if (!id || route.name === 'winterboard-new') {
    try {
      const created = await winterboardApi.createSession({ name: t('winterboard.room.untitled') })
      // Hydrate store immediately with created session data to avoid re-fetch flicker
      store.workspaceId = created.id
      sessionId.value = created.id
      if (created.state) {
        store.hydrateFromSession({
          id: created.id,
          name: created.name,
          owner_id: created.owner_id ?? '',
          state: created.state,
          page_count: created.page_count,
          thumbnail_url: created.thumbnail_url,
          rev: created.rev,
          created_at: created.created_at,
          updated_at: created.updated_at,
        })
      } else {
        store.workspaceName = created.name || t('winterboard.room.untitled')
        store.rev = created.rev ?? 0
      }
      sessionName.value = created.name || t('winterboard.room.untitled')
      isLoading.value = false
      connectPresenceSafe(created.id)
      router.replace({ name: 'winterboard-solo', params: { id: created.id } })
      return
    } catch (err: unknown) {
      const status = (err as Record<string, Record<string, number>>)?.response?.status
      if (status === 401) {
        router.push('/auth/login')
        return
      }
      console.error('[WBSoloRoom] Failed to create session:', err)
      router.push({ name: 'winterboard-sessions' })
      return
    }
  }

  if (id) {
    store.workspaceId = id
    sessionId.value = id

    // Load session from API
    try {
      const detail = await winterboardApi.getSession(id)
      if (detail.state) {
        store.hydrateFromSession({
          id: detail.id,
          name: detail.name,
          owner_id: detail.owner_id ?? '',
          state: detail.state,
          page_count: detail.page_count,
          thumbnail_url: detail.thumbnail_url,
          rev: detail.rev,
          created_at: detail.created_at,
          updated_at: detail.updated_at,
        })
      }
      sessionName.value = detail.name || t('winterboard.room.untitled')
    } catch (err: unknown) {
      const status = (err as Record<string, Record<string, number>>)?.response?.status
      if (status === 401) {
        router.push('/auth/login')
        return
      }
      if (status === 404) {
        router.push({ name: 'winterboard-sessions', query: { error: 'not_found' } })
        return
      }
      if (status === 409) {
        window.location.reload()
        return
      }
      if (!navigator.onLine || !status) {
        store.setSyncStatus('offline')
      }
      console.error('[WBSoloRoom] Failed to load session:', err)
    } finally {
      // Always stop loading — even on error, show the canvas
      isLoading.value = false
    }

    // Connect presence WebSocket (non-blocking, graceful)
    connectPresenceSafe(id)
  }

  sessionName.value = store.workspaceName
})

onBeforeUnmount(async () => {
  // Flush pending changes (was TODO[A-SAVE])
  try {
    await autosave.saveNow()
  } catch {
    // Best-effort save on unmount
  }
  autosave.destroy()
  presence.disconnect()
})

watch(() => store.workspaceName, (name) => {
  sessionName.value = name
})
</script>

<style scoped>
/* WB: Solo room layout — header + toolbar + canvas + footer
   Ref: classroom/views/SoloRoom.vue (adapted with WB prefix) */

.wb-solo-room {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--wb-bg-tertiary, #f1f5f9);
}

/* ── Header ────────────────────────────────────────────────────────────────── */

.wb-solo-room__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--wb-header-bg, #0f172a);
  color: white;
  height: 56px;
  flex-shrink: 0;
  z-index: 30;
}

@media (max-width: 1024px) {
  .wb-solo-room__header {
    padding: 0 16px;
  }
}

.wb-solo-room__title {
  flex: 1;
  min-width: 0;
}

.wb-title-input {
  width: 100%;
  max-width: 220px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid transparent;
  border-radius: 6px;
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.wb-title-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.wb-title-input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.18);
  border-color: var(--wb-brand, #2563eb);
}

.wb-solo-room__status {
  flex-shrink: 0;
  margin: 0 16px;
}

.wb-save-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
}

.wb-save-indicator__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
  transition: background 0.3s ease;
}

.wb-save-indicator--saved .wb-save-indicator__dot {
  background: #22c55e;
}

.wb-save-indicator--syncing .wb-save-indicator__dot {
  background: #eab308;
  animation: wb-pulse 1s infinite;
}

.wb-save-indicator--error .wb-save-indicator__dot {
  background: #ef4444;
}

.wb-save-indicator--offline .wb-save-indicator__dot {
  background: #f97316;
}

@keyframes wb-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ── A5.1: Follow mode ─────────────────────────────────────────────────────── */

.wb-follow-controls {
  flex-shrink: 0;
  margin: 0 12px;
}

.wb-follow-btn {
  padding: 4px 14px;
  background: rgba(37, 99, 235, 0.8);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
  white-space: nowrap;
}

.wb-follow-btn:hover {
  background: rgba(37, 99, 235, 1);
}

.wb-follow-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.4);
  border-radius: 6px;
  font-size: 0.75rem;
  color: #bbf7d0;
  white-space: nowrap;
}

.wb-follow-indicator__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  animation: wb-pulse 1.5s infinite;
}

.wb-follow-stop-btn {
  margin-left: 4px;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 0.6875rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.wb-follow-stop-btn:hover {
  background: rgba(239, 68, 68, 0.6);
}

.wb-solo-room__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.wb-header-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.15s ease;
}

.wb-header-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.wb-header-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.wb-header-btn--exit {
  width: auto;
  padding: 0 12px;
  font-size: 0.8125rem;
  font-weight: 500;
}

/* ── Main ──────────────────────────────────────────────────────────────────── */

.wb-solo-room__main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.wb-solo-room__toolbar {
  flex-shrink: 0;
  z-index: 20;
}

.wb-solo-room__canvas {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--wb-canvas-area-bg, #e2e8f0);
}

/* ── Footer ────────────────────────────────────────────────────────────────── */

.wb-solo-room__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 44px;
  background: var(--wb-footer-bg, #ffffff);
  border-top: 1px solid var(--wb-border, #e2e8f0);
  flex-shrink: 0;
  z-index: 20;
}

.wb-page-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wb-page-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--wb-bg-secondary, #f8fafc);
  border: 1px solid var(--wb-border, #e2e8f0);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--wb-fg, #0f172a);
  transition: background 0.15s ease;
}

.wb-page-btn:hover:not(:disabled) {
  background: var(--wb-bg-hover, #f1f5f9);
}

.wb-page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.wb-page-btn--add {
  font-weight: 600;
  color: var(--wb-brand, #2563eb);
}

.wb-page-indicator {
  font-size: 0.8125rem;
  color: var(--wb-fg-secondary, #475569);
  min-width: 48px;
  text-align: center;
}

.wb-zoom-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.wb-zoom-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--wb-bg-secondary, #f8fafc);
  border: 1px solid var(--wb-border, #e2e8f0);
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
  transition: background 0.15s ease;
}

.wb-zoom-btn:hover {
  background: var(--wb-bg-hover, #f1f5f9);
}

.wb-zoom-level {
  font-size: 0.8125rem;
  color: var(--wb-fg-secondary, #475569);
  min-width: 48px;
  text-align: center;
}

/* ── A6.3: Responsive — Mobile (<768px) ───────────────────────────────────── */

@media (max-width: 768px) {
  .wb-solo-room__header {
    height: 44px;
    padding: 0 8px;
    gap: 4px;
  }

  .wb-solo-room__title {
    max-width: 100px;
  }

  .wb-title-input {
    max-width: 100px;
    font-size: 0.75rem;
    padding: 2px 6px;
  }

  .wb-solo-room__status {
    display: none;
  }

  .wb-follow-controls {
    margin: 0 4px;
  }

  .wb-follow-btn {
    font-size: 0.6875rem;
    padding: 3px 8px;
  }

  .wb-follow-indicator {
    font-size: 0.6875rem;
    padding: 3px 6px;
    gap: 4px;
  }

  .wb-solo-room__actions {
    gap: 4px;
  }

  .wb-header-btn {
    width: 36px;
    height: 36px;
    min-width: 44px;
    min-height: 44px;
  }

  .wb-header-btn--exit {
    min-width: 44px;
    padding: 0 8px;
    font-size: 0.75rem;
  }

  /* Mobile: toolbar at bottom, canvas takes full width */
  .wb-solo-room__main {
    flex-direction: column;
  }

  .wb-solo-room__toolbar {
    order: 2;
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .wb-solo-room__canvas {
    order: 1;
    flex: 1;
    min-height: 0;
  }

  .wb-solo-room__footer {
    height: 40px;
    padding: 0 8px;
  }

  .wb-page-nav {
    gap: 4px;
  }

  .wb-page-btn {
    width: 36px;
    height: 36px;
    min-width: 44px;
    min-height: 44px;
  }

  .wb-page-indicator {
    font-size: 0.75rem;
    min-width: 36px;
  }

  .wb-zoom-controls {
    gap: 4px;
  }

  .wb-zoom-btn {
    width: 36px;
    height: 36px;
    min-width: 44px;
    min-height: 44px;
  }

  .wb-zoom-level {
    font-size: 0.75rem;
    min-width: 36px;
  }
}

/* ── A6.3: Responsive — Tablet (768px–1024px) ────────────────────────────── */

@media (min-width: 769px) and (max-width: 1024px) {
  .wb-solo-room__header {
    height: 52px;
    padding: 0 16px;
  }

  .wb-title-input {
    max-width: 180px;
  }
}

/* ── B6.3: Empty canvas hint ───────────────────────────────────────────────── */

.wb-empty-canvas-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  opacity: 0.15;
  user-select: none;
}

.wb-empty-canvas-hint__icon {
  width: 40px;
  height: 40px;
  color: var(--wb-fg-secondary, #64748b);
}

.wb-empty-canvas-hint__text {
  font-size: 14px;
  font-weight: 500;
  color: var(--wb-fg-secondary, #64748b);
}

/* ── B6.2: Fade transition for canvas loader ──────────────────────────────── */

.wb-fade-enter-active,
.wb-fade-leave-active {
  transition: opacity 0.3s ease;
}

.wb-fade-enter-from,
.wb-fade-leave-to {
  opacity: 0;
}

/* ── B5.1: Skip to canvas link ─────────────────────────────────────────────── */

.wb-skip-link {
  position: absolute;
  top: -100%;
  left: 16px;
  z-index: 100;
  padding: 8px 16px;
  background: var(--wb-brand, #0066FF);
  color: #ffffff;
  border-radius: 0 0 8px 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: top 0.2s ease;
}

.wb-skip-link:focus {
  top: 0;
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

/* ── Reduced motion ────────────────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .wb-save-indicator__dot,
  .wb-header-btn,
  .wb-page-btn,
  .wb-zoom-btn,
  .wb-title-input,
  .wb-skip-link {
    transition: none;
  }

  .wb-fade-enter-active,
  .wb-fade-leave-active {
    transition: none;
  }

  @keyframes wb-pulse {
    0%, 100% { opacity: 1; }
  }
}
</style>
