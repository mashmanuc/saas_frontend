// TASK F6: ToolManager - Tool system

import { BoardEventEmitter } from './eventEmitter'
import type { ToolType, ToolConfig, Point } from './types'
import { DEFAULT_TOOL_CONFIG, TOOL_CURSORS } from './constants'

type ToolEvents = {
  'tool-change': ToolType
  'config-change': { type: ToolType; config: ToolConfig }
  [key: string]: unknown
}

export interface Tool {
  readonly type: ToolType
  readonly cursor: string

  activate(config: ToolConfig): void
  deactivate(): void

  onPointerDown(e: PointerEvent, point: Point): void
  onPointerMove(e: PointerEvent, point: Point): void
  onPointerUp(e: PointerEvent, point: Point): void

  onKeyDown?(e: KeyboardEvent): void
  onKeyUp?(e: KeyboardEvent): void
}

export class ToolManager {
  private tools: Map<ToolType, Tool> = new Map()
  private activeTool: Tool | null = null
  private activeToolType: ToolType = 'pencil'
  private toolConfigs: Map<ToolType, ToolConfig> = new Map()

  public readonly events = new BoardEventEmitter<ToolEvents>()

  constructor() {
    // Initialize default configs for all tools
    const toolTypes: ToolType[] = [
      'select',
      'pan',
      'pencil',
      'marker',
      'highlighter',
      'eraser',
      'shape',
      'text',
      'image',
      'sticky',
      'connector',
      'laser',
    ]

    for (const type of toolTypes) {
      this.toolConfigs.set(type, { ...DEFAULT_TOOL_CONFIG })
    }
  }

  registerTool(type: ToolType, tool: Tool): void {
    this.tools.set(type, tool)
  }

  getActiveTool(): Tool | null {
    return this.activeTool
  }

  getActiveToolType(): ToolType {
    return this.activeToolType
  }

  setActiveTool(type: ToolType): void {
    // Deactivate current tool
    if (this.activeTool) {
      this.activeTool.deactivate()
    }

    // Activate new tool
    const tool = this.tools.get(type)
    if (tool) {
      const config = this.toolConfigs.get(type) ?? DEFAULT_TOOL_CONFIG
      tool.activate(config)
      this.activeTool = tool
    } else {
      this.activeTool = null
    }

    this.activeToolType = type
    this.events.emit('tool-change', type)
  }

  getToolConfig(type: ToolType): ToolConfig {
    return this.toolConfigs.get(type) ?? { ...DEFAULT_TOOL_CONFIG }
  }

  updateToolConfig(type: ToolType, config: Partial<ToolConfig>): void {
    const currentConfig = this.toolConfigs.get(type) ?? { ...DEFAULT_TOOL_CONFIG }
    const newConfig = { ...currentConfig, ...config }
    this.toolConfigs.set(type, newConfig)

    // If this is the active tool, update it
    if (this.activeToolType === type && this.activeTool) {
      this.activeTool.activate(newConfig)
    }

    this.events.emit('config-change', { type, config: newConfig })
  }

  getAvailableTools(): ToolType[] {
    return Array.from(this.tools.keys())
  }

  getCursor(): string {
    if (this.activeTool) {
      return this.activeTool.cursor
    }
    return TOOL_CURSORS[this.activeToolType] ?? 'default'
  }

  // Event routing
  handlePointerDown(e: PointerEvent, canvasPoint: Point): void {
    if (this.activeTool) {
      this.activeTool.onPointerDown(e, canvasPoint)
    }
  }

  handlePointerMove(e: PointerEvent, canvasPoint: Point): void {
    if (this.activeTool) {
      this.activeTool.onPointerMove(e, canvasPoint)
    }
  }

  handlePointerUp(e: PointerEvent, canvasPoint: Point): void {
    if (this.activeTool) {
      this.activeTool.onPointerUp(e, canvasPoint)
    }
  }

  handleKeyDown(e: KeyboardEvent): void {
    if (this.activeTool?.onKeyDown) {
      this.activeTool.onKeyDown(e)
    }
  }

  handleKeyUp(e: KeyboardEvent): void {
    if (this.activeTool?.onKeyUp) {
      this.activeTool.onKeyUp(e)
    }
  }

  // Quick tool switching
  setColor(color: string): void {
    this.updateToolConfig(this.activeToolType, { color })
  }

  setThickness(thickness: number): void {
    this.updateToolConfig(this.activeToolType, { thickness })
  }

  setOpacity(opacity: number): void {
    this.updateToolConfig(this.activeToolType, { opacity })
  }

  destroy(): void {
    if (this.activeTool) {
      this.activeTool.deactivate()
    }
    this.tools.clear()
    this.events.removeAll()
  }
}

export default ToolManager
