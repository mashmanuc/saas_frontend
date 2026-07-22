<template>
  <div
    class="wb-board-card"
    :class="{ 'wb-board-card--selected': selected }"
    role="article"
    :aria-label="board.name || t('winterboard.boards.untitled')"
    tabindex="0"
    @click="emit('open')"
    @keydown.enter="emit('open')"
    @keydown.space.prevent="emit('open')"
  >
    <!-- Selection checkbox (top-left, visible on hover or when selected) -->
    <div class="wb-board-card__select" @click.stop="emit('toggle-select')">
      <span class="wb-board-card__checkbox" :class="{ 'wb-board-card__checkbox--checked': selected }" aria-hidden="true">
        <svg v-if="selected" width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    </div>

    <!-- Thumbnail -->
    <div class="wb-board-card__thumb">
      <img
        v-if="board.thumbnail_url"
        :src="board.thumbnail_url"
        :alt="board.name || t('winterboard.boards.untitled')"
        class="wb-board-card__thumb-img"
        loading="lazy"
        draggable="false"
      />
      <div v-else class="wb-board-card__thumb-placeholder" aria-hidden="true">
        <img :src="logoSrc" alt="Winterboard" class="wb-board-card__thumb-logo" />
      </div>
    </div>

    <!-- Body -->
    <div class="wb-board-card__body">
      <h3 class="wb-board-card__title">
        {{ board.name || t('winterboard.boards.untitled') }}
      </h3>
      <!-- Board status badge -->
      <span
        class="wb-board-card__status-badge"
        :class="board.has_lesson ? 'wb-board-card__status-badge--active' : 'wb-board-card__status-badge--draft'"
      >
        {{ board.has_lesson ? t('winterboard.boards.statusActive') : t('winterboard.boards.statusDraft') }}
      </span>
      <!-- INV-KNOW-3 (Knowledge plan 2026-05-02 PR-4): folder breadcrumb.
           PURE RENDER — value прямо з backend (BoardFolder.full_path,
           materialized у PR-1). Без traversal, без computed, без logic.
           Nothing for root sessions (folder_path is null).
           CSS-truncate + native `title` tooltip → full path on hover. -->
      <!-- Prep session label — shown when board is linked to a KnowledgeLesson (INV-PREP-2) -->
      <div v-if="board.origin_lesson_id" class="wb-board-card__prep" @click.stop>
        <span class="wb-board-card__prep-badge">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M1 7.5L7 1.5l1.5 1.5-6 6H1V7.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
          </svg>
          {{ t('winterboard.boards.prepLabel') }}
          <template v-if="board.origin_lesson_title"> · {{ board.origin_lesson_title }}</template>
        </span>
        <router-link
          :to="{ name: 'MyLessons' }"
          class="wb-board-card__prep-back"
        >{{ t('winterboard.boards.backToLesson') }}</router-link>
      </div>
      <p
        v-if="board.folder_path"
        class="wb-board-card__path"
        :title="board.folder_path"
      >
        {{ board.folder_path }}
      </p>
      <p class="wb-board-card__meta">
        <span>{{ t('winterboard.boards.pageCount', { n: board.page_count }) }}</span>
        <span class="wb-board-card__sep" aria-hidden="true">·</span>
        <span>{{ formatTimeAgo(board.updated_at) }}</span>
      </p>
    </div>

    <!-- Actions (3-dot menu) -->
    <div class="wb-board-card__actions" @click.stop>
      <button
        type="button"
        class="wb-board-card__menu-trigger"
        :aria-label="t('winterboard.boards.openMenu')"
        :aria-expanded="menuOpen"
        @click="menuOpen = !menuOpen"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="3" r="1.5" fill="currentColor" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          <circle cx="8" cy="13" r="1.5" fill="currentColor" />
        </svg>
      </button>

      <Transition name="wb-menu-fade">
        <div v-if="menuOpen" class="wb-board-card__menu" role="menu">
          <button type="button" class="wb-board-card__menu-item" role="menuitem"
            @click="emit('open'); menuOpen = false">
            {{ t('winterboard.boards.actions.open') }}
          </button>
          <button type="button" class="wb-board-card__menu-item" role="menuitem"
            @click="emit('duplicate'); menuOpen = false">
            {{ t('winterboard.boards.actions.duplicate') }}
          </button>
          <button type="button" class="wb-board-card__menu-item" role="menuitem"
            @click="emit('share'); menuOpen = false">
            {{ t('winterboard.boards.actions.share') }}
          </button>
          <!-- Move to folder -->
          <template v-if="folders.length > 0">
            <div class="wb-board-card__menu-divider" role="separator" />
            <div class="wb-board-card__submenu-wrap">
              <button type="button" class="wb-board-card__menu-item" role="menuitem"
                @click.stop="folderSubmenuOpen = !folderSubmenuOpen">
                {{ t('winterboard.boards.actions.moveToFolder') }}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="wb-board-card__chevron" aria-hidden="true">
                  <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <Transition name="wb-menu-fade">
                <div v-if="folderSubmenuOpen" class="wb-board-card__submenu" role="menu">
                  <button
                    v-if="board.folder"
                    type="button"
                    class="wb-board-card__menu-item wb-board-card__menu-item--muted"
                    role="menuitem"
                    @click="emit('move-to-folder', null); menuOpen = false; folderSubmenuOpen = false"
                  >
                    {{ t('winterboard.boards.actions.removeFromFolder') }}
                  </button>
                  <button
                    v-for="f in folders"
                    :key="f.id"
                    type="button"
                    class="wb-board-card__menu-item"
                    :class="{ 'wb-board-card__menu-item--active': board.folder === f.id }"
                    role="menuitem"
                    @click="emit('move-to-folder', f.id); menuOpen = false; folderSubmenuOpen = false"
                  >
                    {{ f.name }}
                  </button>
                </div>
              </Transition>
            </div>
          </template>
          <div class="wb-board-card__menu-divider" role="separator" />
          <button type="button"
            class="wb-board-card__menu-item wb-board-card__menu-item--danger"
            role="menuitem"
            @click="emit('delete'); menuOpen = false">
            {{ t('winterboard.boards.actions.delete') }}
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSeasonalLogo } from '@/composables/useSeasonalLogo'
import type { WBSessionListItem, BoardFolder } from '../../api/winterboardApi'
import { activeLocale } from '@/utils/i18nDate'

// ─── Props & Emits ────────────────────────────────────────────────────────────

interface Props {
  board: WBSessionListItem
  folders?: { id: number; name: string }[]
  selected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  folders: () => [],
  selected: false,
})

const emit = defineEmits<{
  open: []
  duplicate: []
  share: []
  delete: []
  'move-to-folder': [folderId: number | null]
  'toggle-select': []
}>()

// ─── State ────────────────────────────────────────────────────────────────────

const { t } = useI18n()
const { logoSrc } = useSeasonalLogo()
const menuOpen = ref(false)
const folderSubmenuOpen = ref(false)

// ─── Close menu on outside click ──────────────────────────────────────────────

function closeMenu(e: MouseEvent): void {
  if (menuOpen.value) {
    menuOpen.value = false
    folderSubmenuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', closeMenu))
onUnmounted(() => document.removeEventListener('click', closeMenu))

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
  return new Date(iso).toLocaleDateString(activeLocale())
}
</script>

<style scoped>
.wb-board-card {
  position: relative;
  background: var(--wb-card-bg, #ffffff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 12px;
  cursor: pointer;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
  outline: none;
}

.wb-board-card:hover,
.wb-board-card:focus-visible {
  border-color: var(--wb-brand, #0066ff);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.wb-board-card--selected {
  border-color: var(--wb-brand, #0066ff);
  background: #eff6ff;
}

/* ── Selection checkbox ───────────────────────────────────────────────── */

.wb-board-card__select {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.1s;
}

.wb-board-card:hover .wb-board-card__select,
.wb-board-card:focus-within .wb-board-card__select,
.wb-board-card--selected .wb-board-card__select {
  opacity: 1;
}

.wb-board-card__checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: rgba(255, 255, 255, 0.95);
  border: 1.5px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.wb-board-card__checkbox:hover {
  border-color: var(--wb-brand, #0066ff);
}

.wb-board-card__checkbox--checked {
  background: var(--wb-brand, #0066ff);
  border-color: var(--wb-brand, #0066ff);
  color: #fff;
}

/* ── Thumbnail ────────────────────────────────────────────────────────── */

.wb-board-card__thumb {
  height: 140px;
  background: var(--wb-canvas-bg, #f8fafc);
  border-radius: 12px 12px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.wb-board-card__thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wb-board-card__thumb-placeholder {
  color: #cbd5e1;
}

.wb-board-card__thumb-logo {
  width: 48px;
  height: 48px;
  opacity: 0.6;
}

/* ── Body ─────────────────────────────────────────────────────────────── */

.wb-board-card__body {
  padding: 14px 16px 16px;
}

.wb-board-card__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
  margin: 0 0 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 8px);
}

.wb-board-card__status-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  width: fit-content;
  margin-bottom: 4px;
}

.wb-board-card__status-badge--active {
  color: #7c3aed;
  background: #ede9fe;
}

.wb-board-card__status-badge--draft {
  color: #64748b;
  background: #f1f5f9;
}

/* INV-KNOW-3 (PR-4): folder breadcrumb — single-line truncate, hover tooltip
   reveals full path (native `title` attr). No JS truncate logic. */
.wb-board-card__path {
  font-size: 11.5px;
  color: var(--wb-fg-secondary, #94a3b8);
  margin: 0 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  cursor: help;
}

.wb-board-card__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
  margin: 0;
}

.wb-board-card__sep {
  opacity: 0.5;
}

/* ── Prep session label ───────────────────────────────────────────────── */

.wb-board-card__prep {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 4px;
}

.wb-board-card__prep-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #0066ff;
  background: #eff6ff;
  border-radius: 6px;
  padding: 2px 7px;
  width: fit-content;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.wb-board-card__prep-back {
  font-size: 11px;
  color: var(--wb-fg-secondary, #64748b);
  text-decoration: none;
  padding: 0 2px;
  transition: color 0.1s;
}

.wb-board-card__prep-back:hover {
  color: var(--wb-brand, #0066ff);
  text-decoration: underline;
}

/* ── Actions ─────────────────────────────────────────────────────────── */

.wb-board-card__actions {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
}

.wb-board-card__menu-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 8px;
  cursor: pointer;
  color: var(--wb-fg-secondary, #64748b);
  transition: background 0.1s, box-shadow 0.1s;
  opacity: 0;
}

.wb-board-card:hover .wb-board-card__menu-trigger,
.wb-board-card:focus-within .wb-board-card__menu-trigger {
  opacity: 1;
}

.wb-board-card__menu-trigger:hover {
  background: #ffffff;
  color: var(--wb-fg, #0f172a);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.wb-board-card__menu {
  position: absolute;
  top: 36px;
  right: 0;
  min-width: 160px;
  background: var(--wb-card-bg, #ffffff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14);
  padding: 6px 0;
  z-index: 100;
}

.wb-board-card__menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 9px 14px;
  background: none;
  border: none;
  font-size: 14px;
  color: var(--wb-fg, #0f172a);
  text-align: left;
  cursor: pointer;
  transition: background 0.1s;
  white-space: nowrap;
}

.wb-board-card__menu-item:hover {
  background: var(--wb-canvas-bg, #f1f5f9);
}

.wb-board-card__menu-item--danger {
  color: #ef4444;
}

.wb-board-card__menu-item--danger:hover {
  background: #fef2f2;
}

.wb-board-card__menu-divider {
  height: 1px;
  background: var(--wb-toolbar-border, #e2e8f0);
  margin: 4px 0;
}

/* ── Submenu (Move to folder) ────────────────────────────────────────── */

.wb-board-card__submenu-wrap {
  position: relative;
}

.wb-board-card__chevron {
  margin-left: auto;
  opacity: 0.5;
}

.wb-board-card__submenu {
  position: absolute;
  top: 0;
  left: 100%;
  min-width: 140px;
  max-height: 220px;
  overflow-y: auto;
  background: var(--wb-card-bg, #ffffff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14);
  padding: 6px 0;
  z-index: 110;
}

.wb-board-card__menu-item--muted {
  color: var(--wb-fg-secondary, #94a3b8);
  font-style: italic;
}

.wb-board-card__menu-item--active {
  font-weight: 600;
  color: var(--wb-brand, #0066ff);
}

/* ── Menu transition ─────────────────────────────────────────────────── */

.wb-menu-fade-enter-active,
.wb-menu-fade-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.wb-menu-fade-enter-from,
.wb-menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Skeleton state ──────────────────────────────────────────────────── */

.wb-board-card--skeleton {
  cursor: default;
  pointer-events: none;
}

/* ── Touch: always show trigger ──────────────────────────────────────── */

@media (hover: none) {
  .wb-board-card__menu-trigger {
    opacity: 1;
  }
}

/* ── Reduced motion ──────────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .wb-board-card,
  .wb-board-card__menu-trigger {
    transition: none;
  }

  .wb-menu-fade-enter-active,
  .wb-menu-fade-leave-active {
    transition: none;
  }
}
</style>
