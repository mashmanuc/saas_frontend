// EraserTool - Eraser tool

import { BaseTool } from './BaseTool'
import type { ToolType, Point, Component } from '../types'

export interface EraserToolCallbacks {
  findComponentsAtPoint: (x: number, y: number) => Component[]
  deleteComponent: (id: string) => void
}

export class EraserTool extends BaseTool {
  private callbacks: EraserToolCallbacks
  private isErasing = false
  private erasedIds: Set<string> = new Set()

  constructor(callbacks: EraserToolCallbacks) {
    super()
    this.callbacks = callbacks
  }

  get type(): ToolType {
    return 'eraser'
  }

  get cursor(): string {
    return 'crosshair'
  }

  onPointerDown(e: PointerEvent, point: Point): void {
    this.isErasing = true
    this.erasedIds.clear()
    this.eraseAt(point)
  }

  onPointerMove(e: PointerEvent, point: Point): void {
    if (!this.isErasing) return
    this.eraseAt(point)
  }

  onPointerUp(e: PointerEvent, point: Point): void {
    this.isErasing = false
    this.erasedIds.clear()
  }

  private eraseAt(point: Point): void {
    const components = this.callbacks.findComponentsAtPoint(point.x, point.y)

    for (const component of components) {
      if (!this.erasedIds.has(component.id) && !component.locked) {
        this.erasedIds.add(component.id)
        this.callbacks.deleteComponent(component.id)
      }
    }
  }

  deactivate(): void {
    super.deactivate()
    this.isErasing = false
    this.erasedIds.clear()
  }
}

export default EraserTool
