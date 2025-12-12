// PencilTool - Pencil/pen drawing tool

import { BaseTool } from './BaseTool'
import type { ToolType, Point, StrokeData } from '../types'
import { MIN_STROKE_DISTANCE, STROKE_SMOOTHING } from '../constants'

export interface PencilToolCallbacks {
  onStrokeStart: (layerId: number, data: StrokeData) => string
  onStrokeUpdate: (id: string, points: Point[]) => void
  onStrokeEnd: (id: string) => void
  getActiveLayerId: () => number | null
}

export class PencilTool extends BaseTool {
  private callbacks: PencilToolCallbacks
  private currentStrokeId: string | null = null
  private points: Point[] = []
  private isDrawing = false
  private lastPoint: Point | null = null

  constructor(callbacks: PencilToolCallbacks) {
    super()
    this.callbacks = callbacks
  }

  get type(): ToolType {
    return 'pencil'
  }

  get cursor(): string {
    return 'crosshair'
  }

  onPointerDown(e: PointerEvent, point: Point): void {
    const layerId = this.callbacks.getActiveLayerId()
    if (layerId === null) return

    this.isDrawing = true
    this.points = [point]
    this.lastPoint = point

    const strokeData: StrokeData = {
      points: [point],
      color: this.getColor(),
      thickness: this.getThickness(),
      opacity: this.getOpacity(),
      tool: 'pencil',
      smoothing: STROKE_SMOOTHING,
    }

    this.currentStrokeId = this.callbacks.onStrokeStart(layerId, strokeData)
  }

  onPointerMove(e: PointerEvent, point: Point): void {
    if (!this.isDrawing || !this.currentStrokeId || !this.lastPoint) return

    // Check minimum distance
    const dx = point.x - this.lastPoint.x
    const dy = point.y - this.lastPoint.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance < MIN_STROKE_DISTANCE) return

    this.points.push(point)
    this.lastPoint = point

    this.callbacks.onStrokeUpdate(this.currentStrokeId, [...this.points])
  }

  onPointerUp(e: PointerEvent, point: Point): void {
    if (!this.isDrawing || !this.currentStrokeId) return

    // Add final point if different
    if (this.lastPoint && (point.x !== this.lastPoint.x || point.y !== this.lastPoint.y)) {
      this.points.push(point)
      this.callbacks.onStrokeUpdate(this.currentStrokeId, [...this.points])
    }

    this.callbacks.onStrokeEnd(this.currentStrokeId)

    this.isDrawing = false
    this.currentStrokeId = null
    this.points = []
    this.lastPoint = null
  }

  deactivate(): void {
    super.deactivate()
    // Cancel any in-progress stroke
    if (this.isDrawing && this.currentStrokeId) {
      this.callbacks.onStrokeEnd(this.currentStrokeId)
    }
    this.isDrawing = false
    this.currentStrokeId = null
    this.points = []
    this.lastPoint = null
  }
}

export default PencilTool
