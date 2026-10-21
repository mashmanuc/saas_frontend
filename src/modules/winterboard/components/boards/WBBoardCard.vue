<template>
  <div
    ref="cardEl"
    class="wb-board-card"
    :class="{ 'wb-board-card--selected': selected, 'wb-board-card--dusty': dusty }"
    :style="{ '--h': cover.hue, '--i': Math.min(index, 12) }"
    :title="dusty ? t('winterboard.boards.dustyHint') : undefined"
    role="article"
    :aria-label="board.name || t('winterboard.boards.untitled')"
    tabindex="0"
    @mousemove="onTilt"
    @mouseleave="resetTilt"
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
      <template v-if="board.thumbnail_url && !thumbBroken">
        <img
          :src="board.thumbnail_url"
          :alt="board.name || t('winterboard.boards.untitled')"
          class="wb-board-card__thumb-img"
          loading="lazy"
          draggable="false"
          @error="thumbBroken = true"
        />
        <span class="wb-board-card__shot-label">{{ t('winterboard.boards.firstPageShot') }}</span>
      </template>
      <!-- Обкладинка замість порожнього місця (макет «Студія уроків», 2026-10-22): знак з назви або
           монограма, три міні-сторінки віялом, сезонний логотип у куті. utils/boardCover.ts -->
      <div v-else class="wb-board-card__cover" aria-hidden="true">
        <img :src="logoSrc" alt="" class="wb-board-card__cover-logo" @mouseenter="onLogoHover" />
        <div
          v-if="!cover.empty"
          class="wb-board-card__glyph"
          :class="{ 'wb-board-card__glyph--mono': cover.mono }"
        >{{ cover.glyph }}</div>
        <div class="wb-board-card__pages">
          <span v-for="n in 3" :key="n" class="wb-board-card__page">
            <i v-if="n === 3" class="wb-board-card__page-title" />
            <i /><i class="wb-board-card__page-short" /><i />
            <b v-if="n === 3">{{ cover.glyph }}</b>
          </span>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div class="wb-board-card__body">
      <h3 class="wb-board-card__title">
        {{ board.name || t('winterboard.boards.untitled') }}
      </h3>
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
        <!-- Board status badge -->
        <span
          class="wb-board-card__status-badge"
          :class="board.has_lesson ? 'wb-board-card__status-badge--active' : 'wb-board-card__status-badge--draft'"
        >
          {{ board.has_lesson ? t('winterboard.boards.statusActive') : t('winterboard.boards.statusDraft') }}
        </span>
        <span>{{ formatTimeAgo(board.updated_at) }}</span>
        <span class="wb-board-card__pagecount">{{ t('winterboard.boards.pageCount', { n: board.page_count }) }}</span>
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSeasonalLogo } from '@/composables/useSeasonalLogo'
import type { WBSessionListItem, BoardFolder } from '../../api/winterboardApi'
import { activeLocale } from '@/utils/i18nDate'
import { getBoardCover } from '../../utils/boardCover'
import { SEASON_FX, burstFrom, fxAllowed } from '../../utils/studioFx'

// ─── Props & Emits ────────────────────────────────────────────────────────────

interface Props {
  board: WBSessionListItem
  folders?: { id: number; name: string }[]
  selected?: boolean
  /** Місце в сітці — затримка появи картки хвилею (до 12-ї). */
  index?: number
}

const props = withDefaults(defineProps<Props>(), {
  folders: () => [],
  selected: false,
  index: 0,
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
const { season, logoSrc } = useSeasonalLogo()
const menuOpen = ref(false)
const folderSubmenuOpen = ref(false)
const cardEl = ref<HTMLElement | null>(null)

const cover = computed(() => getBoardCover(props.board.name, activeLocale()))
// Знімок не завантажився (видалений файл, мережа) — обкладинка, а не alt-текст у рамці
const thumbBroken = ref(false)
watch(() => props.board.thumbnail_url, () => { thumbBroken.value = false })

// «Давно не змінювали» — чернетка без змін тиждень і довше (за датою зміни: дати відкриття список не віддає)
const DUSTY_AFTER_MS = 7 * 24 * 60 * 60 * 1000
const dusty = computed(() =>
  !props.board.has_lesson && Date.now() - new Date(props.board.updated_at).getTime() >= DUSTY_AFTER_MS,
)

// ─── Нахил за курсором + відблиск (лише миша; на сенсорних панелях і з reduced-motion — ні) ──

function onTilt(e: MouseEvent): void {
  const el = cardEl.value
  if (!el || !fxAllowed()) return
  const r = el.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width
  const y = (e.clientY - r.top) / r.height
  el.style.setProperty('--mx', `${x * 100}%`)
  el.style.setProperty('--my', `${y * 100}%`)
  el.style.transform = `perspective(700px) rotateX(${(0.5 - y) * 7}deg) rotateY(${(x - 0.5) * 9}deg) translateY(-3px)`
}

function resetTilt(): void {
  if (cardEl.value) cardEl.value.style.transform = ''
}

let logoFxAt = 0
function onLogoHover(e: MouseEvent): void {
  if (Date.now() - logoFxAt < 900) return
  logoFxAt = Date.now()
  const fx = SEASON_FX[season.value] ?? []
  burstFrom(e.currentTarget as Element, [...fx, ...fx], 40)
}

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
  /* Кольори обкладинки: відтінок --h з картки, насиченість/яскравість — тема (--wb-cover-* у main.css) */
  --mx: 50%;
  --my: 50%;
  --cover-bg: hsl(var(--h, 165) var(--wb-cover-cs, 70%) var(--wb-cover-cl, 92%));
  --cover-ink: hsl(var(--h, 165) var(--wb-cover-is, 45%) var(--wb-cover-il, 32%));
  --cover-line: hsl(var(--h, 165) var(--wb-cover-ls, 40%) var(--wb-cover-ll, 86%));
  position: relative;
  background: var(--wb-card-bg, #ffffff);
  border: 1px solid transparent;
  border-radius: 18px;
  box-shadow: 0 10px 30px -22px rgba(13, 74, 62, 0.45);
  cursor: pointer;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.15s ease;
  outline: none;
  /* backwards, не both: після появи анімація не тримає transform — інакше нахил (inline) не діяв би */
  animation: wb-card-rise 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.2) backwards;
  animation-delay: calc(var(--i, 0) * 45ms);
}

@keyframes wb-card-rise {
  from { opacity: 0; transform: translateY(24px) scale(0.96); }
}

/* Відблиск за курсором (координати — onTilt) */
.wb-board-card::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 3;
  border-radius: inherit;
  pointer-events: none;
  background: radial-gradient(260px circle at var(--mx) var(--my), rgba(255, 255, 255, 0.5), transparent 45%);
  opacity: 0;
  transition: opacity 0.25s;
}

.wb-board-card:hover::before {
  opacity: 1;
}

.wb-board-card:hover,
.wb-board-card:focus-visible {
  border-color: var(--wb-border, rgba(5, 150, 105, 0.2));
  box-shadow: 0 24px 44px -22px rgba(13, 74, 62, 0.45);
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
  color: var(--color-on-accent);
}

/* ── Thumbnail ────────────────────────────────────────────────────────── */

.wb-board-card__thumb {
  position: relative;
  height: 140px;
  background: var(--cover-bg);
  border-radius: 18px 18px 0 0;
  overflow: hidden;
}

.wb-board-card__thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: var(--wb-canvas-bg, #ffffff);
}

.wb-board-card__shot-label {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 2;
  font-size: 10px;
  font-weight: 700;
  color: var(--wb-fg-secondary, #1f6b5a);
  background: color-mix(in srgb, var(--wb-card-bg, #ffffff) 88%, transparent);
  border-radius: 5px;
  padding: 1px 6px;
}

/* ── Обкладинка (немає знімка першої сторінки) ───────────────────────── */

.wb-board-card__cover {
  position: absolute;
  inset: 0;
}

.wb-board-card__cover-logo {
  /* Лівий нижній кут: лівий верхній при наведенні займає галочка вибору дошки */
  position: absolute;
  left: 12px;
  bottom: 10px;
  z-index: 2;
  width: 26px;
  height: 26px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.12));
  transition: transform 0.5s cubic-bezier(0.3, 1.5, 0.5, 1);
}

.wb-board-card:hover .wb-board-card__cover-logo {
  transform: rotate(-12deg) scale(1.15);
}

.wb-board-card__glyph {
  position: absolute;
  right: -6px;
  bottom: -26px;
  font-size: 112px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  color: var(--cover-ink);
  opacity: var(--wb-cover-glyph-opacity, 0.16);
  transition: transform 0.5s cubic-bezier(0.3, 1.3, 0.5, 1);
}

.wb-board-card__glyph--mono {
  font-size: 96px;
  font-style: italic;
  letter-spacing: -0.04em;
  bottom: -18px;
}

.wb-board-card:hover .wb-board-card__glyph {
  transform: translate(-8px, -6px) rotate(-6deg) scale(1.06);
}

.wb-board-card__pages {
  position: absolute;
  left: 50%;
  top: 22px;
  width: 0;
  height: 0;
}

.wb-board-card__page {
  position: absolute;
  left: -38px;
  top: 0;
  width: 76px;
  height: 98px;
  border-radius: 7px;
  background: var(--wb-card-bg, #ffffff);
  box-shadow: 0 6px 14px -8px rgba(0, 0, 0, 0.3);
  padding: 9px 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  transition: transform 0.45s cubic-bezier(0.3, 1.4, 0.5, 1);
}

.wb-board-card__page i {
  display: block;
  height: 4px;
  border-radius: 2px;
  background: var(--cover-line);
}

.wb-board-card__page .wb-board-card__page-title {
  height: 6px;
  width: 60%;
  background: var(--cover-ink);
  opacity: 0.55;
}

.wb-board-card__page .wb-board-card__page-short {
  width: 70%;
}

.wb-board-card__page b {
  margin-top: auto;
  align-self: center;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 700;
  color: var(--cover-ink);
  opacity: 0.8;
}

.wb-board-card__page:nth-child(1) { transform: translateX(-14px) rotate(-7deg); }
.wb-board-card__page:nth-child(2) { transform: translateX(14px) rotate(6deg); }
.wb-board-card:hover .wb-board-card__page:nth-child(1) { transform: translateX(-58px) translateY(6px) rotate(-14deg); }
.wb-board-card:hover .wb-board-card__page:nth-child(2) { transform: translateX(58px) translateY(6px) rotate(13deg); }
.wb-board-card:hover .wb-board-card__page:nth-child(3) { transform: translateY(-4px); }

/* «Давно не змінювали» — павутинка в куті обкладинки, зникає при наведенні */
.wb-board-card--dusty .wb-board-card__thumb::after {
  content: "";
  position: absolute;
  right: 0;
  top: 0;
  z-index: 2;
  width: 34px;
  height: 34px;
  pointer-events: none;
  opacity: 0.55;
  transition: opacity 0.6s;
  background:
    radial-gradient(circle at 100% 0, transparent 8px, color-mix(in srgb, var(--wb-fg-secondary, #1f6b5a) 35%, transparent) 8.5px 9.5px, transparent 10px 15px, color-mix(in srgb, var(--wb-fg-secondary, #1f6b5a) 30%, transparent) 15.5px 16.5px, transparent 17px),
    linear-gradient(225deg, transparent 48%, color-mix(in srgb, var(--wb-fg-secondary, #1f6b5a) 30%, transparent) 49% 51%, transparent 52%);
}

.wb-board-card--dusty:hover .wb-board-card__thumb::after {
  opacity: 0;
}

/* ── Body ─────────────────────────────────────────────────────────────── */

.wb-board-card__body {
  padding: 14px 16px 14px;
}

.wb-board-card__title {
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--wb-fg, #0f172a);
  margin: 0 0 8px;
  min-height: 38px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.wb-board-card__status-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  width: fit-content;
}

.wb-board-card__status-badge--active {
  color: var(--wb-brand, #047857);
  background: var(--wb-bg-hover, rgba(5, 150, 105, 0.08));
}

/* «У заняттях» — пульсуюча крапка */
.wb-board-card__status-badge--active::before {
  content: "";
  width: 6px;
  height: 6px;
  margin-right: 5px;
  border-radius: 50%;
  background: currentColor;
  animation: wb-card-pulse 1.6s infinite;
}

@keyframes wb-card-pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 50%, transparent); }
  100% { box-shadow: 0 0 0 7px transparent; }
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
  flex-wrap: wrap;
  gap: 4px 8px;
  white-space: nowrap;
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
  margin: 0;
}

.wb-board-card__pagecount {
  margin-left: auto;
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

/* Сенсорні панелі шкіл: без відблиску, легка тінь (нахилу там і так нема — onTilt) */
@media (pointer: coarse) {
  .wb-board-card,
  .wb-board-card:hover {
    box-shadow: 0 2px 8px -4px rgba(13, 74, 62, 0.45);
  }

  .wb-board-card::before {
    display: none;
  }
}

/* ── Reduced motion ──────────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .wb-board-card,
  .wb-board-card *,
  .wb-board-card::before,
  .wb-board-card *::before,
  .wb-board-card *::after,
  .wb-board-card__menu-trigger {
    animation: none !important;
    transition: none !important;
  }

  .wb-menu-fade-enter-active,
  .wb-menu-fade-leave-active {
    transition: none;
  }
}

/* Темна тема (Б-156, фаза 1): жорсткі світлі кольори вище → токени; світла тема без змін */
[data-theme="dark"] .wb-board-card--selected { background: var(--color-accent-soft); }
[data-theme="dark"] .wb-board-card__checkbox:not(.wb-board-card__checkbox--checked),
[data-theme="dark"] .wb-board-card__menu-trigger,
[data-theme="dark"] .wb-board-card__menu-trigger:hover { background: var(--color-surface-elevated); }
[data-theme="dark"] .wb-board-card__status-badge--active { color: var(--color-info); background: var(--color-info-soft); }
[data-theme="dark"] .wb-board-card__status-badge--draft { color: var(--color-text-secondary); background: var(--color-surface-sunken); }
[data-theme="dark"] .wb-board-card__prep-badge { color: var(--color-info); background: var(--color-info-soft); }
</style>
