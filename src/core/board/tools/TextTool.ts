// TASK F12: TextTool - Text creation tool

import { BaseTool } from './BaseTool'
import type { ToolType, Point, TextData, ToolConfig } from '../types'
import { DEFAULT_TEXT_COLOR, DEFAULT_FONT_SIZE, DEFAULT_FONT_FAMILY } from '../constants'

export interface TextToolCallbacks {
  onTextCreate: (layerId: number, data: TextData, position: Point) => string
  onTextEdit: (id: string) => void
  onTextUpdate: (id: string, text: string) => void
  onTextEnd: (id: string) => void
  getActiveLayerId: () => number | null
  findTextAtPoint: (x: number, y: number) => string | null
}

export class TextTool extends BaseTool {
  private callbacks: TextToolCallbacks
  private editingId: string | null = null

  constructor(callbacks: TextToolCallbacks) {
    super()
    this.callbacks = callbacks
  }

  get type(): ToolType {
    return 'text'
  }

  get cursor(): string {
    return 'text'
  }

  onPointerDown(e: PointerEvent, point: Point): void {
    // Check if clicking on existing text
    const existingTextId = this.callbacks.findTextAtPoint(point.x, point.y)

    if (existingTextId) {
      // Edit existing text
      this.editingId = existingTextId
      this.callbacks.onTextEdit(existingTextId)
      return
    }

    // Create new text
    const layerId = this.callbacks.getActiveLayerId()
    if (layerId === null) return

    const textData: TextData = {
      text: '',
      fontSize: this.config.fontSize ?? DEFAULT_FONT_SIZE,
      fontFamily: this.config.fontFamily ?? DEFAULT_FONT_FAMILY,
      color: this.config.color ?? DEFAULT_TEXT_COLOR,
      align: 'left',
    }

    this.editingId = this.callbacks.onTextCreate(layerId, textData, point)
    this.callbacks.onTextEdit(this.editingId)
  }

  onPointerMove(e: PointerEvent, point: Point): void {
    // Text tool doesn't need move handling
  }

  onPointerUp(e: PointerEvent, point: Point): void {
    // Text tool doesn't need up handling
  }

  finishEditing(): void {
    if (this.editingId) {
      this.callbacks.onTextEnd(this.editingId)
      this.editingId = null
    }
  }

  updateText(text: string): void {
    if (this.editingId) {
      this.callbacks.onTextUpdate(this.editingId, text)
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

export default TextTool
