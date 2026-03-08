<template>
  <svg
    v-if="gridType !== 'none'"
    class="wb-grid-overlay"
    :width="scaledWidth"
    :height="scaledHeight"
    :viewBox="`0 0 ${width} ${height}`"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <!-- Small grid pattern (20px cells) -->
      <pattern
        v-if="gridType === 'small-grid'"
        id="wb-pattern-small-grid"
        :width="20"
        :height="20"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M 20 0 L 0 0 0 20"
          fill="none"
          :stroke="gridColor"
          stroke-width="0.5"
        />
      </pattern>

      <!-- Large grid pattern (40px cells) -->
      <pattern
        v-if="gridType === 'large-grid'"
        id="wb-pattern-large-grid"
        :width="40"
        :height="40"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M 40 0 L 0 0 0 40"
          fill="none"
          :stroke="gridColor"
          stroke-width="0.5"
        />
      </pattern>

      <!-- Dots pattern (20px spacing) -->
      <pattern
        v-if="gridType === 'dots'"
        id="wb-pattern-dots"
        :width="20"
        :height="20"
        patternUnits="userSpaceOnUse"
      >
        <circle
          cx="10"
          cy="10"
          r="1"
          :fill="gridColor"
        />
      </pattern>

      <!-- Ruled lines pattern (32px spacing) -->
      <pattern
        v-if="gridType === 'ruled'"
        id="wb-pattern-ruled"
        :width="width"
        :height="32"
        patternUnits="userSpaceOnUse"
      >
        <line
          x1="0"
          :y1="31.5"
          :x2="width"
          :y2="31.5"
          :stroke="gridColor"
          stroke-width="0.5"
        />
      </pattern>
    </defs>

    <!-- Fill rectangle with pattern -->
    <rect
      v-if="gridType === 'small-grid'"
      width="100%"
      height="100%"
      fill="url(#wb-pattern-small-grid)"
    />
    <rect
      v-if="gridType === 'large-grid'"
      width="100%"
      height="100%"
      fill="url(#wb-pattern-large-grid)"
    />
    <rect
      v-if="gridType === 'dots'"
      width="100%"
      height="100%"
      fill="url(#wb-pattern-dots)"
    />
    <rect
      v-if="gridType === 'ruled'"
      width="100%"
      height="100%"
      fill="url(#wb-pattern-ruled)"
    />

    <!-- Coordinate plane: dynamic grid + axes + labels -->
    <g v-if="gridType === 'coordinate'">
      <defs>
        <!-- Minor grid — dynamic step based on zoom -->
        <pattern
          id="wb-pattern-coord-minor"
          :width="coordMinorStep"
          :height="coordMinorStep"
          patternUnits="userSpaceOnUse"
        >
          <path
            :d="`M ${coordMinorStep} 0 L 0 0 0 ${coordMinorStep}`"
            fill="none"
            :stroke="coordMinorColor"
            stroke-width="0.4"
          />
        </pattern>
        <!-- Major grid — dynamic step based on zoom -->
        <pattern
          id="wb-pattern-coord-major"
          :width="coordMajorStep"
          :height="coordMajorStep"
          patternUnits="userSpaceOnUse"
        >
          <path
            :d="`M ${coordMajorStep} 0 L 0 0 0 ${coordMajorStep}`"
            fill="none"
            :stroke="coordMajorColor"
            stroke-width="0.8"
          />
        </pattern>
      </defs>

      <!-- Minor grid -->
      <rect width="100%" height="100%" fill="url(#wb-pattern-coord-minor)" />
      <!-- Major grid -->
      <rect width="100%" height="100%" fill="url(#wb-pattern-coord-major)" />

      <!-- X axis -->
      <line
        x1="0"
        :y1="originY"
        :x2="width"
        :y2="originY"
        :stroke="axisColor"
        stroke-width="2"
      />
      <!-- Y axis -->
      <line
        :x1="originX"
        y1="0"
        :x2="originX"
        :y2="height"
        :stroke="axisColor"
        stroke-width="2"
      />

      <!-- X axis arrow -->
      <polygon
        :points="`${width - 2},${originY - 5} ${width - 2},${originY + 5} ${width + 5},${originY}`"
        :fill="axisColor"
      />
      <!-- Y axis arrow -->
      <polygon
        :points="`${originX - 5},2 ${originX + 5},2 ${originX},-5`"
        :fill="axisColor"
      />

      <!-- X axis tick marks + labels -->
      <g :transform="`translate(0, ${originY})`">
        <template v-for="n in xLabels" :key="`xl-${n}`">
          <line
            :x1="originX + n * coordMajorStep"
            y1="-5"
            :x2="originX + n * coordMajorStep"
            y2="5"
            :stroke="axisColor"
            stroke-width="1.2"
          />
          <text
            v-if="n !== 0"
            :x="originX + n * coordMajorStep"
            y="18"
            text-anchor="middle"
            :fill="labelColor"
            font-size="12"
            font-weight="500"
            font-family="system-ui, sans-serif"
          >{{ n }}</text>
        </template>
      </g>

      <!-- Y axis tick marks + labels -->
      <g :transform="`translate(${originX}, 0)`">
        <template v-for="n in yLabels" :key="`yl-${n}`">
          <line
            x1="-5"
            :y1="originY - n * coordMajorStep"
            x2="5"
            :y2="originY - n * coordMajorStep"
            :stroke="axisColor"
            stroke-width="1.2"
          />
          <text
            v-if="n !== 0"
            x="-12"
            :y="originY - n * coordMajorStep + 4"
            text-anchor="end"
            :fill="labelColor"
            font-size="12"
            font-weight="500"
            font-family="system-ui, sans-serif"
          >{{ n }}</text>
        </template>
      </g>

      <!-- Origin label "0" -->
      <text
        :x="originX - 12"
        :y="originY + 18"
        text-anchor="end"
        :fill="labelColor"
        font-size="12"
        font-weight="600"
        font-family="system-ui, sans-serif"
      >0</text>

      <!-- Axis labels "x" and "y" -->
      <text
        :x="width - 16"
        :y="originY - 12"
        :fill="axisColor"
        font-size="14"
        font-weight="700"
        font-style="italic"
        font-family="system-ui, sans-serif"
      >x</text>
      <text
        :x="originX + 12"
        y="18"
        :fill="axisColor"
        font-size="14"
        font-weight="700"
        font-style="italic"
        font-family="system-ui, sans-serif"
      >y</text>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GridType } from '../../composables/useGridOverlay'

const props = withDefaults(defineProps<{
  gridType: GridType
  width: number
  height: number
  zoom: number
}>(), {
  gridType: 'none',
  width: 1920,
  height: 1080,
  zoom: 1,
})

// Scaled dimensions — SVG element matches Konva stage pixel size
const scaledWidth = computed(() => props.width * props.zoom)
const scaledHeight = computed(() => props.height * props.zoom)

// Colors for grid lines
const gridColor = '#cbd5e1' // slate-300

// Coordinate plane — darker, more visible colors
const coordMinorColor = '#cbd5e1' // slate-300 (was slate-200)
const coordMajorColor = '#94a3b8' // slate-400 (was slate-300)
const axisColor = '#1e293b' // slate-800 (was slate-700)
const labelColor = '#334155' // slate-700 (was slate-500)

// Dynamic coordinate step based on zoom level
// At zoom 1.0: minor=20px, major=100px (5 minor = 1 major)
// Zoom in  → more detail visible, can use smaller steps
// Zoom out → less detail, use larger steps to avoid clutter
const coordMinorStep = computed(() => {
  const z = props.zoom
  if (z >= 2) return 10
  if (z >= 1.5) return 15
  if (z >= 0.8) return 20
  if (z >= 0.5) return 25
  return 40
})

const coordMajorStep = computed(() => coordMinorStep.value * 5)

// Coordinate plane: origin at center of canvas
const originX = computed(() => Math.round(props.width / 2))
const originY = computed(() => Math.round(props.height / 2))

// Generate labels for X axis (dynamic step)
const xLabels = computed(() => {
  const step = coordMajorStep.value
  const labels: number[] = []
  const maxPositive = Math.floor((props.width - originX.value) / step)
  const maxNegative = Math.floor(originX.value / step)
  for (let i = -maxNegative; i <= maxPositive; i++) {
    labels.push(i)
  }
  return labels
})

// Generate labels for Y axis (positive up, negative down)
const yLabels = computed(() => {
  const step = coordMajorStep.value
  const labels: number[] = []
  const maxPositive = Math.floor(originY.value / step)
  const maxNegative = Math.floor((props.height - originY.value) / step)
  for (let i = -maxNegative; i <= maxPositive; i++) {
    labels.push(i)
  }
  return labels
})
</script>

<style scoped>
.wb-grid-overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 1;
  user-select: none;
}
</style>
