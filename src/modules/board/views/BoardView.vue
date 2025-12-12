<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useBoardStore } from '@/stores/boardStore'
import { useBoardHistoryStore } from '@/stores/boardHistoryStore'
import BoardCanvas from '../components/canvas/BoardCanvas.vue'
import BoardToolbar from '../components/toolbar/BoardToolbar.vue'
import LayersPanel from '../components/layers/LayersPanel.vue'
import HistoryPanel from '../components/history/HistoryPanel.vue'
import PropertiesPanel from '../components/properties/PropertiesPanel.vue'
import MiniMap from '../components/shared/MiniMap.vue'
import ZoomControls from '../components/shared/ZoomControls.vue'
import StatusBar from '../components/shared/StatusBar.vue'
import ExportModal from '../components/export/ExportModal.vue'
import TemplateGallery from '../components/templates/TemplateGallery.vue'

const route = useRoute()
const boardStore = useBoardStore()
const historyStore = useBoardHistoryStore()

const {
  isLoading,
  layers,
  activeLayerId,
  activeTool,
  toolConfig,
  canUndo,
  canRedo,
  syncStatus,
  isOffline,
  hasSelection,
  viewport,
} = storeToRefs(boardStore)

const containerRef = ref<HTMLElement | null>(null)
const sessionId = computed(() => route.params.sessionId as string)

// Panel visibility
const showLayersPanel = ref(true)
const showHistoryPanel = ref(false)
const showPropertiesPanel = ref(true)
const showExportModal = ref(false)
const showTemplateGallery = ref(false)

// Keyboard shortcuts
function handleKeydown(event: KeyboardEvent) {
  // Prevent shortcuts when typing in input
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return
  }

  const ctrl = event.ctrlKey || event.metaKey

  if (ctrl && event.key === 'z' && !event.shiftKey) {
    event.preventDefault()
    boardStore.undo()
  } else if ((ctrl && event.key === 'z' && event.shiftKey) || (ctrl && event.key === 'y')) {
    event.preventDefault()
    boardStore.redo()
  } else if (ctrl && event.key === 'a') {
    event.preventDefault()
    boardStore.selectAll()
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    if (hasSelection.value) {
      event.preventDefault()
      boardStore.deleteSelected()
    }
  } else if (ctrl && event.key === 'd') {
    event.preventDefault()
    boardStore.duplicateSelected()
  } else if (ctrl && event.key === 's') {
    event.preventDefault()
    boardStore.saveSession()
  } else if (ctrl && event.key === 'e') {
    event.preventDefault()
    showExportModal.value = true
  } else if (event.key === 'Escape') {
    boardStore.clearSelection()
    showExportModal.value = false
    showTemplateGallery.value = false
  } else if (event.key === 'v') {
    boardStore.setTool('select')
  } else if (event.key === 'h') {
    boardStore.setTool('pan')
  } else if (event.key === 'p') {
    boardStore.setTool('pencil')
  } else if (event.key === 'm') {
    boardStore.setTool('marker')
  } else if (event.key === 'e') {
    boardStore.setTool('eraser')
  } else if (event.key === 's' && !ctrl) {
    boardStore.setTool('shape')
  } else if (event.key === 't') {
    boardStore.setTool('text')
  } else if (event.key === 'n') {
    boardStore.setTool('sticky')
  } else if (event.key === 'l') {
    boardStore.setTool('connector')
  } else if (event.key === '+' || event.key === '=') {
    boardStore.zoomIn()
  } else if (event.key === '-') {
    boardStore.zoomOut()
  } else if (event.key === '0') {
    boardStore.resetView()
  } else if (event.key === '1') {
    boardStore.fitToContent()
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)

  if (containerRef.value && sessionId.value) {
    await boardStore.initializeBoard(sessionId.value, containerRef.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  boardStore.disposeBoard()
})
</script>

<template>
  <div class="board-view">
    <!-- Loading overlay -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner" />
      <span>Loading board...</span>
    </div>

    <!-- Main layout -->
    <div class="board-layout">
      <!-- Left sidebar -->
      <aside class="sidebar left">
        <BoardToolbar
          :active-tool="activeTool"
          :tool-config="toolConfig"
          :can-undo="canUndo"
          :can-redo="canRedo"
          @tool-change="boardStore.setTool"
          @config-change="boardStore.setToolConfig"
          @undo="boardStore.undo"
          @redo="boardStore.redo"
        />
      </aside>

      <!-- Canvas area -->
      <main class="canvas-area" ref="containerRef">
        <BoardCanvas />

        <!-- Zoom controls -->
        <ZoomControls
          :zoom="viewport.zoom"
          @zoom-in="boardStore.zoomIn"
          @zoom-out="boardStore.zoomOut"
          @zoom-reset="boardStore.resetView"
          @fit-content="boardStore.fitToContent"
        />

        <!-- Mini map -->
        <MiniMap :viewport="viewport" :layers="layers" />
      </main>

      <!-- Right sidebar -->
      <aside class="sidebar right">
        <div class="panel-tabs">
          <button
            :class="{ active: showLayersPanel }"
            @click="showLayersPanel = true; showHistoryPanel = false"
          >
            Layers
          </button>
          <button
            :class="{ active: showHistoryPanel }"
            @click="showHistoryPanel = true; showLayersPanel = false"
          >
            History
          </button>
        </div>

        <LayersPanel
          v-if="showLayersPanel"
          :layers="layers"
          :active-layer-id="activeLayerId"
          @select="boardStore.setActiveLayer"
          @create="boardStore.createLayer"
          @delete="boardStore.deleteLayer"
          @toggle-visibility="boardStore.toggleLayerVisibility"
          @toggle-lock="boardStore.toggleLayerLock"
        />

        <HistoryPanel
          v-if="showHistoryPanel"
          :entries="historyStore.entries"
          :versions="historyStore.versions"
          @create-version="historyStore.createVersion"
          @restore-version="historyStore.restoreVersion"
        />

        <PropertiesPanel
          v-if="showPropertiesPanel && hasSelection"
          :selected-components="boardStore.selectedComponents"
        />
      </aside>
    </div>

    <!-- Status bar -->
    <StatusBar
      :sync-status="syncStatus"
      :is-offline="isOffline"
      :zoom="viewport.zoom"
      :selection-count="boardStore.selectedIds.length"
    />

    <!-- Modals -->
    <ExportModal
      v-if="showExportModal"
      @close="showExportModal = false"
      @export="boardStore.exportBoard"
    />

    <TemplateGallery
      v-if="showTemplateGallery"
      @close="showTemplateGallery = false"
      @apply="boardStore.applyTemplate"
    />
  </div>
</template>

<style scoped>
.board-view {
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  overflow: hidden;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  z-index: 1000;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e0e0e0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.board-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 280px;
  background: #ffffff;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar.left {
  width: 64px;
}

.sidebar.right {
  border-right: none;
  border-left: 1px solid #e0e0e0;
}

.canvas-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
}

.panel-tabs button {
  flex: 1;
  padding: 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  color: #666;
  transition: all 0.2s;
}

.panel-tabs button:hover {
  background: #f5f5f5;
}

.panel-tabs button.active {
  color: #3b82f6;
  border-bottom: 2px solid #3b82f6;
}
</style>
