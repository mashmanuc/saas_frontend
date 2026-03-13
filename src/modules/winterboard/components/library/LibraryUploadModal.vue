<template>
  <Teleport to="body">
    <div
      class="wb-upload-modal-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="t('winterboard.library.uploadTitle')"
      @click.self="emit('close')"
    >
      <div class="wb-upload-modal">
        <!-- Header -->
        <div class="wb-upload-modal__header">
          <h2 class="wb-upload-modal__title">{{ t('winterboard.library.uploadTitle') }}</h2>
          <button
            type="button"
            class="wb-upload-modal__close"
            :aria-label="t('winterboard.library.close')"
            @click="emit('close')"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- Drop zone -->
        <div
          class="wb-upload-modal__dropzone"
          :class="{ 'wb-upload-modal__dropzone--drag': isDragging }"
          role="button"
          tabindex="0"
          :aria-label="t('winterboard.library.dropZoneLabel')"
          @click="fileInputRef?.click()"
          @keydown.enter="fileInputRef?.click()"
          @keydown.space.prevent="fileInputRef?.click()"
          @dragover.prevent="isDragging = true"
          @dragleave="isDragging = false"
          @drop.prevent="onDrop"
        >
          <input
            ref="fileInputRef"
            type="file"
            class="wb-upload-modal__file-input"
            :accept="ACCEPTED_TYPES"
            multiple
            tabindex="-1"
            @change="onFileInputChange"
          />
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect x="4" y="12" width="32" height="22" rx="3" stroke="#94a3b8" stroke-width="1.5"/>
            <path d="M20 6v16M14 12l6-6 6 6" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p class="wb-upload-modal__drop-text">{{ t('winterboard.library.dropOrClick') }}</p>
          <p class="wb-upload-modal__drop-hint">{{ t('winterboard.library.acceptedTypes') }}</p>
        </div>

        <!-- File list -->
        <ul v-if="pendingFiles.length > 0" class="wb-upload-modal__file-list">
          <li
            v-for="(pf, idx) in pendingFiles"
            :key="idx"
            class="wb-upload-modal__file-item"
            :class="`wb-upload-modal__file-item--${pf.status}`"
          >
            <span class="wb-upload-modal__file-icon" aria-hidden="true">{{ fileIcon(pf.file) }}</span>
            <span class="wb-upload-modal__file-name">{{ pf.file.name }}</span>
            <span class="wb-upload-modal__file-size">{{ formatSize(pf.file.size) }}</span>
            <span class="wb-upload-modal__file-status" :aria-label="statusLabel(pf.status)">
              <template v-if="pf.status === 'pending'">–</template>
              <template v-else-if="pf.status === 'uploading'">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="wb-spin" aria-hidden="true">
                  <circle cx="7" cy="7" r="5.5" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="20 15"/>
                </svg>
              </template>
              <template v-else-if="pf.status === 'done'">✓</template>
              <template v-else-if="pf.status === 'error'">✗</template>
            </span>
          </li>
        </ul>

        <!-- Folder selector -->
        <div v-if="pendingFiles.length > 0" class="wb-upload-modal__folder-row">
          <label class="wb-upload-modal__label" :for="'folder-select-' + uid">
            {{ t('winterboard.library.uploadToFolder') }}
          </label>
          <select
            :id="'folder-select-' + uid"
            v-model="targetFolderId"
            class="wb-upload-modal__select"
          >
            <option :value="null">{{ t('winterboard.library.allFiles') }}</option>
            <option
              v-for="folder in flatFolders"
              :key="folder.id"
              :value="folder.id"
            >
              {{ '\u00a0'.repeat(folder.depth * 2) }}{{ folder.name }}
            </option>
          </select>
        </div>

        <!-- Error message -->
        <p v-if="globalError" class="wb-upload-modal__error" role="alert">{{ globalError }}</p>

        <!-- Footer actions -->
        <div class="wb-upload-modal__footer">
          <button type="button" class="wb-upload-modal__btn wb-upload-modal__btn--cancel" @click="emit('close')">
            {{ t('winterboard.boards.confirmDelete.cancel') }}
          </button>
          <button
            type="button"
            class="wb-upload-modal__btn wb-upload-modal__btn--upload"
            :disabled="pendingFiles.length === 0 || uploading"
            @click="startUpload"
          >
            {{ uploading ? t('winterboard.library.uploading') : t('winterboard.library.upload') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { createAsset, confirmAsset } from '../../api/library'
import type { LibraryAsset, LibraryFolderTree } from '../../types/library'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = 'image/*,application/pdf,video/*,audio/*'
const uid = Math.random().toString(36).slice(2, 8)

type UploadStatus = 'pending' | 'uploading' | 'done' | 'error'

interface PendingFile {
  file: File
  status: UploadStatus
}

// ─── Props & Emits ────────────────────────────────────────────────────────────

interface Props {
  folderId?: number | null
  folders?: LibraryFolderTree[]
}

const props = withDefaults(defineProps<Props>(), {
  folderId: null,
  folders: () => [],
})

const emit = defineEmits<{
  close: []
  uploaded: [asset: LibraryAsset]
}>()

// ─── i18n ─────────────────────────────────────────────────────────────────────

const { t } = useI18n()

// ─── State ────────────────────────────────────────────────────────────────────

const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const pendingFiles = ref<PendingFile[]>([])
const uploading = ref(false)
const globalError = ref('')
const targetFolderId = ref<number | null>(props.folderId ?? null)

// ─── Computed: flatten folders for select ────────────────────────────────────

interface FlatFolder { id: number; name: string; depth: number }

function flattenFolders(nodes: LibraryFolderTree[], depth = 0): FlatFolder[] {
  const result: FlatFolder[] = []
  for (const n of nodes) {
    result.push({ id: n.id, name: n.name, depth })
    result.push(...flattenFolders(n.children, depth + 1))
  }
  return result
}

const flatFolders = computed<FlatFolder[]>(() => flattenFolders(props.folders ?? []))

// ─── File handling ────────────────────────────────────────────────────────────

function addFiles(files: FileList | File[]): void {
  for (const file of Array.from(files)) {
    if (!pendingFiles.value.some((p) => p.file.name === file.name && p.file.size === file.size)) {
      pendingFiles.value.push({ file, status: 'pending' })
    }
  }
}

function onFileInputChange(e: Event): void {
  const input = e.target as HTMLInputElement
  if (input.files) addFiles(input.files)
  input.value = ''
}

function onDrop(e: DragEvent): void {
  isDragging.value = false
  if (e.dataTransfer?.files) addFiles(e.dataTransfer.files)
}

// ─── Upload ───────────────────────────────────────────────────────────────────

async function startUpload(): Promise<void> {
  if (uploading.value || pendingFiles.value.length === 0) return
  uploading.value = true
  globalError.value = ''

  const toUpload = pendingFiles.value.filter((p) => p.status === 'pending')

  for (const pf of toUpload) {
    pf.status = 'uploading'
    try {
      const asset = await createAsset({
        name: pf.file.name,
        folder: targetFolderId.value,
        content_type: pf.file.type || 'application/octet-stream',
        size_bytes: pf.file.size,
      })
      const confirmed = await confirmAsset(asset.id, {
        cdn_url: asset.cdn_url || '',
        size_bytes: pf.file.size,
      })
      pf.status = 'done'
      emit('uploaded', confirmed)
    } catch (err) {
      console.error('[WB:UploadModal] Upload failed', pf.file.name, err)
      pf.status = 'error'
    }
  }

  uploading.value = false

  const allDone = pendingFiles.value.every((p) => p.status === 'done')
  if (allDone) {
    setTimeout(() => emit('close'), 800)
  } else if (pendingFiles.value.some((p) => p.status === 'error')) {
    globalError.value = t('winterboard.library.uploadError')
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileIcon(file: File): string {
  if (file.type.startsWith('image/')) return '🖼'
  if (file.type === 'application/pdf') return '📄'
  if (file.type.startsWith('video/')) return '🎬'
  if (file.type.startsWith('audio/')) return '🎵'
  return '📁'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusLabel(status: UploadStatus): string {
  const map: Record<UploadStatus, string> = {
    pending: '',
    uploading: t('winterboard.library.uploading'),
    done: t('winterboard.library.done'),
    error: t('winterboard.library.uploadError'),
  }
  return map[status]
}
</script>

<style scoped>
.wb-upload-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.wb-upload-modal {
  background: var(--wb-card-bg, #ffffff);
  border-radius: 14px;
  padding: 24px;
  max-width: 480px;
  width: 92%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Header ──────────────────────────────────────────────────────────── */

.wb-upload-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wb-upload-modal__title {
  font-size: 17px;
  font-weight: 700;
  color: var(--wb-fg, #0f172a);
  margin: 0;
}

.wb-upload-modal__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--wb-fg-secondary, #64748b);
  transition: background 0.1s;
}

.wb-upload-modal__close:hover {
  background: var(--wb-canvas-bg, #f1f5f9);
  color: var(--wb-fg, #0f172a);
}

/* ── Drop zone ───────────────────────────────────────────────────────── */

.wb-upload-modal__dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 20px;
  border: 2px dashed var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  text-align: center;
  outline: none;
  min-height: 140px;
}

.wb-upload-modal__dropzone:hover,
.wb-upload-modal__dropzone:focus-visible {
  border-color: var(--wb-brand, #0066ff);
  background: rgba(0, 102, 255, 0.03);
}

.wb-upload-modal__dropzone--drag {
  border-color: var(--wb-brand, #0066ff);
  background: rgba(0, 102, 255, 0.06);
}

.wb-upload-modal__file-input {
  display: none;
}

.wb-upload-modal__drop-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--wb-fg, #0f172a);
  margin: 0;
}

.wb-upload-modal__drop-hint {
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
  margin: 0;
}

/* ── File list ───────────────────────────────────────────────────────── */

.wb-upload-modal__file-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.wb-upload-modal__file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 7px;
  background: var(--wb-canvas-bg, #f8fafc);
  font-size: 13px;
}

.wb-upload-modal__file-item--done {
  color: #16a34a;
}

.wb-upload-modal__file-item--error {
  background: #fef2f2;
  color: #ef4444;
}

.wb-upload-modal__file-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.wb-upload-modal__file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-upload-modal__file-size {
  color: var(--wb-fg-secondary, #94a3b8);
  flex-shrink: 0;
  font-size: 11px;
}

.wb-upload-modal__file-status {
  flex-shrink: 0;
  width: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

/* ── Folder selector ─────────────────────────────────────────────────── */

.wb-upload-modal__folder-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.wb-upload-modal__label {
  font-size: 13px;
  color: var(--wb-fg-secondary, #64748b);
  flex-shrink: 0;
}

.wb-upload-modal__select {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 6px;
  font-size: 13px;
  color: var(--wb-fg, #0f172a);
  background: var(--wb-card-bg, #ffffff);
  outline: none;
}

.wb-upload-modal__select:focus {
  border-color: var(--wb-brand, #0066ff);
}

/* ── Error ───────────────────────────────────────────────────────────── */

.wb-upload-modal__error {
  font-size: 13px;
  color: #ef4444;
  padding: 8px 12px;
  background: #fef2f2;
  border-radius: 6px;
  margin: 0;
}

/* ── Footer ──────────────────────────────────────────────────────────── */

.wb-upload-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.wb-upload-modal__btn {
  padding: 9px 18px;
  border: none;
  border-radius: 7px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  min-height: 38px;
  transition: background 0.15s;
}

.wb-upload-modal__btn--cancel {
  background: var(--wb-canvas-bg, #f1f5f9);
  color: var(--wb-fg, #0f172a);
}

.wb-upload-modal__btn--cancel:hover {
  background: var(--wb-toolbar-border, #e2e8f0);
}

.wb-upload-modal__btn--upload {
  background: var(--wb-brand, #0066ff);
  color: #ffffff;
}

.wb-upload-modal__btn--upload:hover:not(:disabled) {
  background: var(--wb-brand-hover, #0052cc);
}

.wb-upload-modal__btn--upload:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Spin animation ──────────────────────────────────────────────────── */

.wb-spin {
  animation: wb-spin 0.8s linear infinite;
}

@keyframes wb-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .wb-spin { animation: none; }
  .wb-upload-modal__dropzone,
  .wb-upload-modal__btn { transition: none; }
}
</style>
