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

    const uiLayer = transformer.getLayer()
    if (uiLayer && uiLayer.listening()) {
      uiLayer.listening(false)
      disabledLayers.add(uiLayer)
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

// Layers that had listening/hitGraph disabled
const disabledLayers = new Set<Konva.Layer>()

/**
 * Start render guard - blocks all draw calls and disables hit detection
 */
export function startRenderGuard(stage: Konva.Stage | null): void {
  if (!stage || isGuardActive) return
  
  isGuardActive = true
  extraDrawsDuringSave = 0

  // Drain pending Konva rAF flushes before proxying
  drainPendingBatch(stage, 'stage')

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
    console.debug('[guards] Blocked stage.draw() during save', {
      stageId: stage._id,
      extraDrawsDuringSave,
      stack: new Error().stack,
    })
    return stage
  }
  stage.batchDraw = () => {
    extraDrawsDuringSave++
    recordExtraDraw()
    console.debug('[guards] Blocked stage.batchDraw() during save', {
      stageId: stage._id,
      extraDrawsDuringSave,
      stack: new Error().stack,
    })
    return stage
  }

  // Disable listening and hit graph on ALL layers + proxy their draw methods
  const layers = stage.getLayers()
  layers.forEach((layer: Konva.Layer) => {
    drainPendingBatch(layer, 'layer')
    detachActiveTransformers(stage)
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
      console.debug('[guards] Blocked layer.draw() during save', {
        layerId: layer._id,
        layerName: layer.name?.(),
        extraDrawsDuringSave,
      })
      return layer
    }
    layer.batchDraw = () => {
      extraDrawsDuringSave++
      recordExtraDraw()
      console.debug('[guards] Blocked layer.batchDraw() during save', {
        layerId: layer._id,
        layerName: layer.name?.(),
        extraDrawsDuringSave,
      })
      return layer
    }
    
    // Disable listening
    if (layer.listening()) {
      layer.listening(false)
      disabledLayers.add(layer)
    }
  })
}

/**
 * Stop render guard - restore original methods and re-enable hit detection
 */
export function stopRenderGuard(stage: Konva.Stage | null): void {
  if (!stage || !isGuardActive) return

  isGuardActive = false

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

  // Re-enable listening on layers
  disabledLayers.forEach((layer) => {
    layer.listening(true)
  })
  disabledLayers.clear()
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
