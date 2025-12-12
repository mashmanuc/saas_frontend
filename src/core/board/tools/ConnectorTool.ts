// TASK F15: ConnectorTool - Connector/arrow tool

import { BaseTool } from './BaseTool'
import type { ToolType, Point, ConnectorData, ToolConfig, Component } from '../types'

export interface ConnectorToolCallbacks {
  onConnectorStart: (layerId: number, data: ConnectorData) => string
  onConnectorUpdate: (id: string, endPoint: Point, endComponentId?: string) => void
  onConnectorEnd: (id: string) => void
  getActiveLayerId: () => number | null
  findComponentAtPoint: (x: number, y: number) => Component | null
}

export class ConnectorTool extends BaseTool {
  private callbacks: ConnectorToolCallbacks
  private currentConnectorId: string | null = null
  private startPoint: Point | null = null
  private startComponentId: string | null = null
  private isDrawing = false
  private pathType: 'straight' | 'curved' | 'orthogonal' = 'straight'

  constructor(callbacks: ConnectorToolCallbacks) {
    super()
    this.callbacks = callbacks
  }

  get type(): ToolType {
    return 'connector'
  }

  get cursor(): string {
    return 'crosshair'
  }

  activate(config: ToolConfig): void {
    super.activate(config)
    if (config.connectorType) {
      this.pathType = config.connectorType
    }
  }

  setPathType(type: 'straight' | 'curved' | 'orthogonal'): void {
    this.pathType = type
  }

  onPointerDown(e: PointerEvent, point: Point): void {
    const layerId = this.callbacks.getActiveLayerId()
    if (layerId === null) return

    this.isDrawing = true
    this.startPoint = point

    // Check if starting from a component
    const startComponent = this.callbacks.findComponentAtPoint(point.x, point.y)
    this.startComponentId = startComponent?.id ?? null

    const connectorData: ConnectorData = {
      startComponentId: this.startComponentId ?? undefined,
      startPoint: point,
      endPoint: point,
      pathType: this.pathType,
      startArrow: false,
      endArrow: true,
      color: this.getColor(),
      thickness: this.getThickness(),
    }

    this.currentConnectorId = this.callbacks.onConnectorStart(layerId, connectorData)
  }

  onPointerMove(e: PointerEvent, point: Point): void {
    if (!this.isDrawing || !this.currentConnectorId) return

    // Check if hovering over a component
    const endComponent = this.callbacks.findComponentAtPoint(point.x, point.y)
    const endComponentId = endComponent?.id !== this.startComponentId ? endComponent?.id : undefined

    this.callbacks.onConnectorUpdate(this.currentConnectorId, point, endComponentId)
  }

  onPointerUp(e: PointerEvent, point: Point): void {
    if (!this.isDrawing || !this.currentConnectorId) return

    // Final update with end component
    const endComponent = this.callbacks.findComponentAtPoint(point.x, point.y)
    const endComponentId = endComponent?.id !== this.startComponentId ? endComponent?.id : undefined

    this.callbacks.onConnectorUpdate(this.currentConnectorId, point, endComponentId)
    this.callbacks.onConnectorEnd(this.currentConnectorId)

    this.isDrawing = false
    this.startPoint = null
    this.startComponentId = null
    this.currentConnectorId = null
  }

  onKeyDown(e: KeyboardEvent): void {
    // Cycle through path types with Tab
    if (e.key === 'Tab' && this.isDrawing) {
      e.preventDefault()
      const types: Array<'straight' | 'curved' | 'orthogonal'> = ['straight', 'curved', 'orthogonal']
      const currentIndex = types.indexOf(this.pathType)
      this.pathType = types[(currentIndex + 1) % types.length]
    }
  }

  deactivate(): void {
    super.deactivate()
    if (this.isDrawing && this.currentConnectorId) {
      this.callbacks.onConnectorEnd(this.currentConnectorId)
    }
    this.isDrawing = false
    this.startPoint = null
    this.startComponentId = null
    this.currentConnectorId = null
  }
}

export default ConnectorTool
