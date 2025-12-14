<template>
  <div class="export-menu">
    <!-- Trigger Button -->
    <button
      ref="triggerRef"
      class="export-trigger"
      :aria-expanded="isOpen"
      aria-haspopup="menu"
      :aria-label="$t('solo.export.title')"
      @click="toggleMenu"
    >
      <IconExport class="export-trigger__icon" />
      <span class="export-trigger__text">{{ $t('solo.export.title') }}</span>
    </button>

    <!-- Dropdown Menu -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="isOpen"
          ref="menuRef"
          class="export-dropdown"
          :style="dropdownStyle"
          role="menu"
          @keydown.escape="closeMenu"
        >
          <div class="export-dropdown__header">
            <h3>{{ $t('solo.export.title') }}</h3>
            <button class="close-btn" @click="closeMenu" :aria-label="$t('common.close')">×</button>
          </div>

          <div class="export-dropdown__content">
            <!-- Format Selection -->
            <div class="export-option">
              <label class="export-label">{{ $t('solo.export.format') }}</label>
              <div class="format-buttons">
                <button
                  v-for="fmt in formats"
                  :key="fmt.value"
                  class="format-btn"
                  :class="{ 'format-btn--active': selectedFormat === fmt.value }"
                  :aria-pressed="selectedFormat === fmt.value"
                  @click="selectedFormat = fmt.value"
                >
                  <component :is="fmt.icon" class="format-btn__icon" />
                  <span>{{ fmt.label }}</span>
                </button>
              </div>
            </div>

            <!-- PDF Options -->
            <div v-if="selectedFormat === 'pdf'" class="export-option">
              <label class="export-label">{{ $t('solo.export.pageSize') }}</label>
              <select v-model="pdfOptions.pageSize" class="export-select">
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
                <option value="a3">A3</option>
              </select>

              <label class="export-label">{{ $t('solo.export.orientation') }}</label>
              <div class="orientation-buttons">
                <button
                  class="orientation-btn"
                  :class="{ 'orientation-btn--active': pdfOptions.orientation === 'landscape' }"
                  @click="pdfOptions.orientation = 'landscape'"
                >
                  {{ $t('solo.export.landscape') }}
                </button>
                <button
                  class="orientation-btn"
                  :class="{ 'orientation-btn--active': pdfOptions.orientation === 'portrait' }"
                  @click="pdfOptions.orientation = 'portrait'"
                >
                  {{ $t('solo.export.portrait') }}
                </button>
              </div>
            </div>
          </div>

          <!-- Export Button -->
          <div class="export-dropdown__footer">
            <button
              class="export-btn"
              :disabled="isExporting"
              @click="startExport"
            >
              <IconLoader v-if="isExporting" class="export-btn__spinner" />
              <span>{{ isExporting ? $t('solo.export.exporting') : $t('solo.export.export') }}</span>
            </button>
          </div>

          <!-- Progress -->
          <div v-if="exportStatus" class="export-progress">
            <div class="export-progress__bar">
              <div
                class="export-progress__fill"
                :style="{ width: `${progressPercent}%` }"
              />
            </div>
            <span class="export-progress__text">{{ exportStatusText }}</span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { soloApi } from '@/modules/solo/api/soloApi'
import { notifyError, notifySuccess } from '@/utils/notify'
import type { ExportRequest } from '@/modules/solo/types/solo'

// Icons
import IconExport from './icons/IconExport.vue'
import IconLoader from './icons/IconLoader.vue'
import IconPdf from './icons/IconPdf.vue'
import IconImage from './icons/IconImage.vue'
import IconJson from './icons/IconJson.vue'

interface Props {
  sessionId: string
  stageRef?: { getStage: () => { toDataURL: (config?: { pixelRatio?: number }) => string } | null } | null
  boardState?: Record<string, unknown> | null
}

const props = withDefaults(defineProps<Props>(), {
  stageRef: null,
  boardState: null,
})

// Helper to get board state for JSON export
function getBoardStateForExport(): Record<string, unknown> {
  if (props.boardState) {
    return props.boardState
  }
  // Fallback: try to get from pinia (less reliable)
  try {
    const pinia = (window as unknown as { __pinia?: { state: { value: { board?: unknown } } } }).__pinia
    return (pinia?.state?.value?.board as Record<string, unknown>) || {}
  } catch {
    return {}
  }
}

const emit = defineEmits<{
  'export-start': []
  'export-complete': [url: string]
  'export-error': [error: string]
}>()

const { t } = useI18n()

// State
const isOpen = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const selectedFormat = ref<'png' | 'pdf' | 'json'>('png')
const isExporting = ref(false)
const exportStatus = ref<ExportRequest | null>(null)
const pollInterval = ref<number | null>(null)

const pdfOptions = reactive({
  pageSize: 'a4',
  orientation: 'landscape' as 'landscape' | 'portrait',
})

// Format options
const formats = [
  { value: 'png' as const, label: 'PNG', icon: IconImage },
  { value: 'pdf' as const, label: 'PDF', icon: IconPdf },
  { value: 'json' as const, label: 'JSON', icon: IconJson },
]

// Computed
const dropdownStyle = computed(() => {
  if (!triggerRef.value) return {}
  const rect = triggerRef.value.getBoundingClientRect()
  return {
    top: `${rect.bottom + 8}px`,
    left: `${rect.left}px`,
  }
})

const progressPercent = computed(() => {
  if (!exportStatus.value) return 0
  switch (exportStatus.value.status) {
    case 'pending':
      return 25
    case 'processing':
      return 60
    case 'completed':
      return 100
    default:
      return 0
  }
})

const exportStatusText = computed(() => {
  if (!exportStatus.value) return ''
  switch (exportStatus.value.status) {
    case 'pending':
      return t('solo.export.statusPending')
    case 'processing':
      return t('solo.export.statusProcessing')
    case 'completed':
      return t('solo.export.statusCompleted')
    case 'failed':
      return t('solo.export.statusFailed')
    default:
      return ''
  }
})

// Methods
function toggleMenu(): void {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    nextTick(() => {
      menuRef.value?.focus()
    })
  }
}

function closeMenu(): void {
  isOpen.value = false
  triggerRef.value?.focus()
}

async function startExport(): Promise<void> {
  if (!props.sessionId || isExporting.value) return

  isExporting.value = true
  exportStatus.value = null
  emit('export-start')

  console.log('[ui.export_start]', { format: selectedFormat.value })

  // Try client-side export first for PNG, PDF and JSON
  if (selectedFormat.value === 'png' || selectedFormat.value === 'pdf' || selectedFormat.value === 'json') {
    try {
      await exportClientSide()
      return
    } catch (clientError) {
      console.warn('[ExportMenu] Client-side export failed, trying server:', clientError)
    }
  }

  try {
    const request = await soloApi.requestExport(props.sessionId, selectedFormat.value)
    exportStatus.value = request

    // Start polling for status
    startPolling(request.id)
  } catch (error) {
    isExporting.value = false
    const message = (error as Error)?.message || t('solo.export.error')
    notifyError(message)
    emit('export-error', message)
    console.error('[ExportMenu] Export failed:', error)
  }
}

async function exportClientSide(): Promise<void> {
  if (selectedFormat.value === 'json') {
    // Export as JSON - emit event to get state from parent
    // The parent (SoloWorkspace) should pass boardState as prop
    const boardState = getBoardStateForExport()
    if (!boardState || Object.keys(boardState).length === 0) {
      throw new Error('Board state is empty')
    }
    const json = JSON.stringify(boardState, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    downloadFile(url, `board-${props.sessionId}.json`)
    URL.revokeObjectURL(url)
    
    isExporting.value = false
    notifySuccess(t('solo.export.success'))
    emit('export-complete', url)
  } else if (selectedFormat.value === 'png') {
    // Export as PNG using Konva stage
    console.log('[ExportMenu] PNG export, stageRef:', props.stageRef)
    
    if (!props.stageRef) {
      console.error('[ExportMenu] No stageRef provided')
      throw new Error('PNG export requires canvas access')
    }
    
    const stage = props.stageRef.getStage?.()
    console.log('[ExportMenu] Stage:', stage)
    
    if (!stage) {
      console.error('[ExportMenu] Stage not available from ref')
      throw new Error('Canvas not available')
    }
    
    try {
      const dataUrl = stage.toDataURL({ pixelRatio: 2 })
      downloadFile(dataUrl, `board-${props.sessionId}.png`)
      
      isExporting.value = false
      notifySuccess(t('solo.export.success'))
      emit('export-complete', dataUrl)
    } catch (stageError) {
      console.error('[ExportMenu] Stage toDataURL failed:', stageError)
      throw stageError
    }
  } else if (selectedFormat.value === 'pdf') {
    // Export as PDF using canvas -> image -> PDF
    console.log('[ExportMenu] PDF export, stageRef:', props.stageRef)
    
    if (!props.stageRef) {
      console.error('[ExportMenu] No stageRef provided for PDF')
      throw new Error('PDF export requires canvas access')
    }
    
    const stage = props.stageRef.getStage?.()
    if (!stage) {
      console.error('[ExportMenu] Stage not available for PDF')
      throw new Error('Canvas not available')
    }
    
    try {
      // Get canvas as PNG data URL
      const dataUrl = stage.toDataURL({ pixelRatio: 2 })
      
      // Create a simple PDF by embedding the image
      // Using a basic approach without external library
      const img = new Image()
      img.onload = () => {
        // Create canvas for PDF
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          throw new Error('Cannot create canvas context')
        }
        
        // A4 size at 96 DPI: 794 x 1123 pixels
        canvas.width = 794
        canvas.height = 1123
        
        // Fill white background
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // Scale and center the image
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.9
        const x = (canvas.width - img.width * scale) / 2
        const y = (canvas.height - img.height * scale) / 2
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
        
        // Download as PNG with PDF-like naming (true PDF requires jspdf library)
        // TODO: Install jspdf for real PDF export
        const pdfDataUrl = canvas.toDataURL('image/png')
        downloadFile(pdfDataUrl, `board-${props.sessionId}-a4.png`)
        
        isExporting.value = false
        notifySuccess(t('solo.export.success'))
        emit('export-complete', pdfDataUrl)
      }
      img.onerror = () => {
        throw new Error('Failed to load image for PDF')
      }
      img.src = dataUrl
    } catch (pdfError) {
      console.error('[ExportMenu] PDF export failed:', pdfError)
      throw pdfError
    }
  }
}

function startPolling(exportId: string): void {
  stopPolling()

  pollInterval.value = window.setInterval(async () => {
    try {
      // Note: This would need a getExportStatus endpoint
      // For now, we'll simulate with the export request
      const status = await checkExportStatus(exportId)

      exportStatus.value = status

      if (status.status === 'completed') {
        stopPolling()
        isExporting.value = false

        if (status.file_url) {
          notifySuccess(t('solo.export.success'))
          emit('export-complete', status.file_url)

          // Auto-download
          downloadFile(status.file_url)
        }

        console.log('[ui.export_complete]', { format: selectedFormat.value })
      } else if (status.status === 'failed') {
        stopPolling()
        isExporting.value = false
        notifyError(t('solo.export.error'))
        emit('export-error', 'Export failed')
      }
    } catch (error) {
      console.error('[ExportMenu] Polling error:', error)
    }
  }, 1500)
}

function stopPolling(): void {
  if (pollInterval.value) {
    clearInterval(pollInterval.value)
    pollInterval.value = null
  }
}

async function checkExportStatus(exportId: string): Promise<ExportRequest> {
  return await soloApi.getExportStatus(exportId)
}

function downloadFile(url: string, filename?: string): void {
  const link = document.createElement('a')
  link.href = url
  link.download = filename || `export-${props.sessionId}.${selectedFormat.value}`
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Click outside handler
function handleClickOutside(event: MouseEvent): void {
  if (
    isOpen.value &&
    menuRef.value &&
    !menuRef.value.contains(event.target as Node) &&
    !triggerRef.value?.contains(event.target as Node)
  ) {
    closeMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  stopPolling()
})
</script>

<style scoped>
.export-menu {
  position: relative;
}

.export-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--color-bg-secondary, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-fg, #0f172a);
  transition: all 0.15s ease;
}

.export-trigger:hover {
  background: var(--color-bg-hover, #f1f5f9);
  border-color: var(--color-border-strong, #cbd5e1);
}

.export-trigger:focus-visible {
  outline: 2px solid var(--color-border-focus, #2563eb);
  outline-offset: 2px;
}

.export-trigger__icon {
  width: 18px;
  height: 18px;
}

.export-dropdown {
  position: fixed;
  z-index: 1000;
  min-width: 280px;
  background: var(--color-bg, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1));
  overflow: hidden;
}

.export-dropdown__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border, #e2e8f0);
}

.export-dropdown__header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-size: 1.25rem;
  color: var(--color-fg-tertiary, #94a3b8);
}

.close-btn:hover {
  background: var(--color-bg-hover, #f1f5f9);
  color: var(--color-fg, #0f172a);
}

.export-dropdown__content {
  padding: 16px;
}

.export-option {
  margin-bottom: 16px;
}

.export-option:last-child {
  margin-bottom: 0;
}

.export-label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-fg-secondary, #475569);
}

.format-buttons {
  display: flex;
  gap: 8px;
}

.format-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  background: var(--color-bg-secondary, #f8fafc);
  border: 2px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-fg-secondary, #475569);
  transition: all 0.15s ease;
}

.format-btn:hover {
  border-color: var(--color-border-strong, #cbd5e1);
}

.format-btn--active {
  background: var(--color-brand-light, #dbeafe);
  border-color: var(--color-brand, #2563eb);
  color: var(--color-brand, #2563eb);
}

.format-btn__icon {
  width: 24px;
  height: 24px;
}

.export-select {
  width: 100%;
  padding: 8px 12px;
  background: var(--color-bg, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-md, 8px);
  font-size: 0.875rem;
  margin-bottom: 12px;
}

.orientation-buttons {
  display: flex;
  gap: 8px;
}

.orientation-btn {
  flex: 1;
  padding: 8px;
  background: var(--color-bg-secondary, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  font-size: 0.8125rem;
  transition: all 0.15s ease;
}

.orientation-btn--active {
  background: var(--color-brand-light, #dbeafe);
  border-color: var(--color-brand, #2563eb);
  color: var(--color-brand, #2563eb);
}

.export-dropdown__footer {
  padding: 12px 16px;
  border-top: 1px solid var(--color-border, #e2e8f0);
}

.export-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--color-brand, #2563eb);
  border: none;
  border-radius: var(--radius-md, 8px);
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.export-btn:hover:not(:disabled) {
  background: var(--color-brand-dark, #1d4ed8);
}

.export-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.export-btn__spinner {
  width: 16px;
  height: 16px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.export-progress {
  padding: 12px 16px;
  border-top: 1px solid var(--color-border, #e2e8f0);
}

.export-progress__bar {
  height: 4px;
  background: var(--color-bg-tertiary, #f1f5f9);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}

.export-progress__fill {
  height: 100%;
  background: var(--color-brand, #2563eb);
  transition: width 0.3s ease;
}

.export-progress__text {
  font-size: 0.75rem;
  color: var(--color-fg-secondary, #475569);
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
