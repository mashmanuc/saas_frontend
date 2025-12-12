// TASK F3: InfiniteCanvas - Pan/zoom/viewport management

import { BoardEventEmitter } from './eventEmitter'
import type { Point, Bounds, Viewport, Component, InfiniteCanvasConfig } from './types'
import { DEFAULT_VIEWPORT, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from './constants'

type InfiniteCanvasEvents = {
  'viewport-change': Viewport
  'pan-start': void
  'pan-end': void
  'zoom-change': number
  [key: string]: unknown
}

export class InfiniteCanvas {
  private viewport: Viewport
  private container: HTMLElement
  private isDragging = false
  private lastPointer: Point | null = null
  private config: Required<InfiniteCanvasConfig>
  private panEnabled = true
  private zoomEnabled = true
  private pinchStartDistance: number | null = null
  private pinchStartZoom: number | null = null

  public readonly events = new BoardEventEmitter<InfiniteCanvasEvents>()

  constructor(container: HTMLElement, config?: InfiniteCanvasConfig) {
    this.container = container
    this.config = {
      minZoom: config?.minZoom ?? MIN_ZOOM,
      maxZoom: config?.maxZoom ?? MAX_ZOOM,
      zoomStep: config?.zoomStep ?? ZOOM_STEP,
      panInertia: config?.panInertia ?? true,
      wheelZoom: config?.wheelZoom ?? true,
      pinchZoom: config?.pinchZoom ?? true,
    }

    this.viewport = {
      ...DEFAULT_VIEWPORT,
      width: container.clientWidth,
      height: container.clientHeight,
    }

    this.bindEvents()
  }

  private bindEvents(): void {
    this.container.addEventListener('wheel', this.handleWheel.bind(this), { passive: false })
    this.container.addEventListener('pointerdown', this.handlePointerDown.bind(this))
    this.container.addEventListener('pointermove', this.handlePointerMove.bind(this))
    this.container.addEventListener('pointerup', this.handlePointerUp.bind(this))
    this.container.addEventListener('pointerleave', this.handlePointerUp.bind(this))
    this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false })
    this.container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false })
    this.container.addEventListener('touchend', this.handleTouchEnd.bind(this))

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      this.viewport.width = this.container.clientWidth
      this.viewport.height = this.container.clientHeight
      this.events.emit('viewport-change', { ...this.viewport })
    })
    resizeObserver.observe(this.container)
  }

  getViewport(): Viewport {
    return { ...this.viewport }
  }

  setViewport(viewport: Partial<Viewport>): void {
    if (viewport.x !== undefined) this.viewport.x = viewport.x
    if (viewport.y !== undefined) this.viewport.y = viewport.y
    if (viewport.zoom !== undefined) {
      this.viewport.zoom = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, viewport.zoom))
    }
    if (viewport.width !== undefined) this.viewport.width = viewport.width
    if (viewport.height !== undefined) this.viewport.height = viewport.height

    this.events.emit('viewport-change', { ...this.viewport })
  }

  pan(dx: number, dy: number): void {
    if (!this.panEnabled) return

    this.viewport.x += dx / this.viewport.zoom
    this.viewport.y += dy / this.viewport.zoom
    this.events.emit('viewport-change', { ...this.viewport })
  }

  panTo(x: number, y: number): void {
    if (!this.panEnabled) return

    this.viewport.x = x - this.viewport.width / (2 * this.viewport.zoom)
    this.viewport.y = y - this.viewport.height / (2 * this.viewport.zoom)
    this.events.emit('viewport-change', { ...this.viewport })
  }

  zoom(level: number, center?: Point): void {
    if (!this.zoomEnabled) return

    const newZoom = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, level))
    if (newZoom === this.viewport.zoom) return

    const centerPoint = center ?? {
      x: this.viewport.width / 2,
      y: this.viewport.height / 2,
    }

    // Zoom towards center point
    const canvasPoint = this.screenToCanvas(centerPoint.x, centerPoint.y)
    this.viewport.zoom = newZoom

    const newCanvasPoint = this.screenToCanvas(centerPoint.x, centerPoint.y)
    this.viewport.x += canvasPoint.x - newCanvasPoint.x
    this.viewport.y += canvasPoint.y - newCanvasPoint.y

    this.events.emit('zoom-change', newZoom)
    this.events.emit('viewport-change', { ...this.viewport })
  }

  zoomIn(center?: Point): void {
    this.zoom(this.viewport.zoom + this.config.zoomStep, center)
  }

  zoomOut(center?: Point): void {
    this.zoom(this.viewport.zoom - this.config.zoomStep, center)
  }

  fitToContent(components: Component[], padding = 50): void {
    if (components.length === 0) {
      this.resetView()
      return
    }

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

    this.fitToBounds({ x: minX, y: minY, width: maxX - minX, height: maxY - minY }, padding)
  }

  fitToBounds(bounds: Bounds, padding = 50): void {
    const contentWidth = bounds.width + padding * 2
    const contentHeight = bounds.height + padding * 2

    const scaleX = this.viewport.width / contentWidth
    const scaleY = this.viewport.height / contentHeight
    const newZoom = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, Math.min(scaleX, scaleY)))

    this.viewport.zoom = newZoom
    this.viewport.x = bounds.x - padding + (contentWidth - this.viewport.width / newZoom) / 2
    this.viewport.y = bounds.y - padding + (contentHeight - this.viewport.height / newZoom) / 2

    this.events.emit('zoom-change', newZoom)
    this.events.emit('viewport-change', { ...this.viewport })
  }

  resetView(): void {
    this.viewport.x = 0
    this.viewport.y = 0
    this.viewport.zoom = 1
    this.events.emit('zoom-change', 1)
    this.events.emit('viewport-change', { ...this.viewport })
  }

  screenToCanvas(screenX: number, screenY: number): Point {
    return {
      x: this.viewport.x + screenX / this.viewport.zoom,
      y: this.viewport.y + screenY / this.viewport.zoom,
    }
  }

  canvasToScreen(canvasX: number, canvasY: number): Point {
    return {
      x: (canvasX - this.viewport.x) * this.viewport.zoom,
      y: (canvasY - this.viewport.y) * this.viewport.zoom,
    }
  }

  getVisibleBounds(): Bounds {
    return {
      x: this.viewport.x,
      y: this.viewport.y,
      width: this.viewport.width / this.viewport.zoom,
      height: this.viewport.height / this.viewport.zoom,
    }
  }

  isPointVisible(x: number, y: number): boolean {
    const bounds = this.getVisibleBounds()
    return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height
  }

  isBoundsVisible(bounds: Bounds): boolean {
    const visible = this.getVisibleBounds()
    return !(
      bounds.x + bounds.width < visible.x ||
      bounds.x > visible.x + visible.width ||
      bounds.y + bounds.height < visible.y ||
      bounds.y > visible.y + visible.height
    )
  }

  setPanEnabled(enabled: boolean): void {
    this.panEnabled = enabled
  }

  setZoomEnabled(enabled: boolean): void {
    this.zoomEnabled = enabled
  }

  private handleWheel(e: WheelEvent): void {
    if (!this.config.wheelZoom || !this.zoomEnabled) return

    e.preventDefault()

    const rect = this.container.getBoundingClientRect()
    const center: Point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }

    const delta = -e.deltaY * 0.001
    this.zoom(this.viewport.zoom + delta, center)
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle mouse or Alt+Left click for pan
      this.isDragging = true
      this.lastPointer = { x: e.clientX, y: e.clientY }
      this.container.style.cursor = 'grabbing'
      this.events.emit('pan-start', undefined)
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.isDragging || !this.lastPointer) return

    const dx = e.clientX - this.lastPointer.x
    const dy = e.clientY - this.lastPointer.y

    this.pan(-dx, -dy)

    this.lastPointer = { x: e.clientX, y: e.clientY }
  }

  private handlePointerUp(_e: PointerEvent): void {
    if (this.isDragging) {
      this.isDragging = false
      this.lastPointer = null
      this.container.style.cursor = ''
      this.events.emit('pan-end', undefined)
    }
  }

  private handleTouchStart(e: TouchEvent): void {
    if (e.touches.length === 2 && this.config.pinchZoom) {
      e.preventDefault()
      const distance = this.getTouchDistance(e.touches)
      this.pinchStartDistance = distance
      this.pinchStartZoom = this.viewport.zoom
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    if (e.touches.length === 2 && this.pinchStartDistance !== null && this.pinchStartZoom !== null) {
      e.preventDefault()
      const distance = this.getTouchDistance(e.touches)
      const scale = distance / this.pinchStartDistance
      const newZoom = this.pinchStartZoom * scale

      const center = this.getTouchCenter(e.touches)
      const rect = this.container.getBoundingClientRect()
      this.zoom(newZoom, { x: center.x - rect.left, y: center.y - rect.top })
    }
  }

  private handleTouchEnd(_e: TouchEvent): void {
    this.pinchStartDistance = null
    this.pinchStartZoom = null
  }

  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  private getTouchCenter(touches: TouchList): Point {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    }
  }

  destroy(): void {
    this.events.removeAll()
  }
}

export default InfiniteCanvas
