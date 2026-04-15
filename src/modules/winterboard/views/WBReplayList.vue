<template>
  <div class="replay-list">
    <header class="replay-list__header">
      <div>
        <h1 class="replay-list__title">{{ $t('winterboard.replayList.title') }}</h1>
        <p class="replay-list__subtitle">
          {{ $t('winterboard.replayList.subtitle') }}
        </p>
      </div>
      <span v-if="!isLoading && sessions.length > 0" class="replay-list__count">
        {{ total }}
      </span>
    </header>

    <!-- Loading -->
    <div v-if="isLoading" class="replay-list__grid">
      <div v-for="i in 6" :key="i" class="replay-card replay-card--skeleton" />
    </div>

    <!-- Empty -->
    <div v-else-if="sessions.length === 0" class="replay-list__empty">
      <div class="replay-list__empty-icon">🎬</div>
      <h2 class="replay-list__empty-title">
        {{ $t('winterboard.replayList.empty.title') }}
      </h2>
      <p class="replay-list__empty-subtitle">
        {{ $t('winterboard.replayList.empty.subtitle') }}
      </p>
    </div>

    <!-- Grid -->
    <div v-else class="replay-list__grid">
      <article
        v-for="session in sessions"
        :key="session.id"
        class="replay-card"
        :data-testid="`replay-card-${session.id}`"
      >
        <div class="replay-card__thumb">
          <img
            v-if="session.thumbnail_url"
            :src="session.thumbnail_url"
            :alt="session.name"
            loading="lazy"
          />
          <div v-else class="replay-card__thumb-placeholder">🎬</div>
          <span
            v-if="formatDuration(session.recording_duration_seconds) !== null"
            class="replay-card__duration"
          >
            {{ formatDuration(session.recording_duration_seconds) }}
          </span>
        </div>

        <div class="replay-card__body">
          <h3 class="replay-card__name">{{ session.name || $t('winterboard.replayList.untitled') }}</h3>
          <div class="replay-card__meta">
            <span v-if="session.recording_started_at">
              {{ formatDate(session.recording_started_at) }}
            </span>
            <span
              v-if="session.replay_visibility && session.replay_visibility !== 'private'"
              class="replay-card__badge"
            >
              {{ visibilityLabel(session.replay_visibility) }}
            </span>
            <span v-if="session.is_replay_frozen === false" class="replay-card__badge replay-card__badge--live">
              {{ $t('winterboard.replayList.live') }}
            </span>
          </div>

          <div class="replay-card__actions">
            <button
              type="button"
              class="replay-card__btn replay-card__btn--primary"
              @click="openReplay(session)"
            >
              ▶ {{ $t('winterboard.replayList.actions.watch') }}
            </button>
            <button
              v-if="session.replay_share_token"
              type="button"
              class="replay-card__btn"
              :class="{ 'replay-card__btn--copied': copiedId === session.id }"
              @click="copyShareLink(session)"
            >
              {{ copiedId === session.id
                ? $t('winterboard.replayList.actions.copied')
                : $t('winterboard.replayList.actions.share') }}
            </button>
          </div>
        </div>
      </article>
    </div>

    <!-- Load more -->
    <div v-if="!isLoading && hasMore" class="replay-list__more">
      <button
        type="button"
        class="replay-list__load-more"
        :disabled="isLoadingMore"
        @click="loadMore"
      >
        {{ isLoadingMore ? $t('common.loading') : $t('winterboard.replayList.loadMore') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { winterboardApi, type WBSessionListItem } from '../api/winterboardApi'

const router = useRouter()
const { t } = useI18n()

const sessions = ref<WBSessionListItem[]>([])
const total = ref(0)
const hasMore = ref(false)
const isLoading = ref(true)
const isLoadingMore = ref(false)
const copiedId = ref<string | null>(null)

const PAGE_SIZE = 24

async function loadSessions(append = false) {
  if (append) {
    isLoadingMore.value = true
  } else {
    isLoading.value = true
  }
  try {
    const res = await winterboardApi.listSessions({
      has_recording: true,
      sort: '-updated_at',
      limit: PAGE_SIZE,
      offset: append ? sessions.value.length : 0,
    })
    sessions.value = append ? [...sessions.value, ...res.results] : res.results
    total.value = res.count
    hasMore.value = Boolean(res.next)
  } catch (err) {
    console.error('[WBReplayList] failed to load replays', err)
  } finally {
    isLoading.value = false
    isLoadingMore.value = false
  }
}

onMounted(() => {
  loadSessions(false)
})

function loadMore() {
  if (isLoadingMore.value || !hasMore.value) return
  loadSessions(true)
}

// Повний шлях воркфлоу для власника: відкриваємо у solo-room,
// де вбудований ReplayControls може запустити відтворення.
function openReplay(session: WBSessionListItem) {
  router.push({ name: 'winterboard-solo', params: { id: session.id } })
}

function copyShareLink(session: WBSessionListItem) {
  const token = session.replay_share_token
  if (!token) return
  const url = `${window.location.origin}/winterboard/public/${token}`
  navigator.clipboard.writeText(url).then(() => {
    copiedId.value = session.id
    setTimeout(() => {
      if (copiedId.value === session.id) copiedId.value = null
    }, 2000)
  })
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

function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds < 0) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}с`
  return `${m}:${String(s).padStart(2, '0')}`
}

function visibilityLabel(v: 'private' | 'link' | 'public'): string {
  if (v === 'public') return t('winterboard.replayList.visibility.public')
  if (v === 'link') return t('winterboard.replayList.visibility.link')
  return t('winterboard.replayList.visibility.private')
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
  margin-bottom: var(--space-lg, 24px);
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

.replay-list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-md, 16px);
}

.replay-card {
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: var(--radius-lg, 12px);
  overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  display: flex;
  flex-direction: column;
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

.replay-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
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

.replay-card__badge--live {
  background: color-mix(in srgb, var(--color-error, #dc2626) 12%, transparent);
  color: var(--color-error, #dc2626);
}

.replay-card__actions {
  display: flex;
  gap: var(--space-xs, 6px);
  margin-top: auto;
  padding-top: var(--space-xs, 6px);
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

.replay-list__more {
  display: flex;
  justify-content: center;
  margin-top: var(--space-lg, 24px);
}

.replay-list__load-more {
  padding: 10px 20px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  border-radius: var(--radius-md, 8px);
  color: var(--text-primary);
  font-weight: 600;
  cursor: pointer;
}

.replay-list__load-more:hover:not(:disabled) {
  background: var(--bg-secondary);
}

.replay-list__load-more:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
