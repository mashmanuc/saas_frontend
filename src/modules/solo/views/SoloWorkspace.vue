<template>
  <div class="solo-workspace" :class="{ 'solo-workspace--fullscreen': isFullscreen }">
    <SoloHeader
      :name="workspaceName"
      :last-saved="lastSaved"
      @update:name="workspaceName = $event"
      @save="handleSave"
      @export-png="handleExportPNG"
      @export-json="handleExportJSON"
      @exit="handleExit"
    />

    <div class="solo-main">
      <SoloToolbar
        :current-tool="currentTool"
        :current-color="currentColor"
        :current-size="currentSize"
        :preset-colors="PRESET_COLORS"
        :preset-sizes="PRESET_SIZES"
        @tool-change="setTool"
        @color-change="setColor"
        @size-change="setSize"
        @undo="handleUndo"
        @redo="handleRedo"
        @clear="handleClear"
      />

      <SoloCanvas
        ref="canvasRef"
        :page="activePage"
        :tool="currentTool"
        :color="currentColor"
        :size="currentSize"
        :zoom="zoom"
        :pan-x="pan.x"
        :pan-y="pan.y"
        @stroke-end="handleStrokeEnd"
        @shape-end="handleShapeEnd"
        @text-create="handleTextCreate"
        @zoom-change="zoom = $event"
        @pan-change="handlePanChange"
      />

      <LocalVideoPreview
        v-if="showVideo"
        :stream="stream"
        :video-enabled="videoEnabled"
        :audio-enabled="audioEnabled"
        @toggle-video="toggleVideo"
        @toggle-audio="toggleAudio"
      />
    </div>

    <SoloFooter
      :pages="pages"
      :active-page-id="activePageId"
      :zoom="zoom"
      :fullscreen="isFullscreen"
      @page-switch="switchPage"
      @page-add="addPage"
      @page-delete="deletePage"
      @page-rename="renamePage"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
      @zoom-reset="resetZoom"
      @toggle-fullscreen="toggleFullscreen"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Stroke, Shape, TextElement, PageState } from '../types/solo'
import { HistoryManager } from '../engine/HistoryManager'
import { useTools } from '../composables/useTools'
import { usePages } from '../composables/usePages'
import { useStorage } from '../composables/useStorage'
import { useLocalMedia } from '../composables/useLocalMedia'

import SoloHeader from '../components/header/SoloHeader.vue'
import SoloToolbar from '../components/toolbar/SoloToolbar.vue'
import SoloCanvas from '../components/canvas/SoloCanvas.vue'
import SoloFooter from '../components/footer/SoloFooter.vue'
import LocalVideoPreview from '../components/video/LocalVideoPreview.vue'

import '../styles/solo.css'

const router = useRouter()

// Tools
const {
  currentTool,
  currentColor,
  currentSize,
  setTool,
  setColor,
  setSize,
  handleKeyboardShortcut,
  PRESET_COLORS,
  PRESET_SIZES,
} = useTools()

// Pages
const {
  pages,
  activePageId,
  activePage,
  addPage,
  deletePage,
  switchPage,
  renamePage,
  addStroke,
  addShape,
  addText,
  removeStroke,
  removeShape,
  removeText,
  clearPage,
  setPages,
  getPageState,
} = usePages()

// Storage
const { lastSaved, save, load, startAutosave, stopAutosave, exportPNG, exportJSON } = useStorage()

// Media
const { stream, videoEnabled, audioEnabled, startCamera, stopCamera, toggleVideo, toggleAudio } =
  useLocalMedia()

// Canvas ref
const canvasRef = ref<InstanceType<typeof SoloCanvas> | null>(null)

// State
const workspaceName = ref('Untitled')
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const isFullscreen = ref(false)
const showVideo = ref(true)

// History
const history = new HistoryManager()

// Handlers
function handleStrokeEnd(stroke: Stroke): void {
  addStroke(stroke)
  history.push({
    pageId: activePageId.value,
    type: 'add-stroke',
    payload: stroke,
  })
}

function handleShapeEnd(shape: Shape): void {
  addShape(shape)
  history.push({
    pageId: activePageId.value,
    type: 'add-shape',
    payload: shape,
  })
}

function handleTextCreate(text: TextElement): void {
  addText(text)
  history.push({
    pageId: activePageId.value,
    type: 'add-text',
    payload: text,
  })
}

function handleUndo(): void {
  const action = history.undo()
  if (!action) return

  switch (action.type) {
    case 'add-stroke':
      removeStroke((action.payload as Stroke).id)
      break
    case 'add-shape':
      removeShape((action.payload as Shape).id)
      break
    case 'add-text':
      removeText((action.payload as TextElement).id)
      break
  }
}

function handleRedo(): void {
  const action = history.redo()
  if (!action) return

  switch (action.type) {
    case 'add-stroke':
      addStroke(action.payload as Stroke)
      break
    case 'add-shape':
      addShape(action.payload as Shape)
      break
    case 'add-text':
      addText(action.payload as TextElement)
      break
  }
}

function handleClear(): void {
  if (confirm('Clear this page? This cannot be undone.')) {
    clearPage()
    history.clear()
  }
}

function handleSave(): void {
  save(getPageState(), workspaceName.value)
}

function handleExportPNG(): void {
  const canvas = canvasRef.value?.getCanvas()
  if (canvas) {
    exportPNG(canvas, `${workspaceName.value}.png`)
  }
}

function handleExportJSON(): void {
  exportJSON(getPageState(), `${workspaceName.value}.json`)
}

function handleExit(): void {
  handleSave()
  router.push('/dashboard')
}

function handlePanChange(x: number, y: number): void {
  pan.value = { x, y }
}

function zoomIn(): void {
  zoom.value = Math.min(4, zoom.value + 0.1)
}

function zoomOut(): void {
  zoom.value = Math.max(0.25, zoom.value - 0.1)
}

function resetZoom(): void {
  zoom.value = 1
  pan.value = { x: 0, y: 0 }
}

function toggleFullscreen(): void {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
    isFullscreen.value = true
  } else {
    document.exitFullscreen()
    isFullscreen.value = false
  }
}

function handleKeyDown(e: KeyboardEvent): void {
  // Ctrl+Z - Undo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    handleUndo()
    return
  }

  // Ctrl+Y or Ctrl+Shift+Z - Redo
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    handleRedo()
    return
  }

  // Ctrl+S - Save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    handleSave()
    return
  }

  // Tool shortcuts (only if not in input)
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return
  }

  handleKeyboardShortcut(e.key)
}

// Lifecycle
onMounted(async () => {
  // Load saved state
  const saved = load()
  if (saved) {
    setPages(saved.pages)
    workspaceName.value = saved.name
    zoom.value = saved.zoom
    pan.value = saved.pan
  }

  // Start autosave
  startAutosave(getPageState, () => workspaceName.value)

  // Start camera
  await startCamera()

  // Keyboard shortcuts
  window.addEventListener('keydown', handleKeyDown)

  // Fullscreen change
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
})

onUnmounted(() => {
  stopAutosave()
  stopCamera()
  window.removeEventListener('keydown', handleKeyDown)
})
</script>
