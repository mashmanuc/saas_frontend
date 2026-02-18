<!-- WB: PDF Import Button — toolbar trigger + drag-drop + progress overlay
     Ref: TASK_BOARD_PHASES.md B5.1, LAW-18 (Asset Pipeline) -->
<template>
  <div
    class="wb-pdf-import"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <!-- Import button -->
    <button
      type="button"
      class="wb-pdf-import__btn"
      :class="{ 'wb-pdf-import__btn--importing': isImporting }"
      :disabled="isImporting"
      :aria-label="t('winterboard.pdf.importPdf')"
      :title="t('winterboard.pdf.importPdf')"
      @click="openFilePicker"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M10 1.5H4.5A1.5 1.5 0 003 3v12a1.5 1.5 0 001.5 1.5h9A1.5 1.5 0 0015 15V6.5L10 1.5z" stroke="currentColor" stroke-width="1.2" />
        <path d="M10 1.5V6.5H15" stroke="currentColor" stroke-width="1.2" />
        <path d="M9 9v4.5M7 11l2-2 2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span class="wb-pdf-import__label">{{ t('winterboard.pdf.importPdf') }}</span>
    </button>

    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".pdf,application/pdf"
      class="wb-pdf-import__input"
      aria-hidden="true"
      tabindex="-1"
      @change="onFileSelected"
    />

    <!-- Drag overlay -->
    <Transition name="wb-fade">
      <div v-if="isDragging" class="wb-pdf-import__drag-overlay" role="status">
        <div class="wb-pdf-import__drag-content">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path d="M24 8v20M16 20l8-8 8 8" stroke="#0066FF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M8 32v4a4 4 0 004 4h24a4 4 0 004-4v-4" stroke="#0066FF" stroke-width="2.5" stroke-linecap="round" />
          </svg>
          <p>{{ t('winterboard.pdf.dropPdfHere') }}</p>
        </div>
      </div>
    </Transition>

    <!-- Import progress modal -->
    <Teleport to="body">
      <Transition name="wb-dialog-fade">
        <div v-if="isImporting" class="wb-pdf-import__overlay">
          <div class="wb-pdf-import__modal" role="dialog" aria-modal="true" :aria-label="t('winterboard.pdf.importProgress')">
            <div class="wb-pdf-import__modal-spinner" />
            <p class="wb-pdf-import__modal-title" aria-live="polite">
              {{ progressText || t('winterboard.pdf.importProgress') }}
            </p>
            <div class="wb-pdf-import__progress-bar">
              <div class="wb-pdf-import__progress-fill" :style="{ width: progress + '%' }" />
            </div>
            <p class="wb-pdf-import__progress-pct">{{ progress }}%</p>
            <button
              type="button"
              class="wb-pdf-import__cancel-btn"
              :aria-label="t('winterboard.pdf.cancelImport')"
              @click="cancelImport"
            >
              {{ t('winterboard.pdf.cancelImport') }}
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Error toast (inline) -->
    <Transition name="wb-fade">
      <div v-if="importError" class="wb-pdf-import__error" role="alert">
        <span>{{ importError }}</span>
        <button type="button" class="wb-pdf-import__error-close" :aria-label="t('winterboard.pdf.dismissError')" @click="importError = null">×</button>
      </div>
    </Transition>

    <!-- Success toast -->
    <Transition name="wb-fade">
      <div v-if="showSuccess" class="wb-pdf-import__success" role="status" aria-live="polite">
        {{ successMessage }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
// WB: WBPdfImportButton — PDF import trigger with drag-drop, progress, validation
// Ref: TASK_BOARD_PHASES.md B5.1
import { ref, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePdfImport, validatePdfFile } from '../../composables/usePdfImport'

const props = defineProps<{
  sessionId: string
}>()

const emit = defineEmits<{
  imported: [pageCount: number]
}>()

const { t } = useI18n()

// ── PDF Import composable ─────────────────────────────────────────────────
const sessionIdRef = ref(props.sessionId)
watch(() => props.sessionId, (v) => { sessionIdRef.value = v })

const { isImporting, progress, progressText, error: pdfError, importPdf, cancel: cancelPdfImport } = usePdfImport(sessionIdRef)

// ── Local state ───────────────────────────────────────────────────────────
const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const importError = ref<string | null>(null)
const showSuccess = ref(false)
const successMessage = ref('')
let dragLeaveTimer: ReturnType<typeof setTimeout> | null = null
let successTimer: ReturnType<typeof setTimeout> | null = null

// ── File picker ───────────────────────────────────────────────────────────
function openFilePicker(): void {
  fileInputRef.value?.click()
}

function onFileSelected(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    handleFile(file)
  }
  // Reset input so same file can be re-selected
  input.value = ''
}

// ── Drag & drop ───────────────────────────────────────────────────────────
function onDragOver(e: DragEvent): void {
  if (dragLeaveTimer) { clearTimeout(dragLeaveTimer); dragLeaveTimer = null }
  if (!isDragging.value) isDragging.value = true
}

function onDragLeave(): void {
  // Debounce to avoid flicker when moving between child elements
  dragLeaveTimer = setTimeout(() => { isDragging.value = false }, 100)
}

function onDrop(e: DragEvent): void {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    handleFile(file)
  }
}

// ── Core import handler ───────────────────────────────────────────────────
async function handleFile(file: File): Promise<void> {
  importError.value = null

  // Client-side validation with i18n messages
  const validation = validatePdfFile(file)
  if (!validation.valid) {
    importError.value = mapValidationError(validation.error ?? '')
    return
  }

  await importPdf(file)

  if (pdfError.value) {
    importError.value = pdfError.value
  } else {
    // Success
    showSuccessToast(t('winterboard.pdf.importComplete'))
    emit('imported', 0) // page count unknown here, store handles it
  }
}

function mapValidationError(err: string): string {
  if (err.includes('too large') || err.includes('Maximum allowed')) {
    return t('winterboard.pdf.errorTooLarge')
  }
  if (err.includes('Invalid file type') || err.includes('.pdf extension')) {
    return t('winterboard.pdf.errorInvalidPdf')
  }
  if (err.includes('empty')) {
    return t('winterboard.pdf.errorInvalidPdf')
  }
  return err
}

function cancelImport(): void {
  cancelPdfImport()
}

// ── Success toast ─────────────────────────────────────────────────────────
function showSuccessToast(msg: string): void {
  successMessage.value = msg
  showSuccess.value = true
  if (successTimer) clearTimeout(successTimer)
  successTimer = setTimeout(() => { showSuccess.value = false }, 3000)
}

// ── Expose for testing ────────────────────────────────────────────────────
defineExpose({
  openFilePicker,
  handleFile,
  isDragging,
  importError,
  isImporting,
  progress,
  progressText,
  showSuccess,
  cancelImport,
})

onBeforeUnmount(() => {
  if (dragLeaveTimer) clearTimeout(dragLeaveTimer)
  if (successTimer) clearTimeout(successTimer)
})
</script>

<style scoped>
/* ── Import button ──────────────────────────────────────────────────── */
.wb-pdf-import {
  position: relative;
}

.wb-pdf-import__btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: none;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--wb-fg, #0f172a);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.wb-pdf-import__btn:hover {
  background: var(--wb-canvas-bg, #f8fafc);
  border-color: var(--wb-brand, #0066FF);
}

.wb-pdf-import__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wb-pdf-import__btn--importing {
  border-color: var(--wb-brand, #0066FF);
}

.wb-pdf-import__label {
  white-space: nowrap;
}

.wb-pdf-import__input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

/* ── Drag overlay ───────────────────────────────────────────────────── */
.wb-pdf-import__drag-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 102, 255, 0.08);
  border: 3px dashed var(--wb-brand, #0066FF);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  pointer-events: none;
}

.wb-pdf-import__drag-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--wb-brand, #0066FF);
  font-size: 16px;
  font-weight: 600;
}

/* ── Progress modal ─────────────────────────────────────────────────── */
.wb-pdf-import__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.wb-pdf-import__modal {
  background: #ffffff;
  border-radius: 12px;
  padding: 32px;
  max-width: 360px;
  width: 90%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.16);
}

.wb-pdf-import__modal-spinner {
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

.wb-pdf-import__modal-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
  margin: 0;
  text-align: center;
}

.wb-pdf-import__progress-bar {
  width: 100%;
  height: 6px;
  background: var(--wb-toolbar-border, #e2e8f0);
  border-radius: 3px;
  overflow: hidden;
}

.wb-pdf-import__progress-fill {
  height: 100%;
  background: var(--wb-brand, #0066FF);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.wb-pdf-import__progress-pct {
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
  margin: 0;
}

.wb-pdf-import__cancel-btn {
  padding: 6px 16px;
  background: none;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 6px;
  font-size: 13px;
  color: var(--wb-fg-secondary, #64748b);
  cursor: pointer;
  transition: background 0.15s;
}

.wb-pdf-import__cancel-btn:hover {
  background: var(--wb-canvas-bg, #f1f5f9);
}

/* ── Error toast ────────────────────────────────────────────────────── */
.wb-pdf-import__error {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 1002;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.wb-pdf-import__error-close {
  background: none;
  border: none;
  color: #dc2626;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

/* ── Success toast ──────────────────────────────────────────────────── */
.wb-pdf-import__success {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #16a34a;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  z-index: 1002;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* ── Transitions ────────────────────────────────────────────────────── */
.wb-fade-enter-active,
.wb-fade-leave-active {
  transition: opacity 0.2s ease;
}

.wb-fade-enter-from,
.wb-fade-leave-to {
  opacity: 0;
}

.wb-dialog-fade-enter-active,
.wb-dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.wb-dialog-fade-enter-from,
.wb-dialog-fade-leave-to {
  opacity: 0;
}

/* ── Reduced motion ─────────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .wb-pdf-import__btn,
  .wb-pdf-import__cancel-btn,
  .wb-pdf-import__progress-fill,
  .wb-pdf-import__modal-spinner {
    transition: none;
    animation: none;
  }

  .wb-fade-enter-active,
  .wb-fade-leave-active,
  .wb-dialog-fade-enter-active,
  .wb-dialog-fade-leave-active {
    transition: none;
  }
}
</style>
