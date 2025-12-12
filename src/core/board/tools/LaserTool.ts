// LaserTool - Laser pointer tool

import { BaseTool } from './BaseTool'
import type { ToolType, Point } from '../types'

export interface LaserToolCallbacks {
  onLaserMove: (point: Point) => void
  onLaserStart: () => void
  onLaserEnd: () => void
}

export class LaserTool extends BaseTool {
  private callbacks: LaserToolCallbacks
  private isLaserActive = false

  constructor(callbacks: LaserToolCallbacks) {
    super()
    this.callbacks = callbacks
  }

  get type(): ToolType {
    return 'laser'
  }

  get cursor(): string {
    return 'crosshair'
  }

  onPointerDown(e: PointerEvent, point: Point): void {
    this.isLaserActive = true
    this.callbacks.onLaserStart()
    this.callbacks.onLaserMove(point)
  }

  onPointerMove(e: PointerEvent, point: Point): void {
    if (!this.isLaserActive) return
    this.callbacks.onLaserMove(point)
  }

  onPointerUp(e: PointerEvent, point: Point): void {
    if (!this.isLaserActive) return
    this.isLaserActive = false
    this.callbacks.onLaserEnd()
  }

  deactivate(): void {
    super.deactivate()
    if (this.isLaserActive) {
      this.callbacks.onLaserEnd()
    }
    this.isLaserActive = false
  }
}

export default LaserTool
