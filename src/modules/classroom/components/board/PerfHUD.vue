<template>
  <div v-if="visible" class="perf-hud" :class="{ 'perf-hud--warning': fps < 30 }">
    <!-- Basic metrics -->
    <div class="perf-hud__row">
      <span class="perf-hud__label">FPS:</span>
      <span class="perf-hud__value" :class="{ 'perf-hud__value--warning': fps < 55 }">{{ fps }}</span>
    </div>
    <div class="perf-hud__row">
      <span class="perf-hud__label">Draw:</span>
      <span class="perf-hud__value">{{ drawCalls }}/s</span>
    </div>
    <div class="perf-hud__row">
      <span class="perf-hud__label">Render:</span>
      <span class="perf-hud__value">{{ renderTime.toFixed(1) }}ms</span>
    </div>
    <div class="perf-hud__row">
      <span class="perf-hud__label">Block:</span>
      <span class="perf-hud__value" :class="{ 'perf-hud__value--warning': mainThreadBlock > 8 }">
        {{ mainThreadBlock.toFixed(1) }}ms
      </span>
    </div>
    
    <!-- F29-STEALTH: Save window metrics -->
    <div class="perf-hud__divider"></div>
    <div class="perf-hud__row">
      <span class="perf-hud__label">ExtraDraws:</span>
      <span class="perf-hud__value" :class="{ 'perf-hud__value--error': extraDrawsDuringSave > 0 }">
        {{ extraDrawsDuringSave }}
      </span>
    </div>
    <div class="perf-hud__row">
      <span class="perf-hud__label">SaveBlock:</span>
      <span class="perf-hud__value" :class="{ 'perf-hud__value--warning': mainThreadBlockDuringSave > 8 }">
        {{ mainThreadBlockDuringSave.toFixed(1) }}ms
      </span>
    </div>
    <div class="perf-hud__row">
      <span class="perf-hud__label">InputLat:</span>
      <span class="perf-hud__value" :class="{ 'perf-hud__value--warning': inputLatencyDuringSave > 16 }">
        {{ inputLatencyDuringSave.toFixed(1) }}ms
      </span>
    </div>
    <div class="perf-hud__row">
      <span class="perf-hud__label">Overlay:</span>
      <span class="perf-hud__value" :class="{ 'perf-hud__value--warning': overlayCopyMs > 3 }">
        {{ overlayCopyMs.toFixed(1) }}ms
      </span>
    </div>
    <div v-if="saveRTT > 0" class="perf-hud__row">
      <span class="perf-hud__label">SaveRTT:</span>
      <span class="perf-hud__value">{{ saveRTT.toFixed(0) }}ms</span>
    </div>
    <div v-if="isSaveActive" class="perf-hud__row perf-hud__row--saving">
      <span class="perf-hud__label">⏳ SAVING...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * F29.8 — Profiler Overlay (Perf HUD)
 * Dev-only performance monitoring overlay
 * Toggle with Ctrl+Alt+P
 * 
 * F29-STEALTH: Extended with save window metrics
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'
import {
  subscribeToMetrics,
  getMetricsSnapshot,
  isSaveWindowActive,
  type SaveWindowMetrics,
} from '../../board/perf/saveWindowMetrics'

interface Props {
  stageRef?: { getStage?: () => { getDrawCalls?: () => number } | null } | null
  enabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  stageRef: null,
  enabled: false,
})

const visible = ref(false)
const fps = ref(60)
const drawCalls = ref(0)
const renderTime = ref(0)
const saveRTT = ref(0)
const mainThreadBlock = ref(0)

// F29-STEALTH: Save window metrics
const extraDrawsDuringSave = ref(0)
const mainThreadBlockDuringSave = ref(0)
const inputLatencyDuringSave = ref(0)
const overlayCopyMs = ref(0)
const isSaveActive = ref(false)

let frameCount = 0
let lastFrameTime = performance.now()
let lastSecondTime = performance.now()
let drawCallsThisSecond = 0
let animationFrameId: number | null = null
let lastDrawCalls = 0

// Track main thread blocking
let lastTaskTime = performance.now()
let maxBlockThisSecond = 0

function measureFrame() {
  const now = performance.now()
  const delta = now - lastFrameTime
  lastFrameTime = now
  frameCount++

  // Track main thread blocking (long tasks)
  const taskDuration = delta
  if (taskDuration > maxBlockThisSecond) {
    maxBlockThisSecond = taskDuration
  }

  // Update stats every second
  if (now - lastSecondTime >= 1000) {
    fps.value = Math.round(frameCount * 1000 / (now - lastSecondTime))
    
    // Get draw calls from stage if available
    const stage = props.stageRef?.getStage?.()
    if (stage && typeof stage.getDrawCalls === 'function') {
      const currentDrawCalls = stage.getDrawCalls()
      drawCalls.value = currentDrawCalls - lastDrawCalls
      lastDrawCalls = currentDrawCalls
    } else {
      drawCalls.value = drawCallsThisSecond
    }

    mainThreadBlock.value = maxBlockThisSecond
    maxBlockThisSecond = 0
    drawCallsThisSecond = 0
    frameCount = 0
    lastSecondTime = now

    // Log to console with tag
    if (visible.value) {
      console.log('[perf.board]', {
        fps: fps.value,
        drawCalls: drawCalls.value,
        renderTime: renderTime.value.toFixed(1),
        mainThreadBlock: mainThreadBlock.value.toFixed(1),
      })
    }
  }

  if (visible.value) {
    animationFrameId = requestAnimationFrame(measureFrame)
  }
}

function handleKeyDown(e: KeyboardEvent) {
  // Ctrl+Alt+P to toggle
  if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'p') {
    e.preventDefault()
    visible.value = !visible.value
    if (visible.value) {
      animationFrameId = requestAnimationFrame(measureFrame)
      console.log('[perf.board] HUD enabled')
    } else {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      }
      console.log('[perf.board] HUD disabled')
    }
  }
}

// Track render time from external source
function updateRenderTime(time: number) {
  renderTime.value = time
}

// Track save RTT from external source
function updateSaveRTT(rtt: number) {
  saveRTT.value = rtt
}

// Track draw calls manually
function trackDrawCall() {
  drawCallsThisSecond++
}

// F29-STEALTH: Update save window metrics from subscription
function handleMetricsUpdate(metrics: SaveWindowMetrics): void {
  extraDrawsDuringSave.value = metrics.extraDrawsDuringSave
  mainThreadBlockDuringSave.value = metrics.mainThreadBlockMsDuringSave
  inputLatencyDuringSave.value = metrics.inputLatencyMsDuringSave
  overlayCopyMs.value = metrics.overlayCopyMs
  saveRTT.value = metrics.saveRttMs
}

let unsubscribeMetrics: (() => void) | null = null

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  
  // Subscribe to save window metrics
  unsubscribeMetrics = subscribeToMetrics(handleMetricsUpdate)
  
  // Load initial metrics
  const initial = getMetricsSnapshot()
  handleMetricsUpdate(initial)
  
  // Start measuring if enabled by default
  if (props.enabled) {
    visible.value = true
    animationFrameId = requestAnimationFrame(measureFrame)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
  if (unsubscribeMetrics) {
    unsubscribeMetrics()
  }
})

watch(() => props.enabled, (newVal) => {
  if (newVal && !visible.value) {
    visible.value = true
    animationFrameId = requestAnimationFrame(measureFrame)
  }
})

// F29-STEALTH: Check save window status in measureFrame
function updateSaveWindowStatus(): void {
  isSaveActive.value = isSaveWindowActive()
}

defineExpose({
  updateRenderTime,
  updateSaveRTT,
  trackDrawCall,
  updateSaveWindowStatus,
})
</script>

<style scoped>
/* F29-AS.25: CSS containment to prevent layout/reflow */
.perf-hud {
  position: fixed;
  top: 8px;
  right: 8px;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  color: #00ff00;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 11px;
  padding: 8px 12px;
  border-radius: 4px;
  pointer-events: none;
  contain: content;
  will-change: contents;
  min-width: 120px;
}

.perf-hud--warning {
  background: rgba(180, 0, 0, 0.9);
}

.perf-hud__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  line-height: 1.4;
}

.perf-hud__label {
  color: #888;
}

.perf-hud__value {
  font-weight: 600;
  text-align: right;
}

.perf-hud__value--warning {
  color: #ff6600;
}

.perf-hud__value--error {
  color: #ff0000;
  font-weight: 700;
}

.perf-hud__divider {
  height: 1px;
  background: #444;
  margin: 4px 0;
}

.perf-hud__row--saving {
  color: #ffcc00;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
