<script setup lang="ts">
import { ref } from 'vue'
import { X, Download, Image, FileJson, FileText } from 'lucide-vue-next'
import type { ExportFormat } from '@/core/board/types'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'export', format: ExportFormat): void
}>()

const selectedFormat = ref<ExportFormat>('png')
const isExporting = ref(false)

const formats: Array<{ value: ExportFormat; label: string; icon: typeof Image; description: string }> = [
  { value: 'png', label: 'PNG', icon: Image, description: 'High quality image with transparency' },
  { value: 'jpg', label: 'JPG', icon: Image, description: 'Compressed image, smaller file size' },
  { value: 'svg', label: 'SVG', icon: FileText, description: 'Vector format, scalable' },
  { value: 'pdf', label: 'PDF', icon: FileText, description: 'Document format for printing' },
  { value: 'json', label: 'JSON', icon: FileJson, description: 'Raw data, can be imported later' },
]

async function handleExport() {
  isExporting.value = true
  try {
    emit('export', selectedFormat.value)
    emit('close')
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div class="export-modal-overlay" @click.self="emit('close')">
    <div class="export-modal">
      <div class="modal-header">
        <h2>Export Board</h2>
        <button class="close-btn" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>

      <div class="modal-content">
        <div class="format-options">
          <label
            v-for="format in formats"
            :key="format.value"
            class="format-option"
            :class="{ selected: selectedFormat === format.value }"
          >
            <input
              type="radio"
              :value="format.value"
              v-model="selectedFormat"
              class="sr-only"
            />
            <component :is="format.icon" :size="24" class="format-icon" />
            <div class="format-info">
              <span class="format-label">{{ format.label }}</span>
              <span class="format-description">{{ format.description }}</span>
            </div>
          </label>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn secondary" @click="emit('close')">Cancel</button>
        <button class="btn primary" :disabled="isExporting" @click="handleExport">
          <Download :size="18" />
          {{ isExporting ? 'Exporting...' : 'Export' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.export-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.export-modal {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 480px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  color: #666;
}

.close-btn:hover {
  background: #f0f0f0;
}

.modal-content {
  padding: 1.5rem;
}

.format-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.format-option {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.format-option:hover {
  border-color: #3b82f6;
}

.format-option.selected {
  border-color: #3b82f6;
  background: #eff6ff;
}

.format-icon {
  color: #666;
}

.format-option.selected .format-icon {
  color: #3b82f6;
}

.format-info {
  display: flex;
  flex-direction: column;
}

.format-label {
  font-weight: 600;
  font-size: 0.9375rem;
}

.format-description {
  font-size: 0.8125rem;
  color: #666;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.modal-footer {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e0e0e0;
}

.btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn.primary {
  background: #3b82f6;
  color: white;
}

.btn.primary:hover {
  background: #2563eb;
}

.btn.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.secondary {
  background: #f0f0f0;
  color: #333;
}

.btn.secondary:hover {
  background: #e0e0e0;
}
</style>
