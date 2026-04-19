<template>
  <div class="replay-list">
    <header class="replay-list__header">
      <div>
        <h1 class="replay-list__title">{{ $t('winterboard.replayList.title') }}</h1>
        <p class="replay-list__subtitle">
          {{ $t('winterboard.replayList.subtitle') }}
        </p>
      </div>
      <span v-if="!store.isLoading && store.replays.length > 0" class="replay-list__count">
        {{ store.replays.length }}
      </span>
    </header>

    <!-- Status tabs + view toggle -->
    <div class="replay-list__toolbar">
      <nav class="replay-list__tabs" role="tablist">
        <button
          v-for="tab in statusTabs"
          :key="tab.value"
          type="button"
          role="tab"
          :aria-selected="store.currentStatus === tab.value"
          class="replay-list__tab"
          :class="{ 'replay-list__tab--active': store.currentStatus === tab.value }"
          @click="store.setStatus(tab.value)"
        >
          {{ tab.label }}
        </button>
      </nav>

      <div class="replay-list__view-toggle" role="group" :aria-label="$t('winterboard.replayList.viewMode.label')">
        <button
          type="button"
          class="replay-list__view-btn"
          :class="{ 'replay-list__view-btn--active': viewMode === 'grid' }"
          :aria-pressed="viewMode === 'grid'"
          :title="$t('winterboard.replayList.viewMode.grid')"
          @click="setViewMode('grid')"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
            <rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
            <rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
            <rect x="9.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
          </svg>
          <span class="sr-only">{{ $t('winterboard.replayList.viewMode.grid') }}</span>
        </button>
        <button
          type="button"
          class="replay-list__view-btn"
          :class="{ 'replay-list__view-btn--active': viewMode === 'list' }"
          :aria-pressed="viewMode === 'list'"
          :title="$t('winterboard.replayList.viewMode.list')"
          @click="setViewMode('list')"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <span class="sr-only">{{ $t('winterboard.replayList.viewMode.list') }}</span>
        </button>
      </div>
    </div>

    <!-- Error -->
    <div v-if="store.error" class="replay-list__error" role="alert">
      {{ store.error }}
    </div>

    <!-- Loading -->
    <div v-if="store.isLoading" :class="containerClass">
      <div v-for="i in 6" :key="i" class="replay-card replay-card--skeleton" />
    </div>

    <!-- Empty -->
    <div v-else-if="store.replays.length === 0" class="replay-list__empty">
      <div class="replay-list__empty-icon">{{ emptyIcon }}</div>
      <h2 class="replay-list__empty-title">
        {{ emptyTitle }}
      </h2>
      <p class="replay-list__empty-subtitle">
        {{ emptySubtitle }}
      </p>
    </div>

    <!-- Grid / List -->
    <div v-else :class="containerClass">
      <article
        v-for="replay in store.replays"
        :key="replay.id"
        class="replay-card"
        :class="{ 'replay-card--list': viewMode === 'list' }"
        :data-testid="`replay-card-${replay.id}`"
      >
        <div class="replay-card__thumb">
          <div class="replay-card__thumb-placeholder">🎬</div>
          <span
            v-if="formatDuration(replay.duration_ms) !== null"
            class="replay-card__duration"
          >
            {{ formatDuration(replay.duration_ms) }}
          </span>
        </div>

        <div class="replay-card__body">
          <h3 class="replay-card__name">
            {{ replay.title || $t('winterboard.replayList.untitled') }}
          </h3>
          <div class="replay-card__meta">
            <span>{{ formatDate(replay.recorded_at) }}</span>
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
              {{ $t('winterboard.replayList.status.archived') }}
            </span>
            <span
              v-if="replay.status === 'trashed'"
              class="replay-card__badge replay-card__badge--trashed"
            >
              🪦 {{ $t('winterboard.replayList.status.trashed') }}
            </span>
            <span
              v-if="replay.view_count > 0"
              class="replay-card__views"
              :title="$t('winterboard.replayList.viewCountTitle')"
            >
              👁 {{ replay.view_count }}
            </span>
          </div>

          <div class="replay-card__actions">
            <button
              v-if="replay.status !== 'trashed'"
              type="button"
              class="replay-card__btn replay-card__btn--primary"
              @click="openReplay(replay)"
            >
              ▶ {{ $t('winterboard.replayList.actions.watch') }}
            </button>
            <button
              v-if="replay.public_token && replay.status !== 'trashed'"
              type="button"
              class="replay-card__btn"
              :class="{ 'replay-card__btn--copied': copiedId === replay.id }"
              @click="copyShareLink(replay)"
            >
              {{ copiedId === replay.id
                ? $t('winterboard.replayList.actions.copied')
                : $t('winterboard.replayList.actions.share') }}
            </button>

            <!-- ⋯ menu -->
            <div class="replay-card__menu-wrap">
              <button
                type="button"
                class="replay-card__btn replay-card__btn--icon"
                :aria-label="$t('common.menu')"
                :data-testid="`replay-menu-${replay.id}`"
                @click.stop="toggleMenu(replay.id)"
              >
                ⋯
              </button>
              <ul
                v-if="openMenuId === replay.id"
                v-click-outside="() => (openMenuId = null)"
                class="replay-card__menu"
                role="menu"
              >
                <!-- Active actions -->
                <template v-if="replay.status === 'active'">
                  <li role="menuitem" @click="handleRename(replay)">
                    ✏️ {{ $t('winterboard.replayList.menu.rename') }}
                  </li>
                  <li class="menu-header">{{ $t('winterboard.replayList.menu.visibility') }}</li>
                  <li
                    v-for="v in ['private', 'unlisted', 'public'] as const"
                    :key="v"
                    role="menuitem"
                    class="menu-item-nested"
                    :class="{ 'menu-selected': replay.visibility === v }"
                    @click="handleVisibility(replay, v)"
                  >
                    {{ visibilityLabel(v) }}
                  </li>
                  <li role="menuitem" @click="handleArchive(replay)">
                    📦 {{ $t('winterboard.replayList.menu.archive') }}
                  </li>
                  <li role="menuitem" class="menu-danger" @click="handleTrash(replay)">
                    🗑 {{ $t('winterboard.replayList.menu.trash') }}
                  </li>
                </template>
                <!-- Archived actions -->
                <template v-else-if="replay.status === 'archived'">
                  <li role="menuitem" @click="handleRestore(replay)">
                    ↩️ {{ $t('winterboard.replayList.menu.restore') }}
                  </li>
                  <li role="menuitem" class="menu-danger" @click="handleTrash(replay)">
                    🗑 {{ $t('winterboard.replayList.menu.trash') }}
                  </li>
                </template>
                <!-- Trashed actions -->
                <template v-else>
                  <li role="menuitem" @click="handleRestore(replay)">
                    ↩️ {{ $t('winterboard.replayList.menu.restoreFromTrash') }}
                  </li>
                </template>
              </ul>
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useReplayStore } from '../stores/replayStore'
import type { Replay, ReplayStatus, ReplayVisibility } from '../api/replayLifecycleApi'

const props = defineProps<{
  initialStatus?: ReplayStatus
}>()

const router = useRouter()
const { t } = useI18n()
const store = useReplayStore()

const copiedId = ref<string | null>(null)
const openMenuId = ref<string | null>(null)

// View mode: grid (плитки) або list (рядки). Persists у localStorage.
const VIEW_MODE_KEY = 'winterboard:replays:view-mode'
type ViewMode = 'grid' | 'list'
const viewMode = ref<ViewMode>(loadViewMode())

function loadViewMode(): ViewMode {
  try {
    const saved = localStorage.getItem(VIEW_MODE_KEY)
    return saved === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

function setViewMode(mode: ViewMode) {
  viewMode.value = mode
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode)
  } catch {
    /* no-op — storage may be disabled */
  }
}

const containerClass = computed(() =>
  viewMode.value === 'list' ? 'replay-list__rows' : 'replay-list__grid',
)

const statusTabs = computed<Array<{ value: ReplayStatus; label: string }>>(() => [
  { value: 'active', label: t('winterboard.replayList.tabs.active') },
  { value: 'archived', label: t('winterboard.replayList.tabs.archived') },
  { value: 'trashed', label: t('winterboard.replayList.tabs.trashed') },
])

const emptyIcon = computed(() => {
  if (store.currentStatus === 'archived') return '📦'
  if (store.currentStatus === 'trashed') return '🗑'
  return '🎬'
})
const emptyTitle = computed(() => {
  if (store.currentStatus === 'archived') return t('winterboard.replayList.empty.archivedTitle')
  if (store.currentStatus === 'trashed') return t('winterboard.replayList.empty.trashedTitle')
  return t('winterboard.replayList.empty.title')
})
const emptySubtitle = computed(() => {
  if (store.currentStatus === 'archived') return t('winterboard.replayList.empty.archivedSubtitle')
  if (store.currentStatus === 'trashed') return t('winterboard.replayList.empty.trashedSubtitle')
  return t('winterboard.replayList.empty.subtitle')
})

onMounted(async () => {
  if (props.initialStatus && store.currentStatus !== props.initialStatus) {
    store.currentStatus = props.initialStatus
  }
  await store.loadReplays()
})

function toggleMenu(id: string) {
  openMenuId.value = openMenuId.value === id ? null : id
}

function openReplay(replay: Replay) {
  openMenuId.value = null
  // Use the public share URL (the same one the "Copy link" button builds).
  // WBPublicView already handles every scenario:
  //   - replay exists + accessible → player loads with ops timeline
  //   - replay trashed → 410 Gone landing page
  //   - private visibility → access denial flow
  //   - not found → 404
  // This avoids the fragile `source_session` dependency — that field is
  // null on older replays and on replays whose source board was deleted,
  // which previously made "Переглянути" silently do nothing or show a
  // confusing "board deleted" message even when the replay was fine.
  if (!replay.public_token) {
    // eslint-disable-next-line no-alert
    window.alert(t('winterboard.replayList.errors.cannotOpen'))
    return
  }
  const url = `${window.location.origin}/winterboard/public/${replay.public_token}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

function copyShareLink(replay: Replay) {
  openMenuId.value = null
  const token = replay.public_token
  if (!token) return
  const url = `${window.location.origin}/winterboard/public/${token}`
  navigator.clipboard.writeText(url).then(() => {
    copiedId.value = replay.id
    setTimeout(() => {
      if (copiedId.value === replay.id) copiedId.value = null
    }, 2000)
  })
}

async function handleRename(replay: Replay) {
  openMenuId.value = null
  // eslint-disable-next-line no-alert
  const next = window.prompt(
    t('winterboard.replayList.prompts.renameTitle'),
    replay.title,
  )
  if (next === null || next.trim() === '' || next === replay.title) return
  try {
    await store.renameReplay(replay.id, next.trim())
  } catch (err) {
    console.error('[WBReplayList] rename failed', err)
  }
}

async function handleVisibility(replay: Replay, visibility: ReplayVisibility) {
  openMenuId.value = null
  if (replay.visibility === visibility) return
  try {
    await store.changeVisibility(replay.id, visibility)
  } catch (err) {
    console.error('[WBReplayList] visibility failed', err)
  }
}

async function handleArchive(replay: Replay) {
  openMenuId.value = null
  try {
    await store.archive(replay.id)
  } catch (err) {
    console.error('[WBReplayList] archive failed', err)
  }
}

async function handleRestore(replay: Replay) {
  openMenuId.value = null
  try {
    await store.restore(replay.id)
  } catch (err) {
    console.error('[WBReplayList] restore failed', err)
  }
}

async function handleTrash(replay: Replay) {
  openMenuId.value = null
  const viewsWarning =
    replay.view_count > 0
      ? t('winterboard.replayList.prompts.trashWithViews', { count: replay.view_count }) + '\n\n'
      : ''
  // eslint-disable-next-line no-alert
  const ok = window.confirm(viewsWarning + t('winterboard.replayList.prompts.trashConfirm'))
  if (!ok) return
  try {
    await store.trash(replay.id)
  } catch (err) {
    console.error('[WBReplayList] trash failed', err)
  }
}

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

// Inline click-outside directive (невелика деталь щоб не тягнути зовнішній пакет).
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
.replay-list {
  max-width: 1280px;
  margin: 0 auto;
  padding: clamp(16px, 3vw, 32px);
}

.replay-list__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-md, 16px);
  margin-bottom: var(--space-md, 16px);
  flex-wrap: wrap;
}

.replay-list__title {
  margin: 0 0 4px;
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 700;
  color: var(--text-primary);
}

.replay-list__subtitle {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}

.replay-list__count {
  font-size: 0.875rem;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 4px 10px;
  border-radius: 999px;
}

.replay-list__toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-md, 16px);
  margin-bottom: var(--space-lg, 24px);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  flex-wrap: wrap;
}

.replay-list__tabs {
  display: flex;
  gap: 4px;
}

.replay-list__view-toggle {
  display: inline-flex;
  align-items: stretch;
  margin-bottom: 4px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  overflow: hidden;
  background: var(--card-bg, #fff);
}

.replay-list__view-btn {
  padding: 6px 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.replay-list__view-btn + .replay-list__view-btn {
  border-left: 1px solid var(--border-color, #e5e7eb);
}

.replay-list__view-btn:hover {
  color: var(--text-primary);
  background: var(--bg-secondary, #f3f4f6);
}

.replay-list__view-btn--active {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.replay-list__tab {
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}

.replay-list__tab:hover {
  color: var(--text-primary);
}

.replay-list__tab--active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.replay-list__error {
  padding: 12px 16px;
  background: color-mix(in srgb, var(--color-error, #dc2626) 8%, transparent);
  color: var(--color-error, #dc2626);
  border-radius: var(--radius-md, 8px);
  margin-bottom: var(--space-md, 16px);
}

.replay-list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-md, 16px);
}

/* ─── List view (rows) ───────────────────────────────────────────── */
.replay-list__rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

article.replay-card--list {
  flex-direction: row;
  align-items: stretch;
  min-height: 76px;
}

article.replay-card--list:hover {
  transform: none; /* не підстрибує у list view */
}

article.replay-card--list .replay-card__thumb {
  flex: 0 0 128px;
  aspect-ratio: 16 / 9;
  width: 128px;
  min-height: 72px;
}

article.replay-card--list .replay-card__thumb-placeholder {
  font-size: 1.75rem;
}

article.replay-card--list .replay-card__body {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(160px, 1fr) auto auto;
  align-items: center;
  gap: var(--space-md, 16px);
  padding: var(--space-sm, 8px) var(--space-md, 16px);
}

article.replay-card--list .replay-card__name {
  grid-column: 1;
  grid-row: 1;
  margin: 0;
}

article.replay-card--list .replay-card__meta {
  grid-column: 1;
  grid-row: 2;
  margin-top: 2px;
}

article.replay-card--list .replay-card__actions {
  grid-column: 3;
  grid-row: 1 / span 2;
  margin-top: 0;
  padding-top: 0;
  align-items: center;
}

article.replay-card--list .replay-card__btn--primary,
article.replay-card--list .replay-card__btn:not(.replay-card__btn--icon) {
  padding: 6px 12px;
  flex: 0 0 auto;
}

/* Сховати duration overlay у list view — воно дублюється у meta-рядку,
   і маленькі thumbnails роблять його нерозбірливим. */
article.replay-card--list .replay-card__duration {
  display: none;
}

/* Відповідь на вузькі екрани — list перетворюється на grid */
@media (max-width: 640px) {
  article.replay-card--list {
    flex-direction: column;
  }
  article.replay-card--list .replay-card__thumb {
    width: 100%;
    flex-basis: auto;
  }
  article.replay-card--list .replay-card__body {
    grid-template-columns: 1fr auto;
  }
  article.replay-card--list .replay-card__actions {
    grid-column: 1 / span 2;
    grid-row: 3;
    padding-top: 4px;
  }
}

.replay-card {
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: var(--radius-lg, 12px);
  /* overflow visible — щоб ⋯ menu не обрізався card'ом.
     Округлення кутів виносимо на внутрішні елементи (thumbnail). */
  overflow: visible;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Карточка з відкритим меню піднімається над сусідами (fix: list view clipping). */
.replay-card:has(.replay-card__menu) {
  z-index: 10;
}

.replay-card__thumb {
  /* Явно радіусити верхні кути (grid) / ліві (list) — замість card overflow */
  border-top-left-radius: var(--radius-lg, 12px);
  border-top-right-radius: var(--radius-lg, 12px);
}

article.replay-card--list .replay-card__thumb {
  border-radius: 0;
  border-top-left-radius: var(--radius-lg, 12px);
  border-bottom-left-radius: var(--radius-lg, 12px);
}

.replay-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.replay-card--skeleton {
  min-height: 280px;
  background: linear-gradient(
    90deg,
    var(--bg-secondary, #f3f4f6) 0%,
    var(--border-color, #e5e7eb) 50%,
    var(--bg-secondary, #f3f4f6) 100%
  );
  background-size: 200% 100%;
  animation: replay-skel 1.4s infinite;
}

@keyframes replay-skel {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.replay-card__thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--bg-secondary);
  overflow: hidden;
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
  min-width: 220px;
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

/* Перший header у меню не потребує верхньої межі (бо над ним нема items). */
.replay-card__menu .menu-header:first-child {
  margin-top: 0;
  border-top: none;
  background: transparent;
}

/* Items всередині header-ованої групи — inset (щоб візуально належали). */
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

.replay-list__empty {
  text-align: center;
  padding: 80px 20px;
}

.replay-list__empty-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.replay-list__empty-title {
  margin: 0 0 4px;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.replay-list__empty-subtitle {
  margin: 0;
  color: var(--text-secondary);
}
</style>
