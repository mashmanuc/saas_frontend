<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="export-modal">
      <header class="export-modal__header">
        <h2>{{ $t('solo.export.title') }}</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </header>

      <div class="export-modal__content">
        <!-- Format selection -->
        <div class="export-option">
          <label>{{ $t('solo.export.format') }}</label>
          <div class="format-buttons">
            <button
              v-for="fmt in formats"
              :key="fmt.id"
              class="format-btn"
              :class="{ 'format-btn--active': format === fmt.id }"
              @click="format = fmt.id"
            >
              <span class="icon">{{ fmt.icon }}</span>
              <span>{{ fmt.label }}</span>
            </button>
          </div>
        </div>

        <!-- PDF options -->
        <div v-if="format === 'pdf'" class="export-option">
          <label>{{ $t('solo.export.pageSize') }}</label>
          <select v-model="pdfOptions.format">
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
          </select>

          <label>{{ $t('solo.export.orientation') }}</label>
          <select v-model="pdfOptions.orientation">
            <option value="landscape">{{ $t('solo.export.landscape') }}</option>
            <option value="portrait">{{ $t('solo.export.portrait') }}</option>
          </select>
        </div>

        <!-- Progress -->
        <div v-if="isExporting" class="export-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${progress}%` }" />
          </div>
          <span>{{ Math.round(progress) }}%</span>
        </div>

        <!-- Error -->
        <div v-if="exportError" class="export-error">
          {{ exportError }}
        </div>
      </div>

      <footer class="export-modal__footer">
        <button class="btn btn-ghost" @click="$emit('close')">
          {{ $t('common.cancel') }}
        </button>
        <button
          class="btn btn-primary"
          :disabled="isExporting"
          @click="handleExport"
        >
          {{ isExporting ? $t('solo.export.exporting') : $t('solo.export.export') }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { usePdfExport } from '../../composables/usePdfExport'
import type { PageState } from '../../types/solo'

interface Props {
  pages: PageState[]
  sessionName: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'exported', format: string): void
}>()

const { isExporting, progress, error: exportError, exportToPdf, renderPageToCanvas } = usePdfExport()

// State
const format = ref<'png' | 'pdf' | 'json'>('pdf')
const pdfOptions = reactive({
  format: 'a4' as 'a4' | 'letter',
  orientation: 'landscape' as 'portrait' | 'landscape',
})

const formats: { id: 'pdf' | 'png' | 'json'; icon: string; label: string }[] = [
  { id: 'pdf', icon: '📄', label: 'PDF' },
  { id: 'png', icon: '🖼️', label: 'PNG' },
  { id: 'json', icon: '📋', label: 'JSON' },
]

async function handleExport(): Promise<void> {
  const filename = props.sessionName || 'board'

  switch (format.value) {
    case 'pdf':
      await exportToPdf(props.pages, `${filename}.pdf`, pdfOptions)
      break
    case 'png':
      await exportPng(filename)
      break
    case 'json':
      exportJson(filename)
      break
  }

  if (!exportError.value) {
    emit('exported', format.value)
    emit('close')
  }
}

async function exportPng(filename: string): Promise<void> {
  // Export first page as PNG
  const canvas = await renderPageToCanvas(props.pages[0])
  const link = document.createElement('a')
  link.download = `${filename}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

function exportJson(filename: string): void {
  const data = JSON.stringify({ pages: props.pages }, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const link = document.createElement('a')
  link.download = `${filename}.json`
  link.href = URL.createObjectURL(blob)
  link.click()
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.export-modal {
  background: var(--card-bg, #fff);
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  overflow: hidden;
}

.export-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.export-modal__header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary, #6b7280);
}

.export-modal__content {
  padding: 1.5rem;
}

.export-option {
  margin-bottom: 1rem;
}

.export-option label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.export-option select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  margin-bottom: 0.75rem;
}

.format-buttons {
  display: flex;
  gap: 0.5rem;
}

.format-btn {
  flex: 1;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-secondary, #f3f4f6);
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
}

.format-btn--active {
  border-color: var(--accent-color, #3b82f6);
  background: var(--accent-bg, #eff6ff);
}

.format-btn .icon {
  font-size: 1.5rem;
}

.export-progress {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--bg-secondary, #f3f4f6);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent-color, #3b82f6);
  transition: width 0.3s;
}

.export-error {
  color: var(--danger-color, #ef4444);
  margin-top: 1rem;
}

.export-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary {
  background: var(--accent-color, #3b82f6);
  color: white;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-color, #e5e7eb);
}
</style>
