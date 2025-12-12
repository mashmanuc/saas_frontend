// TASK F2: CanvasRenderer - Canvas rendering

import type {
  Component,
  Viewport,
  RenderOptions,
  GridConfig,
  RemoteCursor,
  StrokeData,
  ShapeData,
  TextData,
  StickyData,
  ConnectorData,
  Point,
} from './types'
import {
  CANVAS_BACKGROUND,
  SELECTION_COLOR,
  SELECTION_FILL,
  SELECTION_HANDLE_SIZE,
  SELECTION_PADDING,
} from './constants'

export class CanvasRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private offscreenCanvas: OffscreenCanvas | null = null
  private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null
  private dpr: number
  private imageCache: Map<string, HTMLImageElement> = new Map()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get 2D context')
    this.ctx = ctx

    this.dpr = window.devicePixelRatio || 1
    this.setupCanvas()
    this.setupOffscreen()
  }

  private setupCanvas(): void {
    const rect = this.canvas.getBoundingClientRect()
    this.canvas.width = rect.width * this.dpr
    this.canvas.height = rect.height * this.dpr
    this.ctx.scale(this.dpr, this.dpr)
  }

  private setupOffscreen(): void {
    if (typeof OffscreenCanvas !== 'undefined') {
      this.offscreenCanvas = new OffscreenCanvas(this.canvas.width, this.canvas.height)
      this.offscreenCtx = this.offscreenCanvas.getContext('2d')
    }
  }

  resize(width: number, height: number): void {
    this.canvas.width = width * this.dpr
    this.canvas.height = height * this.dpr
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.ctx.scale(this.dpr, this.dpr)

    if (this.offscreenCanvas) {
      this.offscreenCanvas.width = width * this.dpr
      this.offscreenCanvas.height = height * this.dpr
    }
  }

  render(components: Component[], viewport: Viewport, options?: RenderOptions): void {
    this.clear()

    this.ctx.save()
    this.ctx.translate(-viewport.x * viewport.zoom, -viewport.y * viewport.zoom)
    this.ctx.scale(viewport.zoom, viewport.zoom)

    // Render grid
    if (options?.showGrid) {
      this.renderGrid(viewport, { enabled: true, size: 20, color: '#e0e0e0', opacity: 0.5, snap: false })
    }

    // Render components by layer order
    const sortedComponents = [...components].sort((a, b) => {
      if (a.layerId !== b.layerId) return a.layerId - b.layerId
      return 0
    })

    for (const component of sortedComponents) {
      if (!component.visible) continue
      this.renderComponent(component, viewport)
    }

    this.ctx.restore()
  }

  renderComponent(component: Component, viewport: Viewport): void {
    if (!this.isComponentVisible(component, viewport)) return

    this.ctx.save()
    this.ctx.translate(component.x, component.y)
    this.ctx.rotate((component.rotation * Math.PI) / 180)
    this.ctx.scale(component.scaleX, component.scaleY)

    switch (component.type) {
      case 'stroke':
        this.renderStroke(component.data as StrokeData)
        break
      case 'shape':
        this.renderShape(component, component.data as ShapeData)
        break
      case 'text':
        this.renderText(component, component.data as TextData)
        break
      case 'image':
        this.renderImage(component)
        break
      case 'sticky':
        this.renderSticky(component, component.data as StickyData)
        break
      case 'connector':
        this.renderConnector(component.data as ConnectorData)
        break
    }

    this.ctx.restore()
  }

  private renderStroke(data: StrokeData): void {
    if (data.points.length < 2) return

    this.ctx.beginPath()
    this.ctx.strokeStyle = data.color
    this.ctx.lineWidth = data.thickness
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.ctx.globalAlpha = data.opacity

    if (data.tool === 'highlighter') {
      this.ctx.globalCompositeOperation = 'multiply'
    }

    this.ctx.moveTo(data.points[0].x, data.points[0].y)
    for (let i = 1; i < data.points.length; i++) {
      const p0 = data.points[i - 1]
      const p1 = data.points[i]
      const midX = (p0.x + p1.x) / 2
      const midY = (p0.y + p1.y) / 2
      this.ctx.quadraticCurveTo(p0.x, p0.y, midX, midY)
    }
    this.ctx.lineTo(data.points[data.points.length - 1].x, data.points[data.points.length - 1].y)
    this.ctx.stroke()

    this.ctx.globalAlpha = 1
    this.ctx.globalCompositeOperation = 'source-over'
  }

  private renderShape(component: Component, data: ShapeData): void {
    const width = component.width ?? 100
    const height = component.height ?? 100

    this.ctx.beginPath()
    if (data.fill) {
      this.ctx.fillStyle = data.fill
    }
    if (data.stroke) {
      this.ctx.strokeStyle = data.stroke
      this.ctx.lineWidth = data.strokeWidth ?? 2
    }
    this.ctx.globalAlpha = data.opacity ?? 1

    switch (data.shapeType) {
      case 'rectangle':
        if (data.cornerRadius) {
          this.roundRect(0, 0, width, height, data.cornerRadius)
        } else {
          this.ctx.rect(0, 0, width, height)
        }
        break
      case 'ellipse':
        this.ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2)
        break
      case 'triangle':
        this.ctx.moveTo(width / 2, 0)
        this.ctx.lineTo(width, height)
        this.ctx.lineTo(0, height)
        this.ctx.closePath()
        break
      case 'line':
        this.ctx.moveTo(0, 0)
        this.ctx.lineTo(width, height)
        break
      case 'arrow':
        this.drawArrow(0, 0, width, height)
        break
      case 'star':
        this.drawStar(width / 2, height / 2, 5, width / 2, width / 4)
        break
      case 'polygon':
        this.drawPolygon(width / 2, height / 2, Math.min(width, height) / 2, data.sides ?? 6)
        break
    }

    if (data.fill && data.shapeType !== 'line') {
      this.ctx.fill()
    }
    if (data.stroke) {
      this.ctx.stroke()
    }

    this.ctx.globalAlpha = 1
  }

  private renderText(component: Component, data: TextData): void {
    this.ctx.font = `${data.fontStyle ?? 'normal'} ${data.fontWeight ?? 400} ${data.fontSize}px ${data.fontFamily}`
    this.ctx.fillStyle = data.color
    this.ctx.textAlign = data.align ?? 'left'
    this.ctx.textBaseline = 'top'

    const lines = data.text.split('\n')
    const lineHeight = data.lineHeight ?? data.fontSize * 1.2

    lines.forEach((line, i) => {
      this.ctx.fillText(line, 0, i * lineHeight)
    })
  }

  private renderImage(component: Component): void {
    const src = (component.data as { src: string }).src
    let img = this.imageCache.get(src)

    if (!img) {
      img = new Image()
      img.src = src
      img.onload = () => {
        this.imageCache.set(src, img!)
      }
      return
    }

    if (img.complete) {
      this.ctx.drawImage(img, 0, 0, component.width ?? img.width, component.height ?? img.height)
    }
  }

  private renderSticky(component: Component, data: StickyData): void {
    const width = component.width ?? 200
    const height = component.height ?? 200

    // Background
    this.ctx.fillStyle = data.color
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
    this.ctx.shadowBlur = 10
    this.ctx.shadowOffsetY = 5
    this.roundRect(0, 0, width, height, 4)
    this.ctx.fill()
    this.ctx.shadowColor = 'transparent'

    // Text
    this.ctx.fillStyle = '#333333'
    this.ctx.font = `${data.fontSize ?? 14}px Inter, sans-serif`
    this.ctx.textAlign = 'left'
    this.ctx.textBaseline = 'top'

    const padding = 12
    const maxWidth = width - padding * 2
    this.wrapText(data.text, padding, padding, maxWidth, (data.fontSize ?? 14) * 1.4)
  }

  private renderConnector(data: ConnectorData): void {
    this.ctx.beginPath()
    this.ctx.strokeStyle = data.color
    this.ctx.lineWidth = data.thickness

    const start = data.startPoint
    const end = data.endPoint

    if (data.pathType === 'straight') {
      this.ctx.moveTo(start.x, start.y)
      this.ctx.lineTo(end.x, end.y)
    } else if (data.pathType === 'curved') {
      const midX = (start.x + end.x) / 2
      const midY = (start.y + end.y) / 2
      const cpX = midX
      const cpY = start.y
      this.ctx.moveTo(start.x, start.y)
      this.ctx.quadraticCurveTo(cpX, cpY, end.x, end.y)
    } else {
      // Orthogonal
      const midX = (start.x + end.x) / 2
      this.ctx.moveTo(start.x, start.y)
      this.ctx.lineTo(midX, start.y)
      this.ctx.lineTo(midX, end.y)
      this.ctx.lineTo(end.x, end.y)
    }

    this.ctx.stroke()

    // Arrows
    if (data.endArrow) {
      this.drawArrowHead(end.x, end.y, Math.atan2(end.y - start.y, end.x - start.x))
    }
    if (data.startArrow) {
      this.drawArrowHead(start.x, start.y, Math.atan2(start.y - end.y, start.x - end.x))
    }
  }

  renderSelection(components: Component[], viewport: Viewport): void {
    if (components.length === 0) return

    this.ctx.save()
    this.ctx.translate(-viewport.x * viewport.zoom, -viewport.y * viewport.zoom)
    this.ctx.scale(viewport.zoom, viewport.zoom)

    // Calculate bounds
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const comp of components) {
      minX = Math.min(minX, comp.x)
      minY = Math.min(minY, comp.y)
      maxX = Math.max(maxX, comp.x + (comp.width ?? 0))
      maxY = Math.max(maxY, comp.y + (comp.height ?? 0))
    }

    const padding = SELECTION_PADDING / viewport.zoom
    const handleSize = SELECTION_HANDLE_SIZE / viewport.zoom

    // Selection box
    this.ctx.strokeStyle = SELECTION_COLOR
    this.ctx.fillStyle = SELECTION_FILL
    this.ctx.lineWidth = 1 / viewport.zoom
    this.ctx.setLineDash([5 / viewport.zoom, 5 / viewport.zoom])

    this.ctx.fillRect(minX - padding, minY - padding, maxX - minX + padding * 2, maxY - minY + padding * 2)
    this.ctx.strokeRect(minX - padding, minY - padding, maxX - minX + padding * 2, maxY - minY + padding * 2)

    this.ctx.setLineDash([])

    // Handles
    this.ctx.fillStyle = '#ffffff'
    const handles = [
      { x: minX - padding, y: minY - padding },
      { x: maxX + padding, y: minY - padding },
      { x: maxX + padding, y: maxY + padding },
      { x: minX - padding, y: maxY + padding },
      { x: (minX + maxX) / 2, y: minY - padding },
      { x: (minX + maxX) / 2, y: maxY + padding },
      { x: minX - padding, y: (minY + maxY) / 2 },
      { x: maxX + padding, y: (minY + maxY) / 2 },
    ]

    for (const handle of handles) {
      this.ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
      this.ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
    }

    this.ctx.restore()
  }

  renderGrid(viewport: Viewport, gridConfig: GridConfig): void {
    if (!gridConfig.enabled) return

    const bounds = {
      x: viewport.x,
      y: viewport.y,
      width: viewport.width / viewport.zoom,
      height: viewport.height / viewport.zoom,
    }

    const gridSize = gridConfig.size
    const startX = Math.floor(bounds.x / gridSize) * gridSize
    const startY = Math.floor(bounds.y / gridSize) * gridSize
    const endX = bounds.x + bounds.width
    const endY = bounds.y + bounds.height

    this.ctx.strokeStyle = gridConfig.color
    this.ctx.globalAlpha = gridConfig.opacity
    this.ctx.lineWidth = 1 / viewport.zoom

    this.ctx.beginPath()
    for (let x = startX; x <= endX; x += gridSize) {
      this.ctx.moveTo(x, bounds.y)
      this.ctx.lineTo(x, bounds.y + bounds.height)
    }
    for (let y = startY; y <= endY; y += gridSize) {
      this.ctx.moveTo(bounds.x, y)
      this.ctx.lineTo(bounds.x + bounds.width, y)
    }
    this.ctx.stroke()

    this.ctx.globalAlpha = 1
  }

  renderCursors(cursors: RemoteCursor[], viewport: Viewport): void {
    this.ctx.save()
    this.ctx.translate(-viewport.x * viewport.zoom, -viewport.y * viewport.zoom)
    this.ctx.scale(viewport.zoom, viewport.zoom)

    for (const cursor of cursors) {
      this.ctx.save()
      this.ctx.translate(cursor.x, cursor.y)

      // Cursor arrow
      this.ctx.fillStyle = cursor.color
      this.ctx.beginPath()
      this.ctx.moveTo(0, 0)
      this.ctx.lineTo(0, 16)
      this.ctx.lineTo(4, 12)
      this.ctx.lineTo(8, 20)
      this.ctx.lineTo(10, 19)
      this.ctx.lineTo(6, 11)
      this.ctx.lineTo(11, 11)
      this.ctx.closePath()
      this.ctx.fill()

      // Name label
      this.ctx.fillStyle = cursor.color
      this.ctx.font = '12px Inter, sans-serif'
      const textWidth = this.ctx.measureText(cursor.userName).width
      this.roundRect(12, 14, textWidth + 8, 18, 4)
      this.ctx.fill()

      this.ctx.fillStyle = '#ffffff'
      this.ctx.fillText(cursor.userName, 16, 28)

      this.ctx.restore()
    }

    this.ctx.restore()
  }

  clear(): void {
    this.ctx.fillStyle = CANVAS_BACKGROUND
    this.ctx.fillRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr)
  }

  toDataURL(format = 'image/png', quality = 1): string {
    return this.canvas.toDataURL(format, quality)
  }

  async toBlob(format = 'image/png', quality = 1): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to create blob'))
        },
        format,
        quality
      )
    })
  }

  private isComponentVisible(component: Component, viewport: Viewport): boolean {
    const bounds = {
      x: viewport.x,
      y: viewport.y,
      width: viewport.width / viewport.zoom,
      height: viewport.height / viewport.zoom,
    }

    const compRight = component.x + (component.width ?? 0)
    const compBottom = component.y + (component.height ?? 0)

    return !(
      compRight < bounds.x ||
      component.x > bounds.x + bounds.width ||
      compBottom < bounds.y ||
      component.y > bounds.y + bounds.height
    )
  }

  private roundRect(x: number, y: number, width: number, height: number, radius: number): void {
    this.ctx.beginPath()
    this.ctx.moveTo(x + radius, y)
    this.ctx.lineTo(x + width - radius, y)
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    this.ctx.lineTo(x + width, y + height - radius)
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    this.ctx.lineTo(x + radius, y + height)
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    this.ctx.lineTo(x, y + radius)
    this.ctx.quadraticCurveTo(x, y, x + radius, y)
    this.ctx.closePath()
  }

  private drawArrow(x1: number, y1: number, x2: number, y2: number): void {
    this.ctx.moveTo(x1, y1)
    this.ctx.lineTo(x2, y2)
    this.drawArrowHead(x2, y2, Math.atan2(y2 - y1, x2 - x1))
  }

  private drawArrowHead(x: number, y: number, angle: number): void {
    const size = 10
    this.ctx.save()
    this.ctx.translate(x, y)
    this.ctx.rotate(angle)
    this.ctx.beginPath()
    this.ctx.moveTo(0, 0)
    this.ctx.lineTo(-size, -size / 2)
    this.ctx.lineTo(-size, size / 2)
    this.ctx.closePath()
    this.ctx.fill()
    this.ctx.restore()
  }

  private drawStar(cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number): void {
    let rot = (Math.PI / 2) * 3
    const step = Math.PI / spikes

    this.ctx.moveTo(cx, cy - outerRadius)
    for (let i = 0; i < spikes; i++) {
      let x = cx + Math.cos(rot) * outerRadius
      let y = cy + Math.sin(rot) * outerRadius
      this.ctx.lineTo(x, y)
      rot += step

      x = cx + Math.cos(rot) * innerRadius
      y = cy + Math.sin(rot) * innerRadius
      this.ctx.lineTo(x, y)
      rot += step
    }
    this.ctx.lineTo(cx, cy - outerRadius)
    this.ctx.closePath()
  }

  private drawPolygon(cx: number, cy: number, radius: number, sides: number): void {
    const angle = (Math.PI * 2) / sides
    this.ctx.moveTo(cx + radius * Math.cos(0), cy + radius * Math.sin(0))
    for (let i = 1; i <= sides; i++) {
      this.ctx.lineTo(cx + radius * Math.cos(angle * i), cy + radius * Math.sin(angle * i))
    }
    this.ctx.closePath()
  }

  private wrapText(text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
    const words = text.split(' ')
    let line = ''
    let currentY = y

    for (const word of words) {
      const testLine = line + word + ' '
      const metrics = this.ctx.measureText(testLine)
      if (metrics.width > maxWidth && line !== '') {
        this.ctx.fillText(line, x, currentY)
        line = word + ' '
        currentY += lineHeight
      } else {
        line = testLine
      }
    }
    this.ctx.fillText(line, x, currentY)
  }
}

export default CanvasRenderer
