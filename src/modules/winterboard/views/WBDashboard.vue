<!-- WB: Dashboard view — greeting, recent boards, quick actions
     Ref: TASK_BOARD.md B14
     API: /winterboard/sessions/ (НЕ /boards/)
     Auth: useAuthStore.user.first_name -->
<template>
  <div class="wb-dashboard">
    <!-- Header / Greeting -->
    <header class="wb-dashboard__header">
      <div class="wb-dashboard__greeting-wrap">
        <h1 class="wb-dashboard__greeting">{{ greeting }}</h1>
        <p class="wb-dashboard__subtitle">{{ t('winterboard.dashboard.subtitle') }}</p>
      </div>
    </header>

    <!-- Quick actions -->
    <section class="wb-dashboard__section">
      <h2 class="wb-dashboard__section-title">{{ t('winterboard.dashboard.quickActions') }}</h2>
      <div class="wb-dashboard__actions">
        <router-link :to="{ name: 'winterboard-sessions' }" class="wb-dashboard__action-card">
          <span class="wb-dashboard__action-icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/>
              <path d="M8 10h8M8 14h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="wb-dashboard__action-label">{{ t('winterboard.sidebar.boards') }}</span>
        </router-link>

        <router-link :to="{ name: 'winterboard-library' }" class="wb-dashboard__action-card">
          <span class="wb-dashboard__action-icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M4 19V7a2 2 0 012-2h12a2 2 0 012 2v12" stroke="currentColor" stroke-width="1.5"/>
              <path d="M4 19h16M9 7v12M15 7v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="wb-dashboard__action-label">{{ t('winterboard.dashboard.library') }}</span>
        </router-link>

        <router-link :to="{ name: 'winterboard-new' }" class="wb-dashboard__action-card wb-dashboard__action-card--primary">
          <span class="wb-dashboard__action-icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="wb-dashboard__action-label">{{ t('winterboard.boards.newBoard') }}</span>
        </router-link>
      </div>
    </section>

    <!-- Recent boards -->
    <section class="wb-dashboard__section">
      <div class="wb-dashboard__section-header">
        <h2 class="wb-dashboard__section-title">{{ t('winterboard.dashboard.recentBoards') }}</h2>
        <router-link :to="{ name: 'winterboard-sessions' }" class="wb-dashboard__view-all">
          {{ t('winterboard.dashboard.viewAll') }}
        </router-link>
      </div>

      <!-- Loading -->
      <div v-if="loadingBoards" class="wb-dashboard__recent" aria-busy="true">
        <div v-for="i in 4" :key="i" class="wb-recent-card wb-recent-card--skeleton">
          <div class="wb-recent-card__thumb wb-skeleton-pulse" />
          <div class="wb-recent-card__body">
            <div class="wb-skeleton-pulse wb-skeleton-line" />
            <div class="wb-skeleton-pulse wb-skeleton-line wb-skeleton-line--short" />
          </div>
        </div>
      </div>

      <!-- Error -->
      <div v-if="errorBoards" class="wb-dashboard__error" data-testid="dashboard-error">
        <p>{{ errorBoards }}</p>
        <button class="wb-dashboard__retry-btn" @click="loadRecentBoards">{{ t('common.retry') }}</button>
      </div>

      <!-- Empty -->
      <div v-else-if="recentBoards.length === 0" class="wb-dashboard__empty">
        <p>{{ t('winterboard.dashboard.noRecentBoards') }}</p>
        <router-link :to="{ name: 'winterboard-new' }" class="wb-dashboard__empty-cta">
          {{ t('winterboard.boards.createFirst') }}
        </router-link>
      </div>

      <!-- Board cards -->
      <div v-else class="wb-dashboard__recent">
        <div
          v-for="session in recentBoards"
          :key="session.id"
          class="wb-recent-card"
          role="button"
          tabindex="0"
          :aria-label="session.name || t('winterboard.boards.untitled')"
          @click="openBoard(session.id)"
          @keydown.enter="openBoard(session.id)"
        >
          <div class="wb-recent-card__thumb">
            <img
              v-if="session.thumbnail_url"
              :src="session.thumbnail_url"
              :alt="session.name"
              loading="lazy"
              draggable="false"
            />
            <div v-else class="wb-recent-card__thumb-placeholder" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="3" y="5" width="22" height="18" rx="2" stroke="#cbd5e1" stroke-width="1.5"/>
                <path d="M8 12h12M8 16h8" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
          </div>
          <div class="wb-recent-card__body">
            <span class="wb-recent-card__name">
              {{ session.name || t('winterboard.boards.untitled') }}
            </span>
            <span class="wb-recent-card__meta">
              {{ t('winterboard.boards.pageCount', { n: session.page_count }) }}
              &nbsp;·&nbsp;
              {{ formatTimeAgo(session.updated_at) }}
            </span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { winterboardApi, type WBSessionListItem } from '../api/winterboardApi'
import { useToast } from '../composables/useToast'

// ─── Composables ──────────────────────────────────────────────────────────────

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const { showToast } = useToast()

// ─── State ────────────────────────────────────────────────────────────────────

const recentBoards = ref<WBSessionListItem[]>([])
const loadingBoards = ref(false)
const errorBoards = ref<string | null>(null)

// ─── Computed ─────────────────────────────────────────────────────────────────

const greeting = computed<string>(() => {
  const hour = new Date().getHours()
  const name: string = (authStore.user as any)?.first_name
    ?? (authStore.user as any)?.email
    ?? ''
  if (hour < 12) return t('winterboard.dashboard.goodMorning', { name })
  if (hour < 18) return t('winterboard.dashboard.goodAfternoon', { name })
  return t('winterboard.dashboard.goodEvening', { name })
})

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function loadRecentBoards(): Promise<void> {
  loadingBoards.value = true
  errorBoards.value = null
  try {
    const res = await winterboardApi.listSessions()
    recentBoards.value = (res.results ?? [])
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5)
  } catch (err) {
    const msg = err instanceof Error ? err.message : t('winterboard.board.loadError')
    errorBoards.value = msg
    showToast(msg, 'error')
    console.error('[WB:Dashboard] Failed to load recent boards', err)
  } finally {
    loadingBoards.value = false
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function openBoard(id: string): void {
  const resolved = router.resolve({ name: 'winterboard-solo', params: { id } })
  window.open(resolved.href, '_blank', 'noopener')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(loadRecentBoards)
</script>

<style scoped>
.wb-dashboard {
  max-width: 1080px;
  margin: 0 auto;
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

/* ── Header ──────────────────────────────────────────────────────────── */

.wb-dashboard__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.wb-dashboard__greeting {
  font-size: 28px;
  font-weight: 700;
  color: var(--wb-fg, #0f172a);
  margin: 0 0 6px;
}

.wb-dashboard__subtitle {
  font-size: 14px;
  color: var(--wb-fg-secondary, #94a3b8);
  margin: 0;
}

/* ── Section ─────────────────────────────────────────────────────────── */

.wb-dashboard__section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.wb-dashboard__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wb-dashboard__section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
  margin: 0;
}

.wb-dashboard__view-all {
  font-size: 13px;
  color: var(--wb-brand, #0066ff);
  text-decoration: none;
  font-weight: 500;
}

.wb-dashboard__view-all:hover {
  text-decoration: underline;
}

/* ── Quick Actions ───────────────────────────────────────────────────── */

.wb-dashboard__actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.wb-dashboard__action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px 16px;
  background: var(--wb-card-bg, #ffffff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 12px;
  text-decoration: none;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  color: var(--wb-fg, #0f172a);
  min-height: 88px;
}

.wb-dashboard__action-card:hover {
  border-color: var(--wb-brand, #0066ff);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.wb-dashboard__action-card--primary {
  background: var(--wb-brand, #0066ff);
  border-color: var(--wb-brand, #0066ff);
  color: #ffffff;
}

.wb-dashboard__action-card--primary:hover {
  background: var(--wb-brand-hover, #0052cc);
  box-shadow: 0 4px 12px rgba(0, 102, 255, 0.2);
}

.wb-dashboard__action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: currentColor;
}

.wb-dashboard__action-label {
  font-size: 13px;
  font-weight: 600;
  text-align: center;
}

/* ── Recent boards ───────────────────────────────────────────────────── */

.wb-dashboard__recent {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.wb-recent-card {
  background: var(--wb-card-bg, #ffffff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}

.wb-recent-card:hover,
.wb-recent-card:focus-visible {
  border-color: var(--wb-brand, #0066ff);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.wb-recent-card__thumb {
  height: 100px;
  background: var(--wb-canvas-bg, #f8fafc);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.wb-recent-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wb-recent-card__body {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.wb-recent-card__name {
  font-size: 13px;
  font-weight: 500;
  color: var(--wb-fg, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wb-recent-card__meta {
  font-size: 11px;
  color: var(--wb-fg-secondary, #94a3b8);
  white-space: nowrap;
}

/* ── Empty ───────────────────────────────────────────────────────────── */

.wb-dashboard__empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 32px;
  border: 2px dashed var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
  font-size: 14px;
  color: var(--wb-fg-secondary, #94a3b8);
}

.wb-dashboard__empty-cta {
  font-size: 13px;
  font-weight: 600;
  color: var(--wb-brand, #0066ff);
  text-decoration: none;
}

/* ── Skeleton ────────────────────────────────────────────────────────── */

.wb-recent-card--skeleton {
  pointer-events: none;
  cursor: default;
}

.wb-skeleton-pulse {
  background: linear-gradient(
    90deg,
    var(--wb-toolbar-border, #e2e8f0) 25%,
    var(--wb-canvas-bg, #f1f5f9) 50%,
    var(--wb-toolbar-border, #e2e8f0) 75%
  );
  background-size: 200% 100%;
  animation: wb-shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

.wb-skeleton-line {
  height: 13px;
  width: 80%;
  margin-bottom: 6px;
}

.wb-skeleton-line--short {
  width: 50%;
  height: 11px;
}

@keyframes wb-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Responsive ──────────────────────────────────────────────────────── */

@media (max-width: 960px) {
  .wb-dashboard__recent {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .wb-dashboard {
    padding: 20px 12px;
    gap: 28px;
  }

  .wb-dashboard__greeting {
    font-size: 22px;
  }

  .wb-dashboard__actions {
    grid-template-columns: 1fr 1fr;
  }

  .wb-dashboard__recent {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .wb-dashboard__actions {
    grid-template-columns: 1fr;
  }

  .wb-dashboard__recent {
    grid-template-columns: 1fr 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wb-recent-card,
  .wb-dashboard__action-card {
    transition: none;
  }

  .wb-skeleton-pulse {
    animation: none;
  }
}
</style>
