<template>
  <div class="asset-uploader">
    <input
      ref="fileInput"
      type="file"
      :accept="acceptedTypes"
      class="hidden"
      @change="handleFileSelect"
    />

    <button class="upload-btn" @click="fileInput?.click()">
      <span class="icon">📁</span>
      {{ $t('solo.assets.upload') }}
    </button>

    <!-- Preview -->
    <div v-if="preview" class="asset-preview">
      <img v-if="isImage" :src="preview" alt="Preview" />
      <div v-else class="file-preview">
        <span class="icon">📄</span>
        <span>{{ fileName }}</span>
      </div>

      <div class="preview-actions">
        <button class="btn btn-primary" @click="confirmUpload">
          {{ $t('solo.assets.addToBoard') }}
        </button>
        <button class="btn btn-ghost" @click="cancelUpload">
          {{ $t('common.cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const emit = defineEmits<{
  (e: 'upload', file: File, type: 'image' | 'svg' | 'pdf'): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const preview = ref<string | null>(null)

const acceptedTypes = 'image/*,.svg,.pdf'

const fileName = computed(() => selectedFile.value?.name || '')

const isImage = computed(() => {
  if (!selectedFile.value) return false
  return selectedFile.value.type.startsWith('image/')
})

function handleFileSelect(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  selectedFile.value = file

  // Create preview for images
  if (file.type.startsWith('image/')) {
    const reader = new FileReader()
    reader.onload = (e) => {
      preview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  } else {
    preview.value = 'file'
  }
}

function confirmUpload(): void {
  if (!selectedFile.value) return

  let type: 'image' | 'svg' | 'pdf' = 'image'

  if (selectedFile.value.type === 'image/svg+xml') {
    type = 'svg'
  } else if (selectedFile.value.type === 'application/pdf') {
    type = 'pdf'
  }

  emit('upload', selectedFile.value, type)
  cancelUpload()
}

function cancelUpload(): void {
  selectedFile.value = null
  preview.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}
</script>

<style scoped>
.asset-uploader {
  position: relative;
}

.hidden {
  display: none;
}

.upload-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary, #f3f4f6);
  border: 2px dashed var(--border-color, #e5e7eb);
  border-radius: 8px;
  cursor: pointer;
}

.upload-btn:hover {
  border-color: var(--accent-color, #3b82f6);
}

.asset-preview {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.5rem;
  padding: 1rem;
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.asset-preview img {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  margin-bottom: 1rem;
}

.file-preview {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--bg-secondary, #f3f4f6);
  border-radius: 4px;
  margin-bottom: 1rem;
}

.preview-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary {
  background: var(--accent-color, #3b82f6);
  color: white;
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-color, #e5e7eb);
}
</style>
