<template>
  <div class="snapshot-diff">
    <div class="flex items-center gap-4 mb-4">
      <!-- Version A selector -->
      <select v-model="versionA" class="input">
        <option v-for="s in snapshots" :key="s.version" :value="s.version">
          Версія {{ s.version }}
        </option>
      </select>

      <ArrowRight class="w-5 h-5 text-gray-400" />

      <!-- Version B selector -->
      <select v-model="versionB" class="input">
        <option v-for="s in snapshots" :key="s.version" :value="s.version">
          Версія {{ s.version }}
        </option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <Loader2 class="w-8 h-8 text-primary-500 animate-spin" />
    </div>

    <!-- Side by side comparison -->
    <div v-else class="grid grid-cols-2 gap-4">
      <div class="bg-gray-800 rounded-lg p-4">
        <h4 class="text-sm font-medium text-gray-400 mb-2">
          Версія {{ versionA }}
        </h4>
        <div class="aspect-video bg-gray-900 rounded overflow-hidden">
          <canvas ref="canvasA" class="w-full h-full" />
        </div>
      </div>

      <div class="bg-gray-800 rounded-lg p-4">
        <h4 class="text-sm font-medium text-gray-400 mb-2">
          Версія {{ versionB }}
        </h4>
        <div class="aspect-video bg-gray-900 rounded overflow-hidden">
          <canvas ref="canvasB" class="w-full h-full" />
        </div>
      </div>
    </div>

    <!-- Diff stats -->
    <div v-if="diffStats" class="mt-4 p-4 bg-gray-800 rounded-lg">
      <h4 class="font-medium text-white mb-2">Зміни</h4>
      <div class="grid grid-cols-3 gap-4 text-sm">
        <div class="text-green-400">
          +{{ diffStats.added }} додано
        </div>
        <div class="text-red-400">
          -{{ diffStats.removed }} видалено
        </div>
        <div class="text-yellow-400">
          ~{{ diffStats.modified }} змінено
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { ArrowRight, Loader2 } from 'lucide-vue-next'
import { classroomApi } from '../api/classroom'

interface Snapshot {
  version: number
  snapshot_type: string
  created_at: string
}

interface Props {
  sessionId: string
  snapshots: Snapshot[]
  initialVersionA?: number
  initialVersionB?: number
}

const props = defineProps<Props>()

const versionA = ref(props.initialVersionA || props.snapshots[0]?.version)
const versionB = ref(
  props.initialVersionB || props.snapshots[props.snapshots.length - 1]?.version
)
const canvasA = ref<HTMLCanvasElement | null>(null)
const canvasB = ref<HTMLCanvasElement | null>(null)
const diffStats = ref<{ added: number; removed: number; modified: number } | null>(null)
const isLoading = ref(false)

async function loadAndRender(): Promise<void> {
  if (!versionA.value || !versionB.value) return

  isLoading.value = true

  try {
    const [snapshotA, snapshotB] = await Promise.all([
      classroomApi.getSnapshot(props.sessionId, versionA.value),
      classroomApi.getSnapshot(props.sessionId, versionB.value),
    ])

    // Render both canvases
    renderBoardState(canvasA.value, snapshotA.board_state)
    renderBoardState(canvasB.value, snapshotB.board_state)

    // Calculate diff
    diffStats.value = calculateDiff(snapshotA.board_state, snapshotB.board_state)
  } catch (error) {
    console.error('[SnapshotDiff] Failed to load snapshots:', error)
  } finally {
    isLoading.value = false
  }
}

function renderBoardState(
  canvas: HTMLCanvasElement | null,
  state: Record<string, unknown>
): void {
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Set canvas size
  canvas.width = canvas.offsetWidth * 2
  canvas.height = canvas.offsetHeight * 2
  ctx.scale(2, 2)

  // Clear
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Render strokes
  const strokes = (state.strokes || []) as Array<{
    points: { x: number; y: number }[]
    color?: string
    width?: number
  }>

  const scale = canvas.offsetWidth / 1920 // Assuming 1920px board width

  for (const stroke of strokes) {
    if (!stroke.points || stroke.points.length < 2) continue

    ctx.strokeStyle = stroke.color || '#ffffff'
    ctx.lineWidth = (stroke.width || 2) * scale
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()

    ctx.moveTo(stroke.points[0].x * scale, stroke.points[0].y * scale)
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x * scale, stroke.points[i].y * scale)
    }
    ctx.stroke()
  }

  // Render objects
  const objects = (state.objects || {}) as Record<
    string,
    { type: string; x: number; y: number; width: number; height: number; color?: string }
  >

  for (const obj of Object.values(objects)) {
    ctx.fillStyle = obj.color || '#3b82f6'
    const x = obj.x * scale
    const y = obj.y * scale
    const w = obj.width * scale
    const h = obj.height * scale

    if (obj.type === 'rect') {
      ctx.fillRect(x, y, w, h)
    } else if (obj.type === 'circle') {
      ctx.beginPath()
      ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function calculateDiff(
  stateA: Record<string, unknown>,
  stateB: Record<string, unknown>
): { added: number; removed: number; modified: number } {
  const objectsA = (stateA.objects || {}) as Record<string, unknown>
  const objectsB = (stateB.objects || {}) as Record<string, unknown>

  const keysA = new Set(Object.keys(objectsA))
  const keysB = new Set(Object.keys(objectsB))

  let added = 0
  let removed = 0
  let modified = 0

  for (const id of keysB) {
    if (!keysA.has(id)) added++
  }

  for (const id of keysA) {
    if (!keysB.has(id)) {
      removed++
    } else if (JSON.stringify(objectsA[id]) !== JSON.stringify(objectsB[id])) {
      modified++
    }
  }

  // Also count stroke differences
  const strokesA = (stateA.strokes || []) as unknown[]
  const strokesB = (stateB.strokes || []) as unknown[]

  added += Math.max(0, strokesB.length - strokesA.length)
  removed += Math.max(0, strokesA.length - strokesB.length)

  return { added, removed, modified }
}

watch([() => versionA.value, () => versionB.value], loadAndRender)

onMounted(() => {
  loadAndRender()
})
</script>

<style scoped>
.input {
  background: var(--color-bg-secondary, #374151);
  border: 1px solid var(--color-border, #4b5563);
  border-radius: 8px;
  padding: 8px 12px;
  color: white;
  font-size: 14px;
}

.input:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
