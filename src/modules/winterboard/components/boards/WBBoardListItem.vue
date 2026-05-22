<template>
  <div
    class="wb-board-list-item"
    role="row"
    tabindex="0"
    @click="emit('open')"
    @keydown.enter="emit('open')"
    @keydown.space.prevent="emit('open')"
  >
    <!-- Thumbnail -->
    <div class="wb-board-list-item__thumb" aria-hidden="true">
      <img
        v-if="board.thumbnail_url"
        :src="board.thumbnail_url"
        :alt="board.name || t('winterboard.boards.untitled')"
        class="wb-board-list-item__thumb-img"
        loading="lazy"
        draggable="false"
      />
      <div v-else class="wb-board-list-item__thumb-placeholder">
        <img :src="logoSrc" alt="Winterboard" class="wb-board-list__thumb-logo" />
      </div>
    </div>

    <!-- Info -->
    <div class="wb-board-list-item__info">
      <span class="wb-board-list-item__name">
        {{ board.name || t('winterboard.boards.untitled') }}
      </span>
      <!-- Prep session label (INV-PREP-2) -->
      <span v-if="board.origin_lesson_id" class="wb-board-list-item__prep" @click.stop>
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M1 7.5L7 1.5l1.5 1.5-6 6H1V7.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
        </svg>
        {{ t('winterboard.boards.prepLabel') }}
        <template v-if="board.origin_lesson_title"> · {{ board.origin_lesson_title }}</template>
        <router-link :to="{ name: 'MyLessons' }" class="wb-board-list-item__prep-back">
          {{ t('winterboard.boards.backToLesson') }}
        </router-link>
      </span>
      <span class="wb-board-list-item__meta">
        <!-- INV-KNOW-3 PR-4: folder breadcrumb (rendered, not computed) -->
        <span
          v-if="board.folder_path"
          class="wb-board-list-item__path"
          :title="board.folder_path"
        >{{ board.folder_path }}</span>
        <span v-if="board.folder_path" aria-hidden="true"> · </span>
        {{ t('winterboard.boards.pageCount', { n: board.page_count }) }}
        <span aria-hidden="true"> · </span>
        {{ formatTimeAgo(board.updated_at) }}
      </span>
    </div>

    <!-- Actions -->
    <div class="wb-board-list-item__actions" @click.stop>
      <button
        type="button"
        class="wb-board-list-item__action-btn"
        :aria-label="t('winterboard.boards.actions.duplicate')"
        :title="t('winterboard.boards.actions.duplicate')"
        @click="emit('duplicate')"
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
          <rect x="4" y="4" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5" />
          <path d="M10 4V3A1 1 0 009 2H3a1 1 0 00-1 1v6a1 1 0 001 1h1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
      <button
        type="button"
        class="wb-board-list-item__action-btn wb-board-list-item__action-btn--danger"
        :aria-label="t('winterboard.boards.actions.delete')"
        :title="t('winterboard.boards.actions.delete')"
        @click="emit('delete')"
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
          <path d="M2 4h11M5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6 7v4M9 7v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          <path d="M2.5 4l.8 8a1 1 0 001 .9h6.4a1 1 0 001-.9l.8-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSeasonalLogo } from '@/composables/useSeasonalLogo'
import type { WBSessionListItem } from '../../api/winterboardApi'

// ─── Props & Emits ────────────────────────────────────────────────────────────

interface Props {
  board: WBSessionListItem
}

defineProps<Props>()

const emit = defineEmits<{
  open: []
  duplicate: []
  share: []
  delete: []
}>()

// ─── i18n ─────────────────────────────────────────────────────────────────────

const { t } = useI18n()
const { logoSrc } = useSeasonalLogo()

// ─── Time formatting ──────────────────────────────────────────────────────────

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return t('winterboard.time.justNow')
  if (mins < 60) return t('winterboard.time.minutesAgo', { n: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('winterboard.time.hoursAgo', { n: hours })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('winterboard.time.daysAgo', { n: days })
  return new Date(iso).toLocaleDateString()
}
</script>

<style scoped>
.wb-board-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
  outline: none;
  min-height: 56px;
}

.wb-board-list-item:hover,
.wb-board-list-item:focus-visible {
  background: var(--wb-canvas-bg, #f8fafc);
  border-color: var(--wb-toolbar-border, #e2e8f0);
}

/* ── Thumbnail ────────────────────────────────────────────────────────── */

.wb-board-list-item__thumb {
  width: 48px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background: var(--wb-canvas-bg, #f1f5f9);
  display: flex;
  align-items: center;
  justify-content: center;
}

.wb-board-list-item__thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wb-board-list-item__thumb-placeholder {
  color: #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wb-board-list__thumb-logo {
  width: 28px;
  height: 28px;
  opacity: 0.6;
}

/* ── Info ─────────────────────────────────────────────────────────────── */

.wb-board-list-item__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wb-board-list-item__name {
  font-size: 14px;
  font-weight: 500;
  color: var(--wb-fg, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wb-board-list-item__meta {
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* INV-KNOW-3 PR-4: inline breadcrumb segment у meta line */
.wb-board-list-item__path {
  cursor: help;
}

/* ── Prep session label ───────────────────────────────────────────────── */

.wb-board-list-item__prep {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #0066ff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wb-board-list-item__prep-back {
  font-size: 11px;
  font-weight: 400;
  color: var(--wb-fg-secondary, #64748b);
  text-decoration: none;
  margin-left: 4px;
  flex-shrink: 0;
}

.wb-board-list-item__prep-back:hover {
  color: var(--wb-brand, #0066ff);
  text-decoration: underline;
}

/* ── Actions ─────────────────────────────────────────────────────────── */

.wb-board-list-item__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.1s;
}

.wb-board-list-item:hover .wb-board-list-item__actions,
.wb-board-list-item:focus-within .wb-board-list-item__actions {
  opacity: 1;
}

.wb-board-list-item__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  color: var(--wb-fg-secondary, #64748b);
  transition: background 0.1s, border-color 0.1s, color 0.1s;
}

.wb-board-list-item__action-btn:hover {
  background: var(--wb-toolbar-border, #e2e8f0);
  border-color: var(--wb-toolbar-border, #e2e8f0);
  color: var(--wb-fg, #0f172a);
}

.wb-board-list-item__action-btn--danger:hover {
  background: #fef2f2;
  border-color: #fecaca;
  color: #ef4444;
}

/* ── Touch: always show actions ──────────────────────────────────────── */

@media (hover: none) {
  .wb-board-list-item__actions {
    opacity: 1;
  }
}

/* ── Reduced motion ──────────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .wb-board-list-item,
  .wb-board-list-item__actions,
  .wb-board-list-item__action-btn {
    transition: none;
  }
}
</style>
