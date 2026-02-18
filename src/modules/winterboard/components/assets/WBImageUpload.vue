<!-- WB: Image upload UX — drag-drop, paste, file picker, progress overlay
     Ref: TASK_BOARD_PHASES.md B2.1, ManifestWinterboard_v2.md LAW-18
     Integrates with useImageUpload composable (A2.1) -->
<template>
  <!-- Drag overlay — shown when dragging files over the canvas area -->
  <Transition name="wb-upload-fade">
    <div
      v-if="isDragOver"
      class="wb-upload-overlay"
      role="region"
      :aria-label="t('winterboard.upload.dragHere')"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <div class="wb-upload-overlay__content">
        <svg class="wb-upload-overlay__icon" width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 32V16M24 16l-8 8M24 16l8 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          <rect x="4" y="4" width="40" height="40" rx="8" stroke="currentColor" stroke-width="2" stroke-dasharray="6 4" />
        </svg>
        <p class="wb-upload-overlay__text">{{ t('winterboard.upload.dragHere') }}</p>
        <p class="wb-upload-overlay__hint">{{ t('winterboard.upload.supportedFormats') }}</p>
      </div>
    </div>
  </Transition>

  <!-- Upload progress overlay -->
  <Transition name="wb-upload-fade">
    <div
      v-if="isUploading"
      class="wb-upload-progress"
      role="status"
      aria-live="polite"
    >
      <div class="wb-upload-progress__content">
        <div
          class="wb-upload-progress__bar-track"
          role="progressbar"
          :aria-valuenow="progress"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="t('winterboard.upload.uploading')"
        >
          <div
            class="wb-upload-progress__bar-fill"
            :style="{ width: `${progress}%` }"
          />
        </div>
        <p class="wb-upload-progress__text">
          {{ t('winterboard.upload.uploading') }} {{ progress }}%
        </p>
        <button
          type="button"
          class="wb-upload-progress__cancel"
          @click="cancelUpload"
        >
          {{ t('winterboard.upload.cancel') }}
        </button>
      </div>
    </div>
  </Transition>

  <!-- Hidden file input -->
  <input
    ref="fileInputRef"
    type="file"
    accept="image/png,image/jpeg,image/webp,image/svg+xml"
    multiple
    class="wb-upload-input"
    :aria-label="t('winterboard.upload.pickFile')"
    @change="onFileInputChange"
  />
</template>

<script setup lang="ts">
// WB: WBImageUpload — drag-drop, paste, file picker with progress
// Ref: TASK_BOARD_PHASES.md B2.1
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImageUpload, validateFile } from '../../composables/useImageUpload'
import { useToast } from '../../composables/useToast'
import type { WBAsset } from '../../types/winterboard'

const LOG = '[WB:ImageUploadUX]'

// ── Props & Emits ────────────────────────────────────────────────────────
const props = defineProps<{
  sessionId: string | null
  /** Element to listen for drag events on (defaults to document) */
  dropTargetSelector?: string
  /** Disable all upload interactions */
  disabled?: boolean
}>()

const emit = defineEmits<{
  'asset-created': [asset: WBAsset]
  'upload-start': []
  'upload-end': [success: boolean]
}>()

// ── Composables ──────────────────────────────────────────────────────────
const { t } = useI18n()
const { showToast } = useToast()
const {
  uploadImage,
  uploadProgress,
  uploadState,
  uploadError,
  reset: resetUpload,
} = useImageUpload(() => props.sessionId)

// ── Refs ─────────────────────────────────────────────────────────────────
const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)
const isCancelled = ref(false)
let dragCounter = 0

// ── Computed ─────────────────────────────────────────────────────────────
const isUploading = computed(() =>
  uploadState.value === 'uploading' || uploadState.value === 'confirming',
)
const progress = computed(() => Math.round(uploadProgress.value))

// ── Public methods (exposed to parent) ───────────────────────────────────
function openFilePicker(): void {
  if (props.disabled) return
  fileInputRef.value?.click()
}

defineExpose({ openFilePicker })

// ── File processing ──────────────────────────────────────────────────────
async function processFiles(files: FileList | File[]): Promise<void> {
  if (props.disabled || !props.sessionId) return

  const fileArray = Array.from(files)
  if (fileArray.length === 0) return

  for (const file of fileArray) {
    // Validate first
    const validation = validateFile(file)
    if (!validation.valid) {
      const errorKey = file.size > 10 * 1024 * 1024
        ? 'winterboard.upload.tooLarge'
        : 'winterboard.upload.wrongType'
      showToast(t(errorKey), 'error')
      console.warn(`${LOG} File rejected:`, validation.error)
      continue
    }

    isCancelled.value = false
    emit('upload-start')

    const asset = await uploadImage(file)

    if (isCancelled.value) {
      console.info(`${LOG} Upload cancelled by user`)
      emit('upload-end', false)
      continue
    }

    if (asset) {
      showToast(t('winterboard.upload.success'), 'success')
      emit('asset-created', asset)
      emit('upload-end', true)
      console.info(`${LOG} Asset created`, { id: asset.id })
    } else {
      const errMsg = uploadError.value || t('winterboard.upload.error')
      showToast(errMsg, 'error')
      emit('upload-end', false)
      console.error(`${LOG} Upload failed`, { error: uploadError.value })
    }
  }
}

// ── Drag & Drop ──────────────────────────────────────────────────────────
function onDragEnter(e: DragEvent): void {
  if (props.disabled) return
  // Only react to file drags
  if (!e.dataTransfer?.types?.includes('Files')) return
  dragCounter++
  isDragOver.value = true
}

function onDragOver(e: DragEvent): void {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
  }
}

function onDragLeave(_e: DragEvent): void {
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    isDragOver.value = false
  }
}

async function onDrop(e: DragEvent): Promise<void> {
  e.preventDefault()
  isDragOver.value = false
  dragCounter = 0

  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  await processFiles(files)
}

// ── Clipboard paste ──────────────────────────────────────────────────────
async function onPaste(e: ClipboardEvent): Promise<void> {
  if (props.disabled) return
  const items = e.clipboardData?.items
  if (!items) return

  const imageFiles: File[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) imageFiles.push(file)
    }
  }

  // If no images in clipboard, ignore (text paste is not our concern)
  if (imageFiles.length === 0) return

  e.preventDefault()
  await processFiles(imageFiles)
}

// ── File input change ────────────────────────────────────────────────────
async function onFileInputChange(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  await processFiles(input.files)

  // Reset input so the same file can be selected again
  input.value = ''
}

// ── Cancel ───────────────────────────────────────────────────────────────
function cancelUpload(): void {
  isCancelled.value = true
  resetUpload()
}

// ── Lifecycle: attach global listeners ───────────────────────────────────
onMounted(() => {
  document.addEventListener('dragenter', onDragEnter)
  document.addEventListener('dragleave', onDragLeave)
  document.addEventListener('dragover', onDragOverGlobal)
  document.addEventListener('drop', onDropGlobal)
  document.addEventListener('paste', onPaste)
})

onUnmounted(() => {
  document.removeEventListener('dragenter', onDragEnter)
  document.removeEventListener('dragleave', onDragLeave)
  document.removeEventListener('dragover', onDragOverGlobal)
  document.removeEventListener('drop', onDropGlobal)
  document.removeEventListener('paste', onPaste)
})

// Prevent browser default file open on drag
function onDragOverGlobal(e: DragEvent): void {
  if (e.dataTransfer?.types?.includes('Files')) {
    e.preventDefault()
  }
}

function onDropGlobal(e: DragEvent): void {
  // Prevent browser from opening the file if dropped outside overlay
  if (!isDragOver.value) {
    e.preventDefault()
  }
}
</script>

<style scoped>
/* ── Hidden file input ──────────────────────────────────────────────── */
.wb-upload-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ── Drag overlay ───────────────────────────────────────────────────── */
.wb-upload-overlay {
  position: absolute;
  inset: 0;
  background: rgba(37, 99, 235, 0.08);
  border: 2px dashed var(--wb-brand, #2563eb);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  pointer-events: all;
}

.wb-upload-overlay__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
}

.wb-upload-overlay__icon {
  color: var(--wb-brand, #2563eb);
  opacity: 0.8;
}

.wb-upload-overlay__text {
  font-size: 16px;
  font-weight: 600;
  color: var(--wb-brand, #2563eb);
  margin: 0;
}

.wb-upload-overlay__hint {
  font-size: 12px;
  color: var(--wb-fg-secondary, #64748b);
  margin: 0;
}

/* ── Upload progress overlay ────────────────────────────────────────── */
.wb-upload-progress {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.wb-upload-progress__content {
  background: #ffffff;
  border-radius: 12px;
  padding: 24px 32px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.16);
}

.wb-upload-progress__bar-track {
  width: 100%;
  height: 8px;
  background: var(--wb-toolbar-border, #e2e8f0);
  border-radius: 4px;
  overflow: hidden;
}

.wb-upload-progress__bar-fill {
  height: 100%;
  background: var(--wb-brand, #2563eb);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.wb-upload-progress__text {
  font-size: 14px;
  font-weight: 500;
  color: var(--wb-fg, #0f172a);
  margin: 0;
}

.wb-upload-progress__cancel {
  background: none;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 6px;
  padding: 6px 16px;
  font-size: 13px;
  color: var(--wb-fg-secondary, #64748b);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.wb-upload-progress__cancel:hover {
  background: var(--wb-canvas-bg, #f8fafc);
  border-color: var(--wb-fg-secondary, #94a3b8);
}

/* ── Transitions ────────────────────────────────────────────────────── */
.wb-upload-fade-enter-active,
.wb-upload-fade-leave-active {
  transition: opacity 0.2s ease;
}

.wb-upload-fade-enter-from,
.wb-upload-fade-leave-to {
  opacity: 0;
}

/* ── Reduced motion ─────────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .wb-upload-progress__bar-fill,
  .wb-upload-progress__cancel,
  .wb-upload-fade-enter-active,
  .wb-upload-fade-leave-active {
    transition: none;
  }
}
</style>
