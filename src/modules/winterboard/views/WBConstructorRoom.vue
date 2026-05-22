<!-- PR C.1: Constructor Room — редактор Студії уроків.
     INV-CONSTR-1: відкривається для ВСІХ дошок Студії (origin_lesson_id може бути null для scratch).
     INV-CONSTR-2: toolbar БЕЗ Record / Invite — тільки Оновити шаблон + Провести з учнем
     INV-CONSTR-5: persistent session (getOrCreate reuse = correct)
     INV-CONSTR-7: НЕ є canonical lesson source. Canonical = KnowledgeLesson.
     Route: /winterboard/prepare/:id
-->
<template>
  <div
    class="wb-constructor-room"
    :data-device-mode="deviceModeState.deviceMode.value"
  >
    <DesyncRecoveryBanner />
    <ProtocolMismatchModal />

    <!-- ── Constructor Header ───────────────────────────────────────────── -->
    <header class="wb-constructor-room__header">
      <!-- Left: Back + badge + lesson name + undo/redo -->
      <div class="wb-constructor-room__left">
        <button
          type="button"
          class="wb-constructor-room__back"
          :title="t('winterboard.constructor.backToLessons')"
          @click="router.push({ name: 'MyLessons' })"
        >
          ←
        </button>

        <span class="wb-constructor-room__badge">
          {{ t('winterboard.constructor.badge') }}
        </span>

        <span class="wb-constructor-room__lesson-name" :title="lessonName">
          {{ lessonName }}
        </span>

        <div class="wb-constructor-room__history">
          <button
            type="button"
            class="wb-constructor-room__icon-btn"
            :disabled="!store.canUndo"
            :title="t('winterboard.room.undoShortcut')"
            @click="handleUndo"
          >↩</button>
          <button
            type="button"
            class="wb-constructor-room__icon-btn"
            :disabled="!store.canRedo"
            :title="t('winterboard.room.redoShortcut')"
            @click="handleRedo"
          >↪</button>
        </div>
      </div>

      <!-- Center: save status -->
      <div class="wb-constructor-room__status">
        <span class="wb-save-indicator" :class="`wb-save-indicator--${opsSync.syncStatus}`">
          <span class="wb-save-indicator__dot" />
          <span class="wb-save-indicator__text">{{ saveStatusText }}</span>
        </span>
      </div>

      <!-- Right: actions -->
      <div class="wb-constructor-room__actions">
        <!-- Оновити шаблон — зберігає поточний стан як KnowledgeLesson.snapshot -->
        <button
          v-if="originLessonId"
          type="button"
          class="wb-constructor-room__btn wb-constructor-room__btn--secondary"
          :disabled="isUpdatingTemplate || !sessionId"
          @click="handleUpdateTemplate"
        >
          {{ isUpdatingTemplate ? '…' : t('winterboard.constructor.updateTemplate') }}
        </button>

        <!-- INV-CONSTR-2: "Провести з учнем" видалено з конструктора.
             Старт уроку відбувається з "Мої уроки", не з конструктора. -->
      </div>
    </header>

    <!-- ── Body: toolbar + thumbnails + canvas + sidebar ───────────────── -->
    <div class="wb-constructor-room__body">

      <!-- Left Toolbar — як у wb-solo-room__toolbar -->
      <aside class="wb-constructor-room__toolbar">
        <WBToolbar
          v-if="sessionId"
          :current-tool="store.currentTool"
          :current-color="store.currentColor"
          :current-size="store.currentSize"
          :session-id="sessionId"
          :show-materials-btn="true"
          :materials-open="showMaterialsSidebar"
          @tool-change="store.setTool($event)"
          @color-change="store.setColor($event)"
          @size-change="store.setSize($event)"
          @clear-page="handleClearPage"
          @toggle-materials="showMaterialsSidebar = !showMaterialsSidebar"
        />
      </aside>

      <!-- Page thumbnails -->
      <WBPageThumbnails
        :pages="store.pages"
        :current-page-index="store.currentPageIndex"
        :session-id="sessionId ?? ''"
        @select-page="store.setCurrentPage($event)"
        @add-page="handleAddPage"
        @delete-page="handleDeletePage"
        @move-page="handleMovePage"
        @rename-page="handleRenamePage"
      />

      <!-- Canvas area -->
      <div
        id="wb-canvas"
        ref="canvasContainerRef"
        class="wb-constructor-room__canvas"
        tabindex="-1"
        @dragover.prevent
        @drop="contentDrop.handleCanvasDrop($event)"
      >
        <WBCanvasLoader v-if="isLoading" />
        <WBCanvas
          v-show="!isLoading"
          ref="canvasRef"
          class="wb-page-fade"
          :class="{ 'wb-page-fade--out': isPageFading }"
          :tool="store.currentTool"
          :color="store.currentColor"
          :size="store.currentSize"
          :strokes="displayStrokes"
          :assets="displayAssets"
          :width="store.pageWidth"
          :height="store.pageHeight"
          :zoom="store.zoom"
          :background="displayBackground"
          :is-tutor="true"
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
          @presentation-expand="() => {}"
          @audio-badge-click="() => {}"
          @doc-viewer-page-jump="() => {}"
        />

        <!-- Selection toolbar (same as solo room) -->
        <WBSelectionToolbar
          v-if="selectedId && sessionId"
          :selected-id="selectedId"
          :session-id="sessionId"
          :zoom="store.zoom"
          @deselect="selectedId = null"
        />
      </div>

      <!-- Upload progress -->
      <WBUploadIndicator
        :is-uploading="boardClipboard.isUploading.value"
        :upload-error="boardClipboard.uploadError.value"
      />

      <!-- Sidebar collapse toggle -->
      <button
        v-if="showMaterialsSidebar"
        class="wb-solo-room__sidebar-toggle"
        type="button"
        @click="showMaterialsSidebar = !showMaterialsSidebar"
      >
        {{ showMaterialsSidebar ? '◀' : '▶' }}
      </button>

      <!-- Right sidebar — materials -->
      <aside
        v-if="showMaterialsSidebar"
        class="wb-constructor-room__sidebar"
      >
        <GroupContentSidebar
          :group-id="groupId"
          :session-id="sessionId ?? ''"
          :is-tutor="true"
          @add-content="contentDrop.addAtCenter"
        />
      </aside>
    </div>


  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useWBStore } from '../board/state/boardStore'
import { useHistory } from '../composables/useHistory'
import { useKeyboard } from '../composables/useKeyboard'
import { useBoardClipboard } from '../composables/useBoardClipboard'
import { useAutosave } from '../composables/useAutosave'
import { useAnnouncer } from '../composables/useAnnouncer'
import { useContentDrop } from '../composables/useContentDrop'
import { ADD_TOOL_TO_BOARD_KEY } from '../composables/useAddToolToBoard'
import { ADD_TOOL_AT_CLIENT_KEY } from '../composables/useTouchDragFromTray'
import { useToast } from '../composables/useToast'
import { useOpsSyncStore } from '../stores/opsSyncStore'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { useCanvasResize } from '../composables/useCanvasResize'
import { useTouchGestures } from '../components/gestures/useTouchGestures'
import { useDeviceMode } from '../composables/useDeviceMode'
import { useGridOverlay } from '../composables/useGridOverlay'
import { usePageTransition } from '../composables/usePageTransition'

import { winterboardApi } from '../api/winterboardApi'
import { lessonViewApi } from '@/modules/knowledge/api/lessonViewApi'
import { useNotifyStore } from '@/stores/notifyStore'
import { groupApi as learningGroupApi } from '@/modules/groups/api/groupApi'

import type { WBStroke, WBAsset, WBToolType } from '../types/winterboard'

import WBCanvas from '../components/canvas/WBCanvas.vue'
import WBToolbar from '../components/toolbar/WBToolbar.vue'
import WBCanvasLoader from '../components/loading/WBCanvasLoader.vue'
import WBUploadIndicator from '../components/status/WBUploadIndicator.vue'
import WBPageThumbnails from '../components/pages/WBPageThumbnails.vue'
import WBSelectionToolbar from '../components/canvas/WBSelectionToolbar.vue'
import GroupContentSidebar from '../components/sidebar/GroupContentSidebar.vue'
import DesyncRecoveryBanner from '../components/dialogs/DesyncRecoveryBanner.vue'
import ProtocolMismatchModal from '../components/dialogs/ProtocolMismatchModal.vue'
import { provide } from 'vue'
import { registerAuthDeathCleanup } from '@/core/auth/onAuthDeath'

// ── Props ──────────────────────────────────────────────────────────────────
const props = defineProps<{ id: string }>()

// ── Stores / composables ───────────────────────────────────────────────────
const router = useRouter()
const route = useRoute()
const store = useWBStore()
const { t } = useI18n()
const { announce } = useAnnouncer()
const opsSync = useOpsSyncStore()
const notify = useNotifyStore()
const authStore = useAuthStore()
const deviceModeState = useDeviceMode()

const sessionId = ref<string | null>(null)
const autosave = useAutosave(sessionId)
const history = useHistory({ maxSize: 100 })
const _toast = useToast()
const _folderToast = useToast()

// ── Constructor-specific state ─────────────────────────────────────────────
const lessonName = ref('')
const originLessonId = ref<string | null>(null)
const isLoading = ref(true)
const isUpdatingTemplate = ref(false)
const selectedId = ref<string | null>(null)

// ── Canvas refs ────────────────────────────────────────────────────────────
const canvasRef = ref<InstanceType<typeof WBCanvas> | null>(null)
const canvasContainerRef = ref<HTMLElement | null>(null)

// ── Sidebar ────────────────────────────────────────────────────────────────
const showMaterialsSidebar = ref(window.innerWidth > 768)
const autoGroupId = ref<string | null>(null)
const explicitGroupId = computed(() => {
  const qg = route.query.groupId
  return typeof qg === 'string' ? qg : null
})
const groupId = computed(() => explicitGroupId.value || autoGroupId.value)

// ── Save status text ───────────────────────────────────────────────────────
const saveStatusText = computed(() => {
  switch (opsSync.syncStatus) {
    case 'saving': return t('winterboard.room.saving')
    case 'saved':  return t('winterboard.room.saved')
    case 'error':  return t('winterboard.room.saveError')
    default:       return t('winterboard.room.ready')
  }
})

// ── Page transition (fade) ─────────────────────────────────────────────────
const pageTransition = usePageTransition(computed(() => store.currentPageIndex))
const displayStrokes  = computed(() => store.pages[pageTransition.displayIndex.value]?.strokes ?? [])
const displayAssets   = computed(() => store.pages[pageTransition.displayIndex.value]?.assets ?? [])
const displayBackground = computed(() => store.pages[pageTransition.displayIndex.value]?.background)
const isPageFading    = computed(() => pageTransition.isFading.value)

// ── Canvas resize ──────────────────────────────────────────────────────────
useCanvasResize({
  containerRef: canvasContainerRef,
  onResize(w, h) {
    if (w > 0 && h > 0 && store.pageWidth > 0 && store.pageHeight > 0) {
      const fitZoom = Math.min(w / store.pageWidth, h / store.pageHeight, 1)
      if (store.zoom > fitZoom + 0.01) store.setZoom(fitZoom)
    }
  },
  debounceMs: 100,
})

// ── Touch gestures ─────────────────────────────────────────────────────────
const touchGestures = useTouchGestures(canvasContainerRef, {
  onPan(dx, dy)    { store.setScroll(store.scrollX + dx, store.scrollY + dy) },
  onPanEnd()       { /* inertia */ },
  onZoom(zoom)     { store.setZoom(zoom) },
  onUndo()         { handleUndo() },
  onRedo()         { handleRedo() },
  onDoubleTap()    { /* zoom toggle — future */ },
  onLongPress()    { /* context menu — future */ },
  onEdgeSwipe()    { /* page nav — future */ },
  onThreeFingerTap() { /* future */ },
})
onMounted(() => touchGestures.attach())

// ── Grid overlay ───────────────────────────────────────────────────────────
useGridOverlay(props.id)

// ── Clipboard ──────────────────────────────────────────────────────────────
const boardClipboard = useBoardClipboard({
  sessionId,
  store,
  history,
  announce,
})

// ── Keyboard shortcuts ─────────────────────────────────────────────────────
useKeyboard({
  store,
  history,
  sessionId,
  canvasContainerRef,
  boardClipboard,
  onUndo: handleUndo,
  onRedo: handleRedo,
})

// ── Content drop (D&D from sidebar) ───────────────────────────────────────
const contentDrop = useContentDrop({
  sessionId,
  canDraw: computed(() => true),
  onAssetAdd: (asset: WBAsset) => store.addAsset(asset, store.currentPageId),
  screenToCanvas: (x: number, y: number) => {
    const rect = canvasContainerRef.value?.getBoundingClientRect()
    if (rect) return { x: (x - rect.left) / (store.zoom || 1), y: (y - rect.top) / (store.zoom || 1) }
    return { x: (store.pageWidth ?? 800) / 2, y: 100 }
  },
})

provide(ADD_TOOL_TO_BOARD_KEY, (mime: string, payloadStr: string) => {
  const container = canvasContainerRef.value
  if (!container) return
  const zoom = store.zoom || 1
  contentDrop.addAtPosition(mime, payloadStr, {
    x: (container.scrollLeft + container.clientWidth / 2) / zoom,
    y: (container.scrollTop + container.clientHeight / 2) / zoom,
  })
})
provide(ADD_TOOL_AT_CLIENT_KEY, (mime: string, payloadStr: string, clientX: number, clientY: number) => {
  const rect = canvasContainerRef.value?.getBoundingClientRect()
  if (!rect) return
  const zoom = store.zoom || 1
  contentDrop.addAtPosition(mime, payloadStr, {
    x: (clientX - rect.left) / zoom,
    y: (clientY - rect.top) / zoom,
  })
})

// ── Auth death cleanup ─────────────────────────────────────────────────────
registerAuthDeathCleanup(() => {
  opsSync.reset()
  store.$reset()
})

// ── Bootstrap (same sequence as WBSoloRoom) ────────────────────────────────
onMounted(async () => {
  const id = props.id
  if (!id) {
    router.push({ name: 'MyLessons' })
    return
  }

  try {
    const detail = await winterboardApi.getSession(id)

    // origin_lesson_id може бути null для scratch-дошок зі Студії — це OK.
    // Кнопка «Оновити шаблон» прихована v-if="originLessonId" коли null.
    originLessonId.value = detail.origin_lesson_id ?? null
    lessonName.value = detail.origin_lesson_title || detail.name || t('winterboard.constructor.untitled')

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

    // Set sessionId AFTER hydration (same race guard as WBSoloRoom)
    sessionId.value = id

    try {
      await opsSync.bootstrap(id)
    } catch (bootErr) {
      console.error('[WBConstructorRoom] opsSync.bootstrap failed (non-fatal):', bootErr)
    }

    // Auto-detect tutor group for sidebar
    detectTutorGroup()

  } catch (err: unknown) {
    const status = (err as Record<string, Record<string, number>>)?.response?.status
    if (status === 401) { router.push('/auth/login'); return }
    if (status === 404) { router.push({ name: 'MyLessons' }); return }
    console.error('[WBConstructorRoom] load error:', err)
    notify.error(t('winterboard.constructor.loadError'))
  } finally {
    isLoading.value = false
  }
})

onBeforeUnmount(() => {
  opsSync.reset()
  store.$reset()
})

// ── Group auto-detect ──────────────────────────────────────────────────────
async function detectTutorGroup() {
  if (explicitGroupId.value) return
  try {
    const groups = await learningGroupApi.listGroups()
    if (groups?.length > 0) {
      const implicit = groups.find((g: any) => g.group_type === 'IMPLICIT')
      autoGroupId.value = String((implicit || groups[0]).id)
    }
  } catch { /* non-fatal */ }
}

// ── Canvas event handlers ──────────────────────────────────────────────────
function handleStrokeAdd(stroke: WBStroke): void {
  store.addStroke(stroke)
  const page = store.currentPage
  if (page) { try { history.recordAdd(page.id, stroke, 'stroke') } catch { /* non-critical */ } }
}
function handleStrokeUpdate(stroke: WBStroke): void { store.updateStroke(stroke) }
function handleStrokeDelete(strokeId: string): void {
  const page = store.currentPage
  const existing = page?.strokes.find((s) => s.id === strokeId)
  store.deleteStroke(strokeId)
  if (page && existing) { try { history.recordRemove(page.id, existing, 'stroke') } catch { /* non-critical */ } }
}
function handleAssetAdd(asset: WBAsset): void {
  store.addAsset(asset, store.currentPageId)
  const page = store.currentPage
  if (page) { try { history.recordAdd(page.id, asset, 'asset') } catch { /* non-critical */ } }
}
function handleAssetUpdate(asset: WBAsset): void { store.updateAsset(asset) }
function handleAssetDelete(assetId: string): void {
  const page = store.currentPage
  const existing = page?.assets.find((a) => a.id === assetId)
  store.deleteAsset(assetId)
  if (page && existing) { try { history.recordRemove(page.id, existing, 'asset') } catch { /* non-critical */ } }
}
function handleSelect(id: string | null): void { selectedId.value = id }
function handleCursorMove(_payload: { x: number; y: number; tool: WBToolType; color: string }): void {
  // Constructor = solo session, no cursor broadcast needed
}
function handleZoomChange(zoom: number): void  { store.setZoom(zoom) }
function handleScrollChange(x: number, y: number): void { store.setScroll(x, y) }

// ── Undo / Redo ────────────────────────────────────────────────────────────
function handleUndo(): void {
  if (!store.canUndo) return
  const action = history.undo()
  if (action) store.applyHistory(action)
}
function handleRedo(): void {
  if (!store.canRedo) return
  const action = history.redo()
  if (action) store.applyHistory(action)
}

// ── Page operations ────────────────────────────────────────────────────────
function handleAddPage(): void    { store.addPage() }
function handleDeletePage(idx: number): void { store.deletePage(idx) }
function handleMovePage(from: number, to: number): void { store.movePage(from, to) }
function handleRenamePage(payload: { index: number; name: string }): void {
  store.renamePage(payload.index, payload.name)
}
function handleClearPage(): void {
  if (!sessionId.value) return
  store.clearCurrentPage()
}

// ── Оновити шаблон ─────────────────────────────────────────────────────────
// INV-CONSTR-3: оновлює KnowledgeLesson.snapshot, НЕ мутує WBSession.state напряму
async function handleUpdateTemplate(): Promise<void> {
  if (!originLessonId.value || !sessionId.value || isUpdatingTemplate.value) return
  isUpdatingTemplate.value = true
  try {
    // Flush pending ops before snapshot (BE reads session.state after ops are applied)
    await opsSync.flushAll()
    await lessonViewApi.updateSnapshot(originLessonId.value, sessionId.value)
    notify.success(t('winterboard.constructor.templateUpdated'))
  } catch (err) {
    console.error('[WBConstructorRoom] updateTemplate error:', err)
    notify.error(t('winterboard.constructor.templateUpdateError'))
  } finally {
    isUpdatingTemplate.value = false
  }
}
</script>

<style scoped>
/* ── Constructor Room Layout ────────────────────────────────────────────── */
.wb-constructor-room {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
  background: var(--wb-bg-primary, #0f172a);
  color: var(--wb-text-primary, #f1f5f9);
}

/* ── Header — slate-900 + amber accent (відрізняється від solo зеленого) ── */
.wb-constructor-room__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 48px;
  padding: 0 12px;
  background: #0f172a;
  border-bottom: 2px solid #f59e0b; /* amber-500 — constructor signature color */
  flex-shrink: 0;
  z-index: 100;
}

.wb-constructor-room__left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.wb-constructor-room__back {
  background: none;
  border: 1px solid #334155;
  color: #94a3b8;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s;
  flex-shrink: 0;
}
.wb-constructor-room__back:hover { color: #f1f5f9; border-color: #64748b; }

/* Amber badge — constructor visual signature */
.wb-constructor-room__badge {
  background: #f59e0b;
  color: #0f172a;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 2px 7px;
  border-radius: 4px;
  flex-shrink: 0;
  user-select: none;
}

.wb-constructor-room__lesson-name {
  font-size: 14px;
  font-weight: 500;
  color: #f1f5f9;
  truncate: true;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: 280px;
}

.wb-constructor-room__history {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.wb-constructor-room__icon-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  line-height: 1;
  transition: color 0.15s, background 0.15s;
}
.wb-constructor-room__icon-btn:hover:not(:disabled) { color: #f1f5f9; background: #1e293b; }
.wb-constructor-room__icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* ── Status center ─────────────────────────────────────────────────────── */
.wb-constructor-room__status {
  flex-shrink: 0;
}

/* ── Actions right ─────────────────────────────────────────────────────── */
.wb-constructor-room__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.wb-constructor-room__btn {
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  padding: 6px 16px;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.wb-constructor-room__btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Secondary — outline style */
.wb-constructor-room__btn--secondary {
  background: transparent;
  border: 1px solid #f59e0b;
  color: #f59e0b;
}
.wb-constructor-room__btn--secondary:hover:not(:disabled) { background: rgba(245,158,11,0.1); }

/* Primary — amber fill */
.wb-constructor-room__btn--primary {
  background: #f59e0b;
  color: #0f172a;
}
.wb-constructor-room__btn--primary:hover:not(:disabled) { opacity: 0.85; }

/* ── Body ──────────────────────────────────────────────────────────────── */
.wb-constructor-room__body {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

/* ── Toolbar aside — точно як wb-solo-room__toolbar ───────────────────── */
.wb-constructor-room__toolbar {
  flex-shrink: 0;
  z-index: 20;
}

/* ── Canvas ────────────────────────────────────────────────────────────── */
.wb-constructor-room__canvas {
  flex: 1;
  min-width: 0;
  overflow: auto;
  position: relative;
  background: var(--wb-canvas-bg, #1e293b);
  outline: none;
}

/* ── Sidebar ───────────────────────────────────────────────────────────── */
.wb-constructor-room__sidebar {
  width: 280px;
  flex-shrink: 0;
  border-left: 1px solid #1e293b;
  overflow-y: auto;
  background: var(--wb-bg-secondary, #1e293b);
}

/* ── Save indicator (reused from solo) ─────────────────────────────────── */
.wb-save-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #94a3b8;
}
.wb-save-indicator__dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #64748b;
  transition: background 0.3s;
}
.wb-save-indicator--saved .wb-save-indicator__dot   { background: #22c55e; }
.wb-save-indicator--saving .wb-save-indicator__dot  { background: #f59e0b; }
.wb-save-indicator--error .wb-save-indicator__dot   { background: #ef4444; }
</style>
