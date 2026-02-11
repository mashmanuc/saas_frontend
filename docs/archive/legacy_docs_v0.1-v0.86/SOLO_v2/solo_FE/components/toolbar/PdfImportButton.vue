<template>
  <div class="pdf-import" ref="containerRef">
    <!-- Import button -->
    <button
      class="pdf-import-trigger"
      :class="{ 'pdf-import-trigger--active': isProcessing }"
      :disabled="isProcessing"
      @click="openFileDialog"
      :title="isProcessing ? progress.message : 'Import PDF'"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
      <span class="pdf-import-label">PDF</span>
    </button>

    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".pdf,application/pdf"
      class="pdf-import-input"
      @change="handleFileSelect"
    />

    <!-- Progress modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showProgress" class="pdf-import-modal-overlay" @click.self="handleOverlayClick">
          <div class="pdf-import-modal">
            <div class="modal-header">
              <h3 class="modal-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                PDF Import
              </h3>
              <button
                v-if="progress.status !== 'complete'"
                class="modal-close"
                @click="handleCancel"
                :disabled="!isProcessing"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div class="modal-body">
              <!-- Status icon -->
              <div class="status-icon" :class="`status-icon--${progress.status}`">
                <!-- Loading spinner -->
                <svg v-if="['loading', 'rendering', 'uploading'].includes(progress.status)" class="spinner" width="48" height="48" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="31.4" stroke-dashoffset="10" />
                </svg>
                <!-- Success icon -->
                <svg v-else-if="progress.status === 'complete'" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="8 12 11 15 16 9" />
                </svg>
                <!-- Error icon -->
                <svg v-else-if="progress.status === 'error'" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>

              <!-- Progress message -->
              <p class="progress-message">{{ progress.message }}</p>

              <!-- Progress bar -->
              <div v-if="progress.totalPages > 0 && progress.status !== 'error'" class="progress-bar-container">
                <div class="progress-bar">
                  <div
                    class="progress-bar-fill"
                    :style="{ width: `${progressPercent}%` }"
                  />
                </div>
                <span class="progress-text">
                  {{ progress.currentPage }} / {{ progress.totalPages }}
                </span>
              </div>

              <!-- Error details -->
              <p v-if="progress.error" class="error-details">
                {{ progress.error }}
              </p>
            </div>

            <div class="modal-footer">
              <button
                v-if="progress.status === 'complete'"
                class="btn btn-primary"
                @click="handleComplete"
              >
                Done
              </button>
              <button
                v-else-if="progress.status === 'error'"
                class="btn btn-secondary"
                @click="handleRetry"
              >
                Try Again
              </button>
              <button
                v-else
                class="btn btn-secondary"
                @click="handleCancel"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePdfImport, type PdfImportResult } from '../../composables/usePdfImport'

const props = defineProps<{
  sessionId: string
  maxFileSizeMB?: number
}>()

const emit = defineEmits<{
  'import-complete': [result: PdfImportResult]
  'import-error': [error: Error]
}>()

// Refs
const containerRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const showProgress = ref(false)
const selectedFile = ref<File | null>(null)

// PDF Import composable
const { progress, isProcessing, importPdf, cancelImport, reset } = usePdfImport({
  sessionId: props.sessionId,
  maxFileSizeMB: props.maxFileSizeMB || 10,
  renderScale: 2,
  imageQuality: 0.92,
  createPagesForEach: true,
})

// Computed
const progressPercent = computed(() => {
  if (progress.value.totalPages === 0) return 0
  return Math.round((progress.value.currentPage / progress.value.totalPages) * 100)
})

// Watch for complete/error to auto-close
watch(() => progress.value.status, (status) => {
  if (status === 'complete') {
    // Auto close after delay
    setTimeout(() => {
      if (progress.value.status === 'complete') {
        showProgress.value = false
        reset()
      }
    }, 2000)
  }
})

// Methods
function openFileDialog(): void {
  fileInputRef.value?.click()
}

async function handleFileSelect(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  selectedFile.value = file
  showProgress.value = true

  // Reset input for re-selection
  input.value = ''

  try {
    const result = await importPdf(file)
    emit('import-complete', result)
  } catch (error) {
    emit('import-error', error instanceof Error ? error : new Error('Unknown error'))
  }
}

function handleCancel(): void {
  cancelImport()
  showProgress.value = false
  selectedFile.value = null
}

function handleComplete(): void {
  showProgress.value = false
  reset()
  selectedFile.value = null
}

function handleRetry(): void {
  if (selectedFile.value) {
    reset()
    importPdf(selectedFile.value).catch(() => {})
  } else {
    showProgress.value = false
    reset()
    openFileDialog()
  }
}

function handleOverlayClick(): void {
  // Only close if complete or error
  if (progress.value.status === 'complete' || progress.value.status === 'error') {
    showProgress.value = false
    reset()
  }
}
</script>

<style scoped>
.pdf-import {
  position: relative;
}

.pdf-import-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  background: var(--color-bg-primary, #ffffff);
  color: var(--color-text-secondary, #6b7280);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pdf-import-trigger:hover:not(:disabled) {
  border-color: var(--color-brand, #2563eb);
  color: var(--color-brand, #2563eb);
}

.pdf-import-trigger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pdf-import-trigger--active {
  border-color: var(--color-brand, #2563eb);
  background: var(--color-brand-light, #eff6ff);
}

.pdf-import-label {
  display: none;
}

@media (min-width: 640px) {
  .pdf-import-label {
    display: inline;
  }
}

.pdf-import-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

/* Modal overlay */
.pdf-import-modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  padding: 20px;
}

/* Modal */
.pdf-import-modal {
  width: 100%;
  max-width: 400px;
  background: var(--color-bg-primary, #ffffff);
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #1f2937);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-tertiary, #9ca3af);
  cursor: pointer;
  transition: all 0.15s ease;
}

.modal-close:hover:not(:disabled) {
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--color-text-primary, #1f2937);
}

.modal-close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 20px;
  text-align: center;
}

/* Status icon */
.status-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  border-radius: 50%;
}

.status-icon--loading,
.status-icon--rendering,
.status-icon--uploading {
  background: var(--color-brand-light, #eff6ff);
  color: var(--color-brand, #2563eb);
}

.status-icon--complete {
  background: #dcfce7;
  color: #16a34a;
}

.status-icon--error {
  background: #fee2e2;
  color: #dc2626;
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.progress-message {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
}

/* Progress bar */
.progress-bar-container {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--color-bg-tertiary, #f1f5f9);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--color-brand, #2563eb);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-tertiary, #9ca3af);
  min-width: 50px;
  text-align: right;
}

.error-details {
  margin: 8px 0 0;
  padding: 12px;
  background: #fef2f2;
  border-radius: 8px;
  font-size: 12px;
  color: #dc2626;
  word-break: break-word;
}

/* Footer */
.modal-footer {
  display: flex;
  justify-content: center;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.btn {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-primary {
  background: var(--color-brand, #2563eb);
  color: #ffffff;
}

.btn-primary:hover {
  background: var(--color-brand-dark, #1d4ed8);
}

.btn-secondary {
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--color-text-primary, #1f2937);
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}

/* Modal animation */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .pdf-import-modal,
.modal-leave-to .pdf-import-modal {
  transform: scale(0.95) translateY(10px);
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .pdf-import-trigger {
    background: var(--color-bg-primary, #1f2937);
    border-color: var(--color-border, #374151);
    color: var(--color-text-secondary, #9ca3af);
  }

  .pdf-import-modal {
    background: var(--color-bg-primary, #1f2937);
  }

  .modal-header {
    border-color: var(--color-border, #374151);
  }

  .modal-footer {
    border-color: var(--color-border, #374151);
  }

  .error-details {
    background: rgba(220, 38, 38, 0.1);
  }
}
</style>
