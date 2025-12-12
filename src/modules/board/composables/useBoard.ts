// TASK F28: useBoard composable - Main composable for board view

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useBoardStore } from '@/stores/boardStore'
import { useBoardHistoryStore } from '@/stores/boardHistoryStore'
import { useWebRTCStore } from '@/stores/webrtcStore'
import type { ToolType, ExportFormat } from '@/core/board/types'

export function useBoard(sessionId: string) {
  const boardStore = useBoardStore()
  const historyStore = useBoardHistoryStore()
  const webrtcStore = useWebRTCStore()

  const containerRef = ref<HTMLElement | null>(null)
  const showExportModal = ref(false)
  const showTemplateGallery = ref(false)

  // Board store refs
  const {
    isLoading,
    isSaving,
    lastSavedAt,
    viewport,
    layers,
    activeLayerId,
    visibleComponents,
    selectedIds,
    activeTool,
    toolConfig,
    canUndo,
    canRedo,
    syncStatus,
    isOffline,
    pendingChanges,
    remoteCursors,
    videoLayout,
    isFollowMode,
    followingUserId,
    activeLayer,
    selectedComponents,
    hasSelection,
    isConnected,
  } = storeToRefs(boardStore)

  // Video integration
  const isInCall = computed(() => webrtcStore.isConnected)

  // Keyboard shortcuts handler
  function handleKeydown(event: KeyboardEvent) {
    // Prevent shortcuts when typing in input
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    const ctrl = event.ctrlKey || event.metaKey

    // History
    if (ctrl && event.key === 'z' && !event.shiftKey) {
      event.preventDefault()
      boardStore.undo()
    } else if ((ctrl && event.key === 'z' && event.shiftKey) || (ctrl && event.key === 'y')) {
      event.preventDefault()
      boardStore.redo()
    }
    // Selection
    else if (ctrl && event.key === 'a') {
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
    }
    // Save/Export
    else if (ctrl && event.key === 's') {
      event.preventDefault()
      boardStore.saveSession()
    } else if (ctrl && event.key === 'e') {
      event.preventDefault()
      showExportModal.value = true
    }
    // Tools
    else if (event.key === 'v') {
      boardStore.setTool('select')
    } else if (event.key === 'h') {
      boardStore.setTool('pan')
    } else if (event.key === 'p') {
      boardStore.setTool('pencil')
    } else if (event.key === 'm') {
      boardStore.setTool('marker')
    } else if (event.key === 'e' && !ctrl) {
      boardStore.setTool('eraser')
    } else if (event.key === 's' && !ctrl) {
      boardStore.setTool('shape')
    } else if (event.key === 't') {
      boardStore.setTool('text')
    } else if (event.key === 'n') {
      boardStore.setTool('sticky')
    } else if (event.key === 'l') {
      boardStore.setTool('connector')
    }
    // Zoom
    else if (event.key === '+' || event.key === '=') {
      boardStore.zoomIn()
    } else if (event.key === '-') {
      boardStore.zoomOut()
    } else if (event.key === '0') {
      boardStore.resetView()
    } else if (event.key === '1') {
      boardStore.fitToContent()
    }
    // Escape
    else if (event.key === 'Escape') {
      boardStore.clearSelection()
      showExportModal.value = false
      showTemplateGallery.value = false
    }
  }

  // Lifecycle
  onMounted(async () => {
    window.addEventListener('keydown', handleKeydown)

    if (containerRef.value) {
      await boardStore.initializeBoard(sessionId, containerRef.value)
    }
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
    boardStore.disposeBoard()
  })

  // Watch for video call state changes
  watch(isInCall, (inCall) => {
    if (inCall) {
      // Adjust layout for video
      boardStore.setVideoLayout('pip')
    } else {
      boardStore.setVideoLayout('hidden')
    }
  })

  // Actions
  function setTool(tool: ToolType) {
    boardStore.setTool(tool)
  }

  function undo() {
    boardStore.undo()
  }

  function redo() {
    boardStore.redo()
  }

  function zoomIn() {
    boardStore.zoomIn()
  }

  function zoomOut() {
    boardStore.zoomOut()
  }

  function resetView() {
    boardStore.resetView()
  }

  function fitToContent() {
    boardStore.fitToContent()
  }

  function selectAll() {
    boardStore.selectAll()
  }

  function clearSelection() {
    boardStore.clearSelection()
  }

  function deleteSelected() {
    boardStore.deleteSelected()
  }

  function duplicateSelected() {
    boardStore.duplicateSelected()
  }

  async function saveSession() {
    await boardStore.saveSession()
  }

  async function exportBoard(format: ExportFormat) {
    return boardStore.exportBoard(format)
  }

  async function applyTemplate(slug: string) {
    await boardStore.applyTemplate(slug)
  }

  function createLayer(name: string) {
    boardStore.createLayer(name)
  }

  function deleteLayer(id: number) {
    boardStore.deleteLayer(id)
  }

  function setActiveLayer(id: number) {
    boardStore.setActiveLayer(id)
  }

  function toggleFollowMode(userId?: string) {
    boardStore.toggleFollowMode(userId)
  }

  return {
    // Refs
    containerRef,
    showExportModal,
    showTemplateGallery,

    // State
    isLoading,
    isSaving,
    lastSavedAt,
    viewport,
    layers,
    activeLayerId,
    visibleComponents,
    selectedIds,
    activeTool,
    toolConfig,
    canUndo,
    canRedo,
    syncStatus,
    isOffline,
    pendingChanges,
    remoteCursors,
    videoLayout,
    isFollowMode,
    followingUserId,

    // Computed
    activeLayer,
    selectedComponents,
    hasSelection,
    isConnected,
    isInCall,

    // Stores
    boardStore,
    historyStore,

    // Actions
    setTool,
    undo,
    redo,
    zoomIn,
    zoomOut,
    resetView,
    fitToContent,
    selectAll,
    clearSelection,
    deleteSelected,
    duplicateSelected,
    saveSession,
    exportBoard,
    applyTemplate,
    createLayer,
    deleteLayer,
    setActiveLayer,
    toggleFollowMode,
  }
}

export default useBoard
