import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock canvas context
const mockContext = {
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  rect: vi.fn(),
  ellipse: vi.fn(),
  closePath: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 100 })),
  setLineDash: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  putImageData: vi.fn(),
}

// Mock HTMLCanvasElement
vi.stubGlobal('HTMLCanvasElement', class {
  getContext() {
    return mockContext
  }
  toDataURL() {
    return 'data:image/png;base64,test'
  }
  toBlob(callback) {
    callback(new Blob(['test'], { type: 'image/png' }))
  }
})

// Mock OffscreenCanvas
vi.stubGlobal('OffscreenCanvas', class {
  constructor(width, height) {
    this.width = width
    this.height = height
  }
  getContext() {
    return mockContext
  }
})

// Mock ResizeObserver
vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
})

describe('Board Core Engine', () => {
  describe('LayerManager', () => {
    it('creates default layer on init', async () => {
      const { LayerManager } = await import('../../src/core/board/LayerManager')
      const manager = new LayerManager()
      
      const layers = manager.getLayers()
      expect(layers.length).toBe(1)
      expect(layers[0].name).toBe('Layer 1')
    })

    it('creates new layer', async () => {
      const { LayerManager } = await import('../../src/core/board/LayerManager')
      const manager = new LayerManager()
      
      const layer = manager.createLayer('Test Layer')
      expect(layer.name).toBe('Test Layer')
      expect(manager.getLayers().length).toBe(2)
    })

    it('deletes layer', async () => {
      const { LayerManager } = await import('../../src/core/board/LayerManager')
      const manager = new LayerManager()
      
      const layer = manager.createLayer('Test Layer')
      const deleted = manager.deleteLayer(layer.id)
      
      expect(deleted).toBe(true)
      expect(manager.getLayers().length).toBe(1)
    })

    it('prevents deleting last layer', async () => {
      const { LayerManager } = await import('../../src/core/board/LayerManager')
      const manager = new LayerManager()
      
      const layers = manager.getLayers()
      const deleted = manager.deleteLayer(layers[0].id)
      
      expect(deleted).toBe(false)
      expect(manager.getLayers().length).toBe(1)
    })

    it('toggles visibility', async () => {
      const { LayerManager } = await import('../../src/core/board/LayerManager')
      const manager = new LayerManager()
      
      const layers = manager.getLayers()
      const visible = manager.toggleVisibility(layers[0].id)
      
      expect(visible).toBe(false)
      expect(manager.getLayer(layers[0].id)?.visible).toBe(false)
    })

    it('toggles lock', async () => {
      const { LayerManager } = await import('../../src/core/board/LayerManager')
      const manager = new LayerManager()
      
      const layers = manager.getLayers()
      const locked = manager.toggleLock(layers[0].id)
      
      expect(locked).toBe(true)
      expect(manager.getLayer(layers[0].id)?.locked).toBe(true)
    })
  })

  describe('ComponentManager', () => {
    it('creates component', async () => {
      const { ComponentManager } = await import('../../src/core/board/ComponentManager')
      const manager = new ComponentManager()
      
      const component = manager.createComponent('stroke', 1, { x: 0, y: 0 }, {
        points: [{ x: 0, y: 0 }],
        color: '#000',
        thickness: 3,
        opacity: 1,
        tool: 'pencil',
      })
      
      expect(component.type).toBe('stroke')
      expect(component.layerId).toBe(1)
      expect(manager.getComponents().length).toBe(1)
    })

    it('updates component', async () => {
      const { ComponentManager } = await import('../../src/core/board/ComponentManager')
      const manager = new ComponentManager()
      
      const component = manager.createComponent('shape', 1, { x: 0, y: 0 }, {
        shapeType: 'rectangle',
        fill: '#fff',
      })
      
      const updated = manager.updateComponent(component.id, { x: 100, y: 100 })
      
      expect(updated?.x).toBe(100)
      expect(updated?.y).toBe(100)
    })

    it('deletes component', async () => {
      const { ComponentManager } = await import('../../src/core/board/ComponentManager')
      const manager = new ComponentManager()
      
      const component = manager.createComponent('text', 1, { x: 0, y: 0 }, {
        text: 'Hello',
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000',
      })
      
      const deleted = manager.deleteComponent(component.id)
      
      expect(deleted).toBe(true)
      expect(manager.getComponents().length).toBe(0)
    })

    it('finds components at point', async () => {
      const { ComponentManager } = await import('../../src/core/board/ComponentManager')
      const manager = new ComponentManager()
      
      manager.createComponent('shape', 1, { x: 0, y: 0 }, {
        shapeType: 'rectangle',
        fill: '#fff',
      })
      
      const component = manager.getComponent(manager.getComponents()[0].id)
      component.width = 100
      component.height = 100
      
      const found = manager.findComponentsAtPoint(50, 50)
      expect(found.length).toBe(1)
    })

    it('batch creates components', async () => {
      const { ComponentManager } = await import('../../src/core/board/ComponentManager')
      const manager = new ComponentManager()
      
      const created = manager.batchCreate([
        { type: 'shape', layerId: 1, position: { x: 0, y: 0 }, data: { shapeType: 'rectangle' } },
        { type: 'shape', layerId: 1, position: { x: 100, y: 0 }, data: { shapeType: 'ellipse' } },
      ])
      
      expect(created.length).toBe(2)
      expect(manager.getComponents().length).toBe(2)
    })
  })

  describe('HistoryManager', () => {
    it('records actions', async () => {
      const { HistoryManager } = await import('../../src/core/board/HistoryManager')
      const manager = new HistoryManager()
      
      manager.record('create', 'comp1', null, { x: 0, y: 0 })
      
      expect(manager.canUndo()).toBe(true)
      expect(manager.canRedo()).toBe(false)
    })

    it('undoes action', async () => {
      const { HistoryManager } = await import('../../src/core/board/HistoryManager')
      const manager = new HistoryManager()
      
      manager.record('create', 'comp1', null, { x: 0, y: 0 })
      const entry = manager.undo()
      
      expect(entry).not.toBeNull()
      expect(entry?.action).toBe('create')
      expect(manager.canUndo()).toBe(false)
      expect(manager.canRedo()).toBe(true)
    })

    it('redoes action', async () => {
      const { HistoryManager } = await import('../../src/core/board/HistoryManager')
      const manager = new HistoryManager()
      
      manager.record('create', 'comp1', null, { x: 0, y: 0 })
      manager.undo()
      const entry = manager.redo()
      
      expect(entry).not.toBeNull()
      expect(manager.canUndo()).toBe(true)
      expect(manager.canRedo()).toBe(false)
    })

    it('handles batch operations', async () => {
      const { HistoryManager } = await import('../../src/core/board/HistoryManager')
      const manager = new HistoryManager()
      
      manager.startBatch()
      manager.record('create', 'comp1', null, { x: 0, y: 0 })
      manager.record('create', 'comp2', null, { x: 100, y: 0 })
      manager.endBatch()
      
      expect(manager.getUndoStack().length).toBe(1)
      expect(manager.getUndoStack()[0].action).toBe('batch')
    })

    it('clears redo stack on new action', async () => {
      const { HistoryManager } = await import('../../src/core/board/HistoryManager')
      const manager = new HistoryManager()
      
      manager.record('create', 'comp1', null, { x: 0, y: 0 })
      manager.undo()
      manager.record('create', 'comp2', null, { x: 100, y: 0 })
      
      expect(manager.canRedo()).toBe(false)
    })
  })

  describe('SelectionManager', () => {
    it('selects component', async () => {
      const { SelectionManager } = await import('../../src/core/board/SelectionManager')
      const manager = new SelectionManager()
      
      manager.select('comp1')
      
      expect(manager.isSelected('comp1')).toBe(true)
      expect(manager.hasSelection()).toBe(true)
    })

    it('clears selection', async () => {
      const { SelectionManager } = await import('../../src/core/board/SelectionManager')
      const manager = new SelectionManager()
      
      manager.select('comp1')
      manager.clearSelection()
      
      expect(manager.hasSelection()).toBe(false)
    })

    it('toggles selection', async () => {
      const { SelectionManager } = await import('../../src/core/board/SelectionManager')
      const manager = new SelectionManager()
      
      manager.toggleSelection('comp1')
      expect(manager.isSelected('comp1')).toBe(true)
      
      manager.toggleSelection('comp1')
      expect(manager.isSelected('comp1')).toBe(false)
    })

    it('selects multiple', async () => {
      const { SelectionManager } = await import('../../src/core/board/SelectionManager')
      const manager = new SelectionManager()
      
      manager.selectMultiple(['comp1', 'comp2', 'comp3'])
      
      expect(manager.getSelectedIds().length).toBe(3)
    })

    it('adds to selection', async () => {
      const { SelectionManager } = await import('../../src/core/board/SelectionManager')
      const manager = new SelectionManager()
      
      manager.select('comp1')
      manager.select('comp2', true)
      
      expect(manager.getSelectedIds().length).toBe(2)
    })
  })

  describe('InfiniteCanvas', () => {
    it('initializes with default viewport', async () => {
      const { InfiniteCanvas } = await import('../../src/core/board/InfiniteCanvas')
      
      const container = document.createElement('div')
      container.style.width = '800px'
      container.style.height = '600px'
      Object.defineProperty(container, 'clientWidth', { value: 800 })
      Object.defineProperty(container, 'clientHeight', { value: 600 })
      
      const canvas = new InfiniteCanvas(container)
      const viewport = canvas.getViewport()
      
      expect(viewport.zoom).toBe(1)
      expect(viewport.x).toBe(0)
      expect(viewport.y).toBe(0)
    })

    it('zooms in', async () => {
      const { InfiniteCanvas } = await import('../../src/core/board/InfiniteCanvas')
      
      const container = document.createElement('div')
      Object.defineProperty(container, 'clientWidth', { value: 800 })
      Object.defineProperty(container, 'clientHeight', { value: 600 })
      
      const canvas = new InfiniteCanvas(container)
      canvas.zoomIn()
      
      expect(canvas.getViewport().zoom).toBeGreaterThan(1)
    })

    it('zooms out', async () => {
      const { InfiniteCanvas } = await import('../../src/core/board/InfiniteCanvas')
      
      const container = document.createElement('div')
      Object.defineProperty(container, 'clientWidth', { value: 800 })
      Object.defineProperty(container, 'clientHeight', { value: 600 })
      
      const canvas = new InfiniteCanvas(container)
      canvas.zoomOut()
      
      expect(canvas.getViewport().zoom).toBeLessThan(1)
    })

    it('pans', async () => {
      const { InfiniteCanvas } = await import('../../src/core/board/InfiniteCanvas')
      
      const container = document.createElement('div')
      Object.defineProperty(container, 'clientWidth', { value: 800 })
      Object.defineProperty(container, 'clientHeight', { value: 600 })
      
      const canvas = new InfiniteCanvas(container)
      canvas.pan(100, 50)
      
      const viewport = canvas.getViewport()
      expect(viewport.x).toBe(100)
      expect(viewport.y).toBe(50)
    })

    it('converts screen to canvas coordinates', async () => {
      const { InfiniteCanvas } = await import('../../src/core/board/InfiniteCanvas')
      
      const container = document.createElement('div')
      Object.defineProperty(container, 'clientWidth', { value: 800 })
      Object.defineProperty(container, 'clientHeight', { value: 600 })
      
      const canvas = new InfiniteCanvas(container)
      canvas.setViewport({ x: 100, y: 50, zoom: 2 })
      
      const point = canvas.screenToCanvas(200, 100)
      expect(point.x).toBe(200)
      expect(point.y).toBe(100)
    })

    it('resets view', async () => {
      const { InfiniteCanvas } = await import('../../src/core/board/InfiniteCanvas')
      
      const container = document.createElement('div')
      Object.defineProperty(container, 'clientWidth', { value: 800 })
      Object.defineProperty(container, 'clientHeight', { value: 600 })
      
      const canvas = new InfiniteCanvas(container)
      canvas.setViewport({ x: 100, y: 50, zoom: 2 })
      canvas.resetView()
      
      const viewport = canvas.getViewport()
      expect(viewport.x).toBe(0)
      expect(viewport.y).toBe(0)
      expect(viewport.zoom).toBe(1)
    })
  })

  describe('ToolManager', () => {
    it('sets active tool', async () => {
      const { ToolManager } = await import('../../src/core/board/ToolManager')
      const manager = new ToolManager()
      
      manager.setActiveTool('pencil')
      expect(manager.getActiveToolType()).toBe('pencil')
    })

    it('updates tool config', async () => {
      const { ToolManager } = await import('../../src/core/board/ToolManager')
      const manager = new ToolManager()
      
      manager.updateToolConfig('pencil', { color: '#ff0000', thickness: 5 })
      const config = manager.getToolConfig('pencil')
      
      expect(config.color).toBe('#ff0000')
      expect(config.thickness).toBe(5)
    })

    it('sets color shortcut', async () => {
      const { ToolManager } = await import('../../src/core/board/ToolManager')
      const manager = new ToolManager()
      
      manager.setActiveTool('pencil')
      manager.setColor('#00ff00')
      
      const config = manager.getToolConfig('pencil')
      expect(config.color).toBe('#00ff00')
    })

    it('sets thickness shortcut', async () => {
      const { ToolManager } = await import('../../src/core/board/ToolManager')
      const manager = new ToolManager()
      
      manager.setActiveTool('pencil')
      manager.setThickness(10)
      
      const config = manager.getToolConfig('pencil')
      expect(config.thickness).toBe(10)
    })
  })

  describe('OfflineManager', () => {
    it('queues operations', async () => {
      const { OfflineManager } = await import('../../src/core/board/OfflineManager')
      const manager = new OfflineManager('test-session')
      
      manager.queueOperation({ type: 'create', componentId: 'comp1', data: {} })
      
      expect(manager.getPendingCount()).toBe(1)
    })

    it('clears queue', async () => {
      const { OfflineManager } = await import('../../src/core/board/OfflineManager')
      const manager = new OfflineManager('test-session')
      
      manager.queueOperation({ type: 'create', componentId: 'comp1', data: {} })
      manager.clearQueue()
      
      expect(manager.getPendingCount()).toBe(0)
    })

    it('detects online status', async () => {
      const { OfflineManager } = await import('../../src/core/board/OfflineManager')
      const manager = new OfflineManager('test-session')
      
      expect(manager.isOnlineStatus()).toBe(true)
      
      manager.setOnlineStatus(false)
      expect(manager.isOnlineStatus()).toBe(false)
    })
  })
})
