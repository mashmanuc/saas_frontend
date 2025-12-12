// TASK F11: ShapeTool - Shape drawing tool

import { BaseTool } from './BaseTool'
import type { ToolType, Point, ShapeType, ShapeData, ToolConfig } from '../types'
import { DEFAULT_SHAPE_FILL, DEFAULT_SHAPE_STROKE, DEFAULT_SHAPE_STROKE_WIDTH } from '../constants'

export interface ShapeToolCallbacks {
  onShapeStart: (layerId: number, data: ShapeData, position: Point, size: { width: number; height: number }) => string
  onShapeUpdate: (id: string, position: Point, size: { width: number; height: number }) => void
  onShapeEnd: (id: string) => void
  getActiveLayerId: () => number | null
}

export class ShapeTool extends BaseTool {
  private callbacks: ShapeToolCallbacks
  private shapeType: ShapeType = 'rectangle'
  private startPoint: Point | null = null
  private currentShapeId: string | null = null
  private isDrawing = false
  private shiftPressed = false

  constructor(callbacks: ShapeToolCallbacks) {
    super()
    this.callbacks = callbacks
  }

  get type(): ToolType {
    return 'shape'
  }

  get cursor(): string {
    return 'crosshair'
  }

  activate(config: ToolConfig): void {
    super.activate(config)
    if (config.shapeType) {
      this.shapeType = config.shapeType
    }
  }

  setShapeType(type: ShapeType): void {
    this.shapeType = type
  }

  onPointerDown(e: PointerEvent, point: Point): void {
    const layerId = this.callbacks.getActiveLayerId()
    if (layerId === null) return

    this.isDrawing = true
    this.startPoint = point

    const shapeData: ShapeData = {
      shapeType: this.shapeType,
      fill: this.config.color ?? DEFAULT_SHAPE_FILL,
      stroke: DEFAULT_SHAPE_STROKE,
      strokeWidth: DEFAULT_SHAPE_STROKE_WIDTH,
      opacity: this.getOpacity(),
    }

    this.currentShapeId = this.callbacks.onShapeStart(layerId, shapeData, point, { width: 0, height: 0 })
  }

  onPointerMove(e: PointerEvent, point: Point): void {
    if (!this.isDrawing || !this.startPoint || !this.currentShapeId) return

    let width = point.x - this.startPoint.x
    let height = point.y - this.startPoint.y

    // Shift for square/circle
    if (this.shiftPressed) {
      const size = Math.max(Math.abs(width), Math.abs(height))
      width = width < 0 ? -size : size
      height = height < 0 ? -size : size
    }

    const position = {
      x: width < 0 ? this.startPoint.x + width : this.startPoint.x,
      y: height < 0 ? this.startPoint.y + height : this.startPoint.y,
    }

    this.callbacks.onShapeUpdate(this.currentShapeId, position, {
      width: Math.abs(width),
      height: Math.abs(height),
    })
  }

  onPointerUp(e: PointerEvent, point: Point): void {
    if (!this.isDrawing || !this.currentShapeId) return

    this.callbacks.onShapeEnd(this.currentShapeId)

    this.isDrawing = false
    this.startPoint = null
    this.currentShapeId = null
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Shift') {
      this.shiftPressed = true
    }
  }

  onKeyUp(e: KeyboardEvent): void {
    if (e.key === 'Shift') {
      this.shiftPressed = false
    }
  }

  deactivate(): void {
    super.deactivate()
    if (this.isDrawing && this.currentShapeId) {
      this.callbacks.onShapeEnd(this.currentShapeId)
    }
    this.isDrawing = false
    this.startPoint = null
    this.currentShapeId = null
    this.shiftPressed = false
  }
}

export default ShapeTool
