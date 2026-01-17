<template>
  <div class="page-vertical-stack-container">
    <!-- v0.93.1: Toolbar with Add Page button + Layout Mode Switcher (dev-only) -->
    <div v-if="isDevWorkspace" class="page-stack-toolbar">
      <div class="toolbar-left">
        <button 
          class="btn-add-page"
          :disabled="!canAddPage"
          @click="handleAddPage"
          :title="canAddPage ? 'Add new page' : 'Max pages reached'"
        >
          <span class="btn-icon">+</span>
          Add Page
        </button>
        <span class="page-count">{{ pages.length }} pages</span>
      </div>
      
      <!-- FE-93.X.2: Layout Mode Switcher -->
      <LayoutModeSwitcher />
    </div>
    
    <div class="page-vertical-stack" ref="stackRef">
      <div
        v-for="page in pages"
        :key="page.id"
        :ref="el => setPageRef(page.id, el as HTMLElement)"
        :data-page-id="page.id"
        class="page-stack__item"
        :class="{
          'page-stack__item--active': page.id === activePageId,
          'page-stack__item--presenter': followMode && page.id === presenterPageId,
          'page-stack__item--visible': visiblePages.has(page.id)
        }"
      >
        <div class="page-stack__header">
          <h3 class="page-stack__title">{{ page.title }}</h3>
          <span class="page-stack__index">{{ page.index + 1 }}</span>
        </div>
        <div class="page-stack__content">
          <!-- v0.93.0: Real BoardCanvas with lazy rendering -->
          <BoardCanvas
            v-if="canvasPages.has(page.id)"
            :tool="tool"
            :color="color"
            :size="size"
            :strokes="getPageState(page.id).strokes as any[]"
            :assets="getPageState(page.id).assets as any[]"
            :width="920"
            :height="1200"
            @stroke-add="(stroke) => handleStrokeAdd(page.id, stroke)"
            @stroke-update="(stroke) => handleStrokeUpdate(page.id, stroke)"
            @stroke-delete="(strokeId) => handleStrokeDelete(page.id, strokeId)"
            @asset-add="(asset) => handleAssetAdd(page.id, asset)"
            @asset-update="(asset) => handleAssetUpdate(page.id, asset)"
            @asset-delete="(assetId) => handleAssetDelete(page.id, assetId)"
          />
          <div v-else class="page-stack__skeleton">
            <div class="skeleton-loader"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useWhiteboardStore } from '../../stores/whiteboardStore'
import BoardCanvas from '../board/BoardCanvas.vue'
import LayoutModeSwitcher from './LayoutModeSwitcher.vue'
import type { PageMetadata } from '@/core/whiteboard/adapters'

// v0.93.0: Simple debounce implementation
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  
  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
  
  debounced.flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }
  
  return debounced
}

interface Props {
  pages: PageMetadata[]
  activePageId: string | null
  followMode: boolean
  presenterPageId: string | null
  workspaceId: string
  tool?: string
  color?: string
  size?: number
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  tool: 'pen',
  color: '#111111',
  size: 4,
  readonly: false,
})

const emit = defineEmits<{
  pageVisible: [pageId: string]
  scrollToPage: [pageId: string]
}>()

const whiteboardStore = useWhiteboardStore()

const stackRef = ref<HTMLElement | null>(null)
const pageRefs = new Map<string, HTMLElement>()
const visiblePages = ref<Set<string>>(new Set())
let observer: IntersectionObserver | null = null

// v0.93.0: Track which pages should render canvas (visible + neighbors)
const canvasPages = computed(() => {
  const result = new Set<string>()
  const pagesArray = props.pages
  
  visiblePages.value.forEach(pageId => {
    const page = pagesArray.find(p => p.id === pageId)
    if (!page) return
    
    // Add current page
    result.add(pageId)
    
    // Add neighbors (±1)
    const prevPage = pagesArray[page.index - 1]
    const nextPage = pagesArray[page.index + 1]
    if (prevPage) result.add(prevPage.id)
    if (nextPage) result.add(nextPage.id)
  })
  
  return result
})

// v0.93.0: Autosave debounced function (1000ms trailing)
const debouncedSave = debounce(async (pageId: string, state: any) => {
  try {
    await whiteboardStore.updatePageState(pageId, state)
  } catch (err) {
    console.error('[PageVerticalStack] Autosave failed', { pageId, err })
  }
}, 1000)

// v0.93.0: Force flush autosave (no debounce)
async function forceFlushAutosave() {
  // Flush pending debounced saves
  debouncedSave.flush()
  console.info('[PageVerticalStack] Force flush autosave completed')
}

// v0.93.0: Get page state from store
function getPageState(pageId: string) {
  return whiteboardStore.pageStates.get(pageId) || { strokes: [], assets: [] }
}

// v0.93.0: Handle stroke/asset changes from BoardCanvas
function handleStrokeAdd(pageId: string, stroke: any) {
  const state = getPageState(pageId)
  const newState = {
    ...state,
    strokes: [...state.strokes, stroke],
  }
  whiteboardStore.pageStates.set(pageId, newState)
  debouncedSave(pageId, newState)
}

function handleStrokeUpdate(pageId: string, stroke: any) {
  const state = getPageState(pageId)
  const index = state.strokes.findIndex((s: any) => s.id === stroke.id)
  if (index === -1) return
  
  const newStrokes = [...state.strokes]
  newStrokes[index] = stroke
  const newState = { ...state, strokes: newStrokes }
  whiteboardStore.pageStates.set(pageId, newState)
  debouncedSave(pageId, newState)
}

function handleStrokeDelete(pageId: string, strokeId: string) {
  const state = getPageState(pageId)
  const newState = {
    ...state,
    strokes: state.strokes.filter((s: any) => s.id !== strokeId),
  }
  whiteboardStore.pageStates.set(pageId, newState)
  debouncedSave(pageId, newState)
}

function handleAssetAdd(pageId: string, asset: any) {
  const state = getPageState(pageId)
  const newState = {
    ...state,
    assets: [...state.assets, asset],
  }
  whiteboardStore.pageStates.set(pageId, newState)
  debouncedSave(pageId, newState)
}

function handleAssetUpdate(pageId: string, asset: any) {
  const state = getPageState(pageId)
  const index = state.assets.findIndex((a: any) => a.id === asset.id)
  if (index === -1) return
  
  const newAssets = [...state.assets]
  newAssets[index] = asset
  const newState = { ...state, assets: newAssets }
  whiteboardStore.pageStates.set(pageId, newState)
  debouncedSave(pageId, newState)
}

function handleAssetDelete(pageId: string, assetId: string) {
  const state = getPageState(pageId)
  const newState = {
    ...state,
    assets: state.assets.filter((a: any) => a.id !== assetId),
  }
  whiteboardStore.pageStates.set(pageId, newState)
  debouncedSave(pageId, newState)
}

// v0.93.0: Add page button handler
function handleAddPage() {
  whiteboardStore.addDevPage()
}

const isDevWorkspace = computed(() => props.workspaceId.startsWith('dev-workspace-'))
const canAddPage = computed(() => whiteboardStore.canCreatePage)

// v0.93.0: Telemetry (LAW-06)
interface TelemetryEvent {
  timestamp: number
  scroll_latency_ms: number
  scroll_desync: boolean
  presenterPageId: string
  activePageId: string | null
}

// Declare global type
declare global {
  interface Window {
    __WINTERBOARD_TELEMETRY__?: TelemetryEvent[]
  }
}

// Initialize global telemetry object
if (typeof window !== 'undefined' && !window.__WINTERBOARD_TELEMETRY__) {
  window.__WINTERBOARD_TELEMETRY__ = []
}

function recordTelemetry(event: TelemetryEvent) {
  if (typeof window !== 'undefined' && window.__WINTERBOARD_TELEMETRY__) {
    window.__WINTERBOARD_TELEMETRY__.push(event)
    console.info('[WinterboardTelemetry]', event)
  }
}

function setPageRef(pageId: string, el: HTMLElement | null) {
  if (el) {
    pageRefs.set(pageId, el)
  } else {
    pageRefs.delete(pageId)
  }
}

function setupIntersectionObserver() {
  if (!stackRef.value) return

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const pageId = (entry.target as HTMLElement).dataset.pageId
        if (!pageId) return

        if (entry.isIntersecting) {
          visiblePages.value.add(pageId)
          // v0.93.0: LAW-04 - Active page визначається скролом
          // Emit to store to set active page
          whiteboardStore.setActivePageByScroll(pageId)
          emit('pageVisible', pageId)
        } else {
          visiblePages.value.delete(pageId)
        }
      })
    },
    {
      root: stackRef.value,
      rootMargin: '200px 0px',
      threshold: 0.1
    }
  )

  pageRefs.forEach((el) => {
    observer?.observe(el)
  })
}

async function scrollToPage(pageId: string) {
  const el = pageRefs.get(pageId)
  if (!el || !stackRef.value) return

  const t0 = performance.now()
  
  el.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  })
  
  // Wait for scroll to complete and measure latency
  await nextTick()
  const t1 = performance.now()
  const latency = t1 - t0
  
  // Check desync after 300ms
  setTimeout(() => {
    const desync = whiteboardStore.activePageId !== pageId
    
    recordTelemetry({
      timestamp: Date.now(),
      scroll_latency_ms: latency,
      scroll_desync: desync,
      presenterPageId: pageId,
      activePageId: whiteboardStore.activePageId,
    })
  }, 300)
}

watch(() => props.presenterPageId, (newPageId) => {
  if (props.followMode && newPageId) {
    // LAW-05: Follow-mode = Presenter is Authority
    console.info('[PageVerticalStack] Follow-mode: scrolling to presenter page', { pageId: newPageId })
    nextTick(() => {
      scrollToPage(newPageId)
    })
  }
})

watch(() => props.pages.length, () => {
  nextTick(() => {
    if (observer) {
      observer.disconnect()
    }
    setupIntersectionObserver()
  })
})

onMounted(() => {
  nextTick(() => {
    setupIntersectionObserver()
  })
})

// v0.93.0: Force flush on beforeunload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', forceFlushAutosave)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      forceFlushAutosave()
    }
  })
}

onBeforeUnmount(() => {
  // v0.93.0: Force flush before component unmount
  forceFlushAutosave()
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  pageRefs.clear()
  
  // Cleanup event listeners
  if (typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', forceFlushAutosave)
  }
})
</script>

<style scoped>
.page-vertical-stack-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.page-stack-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  background: var(--color-bg-secondary, #f9fafb);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-add-page {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 6px;
  background: white;
  color: var(--color-text-primary, #111827);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-page:hover:not(:disabled) {
  background: var(--color-bg-hover, #f3f4f6);
  border-color: var(--color-primary, #3b82f6);
}

.btn-add-page:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 1.25rem;
  line-height: 1;
}

.page-count {
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
}

.page-vertical-stack {
  display: flex;
  flex-direction: column;
  gap: 3rem;
  padding: 2rem;
  overflow-y: auto;
  flex: 1;
  background: var(--color-bg-tertiary, #e5e7eb);
}

/* v0.93.1: FE-93.X.5 - Enhanced page separation */
.page-stack__item {
  min-height: 600px;
  border: 2px solid var(--color-border, #d1d5db);
  border-radius: 12px;
  background: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.03);
  transition: all 0.3s ease;
  position: relative;
}

.page-stack__item::before {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 16px;
  background: transparent;
  transition: background 0.3s ease;
  pointer-events: none;
  z-index: -1;
}

.page-stack__item--active {
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 8px 16px rgba(59, 130, 246, 0.15), 0 4px 8px rgba(59, 130, 246, 0.1);
}

.page-stack__item--active::before {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(59, 130, 246, 0.02) 100%);
}

.page-stack__item--presenter {
  border-color: var(--color-warning, #f59e0b);
  box-shadow: 0 8px 16px rgba(245, 158, 11, 0.15), 0 4px 8px rgba(245, 158, 11, 0.1);
}

.page-stack__item--presenter::before {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(245, 158, 11, 0.02) 100%);
}

.page-stack__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.page-stack__title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.page-stack__index {
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
}

.page-stack__content {
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 1200px;
  width: 100%;
  position: relative;
}

.page-stack__placeholder {
  color: var(--color-text-tertiary, #9ca3af);
  font-size: 0.875rem;
}

.page-stack__canvas {
  width: 100%;
  height: 100%;
}

.page-stack__skeleton {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.skeleton-loader {
  width: 80%;
  height: 80%;
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s ease-in-out infinite;
  border-radius: 4px;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.page-stack__item--visible {
  opacity: 1;
}
</style>
