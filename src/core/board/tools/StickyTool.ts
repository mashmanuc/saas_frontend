// TASK F14: StickyTool - Sticky note creation tool

import { BaseTool } from './BaseTool'
import type { ToolType, Point, StickyData, ToolConfig } from '../types'
import { STICKY_COLORS } from '../constants'

export interface StickyToolCallbacks {
  onStickyCreate: (layerId: number, data: StickyData, position: Point) => string
  onStickyEdit: (id: string) => void
  onStickyUpdate: (id: string, text: string) => void
  onStickyEnd: (id: string) => void
  getActiveLayerId: () => number | null
  findStickyAtPoint: (x: number, y: number) => string | null
}

export class StickyTool extends BaseTool {
  private callbacks: StickyToolCallbacks
  private editingId: string | null = null
  private colorIndex = 0

  constructor(callbacks: StickyToolCallbacks) {
    super()
    this.callbacks = callbacks
  }

  get type(): ToolType {
    return 'sticky'
  }

  get cursor(): string {
    return 'crosshair'
  }

  activate(config: ToolConfig): void {
    super.activate(config)
    if (config.stickyColor) {
      const index = STICKY_COLORS.indexOf(config.stickyColor)
      if (index >= 0) {
        this.colorIndex = index
      }
    }
  }

  setColor(color: string): void {
    const index = STICKY_COLORS.indexOf(color)
    if (index >= 0) {
      this.colorIndex = index
    }
  }

  cycleColor(): string {
    this.colorIndex = (this.colorIndex + 1) % STICKY_COLORS.length
    return STICKY_COLORS[this.colorIndex]
  }

  onPointerDown(e: PointerEvent, point: Point): void {
    // Check if clicking on existing sticky
    const existingStickyId = this.callbacks.findStickyAtPoint(point.x, point.y)

    if (existingStickyId) {
      // Edit existing sticky
      this.editingId = existingStickyId
      this.callbacks.onStickyEdit(existingStickyId)
      return
    }

    // Create new sticky
    const layerId = this.callbacks.getActiveLayerId()
    if (layerId === null) return

    const stickyData: StickyData = {
      text: '',
      color: this.config.stickyColor ?? STICKY_COLORS[this.colorIndex],
      fontSize: 14,
    }

    this.editingId = this.callbacks.onStickyCreate(layerId, stickyData, point)
    this.callbacks.onStickyEdit(this.editingId)
  }

  onPointerMove(e: PointerEvent, point: Point): void {
    // Sticky tool doesn't need move handling
  }

  onPointerUp(e: PointerEvent, point: Point): void {
    // Sticky tool doesn't need up handling
  }

  finishEditing(): void {
    if (this.editingId) {
      this.callbacks.onStickyEnd(this.editingId)
      this.editingId = null
    }
  }

  updateText(text: string): void {
    if (this.editingId) {
      this.callbacks.onStickyUpdate(this.editingId, text)
    }
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.finishEditing()
    }
  }

  deactivate(): void {
    super.deactivate()
    this.finishEditing()
  }
}

export default StickyTool
