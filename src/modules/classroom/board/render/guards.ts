/**
 * F29-STEALTH: Render Guards
 * Proxy stage.draw/layer.draw to prevent extra draws during save
 * Also manages listening/hitGraphEnabled state
 */

import Konva from 'konva'
import { recordExtraDraw } from '../perf/saveWindowMetrics'

// Counter for extra draws during save (should be 0)
let extraDrawsDuringSave = 0
let isGuardActive = false

let originalAutoDrawEnabled: boolean | null = null

// Internal Konva batching fields we need to flush before guarding
type BatchAnim = {
  isRunning?: () => boolean
  stop?: () => void
}
type KonvaNodeWithBatch = Konva.Stage & {
  _batchAnim?: BatchAnim
  _batchDrawTask?: { cancel?: () => void }
  _batchDrawScheduled?: number
}

const detachedTransformers = new Map<Konva.Transformer, Konva.Node[]>()

function drainPendingBatch(node: Konva.Stage | Konva.Layer, scope: 'stage' | 'layer'): void {
  const internal = node as KonvaNodeWithBatch
  const hasPending =
    internal._batchDrawScheduled ||
    (internal._batchAnim?.isRunning ? internal._batchAnim.isRunning() : false)

  if (hasPending) {
    console.debug('[guards] Draining pending batch before guard', {
      scope,
      nodeId: node._id,
      scheduled: internal._batchDrawScheduled,
      batchAnimRunning: internal._batchAnim?.isRunning?.(),
    })
    try {
      node.draw()
    } catch (error) {
      console.warn('[guards] Failed to flush node before guard', {
        scope,
        nodeId: node._id,
        error,
      })
    }
  }

  if (internal._batchAnim?.stop) {
    internal._batchAnim.stop()
  }
  if (internal._batchDrawTask?.cancel) {
    internal._batchDrawTask.cancel()
  }
  if (internal._batchDrawScheduled) {
    internal._batchDrawScheduled = 0
  }
}

function detachActiveTransformers(stage: Konva.Stage): void {
  const transformers = stage.find('Transformer') as Konva.Transformer[]
  transformers.forEach((transformer) => {
    const nodes = transformer.nodes()
    if (nodes.length > 0) {
      detachedTransformers.set(transformer, nodes.slice())
      transformer.nodes([])
      console.debug('[guards] Detached transformer nodes during save window', {
        transformerId: transformer._id,
        nodeIds: nodes.map((node) => node._id),
      })
    }
  })
}

function restoreTransformers(): void {
  detachedTransformers.forEach((nodes, transformer) => {
    try {
      transformer.nodes(nodes)
    } catch (error) {
      console.warn('[guards] Failed to reattach transformer nodes after save', {
        transformerId: transformer._id,
        error,
      })
    }
  })
  detachedTransformers.clear()
}

// Original methods storage (Stage only)
interface OriginalStageMethods {
  draw: () => Konva.Stage
  batchDraw: () => Konva.Stage
}
const originalMethods = new WeakMap<Konva.Stage, OriginalStageMethods>()

// Original layer methods storage
interface OriginalLayerMethods {
  draw: () => Konva.Layer
  batchDraw: () => Konva.Layer
}
const originalLayerMethods = new WeakMap<Konva.Layer, OriginalLayerMethods>()

const WARN_LIMIT = 3

/**
 * Start render guard - blocks all draw calls and disables hit detection
 */
export function startRenderGuard(stage: Konva.Stage | null): void {
  if (!stage || isGuardActive) return
  
  extraDrawsDuringSave = 0

  if (originalAutoDrawEnabled === null) {
    originalAutoDrawEnabled = Konva.autoDrawEnabled
  }
  Konva.autoDrawEnabled = false

  // Drain pending Konva rAF flushes before proxying
  drainPendingBatch(stage, 'stage')

  detachActiveTransformers(stage)

  // Drain layers after detaching transformers to reduce any pending Transformer/UI layer flushes
  const layers = stage.getLayers()
  layers.forEach((layer: Konva.Layer) => {
    drainPendingBatch(layer, 'layer')
  })

  isGuardActive = true

  // Proxy stage draw methods
  const stageDraw = stage.draw.bind(stage)
  const stageBatchDraw = stage.batchDraw.bind(stage)
  
  originalMethods.set(stage, {
    draw: stageDraw,
    batchDraw: stageBatchDraw,
  })

  // Replace with no-op that counts calls and records to metrics
  stage.draw = () => {
    extraDrawsDuringSave++
    recordExtraDraw()
    const log = extraDrawsDuringSave <= WARN_LIMIT ? console.warn : console.debug
    log('[guards] Blocked stage.draw() during save', {
      stageId: stage._id,
      extraDrawsDuringSave,
      stack: new Error().stack,
    })
    return stage
  }
  stage.batchDraw = () => {
    extraDrawsDuringSave++
    recordExtraDraw()
    const log = extraDrawsDuringSave <= WARN_LIMIT ? console.warn : console.debug
    log('[guards] Blocked stage.batchDraw() during save', {
      stageId: stage._id,
      extraDrawsDuringSave,
      stack: new Error().stack,
    })
    return stage
  }

  // Disable listening and hit graph on ALL layers + proxy their draw methods
  layers.forEach((layer: Konva.Layer) => {
    // Save original layer methods
    const layerDraw = layer.draw.bind(layer)
    const layerBatchDraw = layer.batchDraw.bind(layer)
    originalLayerMethods.set(layer, {
      draw: layerDraw,
      batchDraw: layerBatchDraw,
    })
    
    // Proxy layer draw methods
    layer.draw = () => {
      extraDrawsDuringSave++
      recordExtraDraw()
      const log = extraDrawsDuringSave <= WARN_LIMIT ? console.warn : console.debug
      log('[guards] Blocked layer.draw() during save', {
        layerId: layer._id,
        layerName: layer.name?.(),
        extraDrawsDuringSave,
        stack: new Error().stack,
      })
      return layer
    }
    layer.batchDraw = () => {
      extraDrawsDuringSave++
      recordExtraDraw()
      const log = extraDrawsDuringSave <= WARN_LIMIT ? console.warn : console.debug
      log('[guards] Blocked layer.batchDraw() during save', {
        layerId: layer._id,
        layerName: layer.name?.(),
        extraDrawsDuringSave,
        stack: new Error().stack,
      })
      return layer
    }
  })
}

/**
 * Stop render guard - restore original methods and re-enable hit detection
 */
export function stopRenderGuard(stage: Konva.Stage | null): void {
  if (!stage || !isGuardActive) return

  isGuardActive = false

  if (originalAutoDrawEnabled !== null) {
    Konva.autoDrawEnabled = originalAutoDrawEnabled
    originalAutoDrawEnabled = null
  }

  // Restore stage methods
  const original = originalMethods.get(stage)
  if (original) {
    stage.draw = original.draw
    stage.batchDraw = original.batchDraw
    originalMethods.delete(stage)
  }

  // Restore layer methods
  const layers = stage.getLayers()
  layers.forEach((layer: Konva.Layer) => {
    const originalLayer = originalLayerMethods.get(layer)
    if (originalLayer) {
      layer.draw = originalLayer.draw
      layer.batchDraw = originalLayer.batchDraw
      originalLayerMethods.delete(layer)
    }
  })

  restoreTransformers()

  // Log if any extra draws were attempted
  if (extraDrawsDuringSave > 0) {
    console.warn(`[guards] ${extraDrawsDuringSave} extra draw calls blocked during save`)
  }
}

/**
 * Get count of extra draws during save (for HUD/metrics)
 */
export function getExtraDrawsDuringSave(): number {
  return extraDrawsDuringSave
}

/**
 * Check if guard is currently active
 */
export function isRenderGuardActive(): boolean {
  return isGuardActive
}

/**
 * Reset counter (for testing)
 */
export function resetExtraDrawsCounter(): void {
  extraDrawsDuringSave = 0
}
