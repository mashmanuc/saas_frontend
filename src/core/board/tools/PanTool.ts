// PanTool - Pan/hand tool

import { BaseTool } from './BaseTool'
import type { ToolType, Point } from '../types'

export interface PanToolCallbacks {
  pan: (dx: number, dy: number) => void
}

export class PanTool extends BaseTool {
  private callbacks: PanToolCallbacks
  private isPanning = false
  private lastPoint: Point | null = null

  constructor(callbacks: PanToolCallbacks) {
    super()
    this.callbacks = callbacks
  }

  get type(): ToolType {
    return 'pan'
  }

  get cursor(): string {
    return this.isPanning ? 'grabbing' : 'grab'
  }

  onPointerDown(e: PointerEvent, point: Point): void {
    this.isPanning = true
    this.lastPoint = { x: e.clientX, y: e.clientY }
  }

  onPointerMove(e: PointerEvent, point: Point): void {
    if (!this.isPanning || !this.lastPoint) return

    const dx = e.clientX - this.lastPoint.x
    const dy = e.clientY - this.lastPoint.y

    this.callbacks.pan(-dx, -dy)

    this.lastPoint = { x: e.clientX, y: e.clientY }
  }

  onPointerUp(e: PointerEvent, point: Point): void {
    this.isPanning = false
    this.lastPoint = null
  }

  deactivate(): void {
    super.deactivate()
    this.isPanning = false
    this.lastPoint = null
  }
}

export default PanTool
