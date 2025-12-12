// TASK F1: BoardEngine - Main engine class

import { BoardEventEmitter } from './eventEmitter'
import { CanvasRenderer } from './CanvasRenderer'
import { InfiniteCanvas } from './InfiniteCanvas'
import { LayerManager } from './LayerManager'
import { ComponentManager } from './ComponentManager'
import { ToolManager } from './ToolManager'
import { HistoryManager } from './HistoryManager'
import { SelectionManager } from './SelectionManager'
import { OfflineManager } from './OfflineManager'
import type {
  BoardConfig,
  BoardError,
  Viewport,
  Layer,
  Component,
  ToolType,
  ExportFormat,
  ExportOptions,
  SyncStatus,
  RemoteCursor,
  Point,
  ToolConfig,
} from './types'
import { SYNC_DEBOUNCE_MS, CURSOR_SYNC_INTERVAL_MS } from './constants'

type BoardEvents = {
  ready: void
  error: BoardError
  'viewport-change': Viewport
  'tool-change': ToolType
  'selection-change': Component[]
  'layer-change': Layer[]
  'history-change': { canUndo: boolean; canRedo: boolean }
  'sync-status': SyncStatus
  'offline-status': boolean
  'cursor-update': RemoteCursor
  [key: string]: unknown
}

export class BoardEngine {
  private canvas: CanvasRenderer | null = null
  private infiniteCanvas: InfiniteCanvas | null = null
  private layerManager: LayerManager
  private componentManager: ComponentManager
  private toolManager: ToolManager
  private historyManager: HistoryManager
  private selectionManager: SelectionManager
  private offlineManager: OfflineManager | null = null

  private config: BoardConfig
  private container: HTMLElement | null = null
  private canvasElement: HTMLCanvasElement | null = null
  private isInitialized = false
  private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null
  private cursorSyncTimer: ReturnType<typeof setInterval> | null = null
  private animationFrameId: number | null = null
  private remoteCursors: Map<string, RemoteCursor> = new Map()

  public readonly events = new BoardEventEmitter<BoardEvents>()

  constructor(config: BoardConfig) {
    this.config = config
    this.layerManager = new LayerManager()
    this.componentManager = new ComponentManager()
    this.toolManager = new ToolManager()
    this.historyManager = new HistoryManager()
    this.selectionManager = new SelectionManager()

    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    // Layer events
    this.layerManager.events.on('layer-added', () => {
      this.events.emit('layer-change', this.layerManager.getLayers())
    })
    this.layerManager.events.on('layer-removed', () => {
      this.events.emit('layer-change', this.layerManager.getLayers())
    })
    this.layerManager.events.on('layer-updated', () => {
      this.events.emit('layer-change', this.layerManager.getLayers())
      this.requestRender()
    })
    this.layerManager.events.on('layer-reordered', () => {
      this.events.emit('layer-change', this.layerManager.getLayers())
      this.requestRender()
    })

    // Component events
    this.componentManager.events.on('component-added', () => {
      this.scheduleSyncSave()
      this.requestRender()
    })
    this.componentManager.events.on('component-updated', () => {
      this.scheduleSyncSave()
      this.requestRender()
    })
    this.componentManager.events.on('component-removed', () => {
      this.scheduleSyncSave()
      this.requestRender()
    })

    // Selection events
    this.selectionManager.events.on('selection-change', (ids) => {
      const components = ids.map((id) => this.componentManager.getComponent(id)).filter((c): c is Component => !!c)
      this.events.emit('selection-change', components)
      this.requestRender()
    })
    this.selectionManager.events.on('selection-box-change', () => {
      this.requestRender()
    })

    // Tool events
    this.toolManager.events.on('tool-change', (type) => {
      this.events.emit('tool-change', type)
      this.updateCursor()
    })

    // History events
    this.historyManager.events.on('history-change', (state) => {
      this.events.emit('history-change', state)
    })
  }

  async initialize(sessionId: string, container: HTMLElement): Promise<void> {
    if (this.isInitialized) {
      throw new Error('BoardEngine already initialized')
    }

    this.container = container
    this.config.sessionId = sessionId

    // Create canvas element
    this.canvasElement = document.createElement('canvas')
    this.canvasElement.style.width = '100%'
    this.canvasElement.style.height = '100%'
    this.canvasElement.style.display = 'block'
    container.appendChild(this.canvasElement)

    // Initialize renderer
    this.canvas = new CanvasRenderer(this.canvasElement)

    // Initialize infinite canvas
    this.infiniteCanvas = new InfiniteCanvas(container)
    this.infiniteCanvas.events.on('viewport-change', (viewport) => {
      this.events.emit('viewport-change', viewport)
      this.requestRender()
    })

    // Initialize offline manager
    this.offlineManager = new OfflineManager(sessionId)
    this.offlineManager.events.on('online-status-change', (isOnline) => {
      this.events.emit('offline-status', !isOnline)
    })

    // Setup input handlers
    this.setupInputHandlers()

    // Start cursor sync
    this.startCursorSync()

    this.isInitialized = true

    // Load session
    await this.loadSession()

    this.events.emit('ready', undefined)
  }

  private setupInputHandlers(): void {
    if (!this.canvasElement || !this.infiniteCanvas) return

    this.canvasElement.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return // Only left click
      const point = this.infiniteCanvas!.screenToCanvas(e.offsetX, e.offsetY)
      this.toolManager.handlePointerDown(e, point)
    })

    this.canvasElement.addEventListener('pointermove', (e) => {
      const point = this.infiniteCanvas!.screenToCanvas(e.offsetX, e.offsetY)
      this.toolManager.handlePointerMove(e, point)
      this.updateLocalCursor(point)
    })

    this.canvasElement.addEventListener('pointerup', (e) => {
      const point = this.infiniteCanvas!.screenToCanvas(e.offsetX, e.offsetY)
      this.toolManager.handlePointerUp(e, point)
    })

    window.addEventListener('keydown', (e) => {
      this.toolManager.handleKeyDown(e)
    })

    window.addEventListener('keyup', (e) => {
      this.toolManager.handleKeyUp(e)
    })

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (this.canvas && this.container) {
        this.canvas.resize(this.container.clientWidth, this.container.clientHeight)
        this.requestRender()
      }
    })
    resizeObserver.observe(this.container!)
  }

  async loadSession(): Promise<void> {
    // Try to load from offline storage first
    const offlineState = this.offlineManager?.loadLocalState()
    if (offlineState) {
      this.layerManager.loadLayers(offlineState.layers)
      this.componentManager.loadComponents(offlineState.components)
      return
    }

    // TODO: Load from API
    // For now, just emit ready with default state
  }

  async saveSession(): Promise<void> {
    const state = {
      sessionId: this.config.sessionId,
      layers: this.layerManager.getLayers(),
      components: this.componentManager.getComponents(),
      viewport: this.getViewport(),
      version: Date.now(),
    }

    // Save locally
    this.offlineManager?.saveLocalState(state)

    // TODO: Sync to server
    this.events.emit('sync-status', 'synced')
  }

  getViewport(): Viewport {
    return this.infiniteCanvas?.getViewport() ?? { x: 0, y: 0, zoom: 1, width: 0, height: 0 }
  }

  setViewport(viewport: Partial<Viewport>): void {
    this.infiniteCanvas?.setViewport(viewport)
  }

  getCurrentTool(): ToolType {
    return this.toolManager.getActiveToolType()
  }

  setTool(toolType: ToolType): void {
    this.toolManager.setActiveTool(toolType)
  }

  getToolConfig(): ToolConfig {
    return this.toolManager.getToolConfig(this.toolManager.getActiveToolType())
  }

  setToolConfig(config: Partial<ToolConfig>): void {
    this.toolManager.updateToolConfig(this.toolManager.getActiveToolType(), config)
  }

  getLayers(): Layer[] {
    return this.layerManager.getLayers()
  }

  getActiveLayer(): Layer | null {
    return this.layerManager.getActiveLayer()
  }

  setActiveLayer(id: number): void {
    this.layerManager.setActiveLayer(id)
  }

  createLayer(name: string): Layer {
    return this.layerManager.createLayer(name)
  }

  deleteLayer(id: number): boolean {
    return this.layerManager.deleteLayer(id)
  }

  getSelection(): Component[] {
    return this.selectionManager.getSelectedComponents(this.componentManager)
  }

  getSelectedIds(): string[] {
    return this.selectionManager.getSelectedIds()
  }

  select(id: string, addToSelection = false): void {
    this.selectionManager.select(id, addToSelection)
  }

  selectMultiple(ids: string[]): void {
    this.selectionManager.selectMultiple(ids)
  }

  clearSelection(): void {
    this.selectionManager.clearSelection()
  }

  selectAll(): void {
    this.selectionManager.selectAll(this.componentManager)
  }

  undo(): void {
    const entry = this.historyManager.undo()
    if (entry) {
      // Apply undo
      this.applyHistoryEntry(entry, true)
    }
  }

  redo(): void {
    const entry = this.historyManager.redo()
    if (entry) {
      // Apply redo
      this.applyHistoryEntry(entry, false)
    }
  }

  canUndo(): boolean {
    return this.historyManager.canUndo()
  }

  canRedo(): boolean {
    return this.historyManager.canRedo()
  }

  private applyHistoryEntry(entry: ReturnType<typeof this.historyManager.undo>, isUndo: boolean): void {
    if (!entry) return

    const state = isUndo ? entry.previousState : entry.newState

    if (entry.action === 'batch' && Array.isArray(state)) {
      // Handle batch
      for (const item of state as Array<{ action: string; componentId: string; state: unknown }>) {
        this.applyComponentState(item.componentId, item.state)
      }
    } else if (entry.componentId) {
      this.applyComponentState(entry.componentId, state)
    }

    this.requestRender()
  }

  private applyComponentState(componentId: string, state: unknown): void {
    if (state === null) {
      // Delete
      this.componentManager.deleteComponent(componentId)
    } else {
      // Update or create
      const existing = this.componentManager.getComponent(componentId)
      if (existing) {
        this.componentManager.updateComponent(componentId, state as Partial<Component>)
      }
      // TODO: Handle create case
    }
  }

  async export(format: ExportFormat, options?: ExportOptions): Promise<Blob | string> {
    if (!this.canvas) {
      throw new Error('Canvas not initialized')
    }

    switch (format) {
      case 'png':
        return this.canvas.toBlob('image/png', options?.quality ?? 1)
      case 'jpg':
        return this.canvas.toBlob('image/jpeg', options?.quality ?? 0.9)
      case 'svg':
        // TODO: Implement SVG export
        throw new Error('SVG export not implemented')
      case 'pdf':
        // TODO: Implement PDF export
        throw new Error('PDF export not implemented')
      case 'json':
        return JSON.stringify({
          layers: this.layerManager.getLayers(),
          components: this.componentManager.getComponents(),
        })
      default:
        throw new Error(`Unknown export format: ${format}`)
    }
  }

  async applyTemplate(templateSlug: string): Promise<void> {
    // TODO: Load template from API and apply
    console.log('Applying template:', templateSlug)
  }

  // Zoom controls
  zoomIn(): void {
    this.infiniteCanvas?.zoomIn()
  }

  zoomOut(): void {
    this.infiniteCanvas?.zoomOut()
  }

  zoomTo(level: number): void {
    this.infiniteCanvas?.zoom(level)
  }

  fitToContent(): void {
    this.infiniteCanvas?.fitToContent(this.componentManager.getComponents())
  }

  resetView(): void {
    this.infiniteCanvas?.resetView()
  }

  // Delete selected
  deleteSelected(): void {
    const ids = this.selectionManager.getSelectedIds()
    if (ids.length === 0) return

    // Record for history
    this.historyManager.startBatch()
    for (const id of ids) {
      const component = this.componentManager.getComponent(id)
      if (component) {
        this.historyManager.record('delete', id, component, null)
      }
    }
    this.historyManager.endBatch()

    this.componentManager.batchDelete(ids)
    this.selectionManager.clearSelection()
  }

  // Duplicate selected
  duplicateSelected(): void {
    const ids = this.selectionManager.getSelectedIds()
    if (ids.length === 0) return

    const duplicated = this.componentManager.duplicateComponents(ids)
    this.selectionManager.selectMultiple(duplicated.map((c) => c.id))
  }

  // Remote cursors
  updateRemoteCursor(cursor: RemoteCursor): void {
    this.remoteCursors.set(cursor.userId, cursor)
    this.events.emit('cursor-update', cursor)
    this.requestRender()
  }

  removeRemoteCursor(userId: string): void {
    this.remoteCursors.delete(userId)
    this.requestRender()
  }

  private updateLocalCursor(point: Point): void {
    // TODO: Send cursor position to server
  }

  private startCursorSync(): void {
    this.cursorSyncTimer = setInterval(() => {
      // Clean up stale cursors
      const now = Date.now()
      for (const [userId, cursor] of this.remoteCursors) {
        if (now - cursor.lastUpdate > 5000) {
          this.remoteCursors.delete(userId)
        }
      }
    }, CURSOR_SYNC_INTERVAL_MS)
  }

  private updateCursor(): void {
    if (this.canvasElement) {
      this.canvasElement.style.cursor = this.toolManager.getCursor()
    }
  }

  private scheduleSyncSave(): void {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer)
    }
    this.syncDebounceTimer = setTimeout(() => {
      this.saveSession()
    }, SYNC_DEBOUNCE_MS)
  }

  private requestRender(): void {
    if (this.animationFrameId !== null) return

    this.animationFrameId = requestAnimationFrame(() => {
      this.render()
      this.animationFrameId = null
    })
  }

  private render(): void {
    if (!this.canvas || !this.infiniteCanvas) return

    const viewport = this.infiniteCanvas.getViewport()
    const components = this.componentManager.getComponentsInViewport(viewport)

    this.canvas.render(components, viewport, {
      showGrid: true,
      showCursors: true,
      showSelection: true,
    })

    // Render selection
    const selectedComponents = this.selectionManager.getSelectedComponents(this.componentManager)
    if (selectedComponents.length > 0) {
      this.canvas.renderSelection(selectedComponents, viewport)
    }

    // Render remote cursors
    if (this.remoteCursors.size > 0) {
      this.canvas.renderCursors(Array.from(this.remoteCursors.values()), viewport)
    }
  }

  destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
    }
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer)
    }
    if (this.cursorSyncTimer) {
      clearInterval(this.cursorSyncTimer)
    }

    this.infiniteCanvas?.destroy()
    this.offlineManager?.destroy()
    this.toolManager.destroy()
    this.events.removeAll()

    if (this.canvasElement && this.container) {
      this.container.removeChild(this.canvasElement)
    }

    this.isInitialized = false
  }
}

export default BoardEngine
