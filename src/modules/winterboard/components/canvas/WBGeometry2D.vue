<template>
  <v-group :config="groupConfig">
    <!-- ─── Fill (only at buildProgress = 1.0) ──────────────── -->
    <v-line
      v-if="isPolygonLike && fillVisible"
      :config="fillConfig"
    />
    <v-circle
      v-if="isCircle && fillVisible"
      :config="circleFillConfig"
    />

    <!-- ─── Edges (polygon/triangle) ────────────────────────── -->
    <template v-if="isPolygonLike">
      <v-line
        v-for="(edge, i) in visibleEdges"
        :key="`edge-${i}`"
        :config="edge"
      />
    </template>

    <!-- ─── Circle stroke ───────────────────────────────────── -->
    <v-circle
      v-if="isCircle"
      :config="circleStrokeConfig"
    />
    <!-- Circle radius line (on selection/hover) -->
    <v-line
      v-if="isCircle && showDetailedInfo"
      :config="radiusLineConfig"
    />

    <!-- ─── Level 1: Edge lengths (always visible) ──────────── -->
    <template v-if="params.showMeasurements !== false && measurements">
      <v-text
        v-for="(label, i) in sideLengthLabels"
        :key="`side-${i}`"
        :config="label"
      />
    </template>

    <!-- ─── Level 2: Angles (on hover/selection, lower opacity) -->
    <template v-if="showDetailedInfo && measurements">
      <v-text
        v-for="(label, i) in angleLabels"
        :key="`angle-${i}`"
        :config="label"
      />
    </template>

    <!-- ─── Level 3: Area + Perimeter (selection only) ──────── -->
    <template v-if="props.isSelected && measurements">
      <v-text
        v-if="areaLabel"
        :config="areaLabel"
      />
      <v-text
        v-if="isCircle && circleRadiusLabel"
        :config="circleRadiusLabel"
      />
    </template>

    <!-- ─── Vertex handles (interactive mode) ───────────────── -->
    <template v-if="isPolygonLike && interactive">
      <v-circle
        v-for="(vh, i) in vertexHandles"
        :key="`vh-${i}`"
        :config="vh"
        @mousedown="onVertexMouseDown(i, $event)"
        @mouseenter="onVertexHoverIn(i)"
        @mouseleave="onVertexHoverOut"
        @touchstart="onVertexTouchStart(i, $event)"
      />
    </template>

    <!-- ─── Circle radius handle ────────────────────────────── -->
    <v-circle
      v-if="isCircle && interactive"
      :config="circleRadiusHandle"
      @mousedown="onCircleHandleMouseDown"
      @touchstart="onCircleHandleTouchStart"
    />
  </v-group>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import type { WBAsset } from '../../types/winterboard'
import type { Geometry2DParams } from '../../types/geometry'
import { GEOMETRY_DEFAULTS, roundCoord } from '../../types/geometry'
import {
  computeTriangleMeasurements,
  computeCircleMeasurements,
  computePolygonMeasurements,
  midpoint,
  distance,
  centroid,
  formatMeasurement,
  wouldCollapse,
} from '../../engine/geometryMeasurements'
import { MIN_EMIT_DISTANCE_PX, VERTEX_COLLAPSE_EPSILON } from '../../types/geometry'

/** Compact number formatting: ≥100 → integer, ≥10 → 1 decimal, else 1 decimal */
function formatCompact(val: number): string {
  if (val >= 100) return Math.round(val).toString()
  return val.toFixed(1).replace(/\.0$/, '')
}

// ─── Props ──────────────────────────────────────────────────────────────

interface Props {
  asset: WBAsset
  isSelected?: boolean
  scale?: number
  interactive?: boolean // whether vertex drag is allowed
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  scale: 1,
  interactive: true,
})

// ─── Emits ──────────────────────────────────────────────────────────────

const emit = defineEmits<{
  select: [id: string]
  'vertex-move': [assetId: string, vertexIndex: number, x: number, y: number]
  'vertex-drag-start': [assetId: string, vertexIndex: number]
  'vertex-drag-end': [asset: WBAsset]
  'circle-move': [assetId: string, cx: number, cy: number, radius: number]
  'circle-drag-end': [asset: WBAsset]
}>()

// ─── Geometry params ────────────────────────────────────────────────────

const params = computed((): Geometry2DParams => {
  return (props.asset as any).geometryParams ?? {}
})

const isCircle = computed(() => params.value.shape === 'circle')
const isPolygonLike = computed(() => params.value.shape === 'triangle' || params.value.shape === 'polygon')

const vertices = computed(() => params.value.vertices ?? [])
const buildProgress = computed(() => params.value.buildProgress ?? 1.0)
const fillVisible = computed(() => buildProgress.value >= 1.0)

// ─── Local drag state (R6: float precision for smooth visual) ───────

const localVertices = ref<Array<{ x: number; y: number }> | null>(null)
const localCircleRadius = ref<number | null>(null)
const isDragging = ref(false)
const dragVertexIndex = ref<number | null>(null)
const lastEmittedPoint = ref<{ x: number; y: number } | null>(null)

// Hover state — which vertex is hovered (for edge highlight + angle reveal)
const hoveredVertexIndex = ref<number | null>(null)

// Info visibility hierarchy:
// Level 1 (always): edge lengths
// Level 2 (hover/selection): angles
// Level 3 (selection only): area + perimeter
const showDetailedInfo = computed(() =>
  props.isSelected || hoveredVertexIndex.value !== null || isDragging.value,
)

// Effective vertices: local override during drag, else from store
const effectiveVertices = computed(() => {
  if (localVertices.value && isDragging.value) return localVertices.value
  return vertices.value
})

const effectiveRadius = computed(() => {
  if (localCircleRadius.value != null && isDragging.value) return localCircleRadius.value
  return params.value.radius ?? 50
})

// ─── Styles ─────────────────────────────────────────────────────────────

const fillColor = computed(() => params.value.fillColor ?? GEOMETRY_DEFAULTS.fillColor)
const strokeColor = computed(() => params.value.strokeColor ?? GEOMETRY_DEFAULTS.strokeColor)
const strokeWidth = computed(() => params.value.strokeWidth ?? GEOMETRY_DEFAULTS.strokeWidth)

// ─── Group config ───────────────────────────────────────────────────────

const groupConfig = computed(() => ({
  // geometry uses absolute coords, group at 0,0
  x: 0,
  y: 0,
  id: props.asset.id,
  name: 'geometry_2d',
}))

// ─── Measurements ───────────────────────────────────────────────────────

const measurements = computed(() => {
  if (params.value.shape === 'triangle' && effectiveVertices.value.length === 3) {
    return computeTriangleMeasurements(
      effectiveVertices.value as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }],
    )
  }
  if (params.value.shape === 'circle') {
    return computeCircleMeasurements(effectiveRadius.value)
  }
  if (params.value.shape === 'polygon' && effectiveVertices.value.length >= 3) {
    return computePolygonMeasurements(effectiveVertices.value)
  }
  return null
})

// ─── Fill config (polygon/triangle) ─────────────────────────────────────

const fillConfig = computed(() => {
  const verts = effectiveVertices.value
  if (verts.length < 3) return { points: [], closed: true, fill: 'transparent' }
  const pts: number[] = []
  for (const v of verts) {
    pts.push(v.x, v.y)
  }
  return {
    points: pts,
    closed: true,
    fill: fillColor.value,
    stroke: 'transparent',
    strokeWidth: 0,
    listening: false,
  }
})

// ─── Edge configs (build progress aware) ────────────────────────────────

const visibleEdges = computed(() => {
  const verts = effectiveVertices.value
  const n = verts.length
  if (n < 2) return []

  const totalEdges = n
  const visibleCount = buildProgress.value >= 1.0
    ? totalEdges
    : Math.floor(buildProgress.value * totalEdges)

  const edges: any[] = []
  const hv = hoveredVertexIndex.value
  for (let i = 0; i < visibleCount; i++) {
    const from = verts[i]
    const to = verts[(i + 1) % n]
    // Highlight edges connected to hovered vertex
    const isHighlighted = hv !== null && (i === hv || (i + 1) % n === hv)
    edges.push({
      points: [from.x, from.y, to.x, to.y],
      stroke: isHighlighted ? '#2563eb' : strokeColor.value,
      strokeWidth: isHighlighted ? strokeWidth.value + 1 : strokeWidth.value,
      lineCap: 'round',
      lineJoin: 'round',
      hitStrokeWidth: 10,
      listening: false,
    })
  }
  return edges
})

// ─── Circle configs ─────────────────────────────────────────────────────

const circleFillConfig = computed(() => ({
  x: params.value.cx ?? 0,
  y: params.value.cy ?? 0,
  radius: effectiveRadius.value,
  fill: fillColor.value,
  stroke: 'transparent',
  strokeWidth: 0,
  listening: false,
}))

const circleStrokeConfig = computed(() => {
  const progress = buildProgress.value
  // Full circle or partial arc via dash
  const r = effectiveRadius.value
  const circumference = 2 * Math.PI * r

  if (progress >= 1.0) {
    return {
      x: params.value.cx ?? 0,
      y: params.value.cy ?? 0,
      radius: r,
      fill: 'transparent',
      stroke: strokeColor.value,
      strokeWidth: strokeWidth.value,
      listening: true,
      hitStrokeWidth: 10,
    }
  }

  // Partial circle via dash array
  const visibleLength = circumference * progress
  return {
    x: params.value.cx ?? 0,
    y: params.value.cy ?? 0,
    radius: r,
    fill: 'transparent',
    stroke: strokeColor.value,
    strokeWidth: strokeWidth.value,
    dash: [visibleLength, circumference - visibleLength],
    rotation: -90, // start from top
    listening: false,
  }
})

// ─── Radius line ────────────────────────────────────────────────────────

const radiusLineConfig = computed(() => {
  const cx = params.value.cx ?? 0
  const cy = params.value.cy ?? 0
  const r = effectiveRadius.value
  return {
    points: [cx, cy, cx + r, cy],
    stroke: strokeColor.value,
    strokeWidth: 1,
    dash: [4, 4],
    listening: false,
  }
})

// ─── Vertex handles ─────────────────────────────────────────────────────

const vertexHandles = computed(() => {
  return effectiveVertices.value.map((v, i) => {
    const isDragTarget = dragVertexIndex.value === i
    const isHovered = hoveredVertexIndex.value === i
    return {
      x: v.x,
      y: v.y,
      radius: (isHovered || isDragTarget ? GEOMETRY_DEFAULTS.vertexRadius + 2 : GEOMETRY_DEFAULTS.vertexRadius) / props.scale,
      fill: isDragTarget ? '#fecaca' : isHovered ? '#dbeafe' : GEOMETRY_DEFAULTS.vertexFillColor,
      stroke: isDragTarget ? '#ef4444' : isHovered ? '#2563eb' : GEOMETRY_DEFAULTS.vertexStrokeColor,
      strokeWidth: (isHovered || isDragTarget ? 2.5 : GEOMETRY_DEFAULTS.vertexStrokeWidth) / props.scale,
      hitStrokeWidth: GEOMETRY_DEFAULTS.vertexHitRadius / props.scale,
      draggable: false,
      listening: true,
    }
  })
})

// ─── Circle radius handle ──────────────────────────────────────────────

const circleRadiusHandle = computed(() => {
  const cx = params.value.cx ?? 0
  const cy = params.value.cy ?? 0
  const r = effectiveRadius.value
  return {
    x: cx + r,
    y: cy,
    radius: GEOMETRY_DEFAULTS.vertexRadius / props.scale,
    fill: GEOMETRY_DEFAULTS.vertexFillColor,
    stroke: GEOMETRY_DEFAULTS.vertexStrokeColor,
    strokeWidth: GEOMETRY_DEFAULTS.vertexStrokeWidth / props.scale,
    hitStrokeWidth: GEOMETRY_DEFAULTS.vertexHitRadius / props.scale,
    draggable: false,
    listening: true,
  }
})

// ─── Measurement labels ─────────────────────────────────────────────────

const sideLengthLabels = computed(() => {
  if (!measurements.value || isCircle.value) return []
  const m = measurements.value as { sides: number[] }
  const verts = effectiveVertices.value
  const n = verts.length
  const labels: any[] = []
  const hv = hoveredVertexIndex.value

  for (let i = 0; i < n && i < m.sides.length; i++) {
    const from = verts[i]
    const to = verts[(i + 1) % n]
    const mid = midpoint(from, to)
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.hypot(dx, dy)
    if (len < 1) continue
    const nx = -dy / len * 14
    const ny = dx / len * 14

    // Highlight edges connected to hovered vertex
    const isHighlighted = hv !== null && (i === hv || (i + 1) % n === hv)

    labels.push({
      x: mid.x + nx,
      y: mid.y + ny,
      text: formatCompact(m.sides[i]),
      fontSize: GEOMETRY_DEFAULTS.measurementFontSize / props.scale,
      fontFamily: GEOMETRY_DEFAULTS.measurementFontFamily,
      fill: isHighlighted ? '#1d4ed8' : GEOMETRY_DEFAULTS.measurementColor,
      fontStyle: isHighlighted ? 'bold' : 'normal',
      align: 'center',
      offsetX: 15,
      offsetY: 6,
      listening: false,
      opacity: isHighlighted ? 1 : 0.8,
    })
  }
  return labels
})

const angleLabels = computed(() => {
  if (!measurements.value || isCircle.value) return []
  const m = measurements.value as { angles: number[] }
  const verts = effectiveVertices.value
  const n = verts.length
  const labels: any[] = []
  const center = centroid(verts)
  const hv = hoveredVertexIndex.value

  for (let i = 0; i < n && i < m.angles.length; i++) {
    // When hovering a vertex, show only that vertex's angle
    // When selected, show all angles
    if (hv !== null && !props.isSelected && hv !== i) continue

    const v = verts[i]
    const dx = center.x - v.x
    const dy = center.y - v.y
    const dist = Math.hypot(dx, dy)
    if (dist < 1) continue
    const offset = 22 / props.scale
    const lx = v.x + (dx / dist) * offset
    const ly = v.y + (dy / dist) * offset

    const isHighlighted = hv === i
    labels.push({
      x: lx,
      y: ly,
      text: `${Math.round(m.angles[i])}°`,
      fontSize: (GEOMETRY_DEFAULTS.measurementFontSize - 1) / props.scale,
      fontFamily: GEOMETRY_DEFAULTS.measurementFontFamily,
      fill: isHighlighted ? '#c2410c' : '#ea580c',
      fontStyle: isHighlighted ? 'bold' : 'normal',
      align: 'center',
      offsetX: 12,
      offsetY: 5,
      listening: false,
      opacity: isHighlighted ? 1 : 0.7,
    })
  }
  return labels
})

const areaLabel = computed(() => {
  if (!measurements.value) return null
  const m = measurements.value as { area: number; perimeter?: number }
  const verts = effectiveVertices.value

  let cx: number, cy: number
  if (isCircle.value) {
    cx = params.value.cx ?? 0
    cy = params.value.cy ?? 0
  } else {
    const c = centroid(verts)
    cx = c.x
    cy = c.y
  }

  const text = isCircle.value
    ? `S = ${formatCompact(m.area)}`
    : `S = ${formatCompact(m.area)}\nP = ${formatCompact((m as any).perimeter)}`

  return {
    x: cx,
    y: cy,
    text,
    fontSize: 11 / props.scale,
    fontFamily: GEOMETRY_DEFAULTS.measurementFontFamily,
    fill: GEOMETRY_DEFAULTS.measurementColor,
    align: 'center',
    offsetX: 25,
    offsetY: isCircle.value ? 6 : 12,
    listening: false,
    opacity: 0.6,
  }
})

const circleRadiusLabel = computed(() => {
  if (!measurements.value || !isCircle.value) return null
  const m = measurements.value as { radius: number; diameter: number; circumference: number }
  const cx = params.value.cx ?? 0
  const cy = params.value.cy ?? 0
  const r = effectiveRadius.value
  return {
    x: cx + r / 2,
    y: cy - 10 / props.scale,
    text: `r = ${formatCompact(m.radius)}`,
    fontSize: GEOMETRY_DEFAULTS.measurementFontSize / props.scale,
    fontFamily: GEOMETRY_DEFAULTS.measurementFontFamily,
    fill: GEOMETRY_DEFAULTS.measurementColor,
    align: 'center',
    offsetX: 15,
    offsetY: 0,
    listening: false,
  }
})

// ─── Vertex drag handlers ───────────────────────────────────────────────

function getStagePointerPos(e: any): { x: number; y: number } | null {
  const stage = e?.target?.getStage?.()
  if (!stage) return null
  const pos = stage.getPointerPosition()
  if (!pos) return null
  // Convert to world coordinates (account for stage transform)
  const transform = stage.getAbsoluteTransform().copy().invert()
  return transform.point(pos)
}

// ─── Vertex hover handlers (highlight connected edges + angle) ──────

function onVertexHoverIn(vertexIndex: number) {
  hoveredVertexIndex.value = vertexIndex
}

function onVertexHoverOut() {
  hoveredVertexIndex.value = null
}

function onVertexMouseDown(vertexIndex: number, e: any) {
  e.cancelBubble = true // prevent stage drag
  startDrag(vertexIndex, e)
}

function onVertexTouchStart(vertexIndex: number, e: any) {
  e.cancelBubble = true
  startDrag(vertexIndex, e.evt ? e : e)
}

function startDrag(vertexIndex: number, e: any) {
  const pos = getStagePointerPos(e)
  if (!pos) return

  isDragging.value = true
  dragVertexIndex.value = vertexIndex
  localVertices.value = effectiveVertices.value.map(v => ({ ...v }))
  lastEmittedPoint.value = { x: pos.x, y: pos.y }

  emit('vertex-drag-start', props.asset.id, vertexIndex)

  const stage = e?.target?.getStage?.()
  if (!stage) return

  // G8: lock viewport during vertex drag
  const wasDraggable = stage.draggable()
  stage.draggable(false)

  const onMove = (moveEvt: any) => {
    const mPos = stage.getPointerPosition()
    if (!mPos || dragVertexIndex.value === null || !localVertices.value) return
    const transform = stage.getAbsoluteTransform().copy().invert()
    const worldPos = transform.point(mPos)

    // S7: vertex collapse guard
    if (wouldCollapse(localVertices.value, dragVertexIndex.value, worldPos, VERTEX_COLLAPSE_EPSILON)) {
      return
    }

    // Update local state for smooth rendering (R6: raw float)
    localVertices.value = localVertices.value.map((v, i) =>
      i === dragVertexIndex.value ? { x: worldPos.x, y: worldPos.y } : v,
    )

    // G1.1: distance-based emit
    if (lastEmittedPoint.value) {
      const dist = Math.hypot(
        worldPos.x - lastEmittedPoint.value.x,
        worldPos.y - lastEmittedPoint.value.y,
      )
      if (dist >= MIN_EMIT_DISTANCE_PX) {
        const rx = roundCoord(worldPos.x)
        const ry = roundCoord(worldPos.y)
        emit('vertex-move', props.asset.id, dragVertexIndex.value, rx, ry)
        lastEmittedPoint.value = { x: rx, y: ry }
      }
    }
  }

  const onEnd = () => {
    stage.off('mousemove touchmove', onMove)
    stage.off('mouseup touchend', onEnd)
    stage.draggable(wasDraggable) // G8: restore

    isDragging.value = false
    dragVertexIndex.value = null
    localVertices.value = null
    lastEmittedPoint.value = null

    emit('vertex-drag-end', props.asset)
  }

  stage.on('mousemove touchmove', onMove)
  stage.on('mouseup touchend', onEnd)
}

// ─── Circle radius drag ────────────────────────────────────────────────

function onCircleHandleMouseDown(e: any) {
  e.cancelBubble = true
  startCircleRadiusDrag(e)
}

function onCircleHandleTouchStart(e: any) {
  e.cancelBubble = true
  startCircleRadiusDrag(e)
}

function startCircleRadiusDrag(e: any) {
  const pos = getStagePointerPos(e)
  if (!pos) return

  isDragging.value = true
  localCircleRadius.value = effectiveRadius.value
  lastEmittedPoint.value = { x: pos.x, y: pos.y }

  const stage = e?.target?.getStage?.()
  if (!stage) return

  const wasDraggable = stage.draggable()
  stage.draggable(false)

  const cx = params.value.cx ?? 0
  const cy = params.value.cy ?? 0

  const onMove = () => {
    const mPos = stage.getPointerPosition()
    if (!mPos) return
    const transform = stage.getAbsoluteTransform().copy().invert()
    const worldPos = transform.point(mPos)

    const newRadius = Math.max(5, Math.hypot(worldPos.x - cx, worldPos.y - cy))
    localCircleRadius.value = newRadius

    if (lastEmittedPoint.value) {
      const dist = Math.hypot(
        worldPos.x - lastEmittedPoint.value.x,
        worldPos.y - lastEmittedPoint.value.y,
      )
      if (dist >= MIN_EMIT_DISTANCE_PX) {
        emit('circle-move', props.asset.id, roundCoord(cx), roundCoord(cy), roundCoord(newRadius))
        lastEmittedPoint.value = { x: worldPos.x, y: worldPos.y }
      }
    }
  }

  const onEnd = () => {
    stage.off('mousemove touchmove', onMove)
    stage.off('mouseup touchend', onEnd)
    stage.draggable(wasDraggable)

    isDragging.value = false
    localCircleRadius.value = null
    lastEmittedPoint.value = null

    emit('circle-drag-end', props.asset)
  }

  stage.on('mousemove touchmove', onMove)
  stage.on('mouseup touchend', onEnd)
}
</script>
