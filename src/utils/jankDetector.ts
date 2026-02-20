/**
 * Jank Detector — глобальний інструмент для виявлення "дьоргання" сторінки.
 *
 * Виявляє:
 * 1. Layout shifts (CLS) через PerformanceObserver
 * 2. Long tasks (>50ms) через PerformanceObserver
 * 3. Forced reflows через MutationObserver + requestAnimationFrame
 * 4. Polling-triggered re-renders через патчинг fetch/XHR
 *
 * Використання:
 *   import { jankDetector } from '@/utils/jankDetector'
 *   jankDetector.start()       // Увімкнути моніторинг
 *   jankDetector.stop()        // Вимкнути
 *   jankDetector.getReport()   // Отримати звіт
 *   jankDetector.dump()        // Вивести в консоль
 *
 * В production: jankDetector.startSilent() — збирає дані без console.log
 */

export interface JankEvent {
  type: 'layout-shift' | 'long-task' | 'dom-mutation' | 'polling-response' | 'forced-reflow'
  timestamp: number
  duration?: number
  score?: number
  detail: string
  stack?: string
}

export interface JankReport {
  totalEvents: number
  layoutShifts: number
  longTasks: number
  domMutations: number
  pollingResponses: number
  forcedReflows: number
  clsScore: number
  worstOffenders: JankEvent[]
  pollingEndpoints: Record<string, number>
  timeline: JankEvent[]
}

const MAX_EVENTS = 500
const LONG_TASK_THRESHOLD_MS = 50
const LAYOUT_SHIFT_THRESHOLD = 0.001
const DOM_BATCH_WINDOW_MS = 100

class JankDetectorService {
  private events: JankEvent[] = []
  private isRunning = false
  private isSilent = false
  private observers: PerformanceObserver[] = []
  private mutationObserver: MutationObserver | null = null
  private originalFetch: typeof fetch | null = null
  private originalXhrOpen: typeof XMLHttpRequest.prototype.open | null = null
  private pollingEndpoints: Record<string, number> = {}
  private lastDomMutationTime = 0
  private domMutationBatchCount = 0
  private rafHandle: number | null = null
  private frameTimestamps: number[] = []
  private frameDropCallback: ((dropped: number) => void) | null = null

  start(options?: { silent?: boolean }) {
    if (this.isRunning) return
    this.isRunning = true
    this.isSilent = options?.silent ?? false
    this.events = []
    this.pollingEndpoints = {}

    this.observeLayoutShifts()
    this.observeLongTasks()
    this.observeDomMutations()
    this.patchFetch()
    this.patchXhr()
    this.startFrameMonitor()

    if (!this.isSilent) {
      console.log(
        '%c[JankDetector] Started monitoring',
        'color: #f59e0b; font-weight: bold'
      )
    }
  }

  startSilent() {
    this.start({ silent: true })
  }

  stop() {
    if (!this.isRunning) return
    this.isRunning = false

    this.observers.forEach(o => o.disconnect())
    this.observers = []

    this.mutationObserver?.disconnect()
    this.mutationObserver = null

    this.restoreFetch()
    this.restoreXhr()
    this.stopFrameMonitor()

    if (!this.isSilent) {
      console.log(
        '%c[JankDetector] Stopped. Events collected: ' + this.events.length,
        'color: #f59e0b; font-weight: bold'
      )
    }
  }

  getReport(): JankReport {
    const layoutShifts = this.events.filter(e => e.type === 'layout-shift')
    const longTasks = this.events.filter(e => e.type === 'long-task')
    const domMutations = this.events.filter(e => e.type === 'dom-mutation')
    const pollingResponses = this.events.filter(e => e.type === 'polling-response')
    const forcedReflows = this.events.filter(e => e.type === 'forced-reflow')

    const clsScore = layoutShifts.reduce((sum, e) => sum + (e.score || 0), 0)

    const worstOffenders = [...this.events]
      .sort((a, b) => (b.score || b.duration || 0) - (a.score || a.duration || 0))
      .slice(0, 10)

    return {
      totalEvents: this.events.length,
      layoutShifts: layoutShifts.length,
      longTasks: longTasks.length,
      domMutations: domMutations.length,
      pollingResponses: pollingResponses.length,
      forcedReflows: forcedReflows.length,
      clsScore: Math.round(clsScore * 10000) / 10000,
      worstOffenders,
      pollingEndpoints: { ...this.pollingEndpoints },
      timeline: [...this.events],
    }
  }

  dump() {
    const report = this.getReport()
    console.group('%c[JankDetector] Report', 'color: #f59e0b; font-weight: bold; font-size: 14px')
    console.log(`Total events: ${report.totalEvents}`)
    console.log(`Layout shifts: ${report.layoutShifts} (CLS: ${report.clsScore})`)
    console.log(`Long tasks: ${report.longTasks}`)
    console.log(`DOM mutation batches: ${report.domMutations}`)
    console.log(`Polling responses: ${report.pollingResponses}`)
    console.log(`Forced reflows: ${report.forcedReflows}`)
    console.log('\nPolling endpoints:')
    console.table(report.pollingEndpoints)
    console.log('\nWorst offenders:')
    console.table(report.worstOffenders.map(e => ({
      type: e.type,
      detail: e.detail.slice(0, 80),
      duration: e.duration,
      score: e.score,
      time: new Date(e.timestamp).toISOString().slice(11, 23),
    })))
    console.groupEnd()
    return report
  }

  onFrameDrop(cb: (dropped: number) => void) {
    this.frameDropCallback = cb
  }

  // --- Layout Shift Observer ---
  private observeLayoutShifts() {
    if (typeof PerformanceObserver === 'undefined') return
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const lsEntry = entry as any
          if (lsEntry.value && lsEntry.value > LAYOUT_SHIFT_THRESHOLD && !lsEntry.hadRecentInput) {
            const sources = (lsEntry.sources || [])
              .map((s: any) => s.node?.nodeName || 'unknown')
              .join(', ')
            this.addEvent({
              type: 'layout-shift',
              timestamp: performance.now(),
              score: lsEntry.value,
              detail: `CLS ${lsEntry.value.toFixed(4)} — nodes: ${sources || 'N/A'}`,
            })
          }
        }
      })
      observer.observe({ type: 'layout-shift', buffered: false })
      this.observers.push(observer)
    } catch {
      // PerformanceObserver not supported for layout-shift
    }
  }

  // --- Long Task Observer ---
  private observeLongTasks() {
    if (typeof PerformanceObserver === 'undefined') return
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > LONG_TASK_THRESHOLD_MS) {
            this.addEvent({
              type: 'long-task',
              timestamp: performance.now(),
              duration: entry.duration,
              detail: `Long task: ${Math.round(entry.duration)}ms (name: ${entry.name})`,
            })
          }
        }
      })
      observer.observe({ type: 'longtask', buffered: false })
      this.observers.push(observer)
    } catch {
      // PerformanceObserver not supported for longtask
    }
  }

  // --- DOM Mutation Observer ---
  private observeDomMutations() {
    this.mutationObserver = new MutationObserver((mutations) => {
      const now = performance.now()
      const totalNodes = mutations.reduce((sum, m) => sum + m.addedNodes.length + m.removedNodes.length, 0)

      if (totalNodes < 3) return // Ignore tiny mutations

      // Batch mutations within DOM_BATCH_WINDOW_MS
      if (now - this.lastDomMutationTime < DOM_BATCH_WINDOW_MS) {
        this.domMutationBatchCount += totalNodes
        return
      }

      if (this.domMutationBatchCount > 0) {
        this.addEvent({
          type: 'dom-mutation',
          timestamp: this.lastDomMutationTime,
          detail: `DOM batch: ${this.domMutationBatchCount} nodes changed`,
        })
      }

      this.lastDomMutationTime = now
      this.domMutationBatchCount = totalNodes
    })

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  // --- Fetch Patching ---
  private patchFetch() {
    this.originalFetch = window.fetch
    const self = this

    window.fetch = async function (...args: Parameters<typeof fetch>) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || ''
      const start = performance.now()

      const response = await self.originalFetch!.apply(window, args)
      const duration = performance.now() - start

      // Track polling endpoints
      const path = self.extractPath(url)
      self.pollingEndpoints[path] = (self.pollingEndpoints[path] || 0) + 1

      if (self.pollingEndpoints[path] > 2) {
        self.addEvent({
          type: 'polling-response',
          timestamp: performance.now(),
          duration,
          detail: `Polling: ${path} (${Math.round(duration)}ms, call #${self.pollingEndpoints[path]})`,
        })
      }

      return response
    }
  }

  private restoreFetch() {
    if (this.originalFetch) {
      window.fetch = this.originalFetch
      this.originalFetch = null
    }
  }

  // --- XHR Patching ---
  private patchXhr() {
    this.originalXhrOpen = XMLHttpRequest.prototype.open
    const self = this

    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
      const path = self.extractPath(String(url))
      this.addEventListener('load', () => {
        self.pollingEndpoints[path] = (self.pollingEndpoints[path] || 0) + 1
        if (self.pollingEndpoints[path] > 2) {
          self.addEvent({
            type: 'polling-response',
            timestamp: performance.now(),
            detail: `XHR Polling: ${path} (call #${self.pollingEndpoints[path]})`,
          })
        }
      })
      return self.originalXhrOpen!.apply(this, [method, url, ...rest] as any)
    }
  }

  private restoreXhr() {
    if (this.originalXhrOpen) {
      XMLHttpRequest.prototype.open = this.originalXhrOpen
      this.originalXhrOpen = null
    }
  }

  // --- Frame Monitor (detects dropped frames) ---
  private startFrameMonitor() {
    let lastFrameTime = performance.now()
    const expectedFrameMs = 1000 / 60 // ~16.67ms

    const tick = (now: number) => {
      if (!this.isRunning) return

      const delta = now - lastFrameTime
      const droppedFrames = Math.max(0, Math.round(delta / expectedFrameMs) - 1)

      if (droppedFrames > 2) {
        this.addEvent({
          type: 'forced-reflow',
          timestamp: now,
          duration: delta,
          detail: `Frame drop: ${droppedFrames} frames dropped (${Math.round(delta)}ms gap)`,
        })
        this.frameDropCallback?.(droppedFrames)
      }

      lastFrameTime = now
      this.rafHandle = requestAnimationFrame(tick)
    }

    this.rafHandle = requestAnimationFrame(tick)
  }

  private stopFrameMonitor() {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle)
      this.rafHandle = null
    }
  }

  // --- Helpers ---
  private addEvent(event: JankEvent) {
    if (this.events.length >= MAX_EVENTS) {
      this.events.shift()
    }
    this.events.push(event)

    if (!this.isSilent) {
      const color = {
        'layout-shift': '#ef4444',
        'long-task': '#f97316',
        'dom-mutation': '#eab308',
        'polling-response': '#3b82f6',
        'forced-reflow': '#a855f7',
      }[event.type]

      console.log(
        `%c[Jank] ${event.type}%c ${event.detail}`,
        `color: ${color}; font-weight: bold`,
        'color: inherit'
      )
    }
  }

  private extractPath(url: string): string {
    try {
      const u = new URL(url, window.location.origin)
      return u.pathname
    } catch {
      return url.split('?')[0]
    }
  }
}

export const jankDetector = new JankDetectorService()

// Auto-attach to window for console access in production
if (typeof window !== 'undefined') {
  ;(window as any).__jankDetector = jankDetector
}
