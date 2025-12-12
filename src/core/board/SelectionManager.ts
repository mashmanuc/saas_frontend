// TASK F8: SelectionManager - Selection management

import { BoardEventEmitter } from './eventEmitter'
import type { Bounds, Point, Component } from './types'
import type { ComponentManager } from './ComponentManager'

type SelectionEvents = {
  'selection-change': string[]
  'selection-box-change': Bounds | null
  [key: string]: unknown
}

export class SelectionManager {
  private selectedIds: Set<string> = new Set()
  private selectionBox: Bounds | null = null
  private selectionBoxStart: Point | null = null

  public readonly events = new BoardEventEmitter<SelectionEvents>()

  constructor() {}

  getSelectedIds(): string[] {
    return Array.from(this.selectedIds)
  }

  getSelectedComponents(componentManager: ComponentManager): Component[] {
    return this.getSelectedIds()
      .map((id) => componentManager.getComponent(id))
      .filter((c): c is Component => c !== undefined)
  }

  select(id: string, addToSelection = false): void {
    if (!addToSelection) {
      this.selectedIds.clear()
    }
    this.selectedIds.add(id)
    this.events.emit('selection-change', this.getSelectedIds())
  }

  selectMultiple(ids: string[]): void {
    this.selectedIds.clear()
    for (const id of ids) {
      this.selectedIds.add(id)
    }
    this.events.emit('selection-change', this.getSelectedIds())
  }

  selectAllInLayer(layerId: number, componentManager: ComponentManager): void {
    const components = componentManager.getComponentsInLayer(layerId)
    this.selectMultiple(components.filter((c) => !c.locked).map((c) => c.id))
  }

  selectAll(componentManager: ComponentManager): void {
    const components = componentManager.getComponents()
    this.selectMultiple(components.filter((c) => !c.locked && c.visible).map((c) => c.id))
  }

  deselect(id: string): void {
    this.selectedIds.delete(id)
    this.events.emit('selection-change', this.getSelectedIds())
  }

  clearSelection(): void {
    if (this.selectedIds.size === 0) return
    this.selectedIds.clear()
    this.events.emit('selection-change', [])
  }

  toggleSelection(id: string): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id)
    } else {
      this.selectedIds.add(id)
    }
    this.events.emit('selection-change', this.getSelectedIds())
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id)
  }

  hasSelection(): boolean {
    return this.selectedIds.size > 0
  }

  getSelectionCount(): number {
    return this.selectedIds.size
  }

  getSelectionBounds(componentManager: ComponentManager): Bounds | null {
    const ids = this.getSelectedIds()
    if (ids.length === 0) return null

    return componentManager.getSelectionBounds(ids)
  }

  startSelectionBox(point: Point): void {
    this.selectionBoxStart = point
    this.selectionBox = {
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    }
    this.events.emit('selection-box-change', this.selectionBox)
  }

  updateSelectionBox(point: Point): void {
    if (!this.selectionBoxStart) return

    const x = Math.min(this.selectionBoxStart.x, point.x)
    const y = Math.min(this.selectionBoxStart.y, point.y)
    const width = Math.abs(point.x - this.selectionBoxStart.x)
    const height = Math.abs(point.y - this.selectionBoxStart.y)

    this.selectionBox = { x, y, width, height }
    this.events.emit('selection-box-change', this.selectionBox)
  }

  endSelectionBox(componentManager: ComponentManager): string[] {
    if (!this.selectionBox) return []

    const components = componentManager.findComponentsInRect(this.selectionBox)
    const ids = components.filter((c) => !c.locked).map((c) => c.id)

    this.selectionBox = null
    this.selectionBoxStart = null
    this.events.emit('selection-box-change', null)

    if (ids.length > 0) {
      this.selectMultiple(ids)
    }

    return ids
  }

  cancelSelectionBox(): void {
    this.selectionBox = null
    this.selectionBoxStart = null
    this.events.emit('selection-box-change', null)
  }

  getSelectionBox(): Bounds | null {
    return this.selectionBox
  }

  // Utility methods for selection manipulation
  invertSelection(componentManager: ComponentManager): void {
    const allComponents = componentManager.getComponents()
    const newSelection: string[] = []

    for (const comp of allComponents) {
      if (!comp.locked && comp.visible && !this.selectedIds.has(comp.id)) {
        newSelection.push(comp.id)
      }
    }

    this.selectMultiple(newSelection)
  }

  expandSelection(componentManager: ComponentManager, layerId?: number): void {
    // Expand selection to include all components in the same layer(s)
    const currentSelection = this.getSelectedComponents(componentManager)
    const layerIds = new Set(currentSelection.map((c) => c.layerId))

    if (layerId !== undefined) {
      layerIds.add(layerId)
    }

    const newSelection: string[] = []
    for (const lid of layerIds) {
      const components = componentManager.getComponentsInLayer(lid)
      for (const comp of components) {
        if (!comp.locked && comp.visible) {
          newSelection.push(comp.id)
        }
      }
    }

    this.selectMultiple(newSelection)
  }
}

export default SelectionManager
