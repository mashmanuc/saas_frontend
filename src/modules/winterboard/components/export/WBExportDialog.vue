<!-- WB: Export dialog — format selection, polling, download
     Ref: TASK_BOARD.md B4.3 -->
<template>
  <Modal :open="isOpen" :title="t('winterboard.export.title')" size="sm" @close="emit('close')">
    <p class="wb-export-dialog__desc">{{ t('winterboard.export.description') }}</p>

          <!-- State: idle — format selection + options -->
          <template v-if="state === 'idle'">
            <!-- Format selector -->
            <fieldset class="wb-export-dialog__fieldset">
              <legend class="wb-export-dialog__legend">{{ t('winterboard.export.format') }}</legend>
              <div class="wb-export-dialog__formats">
                <label
                  v-for="fmt in formats"
                  :key="fmt.value"
                  class="wb-export-format"
                  :class="{
                    'wb-export-format--selected': selectedFormat === fmt.value,
                    'wb-export-format--disabled': fmt.disabled,
                  }"
                  :title="fmt.tooltip || undefined"
                >
                  <input
                    v-model="selectedFormat"
                    type="radio"
                    name="wb-export-format"
                    :value="fmt.value"
                    :disabled="fmt.disabled"
                    class="wb-export-format__radio"
                  />
                  <div class="wb-export-format__icon" v-html="fmt.icon" />
                  <div class="wb-export-format__info">
                    <span class="wb-export-format__name">{{ fmt.label }}</span>
                    <span class="wb-export-format__desc">{{ fmt.desc }}</span>
                  </div>
                </label>
              </div>
            </fieldset>

            <!-- Page selection -->
            <fieldset class="wb-export-dialog__fieldset">
              <legend class="wb-export-dialog__legend">{{ t('winterboard.export.pageSelection') }}</legend>
              <div class="wb-export-dialog__page-options">
                <label class="wb-export-option">
                  <input v-model="pageScope" type="radio" name="wb-page-scope" value="current" />
                  <span>{{ t('winterboard.export.currentPage') }}</span>
                </label>
                <label class="wb-export-option">
                  <input v-model="pageScope" type="radio" name="wb-page-scope" value="all" />
                  <span>{{ t('winterboard.export.allPages') }}</span>
                </label>
              </div>
            </fieldset>

            <!-- PNG options -->
            <fieldset v-if="selectedFormat === 'png'" class="wb-export-dialog__fieldset">
              <legend class="wb-export-dialog__legend">{{ t('winterboard.export.pngOptions') }}</legend>
              <div class="wb-export-dialog__option-row">
                <label class="wb-export-option">
                  <span>{{ t('winterboard.export.quality') }}</span>
                  <select v-model="pngQuality" class="wb-export-select">
                    <option value="high">{{ t('winterboard.export.qualityHigh') }}</option>
                    <option value="medium">{{ t('winterboard.export.qualityMedium') }}</option>
                    <option value="low">{{ t('winterboard.export.qualityLow') }}</option>
                  </select>
                </label>
                <label class="wb-export-option">
                  <span>{{ t('winterboard.export.background') }}</span>
                  <select v-model="pngBackground" class="wb-export-select">
                    <option value="white">{{ t('winterboard.export.bgWhite') }}</option>
                    <option value="transparent">{{ t('winterboard.export.bgTransparent') }}</option>
                  </select>
                </label>
              </div>
            </fieldset>

            <!-- PDF options -->
            <fieldset v-if="selectedFormat === 'pdf'" class="wb-export-dialog__fieldset">
              <legend class="wb-export-dialog__legend">{{ t('winterboard.export.pdfOptions') }}</legend>
              <div class="wb-export-dialog__option-row">
                <label class="wb-export-option">
                  <span>{{ t('winterboard.export.pageSize') }}</span>
                  <select v-model="pdfPageSize" class="wb-export-select">
                    <option value="a4">A4</option>
                    <option value="letter">Letter</option>
                    <option value="original">{{ t('winterboard.export.original') }}</option>
                  </select>
                </label>
                <label class="wb-export-option">
                  <span>{{ t('winterboard.export.orientation') }}</span>
                  <select v-model="pdfOrientation" class="wb-export-select">
                    <option value="auto">Auto</option>
                    <option value="portrait">{{ t('winterboard.export.portrait') }}</option>
                    <option value="landscape">{{ t('winterboard.export.landscape') }}</option>
                  </select>
                </label>
              </div>
            </fieldset>

            <!-- JSON options -->
            <fieldset v-if="selectedFormat === 'json'" class="wb-export-dialog__fieldset">
              <legend class="wb-export-dialog__legend">{{ t('winterboard.export.jsonOptions') }}</legend>
              <label class="wb-export-option">
                <input v-model="jsonPretty" type="checkbox" />
                <span>{{ t('winterboard.export.prettyPrint') }}</span>
              </label>
            </fieldset>

            <!-- B5.1: Annotated PDF options -->
            <fieldset v-if="selectedFormat === 'annotated_pdf'" class="wb-export-dialog__fieldset">
              <legend class="wb-export-dialog__legend">{{ t('winterboard.pdf.annotationTypes') }}</legend>
              <div class="wb-export-dialog__option-row">
                <label class="wb-export-option">
                  <input v-model="annotationFilters" type="checkbox" value="strokes" />
                  <span>{{ t('winterboard.pdf.filterStrokes') }}</span>
                </label>
                <label class="wb-export-option">
                  <input v-model="annotationFilters" type="checkbox" value="text" />
                  <span>{{ t('winterboard.pdf.filterText') }}</span>
                </label>
                <label class="wb-export-option">
                  <input v-model="annotationFilters" type="checkbox" value="shapes" />
                  <span>{{ t('winterboard.pdf.filterShapes') }}</span>
                </label>
              </div>
            </fieldset>

            <Button
              variant="primary"
              fullWidth
              :disabled="exporting"
              :loading="exporting"
              @click="startExport"
            >
              {{ t('winterboard.export.startExport') }}
            </Button>
          </template>

          <!-- State: processing -->
          <template v-else-if="state === 'processing'">
            <div class="wb-export-dialog__progress" role="status" aria-live="polite">
              <div class="wb-export-dialog__spinner" />
              <p class="wb-export-dialog__progress-text">{{ t('winterboard.export.processing') }}</p>
              <p v-if="pollElapsed > 0" class="wb-export-dialog__progress-elapsed">
                {{ Math.round(pollElapsed / 1000) }}s
              </p>
              <p v-if="pollElapsed >= POLL_TIMEOUT_MS" class="wb-export-dialog__progress-timeout">
                {{ t('winterboard.export.timeout') }}
              </p>
            </div>
          </template>

          <!-- State: ready — download -->
          <template v-else-if="state === 'ready'">
            <div class="wb-export-dialog__ready">
              <svg class="wb-export-dialog__ready-icon" width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <circle cx="24" cy="24" r="22" stroke="#16a34a" stroke-width="2" />
                <path d="M16 24l6 6 10-12" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <p class="wb-export-dialog__ready-text">{{ t('winterboard.export.ready') }}</p>
              <Button variant="primary" fullWidth @click="downloadFile">
                {{ t('winterboard.export.download') }}
              </Button>
            </div>
          </template>

          <!-- State: error -->
          <template v-else-if="state === 'error'">
            <div class="wb-export-dialog__error">
              <svg class="wb-export-dialog__error-icon" width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <circle cx="24" cy="24" r="22" stroke="#ef4444" stroke-width="2" />
                <path d="M24 14v12M24 30v2" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" />
              </svg>
              <p class="wb-export-dialog__error-text">{{ t('winterboard.export.error') }}</p>
              <p v-if="errorMessage" class="wb-export-dialog__error-detail">{{ errorMessage }}</p>
              <Button variant="primary" fullWidth @click="resetToIdle">
                {{ t('winterboard.export.retry') }}
              </Button>
            </div>
          </template>
  </Modal>
</template>

<script setup lang="ts">
// WB: WBExportDialog — export with format selection, polling, download
// Ref: TASK_BOARD.md B4.3
import { ref, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
import { winterboardApi } from '../../api/winterboardApi'
import { useToast } from '../../composables/useToast'
import type { WBExportFormat } from '../../types/winterboard'

const props = defineProps<{
  sessionId: string
  isOpen: boolean
  /** Number of pages with PDF background (enables annotated_pdf option) */
  pdfPageCount?: number
}>()

const emit = defineEmits<{
  close: []
  exported: []
}>()

const { t } = useI18n()
const { showToast } = useToast()

// ── State ─────────────────────────────────────────────────────────────────
type ExportState = 'idle' | 'processing' | 'ready' | 'error'
const state = ref<ExportState>('idle')
const selectedFormat = ref<WBExportFormat>('png')
const exporting = ref(false)
const exportId = ref<string | null>(null)
const fileUrl = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

// ── Format-specific options (B2.2) ───────────────────────────────────────
type PageScope = 'current' | 'all'
type PngQuality = 'high' | 'medium' | 'low'
type PngBackground = 'white' | 'transparent'
type PdfPageSize = 'a4' | 'letter' | 'original'
type PdfOrientation = 'auto' | 'portrait' | 'landscape'

const pageScope = ref<PageScope>('all')
const pngQuality = ref<PngQuality>('high')
const pngBackground = ref<PngBackground>('white')
const pdfPageSize = ref<PdfPageSize>('a4')
const pdfOrientation = ref<PdfOrientation>('auto')
const jsonPretty = ref(true)

// B5.1: Annotated PDF options
type AnnotationFilter = 'strokes' | 'text' | 'shapes'
const annotationFilters = ref<AnnotationFilter[]>(['strokes', 'text', 'shapes'])

const hasPdfPages = computed(() => (props.pdfPageCount ?? 0) > 0)

// ── Timeout tracking ─────────────────────────────────────────────────────
const POLL_TIMEOUT_MS = 60_000
const pollElapsed = ref(0)
let pollStartTime = 0

// ── Format options ────────────────────────────────────────────────────────
const formats = computed(() => {
  const base = [
    {
      value: 'png' as WBExportFormat,
      label: t('winterboard.export.formats.png'),
      desc: t('winterboard.export.formats.pngDesc'),
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#0066FF" stroke-width="1.5"/><circle cx="8.5" cy="8.5" r="2" stroke="#0066FF" stroke-width="1.5"/><path d="M3 15l5-5 4 4 3-3 6 6" stroke="#0066FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      disabled: false,
      tooltip: '',
    },
    {
      value: 'pdf' as WBExportFormat,
      label: t('winterboard.export.formats.pdf'),
      desc: t('winterboard.export.formats.pdfDesc'),
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#ef4444" stroke-width="1.5"/><path d="M14 2v6h6M8 13h8M8 17h5" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/></svg>',
      disabled: false,
      tooltip: '',
    },
    {
      value: 'json' as WBExportFormat,
      label: t('winterboard.export.formats.json'),
      desc: t('winterboard.export.formats.jsonDesc'),
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M8 3H7a2 2 0 00-2 2v2c0 1.1-.9 2-2 2 1.1 0 2 .9 2 2v2a2 2 0 002 2h1M16 3h1a2 2 0 012 2v2c0 1.1.9 2 2 2-1.1 0-2 .9-2 2v2a2 2 0 01-2 2h-1" stroke="#8b5cf6" stroke-width="1.5" stroke-linecap="round"/></svg>',
      disabled: false,
      tooltip: '',
    },
    {
      value: 'annotated_pdf' as WBExportFormat,
      label: t('winterboard.pdf.exportAnnotatedPdf'),
      desc: hasPdfPages.value
        ? t('winterboard.pdf.pdfPagesWithAnnotations', { count: props.pdfPageCount ?? 0 })
        : t('winterboard.pdf.noPdfPages'),
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#059669" stroke-width="1.5"/><path d="M14 2v6h6" stroke="#059669" stroke-width="1.5"/><path d="M9 15l2 2 4-5" stroke="#059669" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      disabled: !hasPdfPages.value,
      tooltip: hasPdfPages.value ? t('winterboard.pdf.exportAnnotatedPdfTooltip') : t('winterboard.pdf.noPdfPages'),
    },
  ]
  return base
})

// ── Start export ──────────────────────────────────────────────────────────
async function startExport(): Promise<void> {
  exporting.value = true
  errorMessage.value = null
  try {
    const result = await winterboardApi.createExport(props.sessionId, selectedFormat.value)
    exportId.value = result.id

    if (result.status === 'done' && result.file_url) {
      fileUrl.value = result.file_url
      state.value = 'ready'
      emit('exported')
    } else if (result.status === 'error') {
      errorMessage.value = result.error || null
      state.value = 'error'
    } else {
      state.value = 'processing'
      startPolling()
    }
  } catch (err) {
    console.error('[WB:ExportDialog] Export request failed', err)
    showToast(t('winterboard.export.exportError'), 'error')
    state.value = 'error'
  } finally {
    exporting.value = false
  }
}

// ── Polling ───────────────────────────────────────────────────────────────
function startPolling(): void {
  stopPolling()
  pollStartTime = Date.now()
  pollElapsed.value = 0
  pollTimer = setInterval(async () => {
    if (!exportId.value) return
    pollElapsed.value = Date.now() - pollStartTime

    // Timeout check
    if (pollElapsed.value >= POLL_TIMEOUT_MS) {
      console.warn('[WB:ExportDialog] Export timeout after 60s')
      errorMessage.value = t('winterboard.export.timeout')
      state.value = 'error'
      stopPolling()
      return
    }

    try {
      const result = await winterboardApi.getExport(exportId.value)
      if (result.status === 'done' && result.file_url) {
        fileUrl.value = result.file_url
        state.value = 'ready'
        stopPolling()
        emit('exported')
      } else if (result.status === 'error') {
        errorMessage.value = result.error || null
        state.value = 'error'
        stopPolling()
      }
    } catch (err) {
      console.error('[WB:ExportDialog] Poll failed', err)
      showToast(t('winterboard.export.pollError'), 'warning')
      state.value = 'error'
      stopPolling()
    }
  }, 2000)
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// ── Download ──────────────────────────────────────────────────────────────
function downloadFile(): void {
  if (!fileUrl.value) return
  const a = document.createElement('a')
  a.href = fileUrl.value
  a.download = ''
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// ── Reset ─────────────────────────────────────────────────────────────────
function resetToIdle(): void {
  state.value = 'idle'
  exportId.value = null
  fileUrl.value = null
  errorMessage.value = null
  exporting.value = false
  pollElapsed.value = 0
}

// ── Cleanup ───────────────────────────────────────────────────────────────
onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.wb-export-dialog__desc {
  font-size: 13px;
  color: var(--wb-fg-secondary, #94a3b8);
  margin: 0 0 20px;
}

/* ── Format selection ────────────────────────────────────────────────── */
.wb-export-dialog__formats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.wb-export-format {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.wb-export-format:hover {
  background: var(--wb-canvas-bg, #f8fafc);
}

.wb-export-format--selected {
  border-color: var(--wb-brand, #0066FF);
  background: var(--accent-bg, #eff6ff);
}

.wb-export-format__radio {
  width: 16px;
  height: 16px;
  accent-color: var(--wb-brand, #0066FF);
  cursor: pointer;
  flex-shrink: 0;
}

.wb-export-format__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.wb-export-format__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wb-export-format__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
}

.wb-export-format__desc {
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
}

/* ── Action button ───────────────────────────────────────────────────── */
.wb-export-dialog__action-btn {
  display: block;
  width: 100%;
  padding: 10px;
  background: var(--wb-brand, #0066FF);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.wb-export-dialog__action-btn:hover {
  background: var(--wb-brand-hover, #0052cc);
}

.wb-export-dialog__action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Processing ──────────────────────────────────────────────────────── */
.wb-export-dialog__progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 0;
  gap: 12px;
}

.wb-export-dialog__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--wb-toolbar-border, #e2e8f0);
  border-top-color: var(--wb-brand, #0066FF);
  border-radius: 50%;
  animation: wb-spin 0.6s linear infinite;
}

@keyframes wb-spin {
  to { transform: rotate(360deg); }
}

.wb-export-dialog__progress-text {
  font-size: 14px;
  color: var(--wb-fg-secondary, #64748b);
  margin: 0;
}

/* ── Ready ────────────────────────────────────────────────────────────── */
.wb-export-dialog__ready {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
}

.wb-export-dialog__ready-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--success);
  margin: 0;
}

/* ── Error ────────────────────────────────────────────────────────────── */
.wb-export-dialog__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
}

.wb-export-dialog__error-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--danger);
  margin: 0;
}

.wb-export-dialog__error-detail {
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
  margin: 0;
  text-align: center;
}

/* ── B2.2: Fieldset & options ────────────────────────────────────────── */
.wb-export-dialog__fieldset {
  border: none;
  padding: 0;
  margin: 0 0 12px;
}

.wb-export-dialog__legend {
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-fg-secondary, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.wb-export-dialog__page-options {
  display: flex;
  gap: 16px;
}

.wb-export-option {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--wb-fg, #0f172a);
  cursor: pointer;
}

.wb-export-option input[type="radio"],
.wb-export-option input[type="checkbox"] {
  accent-color: var(--wb-brand, #0066FF);
  cursor: pointer;
}

.wb-export-dialog__option-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.wb-export-select {
  padding: 4px 8px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 6px;
  font-size: 13px;
  color: var(--wb-fg, #0f172a);
  background: var(--card-bg);
  cursor: pointer;
  margin-left: 8px;
}

.wb-export-select:focus {
  outline: 2px solid var(--wb-brand, #0066FF);
  outline-offset: -1px;
}

.wb-export-dialog__progress-elapsed {
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
  margin: 0;
}

.wb-export-dialog__progress-timeout {
  font-size: 13px;
  color: var(--danger);
  font-weight: 500;
  margin: 0;
}

/* B5.2: Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .wb-export-format,
  .wb-export-dialog__spinner {
    transition: none;
    animation: none;
  }
}
</style>
