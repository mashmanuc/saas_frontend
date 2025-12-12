// SelectTool - Selection tool

import { BaseTool } from './BaseTool'
import type { ToolType, Point, Component, Bounds } from '../types'

export interface SelectToolCallbacks {
  findComponentsAtPoint: (x: number, y: number) => Component[]
  select: (id: string, addToSelection: boolean) => void
  clearSelection: () => void
  getSelectedIds: () => string[]
  startSelectionBox: (point: Point) => void
  updateSelectionBox: (point: Point) => void
  endSelectionBox: () => string[]
  moveSelected: (dx: number, dy: number) => void
  getSelectionBounds: () => Bounds | null
}

export class SelectTool extends BaseTool {
  private callbacks: SelectToolCallbacks
  private isDragging = false
  private isSelectionBox = false
  private startPoint: Point | null = null
  private lastPoint: Point | null = null
  private clickedOnSelected = false

  constructor(callbacks: SelectToolCallbacks) {
    super()
    this.callbacks = callbacks
  }

  get type(): ToolType {
    return 'select'
  }

  get cursor(): string {
    return 'default'
  }

  onPointerDown(e: PointerEvent, point: Point): void {
    this.startPoint = point
    this.lastPoint = point

    const components = this.callbacks.findComponentsAtPoint(point.x, point.y)
    const selectedIds = this.callbacks.getSelectedIds()

    if (components.length > 0) {
      const topComponent = components[0]
      const isAlreadySelected = selectedIds.includes(topComponent.id)

      if (e.shiftKey) {
        // Add to selection
        this.callbacks.select(topComponent.id, true)
      } else if (!isAlreadySelected) {
        // Select new component
        this.callbacks.select(topComponent.id, false)
      }

      this.clickedOnSelected = selectedIds.includes(topComponent.id) || !e.shiftKey
      this.isDragging = true
    } else {
      // Start selection box
      if (!e.shiftKey) {
        this.callbacks.clearSelection()
      }
      this.isSelectionBox = true
      this.callbacks.startSelectionBox(point)
    }
  }

  onPointerMove(e: PointerEvent, point: Point): void {
    if (this.isDragging && this.lastPoint && this.clickedOnSelected) {
      const dx = point.x - this.lastPoint.x
      const dy = point.y - this.lastPoint.y

      if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
        this.callbacks.moveSelected(dx, dy)
      }

      this.lastPoint = point
    } else if (this.isSelectionBox) {
      this.callbacks.updateSelectionBox(point)
    }
  }

  onPointerUp(e: PointerEvent, point: Point): void {
    if (this.isSelectionBox) {
      this.callbacks.endSelectionBox()
    }

    this.isDragging = false
    this.isSelectionBox = false
    this.startPoint = null
    this.lastPoint = null
    this.clickedOnSelected = false
  }

  onKeyDown(e: KeyboardEvent): void {
    const selectedIds = this.callbacks.getSelectedIds()
    if (selectedIds.length === 0) return

    const moveAmount = e.shiftKey ? 10 : 1

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        this.callbacks.moveSelected(0, -moveAmount)
        break
      case 'ArrowDown':
        e.preventDefault()
        this.callbacks.moveSelected(0, moveAmount)
        break
      case 'ArrowLeft':
        e.preventDefault()
        this.callbacks.moveSelected(-moveAmount, 0)
        break
      case 'ArrowRight':
        e.preventDefault()
        this.callbacks.moveSelected(moveAmount, 0)
        break
    }
  }

  deactivate(): void {
    super.deactivate()
    this.isDragging = false
    this.isSelectionBox = false
    this.startPoint = null
    this.lastPoint = null
    this.clickedOnSelected = false
  }
}

export default SelectTool
