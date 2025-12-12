// TASK F5: ComponentManager - Component CRUD operations

import { BoardEventEmitter } from './eventEmitter'
import type {
  Component,
  ComponentType,
  ComponentData,
  Point,
  Bounds,
  Viewport,
  Transform,
  CreateComponentData,
  UpdateComponentData,
} from './types'

type ComponentEvents = {
  'component-added': Component
  'component-updated': Component
  'component-removed': string
  'components-batch-added': Component[]
  'components-batch-removed': string[]
  [key: string]: unknown
}

export class ComponentManager {
  private components: Map<string, Component> = new Map()
  private componentsByLayer: Map<number, Set<string>> = new Map()

  public readonly events = new BoardEventEmitter<ComponentEvents>()

  constructor() {}

  loadComponents(components: Array<Component & { data: ComponentData }>): void {
    this.components.clear()
    this.componentsByLayer.clear()

    for (const comp of components) {
      this.components.set(comp.id, comp)
      this.addToLayerIndex(comp.id, comp.layerId)
    }
  }

  getComponents(): Component[] {
    return Array.from(this.components.values())
  }

  getComponent(id: string): Component | undefined {
    return this.components.get(id)
  }

  getComponentsInLayer(layerId: number): Component[] {
    const ids = this.componentsByLayer.get(layerId)
    if (!ids) return []
    return Array.from(ids)
      .map((id) => this.components.get(id))
      .filter((c): c is Component => c !== undefined)
  }

  getComponentsInViewport(viewport: Viewport, buffer = 100): Component[] {
    const bounds: Bounds = {
      x: viewport.x - buffer,
      y: viewport.y - buffer,
      width: viewport.width / viewport.zoom + buffer * 2,
      height: viewport.height / viewport.zoom + buffer * 2,
    }

    return this.getComponents().filter((comp) => {
      if (!comp.visible) return false
      return this.boundsIntersect(this.getComponentBounds(comp.id), bounds)
    })
  }

  createComponent(type: ComponentType, layerId: number, position: Point, data: ComponentData): Component {
    const id = this.generateId()

    const component: Component = {
      id,
      type,
      layerId,
      x: position.x,
      y: position.y,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      data,
      locked: false,
      visible: true,
      version: 1,
    }

    // Calculate dimensions based on type
    if (type === 'shape' || type === 'sticky' || type === 'image' || type === 'text') {
      component.width = 100
      component.height = 100
    }

    this.components.set(id, component)
    this.addToLayerIndex(id, layerId)

    this.events.emit('component-added', component)
    return component
  }

  updateComponent(id: string, updates: Partial<Component>): Component | null {
    const component = this.components.get(id)
    if (!component) return null

    // Handle layer change
    if (updates.layerId !== undefined && updates.layerId !== component.layerId) {
      this.removeFromLayerIndex(id, component.layerId)
      this.addToLayerIndex(id, updates.layerId)
    }

    Object.assign(component, updates)
    component.version++

    this.events.emit('component-updated', component)
    return component
  }

  moveComponent(id: string, x: number, y: number): Component | null {
    return this.updateComponent(id, { x, y })
  }

  transformComponent(id: string, transform: Transform): Component | null {
    const updates: Partial<Component> = {}
    if (transform.x !== undefined) updates.x = transform.x
    if (transform.y !== undefined) updates.y = transform.y
    if (transform.rotation !== undefined) updates.rotation = transform.rotation
    if (transform.scaleX !== undefined) updates.scaleX = transform.scaleX
    if (transform.scaleY !== undefined) updates.scaleY = transform.scaleY

    return this.updateComponent(id, updates)
  }

  deleteComponent(id: string): boolean {
    const component = this.components.get(id)
    if (!component) return false

    this.removeFromLayerIndex(id, component.layerId)
    this.components.delete(id)

    this.events.emit('component-removed', id)
    return true
  }

  batchCreate(items: CreateComponentData[]): Component[] {
    const created: Component[] = []

    for (const item of items) {
      const component = this.createComponentInternal(item.type, item.layerId, item.position, item.data)
      created.push(component)
    }

    this.events.emit('components-batch-added', created)
    return created
  }

  batchUpdate(updates: UpdateComponentData[]): Component[] {
    const updated: Component[] = []

    for (const item of updates) {
      const component = this.components.get(item.id)
      if (!component) continue

      Object.assign(component, item.updates)
      component.version++
      updated.push(component)
    }

    for (const comp of updated) {
      this.events.emit('component-updated', comp)
    }

    return updated
  }

  batchDelete(ids: string[]): number {
    const deleted: string[] = []

    for (const id of ids) {
      const component = this.components.get(id)
      if (!component) continue

      this.removeFromLayerIndex(id, component.layerId)
      this.components.delete(id)
      deleted.push(id)
    }

    if (deleted.length > 0) {
      this.events.emit('components-batch-removed', deleted)
    }

    return deleted.length
  }

  moveToLayer(ids: string[], layerId: number): Component[] {
    const moved: Component[] = []

    for (const id of ids) {
      const component = this.components.get(id)
      if (!component) continue

      this.removeFromLayerIndex(id, component.layerId)
      component.layerId = layerId
      this.addToLayerIndex(id, layerId)
      component.version++
      moved.push(component)
    }

    for (const comp of moved) {
      this.events.emit('component-updated', comp)
    }

    return moved
  }

  getComponentBounds(id: string): Bounds {
    const component = this.components.get(id)
    if (!component) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    return {
      x: component.x,
      y: component.y,
      width: component.width ?? 0,
      height: component.height ?? 0,
    }
  }

  getSelectionBounds(ids: string[]): Bounds {
    if (ids.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const id of ids) {
      const bounds = this.getComponentBounds(id)
      minX = Math.min(minX, bounds.x)
      minY = Math.min(minY, bounds.y)
      maxX = Math.max(maxX, bounds.x + bounds.width)
      maxY = Math.max(maxY, bounds.y + bounds.height)
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }

  findComponentsAtPoint(x: number, y: number): Component[] {
    const result: Component[] = []

    for (const component of this.components.values()) {
      if (!component.visible) continue

      const bounds = this.getComponentBounds(component.id)
      if (x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height) {
        result.push(component)
      }
    }

    // Return in reverse order (top-most first)
    return result.reverse()
  }

  findComponentsInRect(rect: Bounds): Component[] {
    const result: Component[] = []

    for (const component of this.components.values()) {
      if (!component.visible) continue

      const bounds = this.getComponentBounds(component.id)
      if (this.boundsIntersect(bounds, rect)) {
        result.push(component)
      }
    }

    return result
  }

  duplicateComponents(ids: string[]): Component[] {
    const duplicated: Component[] = []
    const offset = 20

    for (const id of ids) {
      const original = this.components.get(id)
      if (!original) continue

      const newComponent = this.createComponent(
        original.type,
        original.layerId,
        { x: original.x + offset, y: original.y + offset },
        JSON.parse(JSON.stringify(original.data))
      )

      newComponent.width = original.width
      newComponent.height = original.height
      newComponent.rotation = original.rotation
      newComponent.scaleX = original.scaleX
      newComponent.scaleY = original.scaleY

      duplicated.push(newComponent)
    }

    return duplicated
  }

  clear(): void {
    this.components.clear()
    this.componentsByLayer.clear()
  }

  private createComponentInternal(
    type: ComponentType,
    layerId: number,
    position: Point,
    data: ComponentData
  ): Component {
    const id = this.generateId()

    const component: Component = {
      id,
      type,
      layerId,
      x: position.x,
      y: position.y,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      data,
      locked: false,
      visible: true,
      version: 1,
    }

    this.components.set(id, component)
    this.addToLayerIndex(id, layerId)

    return component
  }

  private addToLayerIndex(componentId: string, layerId: number): void {
    if (!this.componentsByLayer.has(layerId)) {
      this.componentsByLayer.set(layerId, new Set())
    }
    this.componentsByLayer.get(layerId)!.add(componentId)
  }

  private removeFromLayerIndex(componentId: string, layerId: number): void {
    const layerComponents = this.componentsByLayer.get(layerId)
    if (layerComponents) {
      layerComponents.delete(componentId)
    }
  }

  private boundsIntersect(a: Bounds, b: Bounds): boolean {
    return !(a.x + a.width < b.x || a.x > b.x + b.width || a.y + a.height < b.y || a.y > b.y + b.height)
  }

  private generateId(): string {
    return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export default ComponentManager
