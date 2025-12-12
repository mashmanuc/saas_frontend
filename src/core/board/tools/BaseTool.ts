// TASK F10: BaseTool - Base tool class

import type { ToolType, ToolConfig, Point } from '../types'
import type { Tool } from '../ToolManager'

export abstract class BaseTool implements Tool {
  protected config: ToolConfig = {}
  protected isActive = false

  abstract get type(): ToolType
  abstract get cursor(): string

  activate(config: ToolConfig): void {
    this.config = config
    this.isActive = true
  }

  deactivate(): void {
    this.isActive = false
  }

  abstract onPointerDown(e: PointerEvent, point: Point): void
  abstract onPointerMove(e: PointerEvent, point: Point): void
  abstract onPointerUp(e: PointerEvent, point: Point): void

  onKeyDown?(e: KeyboardEvent): void
  onKeyUp?(e: KeyboardEvent): void

  protected getColor(): string {
    return this.config.color ?? '#000000'
  }

  protected getThickness(): number {
    return this.config.thickness ?? 3
  }

  protected getOpacity(): number {
    return this.config.opacity ?? 1
  }
}

export default BaseTool
