<template>
  <div class="solo-workspace-v2" :class="{ 'solo-workspace-v2--fullscreen': isFullscreen }">
    <!-- Header -->
    <header class="solo-workspace-v2__header">
      <div class="solo-workspace-v2__title">
        <input
          v-model="sessionName"
          class="title-input"
          placeholder="Untitled Solo Session"
          @blur="handleTitleBlur"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
      </div>

      <div class="solo-workspace-v2__status">
        <span v-if="autosaveStatus.isSaving" class="status-saving">{{ $t('soloWorkspace.status.saving') }}</span>
        <span v-else-if="autosaveStatus.lastSaved" class="status-saved">
          {{ $t('soloWorkspace.status.saved', { time: formatLastSaved(autosaveStatus.lastSaved) }) }}
        </span>
        <span v-else-if="autosaveStatus.pendingChanges" class="status-pending">{{ $t('soloWorkspace.status.unsavedChanges') }}</span>
      </div>

      <div class="solo-workspace-v2__actions">
        <button class="action-btn" @click="backToList" :title="$t('soloWorkspace.header.backToList')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <button class="action-btn" :disabled="!canUndo" @click="handleUndo" :title="$t('soloWorkspace.header.undo')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <path d="M3 7v6h6"/>
            <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
          </svg>
        </button>
        <button class="action-btn" :disabled="!canRedo" @click="handleRedo" :title="$t('soloWorkspace.header.redo')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <path d="M21 7v6h-6"/>
            <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/>
          </svg>
        </button>
        <button class="action-btn" @click="handleClear" :title="$t('soloWorkspace.header.clear')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
        </button>
        <button class="action-btn" @click="handleExportPDF" :title="$t('soloWorkspace.header.exportPDF')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <label class="action-btn" :title="$t('soloWorkspace.header.importPDF')" style="cursor: pointer; margin: 0;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <input type="file" accept=".pdf" @change="handleImportPDF" style="display: none;" ref="pdfInputRef" />
        </label>
        <button class="btn btn-secondary" @click="handleSave">{{ $t('soloWorkspace.header.save') }}</button>
        <button class="btn btn-primary" @click="handleExit">{{ $t('soloWorkspace.header.exit') }}</button>
      </div>
    </header>

    <!-- Main content: Toolbar + Canvas -->
    <div class="solo-workspace-v2__main">
      <!-- Solo Toolbar V2 -->
      <SoloToolbar
        :current-tool="currentTool"
        :current-color="currentColor"
        :current-size="currentSize"
        :current-arrow-style="arrowStyle"
        :current-arrow-size="arrowSize"
        :preset-colors="presetColors"
        :preset-sizes="presetSizes"
        @tool-change="handleToolChange"
        @color-change="handleColorChange"
        @size-change="handleSizeChange"
        @arrow-style-change="handleArrowStyleChange"
        @arrow-size-change="handleArrowSizeChange"
        @undo="handleUndo"
        @redo="handleRedo"
        @clear="handleClear"
      />

      <!-- Solo Canvas V2 -->
      <div class="solo-workspace-v2__canvas-wrapper">
        <SoloCanvas
          ref="canvasRef"
          :page="currentPageState"
          :tool="currentTool"
          :color="currentColor"
          :size="currentSize"
          :zoom="zoom"
          :pan-x="panX"
          :pan-y="panY"
          :arrow-style="arrowStyle"
          :arrow-size="arrowSize"
          :readonly="false"
          @stroke-end="handleStrokeEnd"
          @shape-end="handleShapeEnd"
          @text-create="handleTextCreate"
          @items-update="handleItemsUpdate"
          @items-delete="handleItemsDelete"
          @asset-add="handleAssetAdd"
          @tool-change="handleToolChange"
          @undo="handleUndo"
          @redo="handleRedo"
          @delete="handleDelete"
          @zoom-change="handleZoomChange"
          @pan-change="handlePanChange"
        />
      </div>
    </div>

    <!-- Footer: Page navigation + Zoom + Background -->
    <footer class="solo-workspace-v2__footer">
      <div class="page-nav">
        <button class="page-btn" :disabled="currentPageIndex <= 0" @click="prevPage" :title="$t('soloWorkspace.footer.previousPage')">←</button>
        <span class="page-indicator" :title="$t('soloWorkspace.footer.currentPage')">{{ currentPageIndex + 1 }} / {{ pages.length }}</span>
        <button class="page-btn" :disabled="currentPageIndex >= pages.length - 1" @click="nextPage" :title="$t('soloWorkspace.footer.nextPage')">→</button>
        <button class="page-btn" @click="addPage" :title="$t('soloWorkspace.footer.addPage')">+</button>
      </div>

      <BackgroundPicker
        :model-value="pageBackground"
        @update:model-value="handleBackgroundChange"
      />

      <div class="zoom-controls">
        <button class="zoom-btn" @click="zoomOut" :title="$t('soloWorkspace.footer.zoomOut')">−</button>
        <span class="zoom-level" :title="$t('soloWorkspace.footer.zoomLevel')">{{ Math.round(zoom * 100) }}%</span>
        <button class="zoom-btn" @click="zoomIn" :title="$t('soloWorkspace.footer.zoomIn')">+</button>
        <button class="zoom-btn" @click="toggleFullscreen" :title="$t('soloWorkspace.footer.fullscreen')">⛶</button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSoloStore } from '../store/soloStore'
import { useHistory } from '../composables/useHistory'
import { useAutosave } from '../composables/useAutosave'
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts'
import type { Tool, ArrowStyle, PageState, PageBackground, Stroke, Shape, TextElement } from '../types/solo'

// Components
import SoloToolbar from '../components/toolbar/SoloToolbar.vue'
import SoloCanvas from '../components/canvas/SoloCanvas.vue'
import BackgroundPicker from '../components/toolbar/BackgroundPicker.vue'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const soloStore = useSoloStore()

// Session state
const sessionId = ref<string | null>(null)
const sessionName = ref('Untitled Solo Session')
const pages = ref<PageState[]>([
  {
    id: 'page-1',
    name: 'Page 1',
    strokes: [],
    shapes: [],
    texts: [],
    assets: [],
    background: { type: 'white' }
  }
])
const currentPageIndex = ref(0)

// Tool state
const currentTool = ref<Tool>('pen')
const currentColor = ref('#000000')
const currentSize = ref(2)
const arrowStyle = ref<ArrowStyle>('arrow-end')
const arrowSize = ref(15)

// Canvas state
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isFullscreen = ref(false)

// Preset values
const presetColors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#FFFFFF']
const presetSizes = [1, 2, 4, 8, 16]

// Current page state
const currentPageState = computed(() => pages.value[currentPageIndex.value])
const pageBackground = computed<PageBackground>(() => currentPageState.value?.background || { type: 'white' })

function normalizePage(page: PageState): PageState {
  return {
    ...page,
    assets: page.assets ?? [],
    strokes: page.strokes ?? [],
    shapes: page.shapes ?? [],
    texts: page.texts ?? [],
    background: page.background ?? { type: 'white' }
  }
}

// Canvas ref
const canvasRef = ref<InstanceType<typeof SoloCanvas> | null>(null)

// History (undo/redo) - simplified for now, using local state
const historyStack = ref<any[]>([])
const historyIndex = ref(-1)
const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < historyStack.value.length - 1)

function recordChange() {
  // Simple history recording
  const snapshot = JSON.parse(JSON.stringify(pages.value))
  historyStack.value = historyStack.value.slice(0, historyIndex.value + 1)
  historyStack.value.push(snapshot)
  historyIndex.value++
  if (historyStack.value.length > 50) {
    historyStack.value.shift()
    historyIndex.value--
  }
}

function undo() {
  if (canUndo.value) {
    historyIndex.value--
    pages.value = JSON.parse(JSON.stringify(historyStack.value[historyIndex.value]))
  }
}

function redo() {
  if (canRedo.value) {
    historyIndex.value++
    pages.value = JSON.parse(JSON.stringify(historyStack.value[historyIndex.value]))
  }
}

// Autosave - simplified for now
const autosaveStatus = ref({
  isSaving: false,
  lastSaved: null as Date | null,
  pendingChanges: false
})

async function saveNow() {
  if (!sessionId.value) return
  
  autosaveStatus.value.isSaving = true
  try {
    await soloStore.updateSession(sessionId.value, {
      name: sessionName.value,
      state: {
        pages: pages.value,
        currentPageIndex: currentPageIndex.value
      },
      page_count: pages.value.length
    })
    autosaveStatus.value.lastSaved = new Date()
    autosaveStatus.value.pendingChanges = false
  } catch (error) {
    console.error('[SoloWorkspaceV2] Save failed:', error)
  } finally {
    autosaveStatus.value.isSaving = false
  }
}

// Keyboard shortcuts
useKeyboardShortcuts({
  onToolChange: (tool) => { currentTool.value = tool },
  onUndo: handleUndo,
  onRedo: handleRedo,
  onDelete: () => {
    // Delete selected items
    console.log('[SoloWorkspaceV2] Delete selected items')
  },
  onZoomIn: zoomIn,
  onZoomOut: zoomOut,
  onZoomReset: () => { zoom.value = 1 }
})

// Lifecycle
onMounted(async () => {
  const id = route.params.id as string | undefined

  if (id && id !== 'new') {
    // Load existing session
    const session = await soloStore.fetchSession(id)
    if (session) {
      sessionId.value = session.id
      sessionName.value = session.name
      if (session.state && typeof session.state === 'object' && 'pages' in session.state) {
        const state = session.state as { pages?: PageState[]; currentPageIndex?: number }
        if (state.pages && state.pages.length > 0) {
          pages.value = state.pages.map(normalizePage)
        }
        if (typeof state.currentPageIndex === 'number') {
          currentPageIndex.value = state.currentPageIndex
        }
      }
    } else {
      // Session not found, create new
      await createNewSession()
    }
  } else {
    // Create new session
    await createNewSession()
  }

  // Fullscreen change listener
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

onBeforeUnmount(async () => {
  // Save before exit
  if (sessionId.value && autosaveStatus.value.pendingChanges) {
    await saveNow()
  }
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})

// Watch for name changes
watch(sessionName, () => {
  autosaveStatus.value.pendingChanges = true
})

// Initial history snapshot
onMounted(() => {
  recordChange()
})

// Handlers
async function createNewSession(): Promise<void> {
  const session = await soloStore.createSession({
    name: sessionName.value,
    state: {
      pages: pages.value.map(normalizePage),
      currentPageIndex: currentPageIndex.value
    },
    page_count: pages.value.length
  })
  sessionId.value = session.id
  router.replace(`/solo-v2/${session.id}`)
}

function handleTitleBlur(): void {
  if (!sessionName.value.trim()) {
    sessionName.value = 'Untitled Solo Session'
  }
}

function handleToolChange(tool: Tool): void {
  currentTool.value = tool
}

function handleColorChange(color: string): void {
  currentColor.value = color
}

function handleSizeChange(size: number): void {
  currentSize.value = size
}

function handleArrowStyleChange(style: ArrowStyle): void {
  arrowStyle.value = style
}

function handleArrowSizeChange(size: number): void {
  arrowSize.value = size
}

function handleStrokeEnd(stroke: Stroke): void {
  currentPageState.value.strokes.push(stroke)
  recordChange()
  autosaveStatus.value.pendingChanges = true
}

function handleShapeEnd(shape: Shape): void {
  currentPageState.value.shapes.push(shape)
  recordChange()
  autosaveStatus.value.pendingChanges = true
}

function handleTextCreate(text: TextElement): void {
  currentPageState.value.texts.push(text)
  recordChange()
  autosaveStatus.value.pendingChanges = true
}

function handleItemsUpdate(updates: Array<{ id: string; type: 'stroke' | 'shape' | 'text'; changes: any }>): void {
  // Update items in current page based on type
  updates.forEach(update => {
    if (update.type === 'stroke') {
      const index = currentPageState.value.strokes.findIndex(s => s.id === update.id)
      if (index >= 0) {
        currentPageState.value.strokes[index] = { ...currentPageState.value.strokes[index], ...update.changes }
      }
    } else if (update.type === 'shape') {
      const index = currentPageState.value.shapes.findIndex(s => s.id === update.id)
      if (index >= 0) {
        currentPageState.value.shapes[index] = { ...currentPageState.value.shapes[index], ...update.changes }
      }
    } else if (update.type === 'text') {
      const index = currentPageState.value.texts.findIndex(t => t.id === update.id)
      if (index >= 0) {
        currentPageState.value.texts[index] = { ...currentPageState.value.texts[index], ...update.changes }
      }
    }
  })
  recordChange()
  autosaveStatus.value.pendingChanges = true
}

function handleItemsDelete(ids: { strokes: string[]; shapes: string[]; texts: string[] }): void {
  currentPageState.value.strokes = currentPageState.value.strokes.filter(s => !ids.strokes.includes(s.id))
  currentPageState.value.shapes = currentPageState.value.shapes.filter(s => !ids.shapes.includes(s.id))
  currentPageState.value.texts = currentPageState.value.texts.filter(t => !ids.texts.includes(t.id))
  recordChange()
  autosaveStatus.value.pendingChanges = true
}

function handleDelete(): void {
  // Handle delete key from canvas
  console.log('[SoloWorkspaceV2] Delete key pressed')
}

function handleZoomChange(newZoom: number): void {
  zoom.value = newZoom
}

function handlePanChange(x: number, y: number): void {
  panX.value = x
  panY.value = y
}

function handleBackgroundChange(background: PageBackground): void {
  if (currentPageState.value) {
    currentPageState.value.background = background
    recordChange()
    autosaveStatus.value.pendingChanges = true
  }
}

function handleAssetAdd(asset: PageState['assets'][number]): void {
  currentPageState.value.assets.push(asset)
  recordChange()
  autosaveStatus.value.pendingChanges = true
}

function handleUndo(): void {
  undo()
}

function handleRedo(): void {
  redo()
}

function handleClear(): void {
  if (confirm('Clear the current page? This cannot be undone.')) {
    currentPageState.value.strokes = []
    currentPageState.value.shapes = []
    currentPageState.value.texts = []
    recordChange()
    autosaveStatus.value.pendingChanges = true
  }
}

async function handleSave(): Promise<void> {
  await saveNow()
}

async function handleExit(): Promise<void> {
  if (autosaveStatus.value.pendingChanges) {
    await saveNow()
  }
  router.push('/solo')
}

// Page navigation
function prevPage(): void {
  if (currentPageIndex.value > 0) {
    currentPageIndex.value--
  }
}

function nextPage(): void {
  if (currentPageIndex.value < pages.value.length - 1) {
    currentPageIndex.value++
  }
}

function addPage(): void {
  const newPage: PageState = {
    id: `page-${Date.now()}`,
    name: `Page ${pages.value.length + 1}`,
    strokes: [],
    shapes: [],
    texts: [],
    assets: [],
    background: { type: 'white' }
  }
  pages.value.push(newPage)
  currentPageIndex.value = pages.value.length - 1
  recordChange()
  autosaveStatus.value.pendingChanges = true
}

// Zoom
function zoomIn(): void {
  zoom.value = Math.min(3, zoom.value + 0.25)
}

function zoomOut(): void {
  zoom.value = Math.max(0.5, zoom.value - 0.25)
}

function toggleFullscreen(): void {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

function handleFullscreenChange(): void {
  isFullscreen.value = !!document.fullscreenElement
}

// PDF Export/Import
const pdfInputRef = ref<HTMLInputElement | null>(null)

async function handleExportPDF(): Promise<void> {
  try {
    // Get canvas element
    const canvas = canvasRef.value?.$el?.querySelector('canvas')
    if (!canvas) {
      console.error('[SoloWorkspaceV2] Canvas not found for export')
      return
    }

    // Create PDF using jsPDF
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [canvas.width, canvas.height]
    })

    // Convert canvas to image and add to PDF
    const imgData = canvas.toDataURL('image/png')
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)

    // Download PDF
    const fileName = `${sessionName.value || 'solo-session'}-${new Date().toISOString().split('T')[0]}.pdf`
    pdf.save(fileName)

    console.log('[SoloWorkspaceV2] PDF exported successfully:', fileName)
  } catch (error) {
    console.error('[SoloWorkspaceV2] PDF export failed:', error)
    alert(t('soloWorkspace.alerts.pdfExportError'))
  }
}

async function handleImportPDF(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  
  if (!file || file.type !== 'application/pdf') {
    console.error('[SoloWorkspaceV2] Invalid file type')
    return
  }

  try {
    // Import PDF using pdfjs-dist
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js`

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    // Create new page for each PDF page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1.5 })

      // Create canvas for rendering
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) continue

      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise

      // Convert canvas to image data URL
      const imageDataUrl = canvas.toDataURL('image/png')

      // Create new page with background image
      const newPage: PageState = {
        id: `page-${Date.now()}-${pageNum}`,
        name: `PDF Page ${pageNum}`,
        strokes: [],
        shapes: [],
        texts: [],
        assets: [],
        background: {
          type: 'color',
          color: '#ffffff',
          image: imageDataUrl
        }
      }

      pages.value.push(newPage)
    }

    // Switch to first imported page
    currentPageIndex.value = pages.value.length - pdf.numPages
    recordChange()
    autosaveStatus.value.pendingChanges = true

    console.log('[SoloWorkspaceV2] PDF imported successfully:', pdf.numPages, 'pages')
    alert(t('soloWorkspace.alerts.pdfImportSuccess', { count: pdf.numPages }))
  } catch (error) {
    console.error('[SoloWorkspaceV2] PDF import failed:', error)
    alert(t('soloWorkspace.alerts.pdfImportError'))
  } finally {
    // Reset input
    if (input) input.value = ''
  }
}

// Navigation
function backToList(): void {
  router.push({ name: 'solo-sessions' })
}

// Utility
function formatLastSaved(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  
  if (seconds < 10) return t('soloWorkspace.status.justNow')
  if (seconds < 60) return `${seconds}s ago`
  
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}
</script>

<style scoped>
.solo-workspace-v2 {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
}

.solo-workspace-v2--fullscreen {
  background: #000;
}

.solo-workspace-v2__header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.solo-workspace-v2__title {
  flex: 1;
}

.title-input {
  border: none;
  background: transparent;
  font-size: 1.125rem;
  font-weight: 600;
  color: #333;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.title-input:hover {
  background: #f5f5f5;
}

.title-input:focus {
  outline: none;
  background: #f0f0f0;
}

.solo-workspace-v2__status {
  font-size: 0.875rem;
  color: #666;
}

.status-saving {
  color: #2196F3;
}

.status-saved {
  color: #4CAF50;
}

.status-pending {
  color: #FF9800;
}

.solo-workspace-v2__actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.action-btn {
  padding: 0.5rem;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover:not(:disabled) {
  background: #f0f0f0;
  color: #333;
}

.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: #2196F3;
  color: white;
}

.btn-primary:hover {
  background: #1976D2;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.solo-workspace-v2__main {
  flex: 1;
  display: flex;
  overflow: hidden;
  gap: 1.5rem;
  padding: 0 1.5rem 1.5rem;
  align-items: stretch;
}

.solo-workspace-v2__main :deep(.solo-toolbar) {
  flex: 0 0 260px;
  min-width: 240px;
  max-width: 260px;
  align-self: flex-start;
}

.solo-workspace-v2__main :deep(.solo-toolbar--horizontal) {
  flex: 1 1 auto;
  min-width: 0;
}

.solo-workspace-v2__canvas-wrapper {
  flex: 1;
  overflow: hidden;
  background: white;
}

.solo-workspace-v2__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  background: white;
  border-top: 1px solid #e0e0e0;
}

.page-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.page-btn {
  padding: 0.25rem 0.5rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #999;
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-indicator {
  font-size: 0.875rem;
  color: #666;
  min-width: 60px;
  text-align: center;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.zoom-btn {
  padding: 0.25rem 0.5rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
  min-width: 32px;
  text-align: center;
}

.zoom-btn:hover {
  background: #f5f5f5;
  border-color: #999;
}

.zoom-level {
  font-size: 0.875rem;
  color: #666;
  min-width: 50px;
  text-align: center;
}
</style>
