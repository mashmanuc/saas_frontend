<template>
  <div
    class="timeline-preview fixed z-50 bg-gray-800 rounded-lg shadow-xl border border-gray-600 p-2"
    :style="{ left: `${position.x + 20}px`, top: `${position.y}px` }"
  >
    <div class="w-48 h-32 bg-gray-900 rounded overflow-hidden">
      <!-- Mini board preview -->
      <canvas ref="previewCanvas" class="w-full h-full" />
    </div>
    <div class="mt-2 text-xs text-gray-400">
      {{ formatEventType(event.event_type) }}
    </div>
    <div class="text-xs text-gray-500">
      {{ formatTime(event.timestamp_ms) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import type { TimelineEvent } from '../composables/useTimeline'

interface Props {
  event: TimelineEvent
  position: { x: number; y: number }
}

const props = defineProps<Props>()
const previewCanvas = ref<HTMLCanvasElement | null>(null)

function formatEventType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

async function renderPreview(): Promise<void> {
  if (!previewCanvas.value || !props.event.data) return

  const ctx = previewCanvas.value.getContext('2d')
  if (!ctx) return

  // Clear canvas
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, previewCanvas.value.width, previewCanvas.value.height)

  // Render stroke preview if available
  const strokeData = props.event.data.strokeData as {
    color?: string
    points?: { x: number; y: number }[]
  } | undefined

  if (strokeData?.points && strokeData.points.length > 0) {
    ctx.strokeStyle = strokeData.color || '#fff'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()

    const scale = 0.2
    ctx.moveTo(strokeData.points[0].x * scale, strokeData.points[0].y * scale)

    for (let i = 1; i < strokeData.points.length; i++) {
      ctx.lineTo(strokeData.points[i].x * scale, strokeData.points[i].y * scale)
    }
    ctx.stroke()
  }

  // Render object preview if available
  const objectData = props.event.data.object as {
    type?: string
    x?: number
    y?: number
    width?: number
    height?: number
    color?: string
  } | undefined

  if (objectData) {
    ctx.fillStyle = objectData.color || '#3b82f6'
    const scale = 0.2
    const x = (objectData.x || 0) * scale
    const y = (objectData.y || 0) * scale
    const w = (objectData.width || 50) * scale
    const h = (objectData.height || 50) * scale

    if (objectData.type === 'rect') {
      ctx.fillRect(x, y, w, h)
    } else if (objectData.type === 'circle') {
      ctx.beginPath()
      ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

watch(() => props.event, renderPreview, { immediate: true })

onMounted(() => {
  if (previewCanvas.value) {
    previewCanvas.value.width = 192
    previewCanvas.value.height = 128
    renderPreview()
  }
})
</script>

<style scoped>
.timeline-preview {
  pointer-events: none;
}
</style>
