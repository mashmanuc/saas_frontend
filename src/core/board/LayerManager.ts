// TASK F4: LayerManager - Layer management

import { BoardEventEmitter } from './eventEmitter'
import type { Layer, LayerData, LayerType } from './types'
import { MAX_LAYERS, DEFAULT_LAYER_OPACITY } from './constants'

type LayerEvents = {
  'layer-added': Layer
  'layer-removed': number
  'layer-updated': Layer
  'layer-reordered': Layer[]
  'active-layer-change': number | null
  [key: string]: unknown
}

export class LayerManager {
  private layers: Map<number, Layer> = new Map()
  private activeLayerId: number | null = null
  private nextId = 1

  public readonly events = new BoardEventEmitter<LayerEvents>()

  constructor() {
    // Create default layer
    this.createLayer('Layer 1', 'content')
  }

  loadLayers(layers: LayerData[]): void {
    this.layers.clear()
    for (const data of layers) {
      const layer: Layer = {
        ...data,
        componentCount: 0,
      }
      this.layers.set(layer.id, layer)
      if (layer.id >= this.nextId) {
        this.nextId = layer.id + 1
      }
    }

    if (layers.length > 0 && this.activeLayerId === null) {
      this.activeLayerId = layers[0].id
      this.events.emit('active-layer-change', this.activeLayerId)
    }
  }

  getLayers(): Layer[] {
    return Array.from(this.layers.values()).sort((a, b) => a.order - b.order)
  }

  getLayer(id: number): Layer | undefined {
    return this.layers.get(id)
  }

  getActiveLayer(): Layer | null {
    if (this.activeLayerId === null) return null
    return this.layers.get(this.activeLayerId) ?? null
  }

  getActiveLayerId(): number | null {
    return this.activeLayerId
  }

  setActiveLayer(id: number): void {
    if (!this.layers.has(id)) return
    this.activeLayerId = id
    this.events.emit('active-layer-change', id)
  }

  createLayer(name: string, type: LayerType = 'content'): Layer {
    if (this.layers.size >= MAX_LAYERS) {
      throw new Error(`Maximum number of layers (${MAX_LAYERS}) reached`)
    }

    const id = this.nextId++
    const order = this.layers.size

    const layer: Layer = {
      id,
      name,
      type,
      order,
      visible: true,
      locked: false,
      opacity: DEFAULT_LAYER_OPACITY,
      componentCount: 0,
    }

    this.layers.set(id, layer)

    if (this.activeLayerId === null) {
      this.activeLayerId = id
      this.events.emit('active-layer-change', id)
    }

    this.events.emit('layer-added', layer)
    return layer
  }

  deleteLayer(id: number): boolean {
    if (!this.layers.has(id)) return false
    if (this.layers.size <= 1) return false // Keep at least one layer

    const layer = this.layers.get(id)!
    this.layers.delete(id)

    // Reorder remaining layers
    const remaining = this.getLayers()
    remaining.forEach((l, i) => {
      l.order = i
    })

    // Update active layer if needed
    if (this.activeLayerId === id) {
      this.activeLayerId = remaining.length > 0 ? remaining[0].id : null
      this.events.emit('active-layer-change', this.activeLayerId)
    }

    this.events.emit('layer-removed', id)
    this.events.emit('layer-reordered', this.getLayers())
    return true
  }

  renameLayer(id: number, name: string): void {
    const layer = this.layers.get(id)
    if (!layer) return

    layer.name = name
    this.events.emit('layer-updated', layer)
  }

  reorderLayers(order: number[]): void {
    order.forEach((id, index) => {
      const layer = this.layers.get(id)
      if (layer) {
        layer.order = index
      }
    })
    this.events.emit('layer-reordered', this.getLayers())
  }

  moveLayerUp(id: number): void {
    const layers = this.getLayers()
    const index = layers.findIndex((l) => l.id === id)
    if (index <= 0) return

    // Swap orders
    const current = layers[index]
    const above = layers[index - 1]
    const tempOrder = current.order
    current.order = above.order
    above.order = tempOrder

    this.events.emit('layer-reordered', this.getLayers())
  }

  moveLayerDown(id: number): void {
    const layers = this.getLayers()
    const index = layers.findIndex((l) => l.id === id)
    if (index < 0 || index >= layers.length - 1) return

    // Swap orders
    const current = layers[index]
    const below = layers[index + 1]
    const tempOrder = current.order
    current.order = below.order
    below.order = tempOrder

    this.events.emit('layer-reordered', this.getLayers())
  }

  toggleVisibility(id: number): boolean {
    const layer = this.layers.get(id)
    if (!layer) return false

    layer.visible = !layer.visible
    this.events.emit('layer-updated', layer)
    return layer.visible
  }

  toggleLock(id: number): boolean {
    const layer = this.layers.get(id)
    if (!layer) return false

    layer.locked = !layer.locked
    this.events.emit('layer-updated', layer)
    return layer.locked
  }

  setOpacity(id: number, opacity: number): void {
    const layer = this.layers.get(id)
    if (!layer) return

    layer.opacity = Math.max(0, Math.min(1, opacity))
    this.events.emit('layer-updated', layer)
  }

  setColor(id: number, color: string): void {
    const layer = this.layers.get(id)
    if (!layer) return

    layer.color = color
    this.events.emit('layer-updated', layer)
  }

  mergeLayers(sourceId: number, targetId: number): Layer | null {
    const source = this.layers.get(sourceId)
    const target = this.layers.get(targetId)
    if (!source || !target) return null

    // Merge component counts
    target.componentCount += source.componentCount

    // Delete source layer
    this.deleteLayer(sourceId)

    this.events.emit('layer-updated', target)
    return target
  }

  duplicateLayer(id: number): Layer | null {
    const original = this.layers.get(id)
    if (!original) return null

    const newLayer = this.createLayer(`${original.name} (copy)`, original.type)
    newLayer.visible = original.visible
    newLayer.opacity = original.opacity
    newLayer.color = original.color

    this.events.emit('layer-updated', newLayer)
    return newLayer
  }

  getVisibleLayers(): Layer[] {
    return this.getLayers().filter((l) => l.visible)
  }

  getUnlockedLayers(): Layer[] {
    return this.getLayers().filter((l) => !l.locked)
  }

  updateComponentCount(id: number, delta: number): void {
    const layer = this.layers.get(id)
    if (!layer) return

    layer.componentCount = Math.max(0, layer.componentCount + delta)
  }

  clear(): void {
    this.layers.clear()
    this.activeLayerId = null
    this.nextId = 1
    this.createLayer('Layer 1', 'content')
  }
}

export default LayerManager
