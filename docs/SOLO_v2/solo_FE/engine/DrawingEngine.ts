import type { Point, Stroke, Shape, TextElement, Tool, PageState } from '../types/solo'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export class DrawingEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private offscreenCanvas: HTMLCanvasElement
  private offscreenCtx: CanvasRenderingContext2D

  private currentStroke: Stroke | null = null
  private currentShape: Shape | null = null
  private isDrawing = false
  private startPoint: Point | null = null

  private tool: Tool = 'pen'
  private color = '#000000'
  private size = 2

  private zoom = 1
  private pan: Point = { x: 0, y: 0 }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Cannot get 2d context')
    this.ctx = ctx

    this.offscreenCanvas = document.createElement('canvas')
    this.offscreenCanvas.width = canvas.width
    this.offscreenCanvas.height = canvas.height
    const offCtx = this.offscreenCanvas.getContext('2d')
    if (!offCtx) throw new Error('Cannot get offscreen 2d context')
    this.offscreenCtx = offCtx
  }

  setTool(tool: Tool): void {
    this.tool = tool
  }

  setColor(color: string): void {
    this.color = color
  }

  setSize(size: number): void {
    this.size = size
  }

  setZoom(zoom: number): void {
    this.zoom = Math.max(0.1, Math.min(5, zoom))
  }

  setPan(pan: Point): void {
    this.pan = pan
  }

  resize(width: number, height: number): void {
    this.canvas.width = width
    this.canvas.height = height
    this.offscreenCanvas.width = width
    this.offscreenCanvas.height = height
  }

  private toCanvasCoords(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left) / this.zoom - this.pan.x,
      y: (clientY - rect.top) / this.zoom - this.pan.y,
    }
  }

  startStroke(clientX: number, clientY: number): Stroke | null {
    if (!['pen', 'highlighter', 'eraser'].includes(this.tool)) return null

    const point = this.toCanvasCoords(clientX, clientY)
    this.isDrawing = true

    const opacity = this.tool === 'highlighter' ? 0.4 : 1
    const composite: GlobalCompositeOperation =
      this.tool === 'eraser' ? 'destination-out' : 'source-over'

    this.currentStroke = {
      id: generateId(),
      tool: this.tool as Stroke['tool'],
      color: this.tool === 'eraser' ? '#000000' : this.color,
      size: this.tool === 'eraser' ? this.size * 3 : this.size,
      opacity,
      points: [point],
      composite,
    }

    return this.currentStroke
  }

  continueStroke(clientX: number, clientY: number): void {
    if (!this.isDrawing || !this.currentStroke) return

    const point = this.toCanvasCoords(clientX, clientY)
    this.currentStroke.points.push(point)

    this.drawStrokeSegment(
      this.currentStroke,
      this.currentStroke.points.length - 2,
      this.currentStroke.points.length - 1
    )
  }

  endStroke(): Stroke | null {
    if (!this.isDrawing || !this.currentStroke) return null

    this.isDrawing = false
    const stroke = this.currentStroke
    this.currentStroke = null
    return stroke
  }

  startShape(clientX: number, clientY: number): Shape | null {
    if (!['line', 'rectangle', 'circle'].includes(this.tool)) return null

    const point = this.toCanvasCoords(clientX, clientY)
    this.isDrawing = true
    this.startPoint = point

    this.currentShape = {
      id: generateId(),
      type: this.tool as Shape['type'],
      color: this.color,
      size: this.size,
      startX: point.x,
      startY: point.y,
      endX: point.x,
      endY: point.y,
    }

    return this.currentShape
  }

  continueShape(clientX: number, clientY: number): void {
    if (!this.isDrawing || !this.currentShape) return

    const point = this.toCanvasCoords(clientX, clientY)
    this.currentShape.endX = point.x
    this.currentShape.endY = point.y
  }

  endShape(): Shape | null {
    if (!this.isDrawing || !this.currentShape) return null

    this.isDrawing = false
    const shape = this.currentShape
    this.currentShape = null
    this.startPoint = null
    return shape
  }

  createText(clientX: number, clientY: number, text: string): TextElement {
    const point = this.toCanvasCoords(clientX, clientY)
    return {
      id: generateId(),
      type: this.tool === 'note' ? 'note' : 'text',
      text,
      x: point.x,
      y: point.y,
      color: this.color,
      fontSize: this.size * 6 + 12,
    }
  }

  private drawStrokeSegment(stroke: Stroke, fromIdx: number, toIdx: number): void {
    if (fromIdx < 0 || toIdx >= stroke.points.length) return

    const from = stroke.points[fromIdx]
    const to = stroke.points[toIdx]

    this.ctx.save()
    this.ctx.globalAlpha = stroke.opacity
    this.ctx.globalCompositeOperation = stroke.composite || 'source-over'
    this.ctx.strokeStyle = stroke.color
    this.ctx.lineWidth = stroke.size
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'

    this.ctx.beginPath()
    this.ctx.moveTo(from.x, from.y)
    this.ctx.lineTo(to.x, to.y)
    this.ctx.stroke()
    this.ctx.restore()
  }

  drawStroke(stroke: Stroke): void {
    if (stroke.points.length < 2) return

    this.ctx.save()
    this.ctx.globalAlpha = stroke.opacity
    this.ctx.globalCompositeOperation = stroke.composite || 'source-over'
    this.ctx.strokeStyle = stroke.color
    this.ctx.lineWidth = stroke.size
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'

    this.ctx.beginPath()
    this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y)

    for (let i = 1; i < stroke.points.length; i++) {
      this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
    }

    this.ctx.stroke()
    this.ctx.restore()
  }

  drawShape(shape: Shape): void {
    this.ctx.save()
    this.ctx.strokeStyle = shape.color
    this.ctx.lineWidth = shape.size
    this.ctx.lineCap = 'round'

    switch (shape.type) {
      case 'line':
        this.ctx.beginPath()
        this.ctx.moveTo(shape.startX, shape.startY)
        this.ctx.lineTo(shape.endX, shape.endY)
        this.ctx.stroke()
        break

      case 'rectangle':
        this.ctx.strokeRect(
          shape.startX,
          shape.startY,
          shape.endX - shape.startX,
          shape.endY - shape.startY
        )
        break

      case 'circle': {
        const rx = Math.abs(shape.endX - shape.startX) / 2
        const ry = Math.abs(shape.endY - shape.startY) / 2
        const cx = shape.startX + (shape.endX - shape.startX) / 2
        const cy = shape.startY + (shape.endY - shape.startY) / 2
        this.ctx.beginPath()
        this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        this.ctx.stroke()
        break
      }
    }

    this.ctx.restore()
  }

  drawText(text: TextElement): void {
    this.ctx.save()
    this.ctx.fillStyle = text.color
    this.ctx.font = `${text.fontSize}px sans-serif`

    if (text.type === 'note') {
      const padding = 8
      const metrics = this.ctx.measureText(text.text)
      const width = text.width || metrics.width + padding * 2
      const height = text.height || text.fontSize + padding * 2

      this.ctx.fillStyle = '#ffffa5'
      this.ctx.fillRect(text.x, text.y, width, height)
      this.ctx.strokeStyle = '#e6e600'
      this.ctx.lineWidth = 1
      this.ctx.strokeRect(text.x, text.y, width, height)

      this.ctx.fillStyle = text.color
      this.ctx.fillText(text.text, text.x + padding, text.y + text.fontSize)
    } else {
      this.ctx.fillText(text.text, text.x, text.y + text.fontSize)
    }

    this.ctx.restore()
  }

  renderPage(page: PageState): void {
    this.clear()

    for (const stroke of page.strokes) {
      this.drawStroke(stroke)
    }

    for (const shape of page.shapes) {
      this.drawShape(shape)
    }

    for (const text of page.texts) {
      this.drawText(text)
    }

    if (this.currentShape) {
      this.drawShape(this.currentShape)
    }
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  toDataURL(type = 'image/png', quality = 1): string {
    return this.canvas.toDataURL(type, quality)
  }

  toBlob(callback: BlobCallback, type = 'image/png', quality = 1): void {
    this.canvas.toBlob(callback, type, quality)
  }
}
