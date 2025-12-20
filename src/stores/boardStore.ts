// TASK F16: Board Store (Refactored) - Pinia store for Advanced Whiteboard v2

import { defineStore, storeToRefs } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import { BoardEngine } from '@/core/board/BoardEngine'
import type {
  Viewport,
  Layer,
  Component,
  ToolType,
  ToolConfig,
  SyncStatus,
  RemoteCursor,
  ExportFormat,
  VideoLayout,
} from '@/core/board/types'
import { DEFAULT_TOOL_CONFIG, DEFAULT_VIEWPORT } from '@/core/board/constants'

export const useBoardStore = defineStore('board', () => {
  // Engine reference
  const engine = shallowRef<BoardEngine | null>(null)

  // Session state
  const sessionId = ref<string | null>(null)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const lastSavedAt = ref<Date | null>(null)

  // Viewport
  const viewport = ref<Viewport>({ ...DEFAULT_VIEWPORT })

  // Layers
  const layers = ref<Layer[]>([])
  const activeLayerId = ref<number | null>(null)

  // Components (visible in viewport)
  const visibleComponents = ref<Component[]>([])

  // Selection
  const selectedIds = ref<string[]>([])

  // Tool
  const activeTool = ref<ToolType>('pencil')
  const toolConfig = ref<ToolConfig>({ ...DEFAULT_TOOL_CONFIG })

  // History
  const canUndo = ref(false)
  const canRedo = ref(false)

  // Sync
  const syncStatus = ref<SyncStatus>('synced')
  const isOffline = ref(false)
  const pendingChanges = ref(0)

  // Cursors (remote)
  const remoteCursors = ref<RemoteCursor[]>([])

  // Video integration
  const videoLayout = ref<VideoLayout>('pip')
  const isFollowMode = ref(false)
  const followingUserId = ref<string | null>(null)

  const recentConflicts = ref<unknown[]>([])

  // Getters
  const activeLayer = computed(() => layers.value.find((l) => l.id === activeLayerId.value))

  const selectedComponents = computed(() => visibleComponents.value.filter((c) => selectedIds.value.includes(c.id)))

  const hasSelection = computed(() => selectedIds.value.length > 0)

  const isConnected = computed(() => !isOffline.value)

  // Actions
  async function initializeBoard(id: string, container: HTMLElement): Promise<void> {
    if (engine.value) {
      engine.value.destroy()
    }

    isLoading.value = true
    sessionId.value = id

    try {
      const boardEngine = new BoardEngine({
        sessionId: id,
        userId: 'current-user', // TODO: Get from auth store
        apiUrl: import.meta.env.VITE_API_URL || '/api',
        wsUrl: import.meta.env.VITE_WS_URL || '/ws',
      })

      // Setup event listeners
      boardEngine.events.on('viewport-change', (vp) => {
        viewport.value = vp
      })

      boardEngine.events.on('layer-change', (newLayers) => {
        layers.value = newLayers
        const active = boardEngine.getActiveLayer()
        activeLayerId.value = active?.id ?? null
      })

      boardEngine.events.on('selection-change', (components) => {
        selectedIds.value = components.map((c) => c.id)
      })

      boardEngine.events.on('tool-change', (type) => {
        activeTool.value = type
      })

      boardEngine.events.on('history-change', (state) => {
        canUndo.value = state.canUndo
        canRedo.value = state.canRedo
      })

      boardEngine.events.on('sync-status', (status) => {
        syncStatus.value = status
        if (status === 'synced') {
          lastSavedAt.value = new Date()
        }
      })

      boardEngine.events.on('offline-status', (offline) => {
        isOffline.value = offline
      })

      boardEngine.events.on('cursor-update', (cursor) => {
        const index = remoteCursors.value.findIndex((c) => c.userId === cursor.userId)
        if (index >= 0) {
          remoteCursors.value[index] = cursor
        } else {
          remoteCursors.value.push(cursor)
        }
      })

      await boardEngine.initialize(id, container)

      engine.value = boardEngine
      layers.value = boardEngine.getLayers()
      activeLayerId.value = boardEngine.getActiveLayer()?.id ?? null
    } finally {
      isLoading.value = false
    }
  }

  async function loadSession(): Promise<void> {
    if (!engine.value) return
    isLoading.value = true
    try {
      await engine.value.loadSession()
    } finally {
      isLoading.value = false
    }
  }

  async function saveSession(): Promise<void> {
    if (!engine.value) return
    isSaving.value = true
    try {
      await engine.value.saveSession()
      lastSavedAt.value = new Date()
    } finally {
      isSaving.value = false
    }
  }

  function disposeBoard(): void {
    if (engine.value) {
      engine.value.destroy()
      engine.value = null
    }
    sessionId.value = null
    layers.value = []
    activeLayerId.value = null
    visibleComponents.value = []
    selectedIds.value = []
    remoteCursors.value = []
  }

  // Viewport actions
  function setViewport(vp: Partial<Viewport>): void {
    engine.value?.setViewport(vp)
  }

  function zoomIn(): void {
    engine.value?.zoomIn()
  }

  function zoomOut(): void {
    engine.value?.zoomOut()
  }

  function zoomTo(level: number): void {
    engine.value?.zoomTo(level)
  }

  function fitToContent(): void {
    engine.value?.fitToContent()
  }

  function resetView(): void {
    engine.value?.resetView()
  }

  // Layer actions
  function createLayer(name: string): void {
    engine.value?.createLayer(name)
  }

  function deleteLayer(id: number): void {
    engine.value?.deleteLayer(id)
  }

  function setActiveLayer(id: number): void {
    engine.value?.setActiveLayer(id)
    activeLayerId.value = id
  }

  function toggleLayerVisibility(id: number): void {
    // TODO: Implement in engine
  }

  function toggleLayerLock(id: number): void {
    // TODO: Implement in engine
  }

  function reorderLayers(order: number[]): void {
    // TODO: Implement in engine
  }

  // Tool actions
  function setTool(tool: ToolType): void {
    engine.value?.setTool(tool)
    activeTool.value = tool
  }

  function setToolConfig(config: Partial<ToolConfig>): void {
    engine.value?.setToolConfig(config)
    toolConfig.value = { ...toolConfig.value, ...config }
  }

  // Selection actions
  function select(id: string, addToSelection = false): void {
    engine.value?.select(id, addToSelection)
  }

  function selectMultiple(ids: string[]): void {
    engine.value?.selectMultiple(ids)
  }

  function clearSelection(): void {
    engine.value?.clearSelection()
  }

  function selectAll(): void {
    engine.value?.selectAll()
  }

  // History actions
  function undo(): void {
    engine.value?.undo()
  }

  function redo(): void {
    engine.value?.redo()
  }

  // Component actions
  function deleteSelected(): void {
    engine.value?.deleteSelected()
  }

  function duplicateSelected(): void {
    engine.value?.duplicateSelected()
  }

  function moveSelectedToLayer(layerId: number): void {
    // TODO: Implement in engine
  }

  // Export actions
  async function exportBoard(format: ExportFormat): Promise<Blob | string> {
    if (!engine.value) {
      throw new Error('Board not initialized')
    }
    return engine.value.export(format)
  }

  // Template actions
  async function applyTemplate(slug: string): Promise<void> {
    if (!engine.value) return
    await engine.value.applyTemplate(slug)
  }

  // Video integration
  function setVideoLayout(layout: VideoLayout): void {
    videoLayout.value = layout
  }

  function toggleFollowMode(userId?: string): void {
    if (isFollowMode.value && followingUserId.value === userId) {
      isFollowMode.value = false
      followingUserId.value = null
    } else {
      isFollowMode.value = true
      followingUserId.value = userId ?? null
    }
  }

  // Cursor sync
  function updateCursorPosition(x: number, y: number): void {
    // TODO: Send to server
  }

  function clearRecentConflicts(): void {
    recentConflicts.value = []
  }

  return {
    // State
    engine,
    sessionId,
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
    recentConflicts,

    // Getters
    activeLayer,
    selectedComponents,
    hasSelection,
    isConnected,

    // Actions
    initializeBoard,
    loadSession,
    saveSession,
    disposeBoard,
    setViewport,
    zoomIn,
    zoomOut,
    zoomTo,
    fitToContent,
    resetView,
    createLayer,
    deleteLayer,
    setActiveLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    reorderLayers,
    setTool,
    setToolConfig,
    select,
    selectMultiple,
    clearSelection,
    selectAll,
    undo,
    redo,
    deleteSelected,
    duplicateSelected,
    moveSelectedToLayer,
    exportBoard,
    applyTemplate,
    setVideoLayout,
    toggleFollowMode,
    updateCursorPosition,
    clearRecentConflicts,
  }
})

export default useBoardStore
