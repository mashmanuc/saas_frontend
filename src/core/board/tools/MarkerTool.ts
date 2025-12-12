// MarkerTool - Marker/highlighter drawing tool

import { BaseTool } from './BaseTool'
import type { ToolType, Point, StrokeData } from '../types'
import { MIN_STROKE_DISTANCE } from '../constants'

export interface MarkerToolCallbacks {
  onStrokeStart: (layerId: number, data: StrokeData) => string
  onStrokeUpdate: (id: string, points: Point[]) => void
  onStrokeEnd: (id: string) => void
  getActiveLayerId: () => number | null
}

export class MarkerTool extends BaseTool {
  private callbacks: MarkerToolCallbacks
  private currentStrokeId: string | null = null
  private points: Point[] = []
  private isDrawing = false
  private lastPoint: Point | null = null
  private toolVariant: 'marker' | 'highlighter'

  constructor(callbacks: MarkerToolCallbacks, variant: 'marker' | 'highlighter' = 'marker') {
    super()
    this.callbacks = callbacks
    this.toolVariant = variant
  }

  get type(): ToolType {
    return this.toolVariant
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
      thickness: this.toolVariant === 'highlighter' ? this.getThickness() * 3 : this.getThickness() * 1.5,
      opacity: this.toolVariant === 'highlighter' ? 0.4 : this.getOpacity(),
      tool: this.toolVariant,
    }

    this.currentStrokeId = this.callbacks.onStrokeStart(layerId, strokeData)
  }

  onPointerMove(e: PointerEvent, point: Point): void {
    if (!this.isDrawing || !this.currentStrokeId || !this.lastPoint) return

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
    if (this.isDrawing && this.currentStrokeId) {
      this.callbacks.onStrokeEnd(this.currentStrokeId)
    }
    this.isDrawing = false
    this.currentStrokeId = null
    this.points = []
    this.lastPoint = null
  }
}

export default MarkerTool
