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

    <!-- Info: назва під прев'ю, дрібніше; бейдж і розмір — один рядок
         (розбір 2026-09-22 п. 2–3: бейдж зрізався нижньою межею картки). -->
    <div class="library-asset-card__info">
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
      <span
        v-else
        class="library-asset-card__name"
        :title="asset.name"
        @dblclick.stop="startRename"
      >{{ asset.name }}</span>
      <div class="library-asset-card__meta">
        <span v-if="sourceBadge" class="library-asset-card__source" :class="`library-asset-card__source--${sourceBadge.type}`">
          {{ sourceBadge.label }}
        </span>
        <span class="library-asset-card__size">{{ formatSize(asset.size_bytes) }}</span>
      </div>
    </div>

    <!-- Вибране — видно без наведення (раніше лише жовта рамка). -->
    <span
      v-if="asset.is_favorite"
      class="library-asset-card__fav"
      :title="t('winterboard.library.favorite')"
      aria-hidden="true"
    >★</span>

    <!-- Дії — одна кнопка «…» у куті, меню з тими самими діями. -->
    <div class="library-asset-card__actions">
      <LibraryAssetMenu
        :asset="asset"
        :can-read-material="canReadMaterial"
        @action="onMenuAction"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { setAssetDragData } from '../../utils/dragHelpers'
import type { LibraryAsset } from '../../types/library'
import LibraryAssetMenu from './LibraryAssetMenu.vue'

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

function onMenuAction(action: string, rect: DOMRect): void {
  if (action === 'rename') startRename()
  else if (action === 'move') emit('move', props.asset, rect)
  else if (action === 'toggle-favorite') emit('toggle-favorite', props.asset)
  else if (action === 'delete') emit('delete', props.asset)
  else if (action === 'read-material') emit('read-material', props.asset)
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
  if ((props.asset as { _source?: string })._source === 'pasted') {
    return { type: 'pasted', label: t('winterboard.library.source.pasted') }
  }
  if (props.asset.content_item_id) return { type: 'lesson', label: t('winterboard.library.source.lesson') }
  return { type: 'upload', label: t('winterboard.library.source.upload') }
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
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
  display: flex;
  flex-direction: column;
}

.library-asset-card:hover {
  border-color: var(--wb-brand, #0f766e);
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.07);
}

/* ── Preview — головна частина картки (п. 3). flex-shrink: 0 — інакше в
   стиснутому контейнері прев'ю схлопувалось до нуля (так було на проді). ── */

.library-asset-card__preview {
  flex-shrink: 0;
  aspect-ratio: 4 / 3;
  background: var(--wb-canvas-bg, #f4f7f6);
  border-bottom: 1px solid var(--wb-toolbar-border, #eef2f1);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.library-asset-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: left top;
}

.library-asset-card__icon {
  line-height: 1;
  user-select: none;
}

/* ── Info ─────────────────────────────────────────────────────────────── */

.library-asset-card__info {
  padding: 8px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.library-asset-card__name {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--wb-fg, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: default;
}

.library-asset-card__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

/* ── Inline rename ─────────────────────────────────────────────────── */

.library-asset-card__rename-row {
  display: flex;
  align-items: center;
  min-width: 0;
}

.library-asset-card__rename-input {
  flex: 1;
  min-width: 0;
  padding: 2px 6px;
  font-size: 12.5px;
  font-weight: 500;
  border: 1px solid var(--wb-brand, #0f766e);
  border-radius: 4px;
  outline: none;
  background: #fff;
  color: var(--wb-fg, #0f172a);
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
  color: var(--wb-fg-secondary, #64748b);
  white-space: nowrap;
}

.library-asset-card__source {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 1px 6px;
  border-radius: 4px;
  line-height: 16px;
  white-space: nowrap;
}

.library-asset-card__source--upload { background: #f1f5f9; color: #475569; }
.library-asset-card__source--lesson { background: #e6f4ef; color: #0f6b52; }
.library-asset-card__source--youtube { background: #f1f5f9; color: #475569; }
.library-asset-card__source--pasted { background: #f3f0fb; color: #5b4a8a; }

.library-asset-card__fav {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.92);
  color: #d97706;
  font-size: 13px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

/* ── «…» у куті — видно завжди (на планшеті hover немає). ─────────────── */

.library-asset-card__actions {
  position: absolute;
  top: 6px;
  right: 6px;
}

@media (prefers-reduced-motion: reduce) {
  .library-asset-card { transition: none; }
}
</style>
