<template>
  <div
    class="wb-board-card"
    role="article"
    :aria-label="board.name || t('winterboard.boards.untitled')"
    tabindex="0"
    @click="emit('open')"
    @keydown.enter="emit('open')"
    @keydown.space.prevent="emit('open')"
  >
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
import type { WBSessionListItem } from '../../api/winterboardApi'

// ─── Props & Emits ────────────────────────────────────────────────────────────

interface Props {
  board: WBSessionListItem
}

const props = defineProps<Props>()

const emit = defineEmits<{
  open: []
  duplicate: []
  share: []
  delete: []
}>()

// ─── State ────────────────────────────────────────────────────────────────────

const { t } = useI18n()
const { logoSrc } = useSeasonalLogo()
const menuOpen = ref(false)

// ─── Close menu on outside click ──────────────────────────────────────────────

function closeMenu(e: MouseEvent): void {
  if (menuOpen.value) menuOpen.value = false
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
  return new Date(iso).toLocaleDateString()
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
