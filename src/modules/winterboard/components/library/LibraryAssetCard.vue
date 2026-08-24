<template>
  <div
    class="library-asset-card"
    :class="{ 'library-asset-card--favorite': asset.is_favorite }"
    draggable="true"
    @dragstart="onDragStart"
    role="article"
    :aria-label="asset.name"
  >
    <!-- Preview -->
    <div class="library-asset-card__preview">
      <img
        v-if="previewSrc"
        :src="previewSrc"
        :alt="asset.name"
        class="library-asset-card__img"
        loading="lazy"
        draggable="false"
      />
      <div v-else class="library-asset-card__icon" aria-hidden="true">
        <!-- PDF -->
        <svg v-if="fileIconType === 'pdf'" width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="4" width="32" height="40" rx="3" fill="#EF4444" fill-opacity="0.1" stroke="#EF4444" stroke-width="1.5"/>
          <path d="M16 4V14H8" stroke="#EF4444" stroke-width="1.5" stroke-linejoin="round"/>
          <text x="24" y="30" text-anchor="middle" font-size="10" font-weight="700" fill="#EF4444">PDF</text>
        </svg>
        <!-- Word (docx/doc) -->
        <svg v-else-if="fileIconType === 'word'" width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="4" width="32" height="40" rx="3" fill="#2563EB" fill-opacity="0.1" stroke="#2563EB" stroke-width="1.5"/>
          <path d="M16 4V14H8" stroke="#2563EB" stroke-width="1.5" stroke-linejoin="round"/>
          <text x="24" y="30" text-anchor="middle" font-size="9" font-weight="700" fill="#2563EB">DOC</text>
        </svg>
        <!-- PowerPoint (pptx/ppt) -->
        <svg v-else-if="fileIconType === 'pptx'" width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="4" width="32" height="40" rx="3" fill="#EA580C" fill-opacity="0.1" stroke="#EA580C" stroke-width="1.5"/>
          <path d="M16 4V14H8" stroke="#EA580C" stroke-width="1.5" stroke-linejoin="round"/>
          <text x="24" y="30" text-anchor="middle" font-size="9" font-weight="700" fill="#EA580C">PPT</text>
        </svg>
        <!-- Video -->
        <svg v-else-if="fileIconType === 'video'" width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="8" width="32" height="32" rx="4" fill="#8B5CF6" fill-opacity="0.1" stroke="#8B5CF6" stroke-width="1.5"/>
          <path d="M20 18v12l10-6-10-6z" fill="#8B5CF6"/>
        </svg>
        <!-- Audio -->
        <svg v-else-if="fileIconType === 'audio'" width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="16" fill="#8B5CF6" fill-opacity="0.1" stroke="#8B5CF6" stroke-width="1.5"/>
          <path d="M20 30V20l12-4v14" stroke="#8B5CF6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="18" cy="30" r="3" fill="#8B5CF6"/>
          <circle cx="30" cy="28" r="3" fill="#8B5CF6"/>
        </svg>
        <!-- Image (fallback if no preview) -->
        <svg v-else-if="fileIconType === 'image'" width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="8" width="32" height="32" rx="4" fill="#10B981" fill-opacity="0.1" stroke="#10B981" stroke-width="1.5"/>
          <circle cx="18" cy="18" r="3" fill="#10B981"/>
          <path d="M8 32l8-8 6 6 4-4 14 14H12a4 4 0 01-4-4v-4z" fill="#10B981" fill-opacity="0.3"/>
        </svg>
        <!-- Generic file -->
        <svg v-else width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="4" width="32" height="40" rx="3" fill="#94A3B8" fill-opacity="0.1" stroke="#94A3B8" stroke-width="1.5"/>
          <path d="M16 4V14H8" stroke="#94A3B8" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M16 24h16M16 30h10" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
    </div>

    <!-- Info -->
    <div class="library-asset-card__info">
      <!-- Inline rename mode -->
      <div v-if="isRenaming" class="library-asset-card__rename-row" @click.stop>
        <input
          ref="renameInputRef"
          v-model="renameValue"
          type="text"
          maxlength="120"
          class="library-asset-card__rename-input"
          @keydown.enter="commitRename"
          @keydown.escape="cancelRename"
          @blur="commitRename"
        />
        <span class="library-asset-card__ext">{{ fileExtension }}</span>
      </div>
      <!-- Normal display -->
      <span
        v-else
        class="library-asset-card__name"
        :title="asset.name"
        @dblclick.stop="startRename"
      >{{ asset.name }}</span>
      <span class="library-asset-card__size">{{ formatSize(asset.size_bytes) }}</span>
      <!-- Phase 16 INT-32: Source badge -->
      <span v-if="sourceBadge" class="library-asset-card__source" :class="`library-asset-card__source--${sourceBadge.type}`">
        {{ sourceBadge.label }}
      </span>
    </div>

    <!-- Actions -->
    <div class="library-asset-card__actions">
      <!-- Ф6-4: кнопки НЕМАЄ, поки сервер не сказав, що читання ввімкнене.
           Раніше вона показувалась завжди і на клік чесно відповідала
           «вимкнено» — тобто існувала, щоб відмовити. -->
      <button
        v-if="canReadMaterial"
        type="button"
        class="library-asset-card__action-btn"
        :aria-label="t('winterboard.materials.readAsset')"
        :title="t('winterboard.materials.readAsset')"
        @click.stop="emit('read-material', asset)"
      >📖</button>
      <button
        type="button"
        class="library-asset-card__action-btn"
        :class="{ 'library-asset-card__action-btn--active': asset.is_favorite }"
        :aria-label="t('winterboard.library.favorite')"
        :aria-pressed="asset.is_favorite"
        :title="t('winterboard.library.favorite')"
        @click.stop="emit('toggle-favorite', asset)"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M7 1.5l1.545 3.13 3.455.5-2.5 2.435.59 3.435L7 9.25l-3.09 1.75.59-3.435L2 5.13l3.455-.5L7 1.5z"
            :fill="asset.is_favorite ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        class="library-asset-card__action-btn"
        :aria-label="t('winterboard.library.renameAsset')"
        :title="t('winterboard.library.renameAsset')"
        @click.stop="startRename"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M8.5 2.5l3 3M2 9.5L9.5 2l3 3L5 12.5H2v-3z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button
        type="button"
        class="library-asset-card__action-btn"
        :aria-label="t('winterboard.library.moveToFolder')"
        :title="t('winterboard.library.moveToFolder')"
        data-testid="move-asset-btn"
        @click.stop="emitMove($event)"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M1.5 4A1.5 1.5 0 013 2.5h2.5l1 1.5H11A1.5 1.5 0 0112.5 5.5v5A1.5 1.5 0 0111 12H3A1.5 1.5 0 011.5 10.5V4z"
            fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
          <path d="M7 7v3M5.5 8.5L7 10l1.5-1.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button
        type="button"
        class="library-asset-card__action-btn library-asset-card__action-btn--danger"
        :aria-label="t('winterboard.library.archiveAction')"
        :title="t('winterboard.library.archiveAction')"
        @click.stop="emit('delete', asset)"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <rect x="1" y="1.5" width="12" height="3" rx="0.5" stroke="currentColor" stroke-width="1.2"/>
          <path d="M2 4.5v7a.5.5 0 00.5.5h9a.5.5 0 00.5-.5v-7M5.5 7.5h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { setAssetDragData } from '../../utils/dragHelpers'
import type { LibraryAsset } from '../../types/library'

// ─── Props & Emits ────────────────────────────────────────────────────────────

interface Props {
  asset: LibraryAsset
  /** Читання матеріалів увімкнене на сервері (`materialsApi.status()`). */
  canReadMaterial?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'toggle-favorite': [asset: LibraryAsset]
  move: [asset: LibraryAsset, anchorRect: DOMRect]
  delete: [asset: LibraryAsset]
  rename: [asset: LibraryAsset, newName: string]
  'read-material': [asset: LibraryAsset]
}>()

function emitMove(e: MouseEvent): void {
  const btn = e.currentTarget as HTMLElement
  emit('move', props.asset, btn.getBoundingClientRect())
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

const { t } = useI18n()

// ─── Computed ─────────────────────────────────────────────────────────────────

const isImage = computed(() => props.asset.content_type.startsWith('image/'))

const previewSrc = computed<string | null>(() => {
  if (props.asset.thumbnail_url) return props.asset.thumbnail_url
  if (isImage.value && props.asset.cdn_url) return props.asset.cdn_url
  return null
})

const fileIconType = computed<string>(() => {
  const ct = props.asset.content_type
  const name = props.asset.name.toLowerCase()
  if (ct === 'application/pdf') return 'pdf'
  if (
    ct === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ct === 'application/msword' ||
    name.endsWith('.docx') || name.endsWith('.doc')
  ) return 'word'
  if (
    ct === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    ct === 'application/vnd.ms-powerpoint' ||
    name.endsWith('.pptx') || name.endsWith('.ppt')
  ) return 'pptx'
  if (ct.startsWith('image/')) return 'image'
  if (ct.startsWith('video/')) return 'video'
  if (ct.startsWith('audio/')) return 'audio'
  return 'file'
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Phase 16 INT-32: Source badge
const sourceBadge = computed<{ type: string; label: string } | null>(() => {
  const name = props.asset.name.toLowerCase()
  const ct = props.asset.content_type
  if (name.includes('youtube') || ct === 'video/youtube') return { type: 'youtube', label: 'YouTube' }
  if (props.asset.content_item_id) return { type: 'lesson', label: 'Lesson' }
  return { type: 'upload', label: 'Upload' }
})

// ─── Inline rename ───────────────────────────────────────────────────────────

const isRenaming = ref(false)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

/** Розширення файлу (напр. ".png", ".pdf") */
const fileExtension = computed<string>(() => {
  const name = props.asset.name
  const dotIdx = name.lastIndexOf('.')
  if (dotIdx <= 0) return ''
  return name.slice(dotIdx)
})

/** Назва без розширення */
const fileStem = computed<string>(() => {
  const name = props.asset.name
  const dotIdx = name.lastIndexOf('.')
  if (dotIdx <= 0) return name
  return name.slice(0, dotIdx)
})

function startRename(): void {
  isRenaming.value = true
  renameValue.value = fileStem.value
  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

function cancelRename(): void {
  isRenaming.value = false
  renameValue.value = ''
}

function commitRename(): void {
  if (!isRenaming.value) return
  const trimmed = renameValue.value.trim()
  isRenaming.value = false

  // Порожня назва або та сама — нічого не робимо
  if (!trimmed || trimmed === fileStem.value) {
    renameValue.value = ''
    return
  }

  emit('rename', props.asset, trimmed)
  renameValue.value = ''
}

// ─── Drag handlers (Phase 33 B2) ─────────────────────────────────────────────

function onDragStart(e: DragEvent): void {
  setAssetDragData(e, props.asset.id)
}
</script>

<style scoped>
.library-asset-card {
  position: relative;
  background: var(--wb-card-bg, #ffffff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
  display: flex;
  flex-direction: column;
}

.library-asset-card:hover {
  border-color: var(--wb-brand, #0066ff);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
}

.library-asset-card--favorite {
  border-color: #f59e0b;
}

/* ── Preview ─────────────────────────────────────────────────────────── */

.library-asset-card__preview {
  height: 120px;
  background: var(--wb-canvas-bg, #f8fafc);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.library-asset-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.library-asset-card__icon {
  font-size: 36px;
  line-height: 1;
  user-select: none;
}

/* ── Info ─────────────────────────────────────────────────────────────── */

.library-asset-card__info {
  padding: 8px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}

.library-asset-card__name {
  font-size: 13px;
  font-weight: 500;
  color: var(--wb-fg, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: default;
}

/* ── Inline rename ─────────────────────────────────────────────────── */

.library-asset-card__rename-row {
  display: flex;
  align-items: center;
  gap: 0;
  min-width: 0;
}

.library-asset-card__rename-input {
  flex: 1;
  min-width: 0;
  padding: 2px 6px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--wb-brand, #0066ff);
  border-radius: 4px;
  outline: none;
  background: #fff;
  color: var(--wb-fg, #0f172a);
}

.library-asset-card__rename-input:focus {
  box-shadow: 0 0 0 2px rgba(0, 102, 255, 0.2);
}

.library-asset-card__ext {
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
  white-space: nowrap;
  flex-shrink: 0;
  padding-left: 1px;
}

.library-asset-card__size {
  font-size: 11px;
  color: var(--wb-fg-secondary, #94a3b8);
}

.library-asset-card__source {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
}

.library-asset-card__source--upload {
  background: #f1f5f9;
  color: #64748b;
}

.library-asset-card__source--lesson {
  background: #ede9fe;
  color: #7c3aed;
}

.library-asset-card__source--youtube {
  background: #fee2e2;
  color: #dc2626;
}

/* ── Actions ─────────────────────────────────────────────────────────── */

.library-asset-card__actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.1s;
}

.library-asset-card:hover .library-asset-card__actions,
.library-asset-card:focus-within .library-asset-card__actions {
  opacity: 1;
}

.library-asset-card__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 6px;
  cursor: pointer;
  color: var(--wb-fg-secondary, #64748b);
  transition: background 0.1s, color 0.1s;
}

.library-asset-card__action-btn:hover {
  background: #ffffff;
  color: var(--wb-fg, #0f172a);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.library-asset-card__action-btn--active {
  color: #f59e0b;
}

.library-asset-card__action-btn--danger:hover {
  color: #ef4444;
  border-color: #fecaca;
}

/* ── Touch: always show actions ──────────────────────────────────────── */

@media (hover: none) {
  .library-asset-card__actions {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .library-asset-card,
  .library-asset-card__actions,
  .library-asset-card__action-btn {
    transition: none;
  }
}
</style>
