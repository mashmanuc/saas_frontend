<template>
  <article
    class="replay-card"
    :class="{
      'replay-card--list': viewMode === 'list',
      'replay-card--draggable': replay.status === 'active',
    }"
    :data-testid="`replay-card-${replay.id}`"
    :draggable="replay.status === 'active'"
    :title="replay.status === 'active' ? t('winterboard.replayList.dragHint') : undefined"
    @dragstart="onDragStart"
  >
    <div class="replay-card__thumb">
      <img
        v-if="replay.thumbnail_url && !thumbFailed"
        class="replay-card__thumb-img"
        :src="replay.thumbnail_url"
        :alt="replay.title || t('winterboard.replayList.untitled')"
        loading="lazy"
        @error="thumbFailed = true"
      />
      <div v-else class="replay-card__thumb-placeholder">🎬</div>
      <span v-if="durationLabel" class="replay-card__duration">
        {{ durationLabel }}
      </span>
      <!-- Drag affordance: видно тільки при hover на active-картку. Сигналізує
           новим користувачам що карту можна перетягти в папку зліва. -->
      <span
        v-if="replay.status === 'active'"
        class="replay-card__drag-hint"
        aria-hidden="true"
      >
        <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
          <circle cx="3" cy="3" r="1.2" fill="currentColor" />
          <circle cx="9" cy="3" r="1.2" fill="currentColor" />
          <circle cx="3" cy="7" r="1.2" fill="currentColor" />
          <circle cx="9" cy="7" r="1.2" fill="currentColor" />
          <circle cx="3" cy="11" r="1.2" fill="currentColor" />
          <circle cx="9" cy="11" r="1.2" fill="currentColor" />
        </svg>
      </span>
    </div>

    <div class="replay-card__body">
      <h3 class="replay-card__name">
        {{ replay.title || t('winterboard.replayList.untitled') }}
      </h3>
      <div class="replay-card__meta">
        <span :title="dateTooltip">{{ dateLabel }}</span>
        <span
          v-if="replay.visibility !== 'private'"
          class="replay-card__badge"
        >
          {{ visibilityLabel(replay.visibility) }}
        </span>
        <span
          v-if="replay.status === 'archived'"
          class="replay-card__badge replay-card__badge--archived"
        >
          {{ t('winterboard.replayList.status.archived') }}
        </span>
        <span
          v-if="replay.status === 'trashed'"
          class="replay-card__badge replay-card__badge--trashed"
        >
          🪦 {{ t('winterboard.replayList.status.trashed') }}
        </span>
        <span
          v-if="replay.view_count > 0"
          class="replay-card__views"
          :title="t('winterboard.replayList.viewCountTitle')"
        >
          👁 {{ replay.view_count }}
        </span>
      </div>

      <div class="replay-card__actions">
        <button
          v-if="replay.status !== 'trashed'"
          type="button"
          class="replay-card__btn replay-card__btn--primary"
          @click="emit('open', replay)"
        >
          ▶ {{ t('winterboard.replayList.actions.watch') }}
        </button>
        <button
          v-if="replay.public_token && replay.status !== 'trashed'"
          type="button"
          class="replay-card__btn"
          :class="{ 'replay-card__btn--copied': copied }"
          @click="emit('share', replay)"
        >
          {{ copied
            ? t('winterboard.replayList.actions.copied')
            : t('winterboard.replayList.actions.share') }}
        </button>

        <div class="replay-card__menu-wrap">
          <button
            ref="menuBtnRef"
            type="button"
            class="replay-card__btn replay-card__btn--icon"
            :aria-label="t('common.menu')"
            :data-testid="`replay-menu-${replay.id}`"
            @click.stop="emit('toggle-menu', replay.id)"
          >
            ⋯
          </button>
          <ul
            v-if="menuOpen"
            v-click-outside="() => emit('close-menu')"
            class="replay-card__menu"
            role="menu"
          >
            <template v-if="replay.status === 'active'">
              <li role="menuitem" @click="emit('rename', replay)">
                ✏️ {{ t('winterboard.replayList.menu.rename') }}
              </li>
              <li
                role="menuitem"
                class="menu-icon"
                @click="emit('move', replay, menuBtnRef?.getBoundingClientRect() ?? null)"
              >
                📂 {{ t('winterboard.replayList.menu.moveToFolder') }}
              </li>
              <li class="menu-header">{{ t('winterboard.replayList.menu.visibility') }}</li>
              <li
                v-for="v in VISIBILITY_OPTIONS"
                :key="v"
                role="menuitem"
                class="menu-item-nested"
                :class="{ 'menu-selected': replay.visibility === v }"
                @click="emit('visibility', replay, v)"
              >
                {{ visibilityLabel(v) }}
              </li>
              <li role="menuitem" @click="emit('archive', replay)">
                📦 {{ t('winterboard.replayList.menu.archive') }}
              </li>
              <li role="menuitem" class="menu-danger" @click="emit('trash', replay)">
                🗑 {{ t('winterboard.replayList.menu.trash') }}
              </li>
            </template>
            <template v-else-if="replay.status === 'archived'">
              <li role="menuitem" @click="emit('restore', replay)">
                ↩️ {{ t('winterboard.replayList.menu.restore') }}
              </li>
              <li role="menuitem" class="menu-danger" @click="emit('trash', replay)">
                🗑 {{ t('winterboard.replayList.menu.trash') }}
              </li>
            </template>
            <template v-else>
              <li role="menuitem" @click="emit('restore', replay)">
                ↩️ {{ t('winterboard.replayList.menu.restoreFromTrash') }}
              </li>
            </template>
          </ul>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Replay, ReplayVisibility } from '../../api/replayLifecycleApi'

interface Props {
  replay: Replay
  viewMode: 'grid' | 'list'
  menuOpen: boolean
  copied: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  open: [replay: Replay]
  share: [replay: Replay]
  rename: [replay: Replay]
  visibility: [replay: Replay, visibility: ReplayVisibility]
  archive: [replay: Replay]
  restore: [replay: Replay]
  trash: [replay: Replay]
  move: [replay: Replay, anchorRect: DOMRect | null]
  'toggle-menu': [id: string]
  'close-menu': []
}>()

const { t } = useI18n()

const VISIBILITY_OPTIONS: ReadonlyArray<ReplayVisibility> = ['private', 'unlisted', 'public']

// Має відповідати backend-у: `WB_REPLAY_PURGE_GRACE_DAYS` у
// apps/winterboard/tasks.py. Зберігаємо локально бо API не експозить це значення.
const PURGE_GRACE_DAYS = 7

const menuBtnRef = ref<HTMLButtonElement | null>(null)

// Прев'ю не завантажилось (битий URL/видалений файл) → 🎬-плейсхолдер.
const thumbFailed = ref(false)

// ─── Formatting ─────────────────────────────────────────────────────

const durationLabel = computed(() => formatDuration(props.replay.duration_ms))

/**
 * Основний текст дати у meta-рядку картки.
 *
 * - active/archived → дата запису (recorded_at)
 * - trashed → дата/коли запис буде автоматично видалено
 *   (trashed_at + PURGE_GRACE_DAYS днів), щоб користувач бачив таймер grace period,
 *   а не дату створення (яка вводила в оману — давала хибне відчуття
 *   "запис висить 10 днів, чому не видалений?")
 */
const dateLabel = computed<string>(() => {
  const { replay } = props
  if (replay.status !== 'trashed' || !replay.trashed_at) {
    return formatDate(replay.recorded_at)
  }
  const purgeAt = new Date(replay.trashed_at)
  purgeAt.setDate(purgeAt.getDate() + PURGE_GRACE_DAYS)
  const daysLeft = Math.ceil((purgeAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  if (daysLeft <= 0) {
    return t('winterboard.replayList.trash.purgeOverdue')
  }
  return t('winterboard.replayList.trash.purgeOn', { date: formatDate(purgeAt.toISOString()) })
})

/**
 * Tooltip підказка (hover на даті).
 * Для trashed — показує дату потрапляння в кошик.
 * Для активних — повну timestamp запису.
 */
const dateTooltip = computed<string>(() => {
  const { replay } = props
  if (replay.status === 'trashed' && replay.trashed_at) {
    return t('winterboard.replayList.trash.trashedAt', {
      date: formatDate(replay.trashed_at),
    })
  }
  try {
    return new Date(replay.recorded_at).toLocaleString()
  } catch {
    return replay.recorded_at
  }
})

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatDuration(ms: number | null | undefined): string | null {
  if (!ms || ms < 0) return null
  const seconds = Math.floor(ms / 1000)
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}с`
  return `${m}:${String(s).padStart(2, '0')}`
}

function visibilityLabel(v: ReplayVisibility): string {
  if (v === 'public') return t('winterboard.replayList.visibility.public')
  if (v === 'unlisted') return t('winterboard.replayList.visibility.unlisted')
  return t('winterboard.replayList.visibility.private')
}

// ─── Drag & drop (to ReplayFolderTree) ─────────────────────────────

function onDragStart(e: DragEvent): void {
  if (!e.dataTransfer) return
  // Власний MIME-type, не сумісний з Library (isAssetDrag) — ReplayFolderTree
  // слухає тільки його, щоб уникнути колізій.
  e.dataTransfer.setData('application/x-wb-replay', props.replay.id)
  e.dataTransfer.effectAllowed = 'move'
}

// Inline click-outside directive — копія з WBReplayList (щоб не тягнути
// зовнішній пакет і не міняти решту replay-UI).
const vClickOutside = {
  mounted(el: HTMLElement, binding: { value: () => void }) {
    const handler = (e: Event) => {
      if (!el.contains(e.target as Node)) binding.value()
    }
    ;(el as unknown as { __clickOutside__: EventListener }).__clickOutside__ = handler
    document.addEventListener('click', handler, true)
  },
  unmounted(el: HTMLElement) {
    const handler = (el as unknown as { __clickOutside__?: EventListener }).__clickOutside__
    if (handler) document.removeEventListener('click', handler, true)
  },
}
</script>

<style scoped>
.replay-card {
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: var(--radius-lg, 12px);
  overflow: visible;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  display: flex;
  flex-direction: column;
  position: relative;
}

.replay-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

/* Drag affordance: лише для active-статусу. Курсор сигналізує про draggable,
   зменшений scope щоб кнопки (watch/share/menu) всередині не наслідували grab. */
.replay-card--draggable .replay-card__thumb {
  cursor: grab;
}

.replay-card--draggable:active .replay-card__thumb {
  cursor: grabbing;
}

.replay-card__drag-hint {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 5px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
}

.replay-card--draggable:hover .replay-card__drag-hint {
  opacity: 1;
}

/* У list-view хінт не показуємо — картка маленька, а drag інтуїтивніший на thumbnail */
.replay-card--list .replay-card__drag-hint {
  display: none;
}

.replay-card:has(.replay-card__menu) {
  z-index: 10;
}

.replay-card__thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--bg-secondary);
  overflow: hidden;
  border-top-left-radius: var(--radius-lg, 12px);
  border-top-right-radius: var(--radius-lg, 12px);
}

.replay-card__thumb-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #fff; /* рендер прев'ю на білому — уникає темної рамки в dark mode */
}

.replay-card__thumb-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 2.5rem;
  opacity: 0.5;
}

.replay-card__duration {
  position: absolute;
  bottom: 8px;
  right: 8px;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 4px;
}

.replay-card__body {
  padding: var(--space-md, 16px);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm, 8px);
  flex: 1;
}

.replay-card__name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.replay-card__meta {
  display: flex;
  align-items: center;
  gap: var(--space-xs, 6px);
  flex-wrap: wrap;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.replay-card__badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 600;
}

.replay-card__badge--archived {
  background: color-mix(in srgb, var(--text-secondary, #6b7280) 12%, transparent);
  color: var(--text-secondary);
}

.replay-card__badge--trashed {
  background: color-mix(in srgb, var(--color-error, #dc2626) 12%, transparent);
  color: var(--color-error, #dc2626);
}

.replay-card__views {
  margin-left: auto;
  font-size: 0.75rem;
}

.replay-card__actions {
  display: flex;
  gap: var(--space-xs, 6px);
  margin-top: auto;
  padding-top: var(--space-xs, 6px);
  position: relative;
}

.replay-card__btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.replay-card__btn:hover {
  background: var(--bg-secondary);
}

.replay-card__btn--primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.replay-card__btn--primary:hover {
  background: color-mix(in srgb, var(--accent) 88%, #000);
}

.replay-card__btn--copied {
  background: color-mix(in srgb, var(--color-success, #10b981) 12%, transparent);
  border-color: var(--color-success, #10b981);
  color: var(--color-success, #10b981);
}

.replay-card__btn--icon {
  flex: 0 0 auto;
  padding: 8px 12px;
  min-width: 40px;
  font-size: 1.1rem;
  line-height: 1;
}

.replay-card__menu-wrap {
  position: relative;
}

.replay-card__menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 4px);
  min-width: 240px;
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: 6px 0;
  margin: 0;
  list-style: none;
  z-index: 50;
}

.replay-card__menu li {
  padding: 8px 14px;
  font-size: 0.875rem;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, color 0.12s;
}

.replay-card__menu li:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.replay-card__menu .menu-header {
  padding: 10px 14px 4px;
  margin-top: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: default;
  pointer-events: none;
  border-top: 1px solid var(--border-color, #e5e7eb);
  background: color-mix(in srgb, var(--text-primary) 4%, transparent);
}

.replay-card__menu .menu-item-nested {
  padding-left: 22px;
}

.replay-card__menu .menu-selected::before {
  content: '✓ ';
  color: var(--accent);
  font-weight: 700;
}

.replay-card__menu .menu-danger {
  color: var(--color-error, #dc2626);
}

/* ─── List view ─────────────────────────────────────────────────── */

.replay-card--list {
  flex-direction: row;
  align-items: stretch;
  min-height: 76px;
}

.replay-card--list:hover {
  transform: none;
}

.replay-card--list .replay-card__thumb {
  flex: 0 0 128px;
  aspect-ratio: 16 / 9;
  width: 128px;
  min-height: 72px;
  border-radius: 0;
  border-top-left-radius: var(--radius-lg, 12px);
  border-bottom-left-radius: var(--radius-lg, 12px);
}

.replay-card--list .replay-card__thumb-placeholder {
  font-size: 1.75rem;
}

.replay-card--list .replay-card__duration {
  display: none;
}

.replay-card--list .replay-card__body {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(160px, 1fr) auto auto;
  align-items: center;
  gap: var(--space-md, 16px);
  padding: var(--space-sm, 8px) var(--space-md, 16px);
}

.replay-card--list .replay-card__name {
  grid-column: 1;
  grid-row: 1;
  margin: 0;
}

.replay-card--list .replay-card__meta {
  grid-column: 1;
  grid-row: 2;
  margin-top: 2px;
}

.replay-card--list .replay-card__actions {
  grid-column: 3;
  grid-row: 1 / span 2;
  margin-top: 0;
  padding-top: 0;
  align-items: center;
}

.replay-card--list .replay-card__btn--primary,
.replay-card--list .replay-card__btn:not(.replay-card__btn--icon) {
  padding: 6px 12px;
  flex: 0 0 auto;
}

@media (max-width: 640px) {
  .replay-card--list {
    flex-direction: column;
  }
  .replay-card--list .replay-card__thumb {
    width: 100%;
    flex-basis: auto;
  }
  .replay-card--list .replay-card__body {
    grid-template-columns: 1fr auto;
  }
  .replay-card--list .replay-card__actions {
    grid-column: 1 / span 2;
    grid-row: 3;
    padding-top: 4px;
  }
}
</style>
