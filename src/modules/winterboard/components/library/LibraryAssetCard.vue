<template>
  <div
    class="library-asset-card"
    :class="{ 'library-asset-card--favorite': asset.is_favorite }"
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
        {{ fileIcon }}
      </div>
    </div>

    <!-- Info -->
    <div class="library-asset-card__info">
      <span class="library-asset-card__name" :title="asset.name">{{ asset.name }}</span>
      <span class="library-asset-card__size">{{ formatSize(asset.size_bytes) }}</span>
    </div>

    <!-- Actions -->
    <div class="library-asset-card__actions">
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
        class="library-asset-card__action-btn library-asset-card__action-btn--danger"
        :aria-label="t('winterboard.library.delete')"
        :title="t('winterboard.library.delete')"
        @click.stop="emit('delete', asset)"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2 3.5h10M4.5 3.5V2.5A.5.5 0 015 2h4a.5.5 0 01.5.5v1M5.5 6.5v3M8.5 6.5v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M2.5 3.5l.7 7.5a.5.5 0 00.5.5h6.6a.5.5 0 00.5-.5l.7-7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LibraryAsset } from '../../types/library'

// ─── Props & Emits ────────────────────────────────────────────────────────────

interface Props {
  asset: LibraryAsset
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'toggle-favorite': [asset: LibraryAsset]
  delete: [asset: LibraryAsset]
}>()

// ─── i18n ─────────────────────────────────────────────────────────────────────

const { t } = useI18n()

// ─── Computed ─────────────────────────────────────────────────────────────────

const isImage = computed(() => props.asset.content_type.startsWith('image/'))

const previewSrc = computed<string | null>(() => {
  if (props.asset.thumbnail_url) return props.asset.thumbnail_url
  if (isImage.value && props.asset.cdn_url) return props.asset.cdn_url
  return null
})

const fileIcon = computed<string>(() => {
  const ct = props.asset.content_type
  if (ct.startsWith('image/')) return '🖼'
  if (ct === 'application/pdf') return '📄'
  if (ct.startsWith('video/')) return '🎬'
  if (ct.startsWith('audio/')) return '🎵'
  return '📁'
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
}

.library-asset-card__size {
  font-size: 11px;
  color: var(--wb-fg-secondary, #94a3b8);
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
