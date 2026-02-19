<!-- WB: Session list view — full implementation
     Ref: TASK_BOARD.md B4.1
     Grid of session cards, CRUD, loading/empty states
     Deploy: 2026-02-18 18:45 -->
<template>
  <div class="wb-session-list">
    <!-- Header -->
    <div class="wb-session-list__header">
      <h1 class="wb-session-list__title">{{ t('winterboard.sessions.title') }}</h1>
      <router-link
        :to="{ name: 'winterboard-new' }"
        class="wb-session-list__new-btn"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        {{ t('winterboard.sessions.newSession') }}
      </router-link>
    </div>

    <!-- Loading state: skeleton cards -->
    <div v-if="loading" class="wb-session-grid">
      <div v-for="i in 3" :key="i" class="wb-session-card wb-session-card--skeleton">
        <div class="wb-session-card__thumb wb-skeleton-pulse" />
        <div class="wb-session-card__body">
          <div class="wb-skeleton-pulse wb-skeleton-line wb-skeleton-line--title" />
          <div class="wb-skeleton-pulse wb-skeleton-line wb-skeleton-line--meta" />
        </div>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="loadError" class="wb-session-list__empty">
      <svg class="wb-session-list__empty-icon" width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="24" cy="24" r="22" stroke="#ef4444" stroke-width="2" />
        <path d="M24 14v12M24 30v2" stroke="#ef4444" stroke-width="2" stroke-linecap="round" />
      </svg>
      <p class="wb-session-list__empty-title">{{ t('winterboard.sessions.loadError') }}</p>
      <button type="button" class="wb-session-list__cta-btn" @click="fetchSessions">
        {{ t('winterboard.error.retry') }}
      </button>
    </div>

    <!-- Empty state -->
    <div v-else-if="sessions.length === 0" class="wb-session-list__empty">
      <svg class="wb-session-list__empty-icon" width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <rect x="8" y="12" width="48" height="40" rx="4" stroke="#94a3b8" stroke-width="2" />
        <path d="M20 28h24M20 36h16" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" />
        <circle cx="32" cy="8" r="4" fill="#94a3b8" />
      </svg>
      <p class="wb-session-list__empty-title">{{ t('winterboard.sessions.emptyTitle') }}</p>
      <p class="wb-session-list__empty-message">{{ t('winterboard.sessions.emptyMessage') }}</p>
      <router-link :to="{ name: 'winterboard-new' }" class="wb-session-list__cta-btn">
        {{ t('winterboard.sessions.createFirst') }}
      </router-link>
    </div>

    <!-- Session grid -->
    <div v-else class="wb-session-grid">
      <div
        v-for="session in sessions"
        :key="session.id"
        class="wb-session-card"
        @click="openSession(session.id)"
      >
        <!-- Thumbnail -->
        <div class="wb-session-card__thumb">
          <img
            v-if="session.thumbnail_url"
            :src="session.thumbnail_url"
            :alt="session.name"
            class="wb-session-card__thumb-img"
          />
          <div v-else class="wb-session-card__thumb-placeholder">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect x="4" y="6" width="24" height="20" rx="2" stroke="#cbd5e1" stroke-width="1.5" />
              <path d="M10 16h12M10 20h8" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </div>
        </div>

        <!-- Body -->
        <div class="wb-session-card__body">
          <h3 class="wb-session-card__name">{{ session.name || t('winterboard.sessionCard.untitled') }}</h3>
          <div class="wb-session-card__meta">
            <span class="wb-session-card__time">{{ formatTimeAgo(session.updated_at) }}</span>
            <span class="wb-session-card__pages">{{ t('winterboard.sessionCard.pageCount', { n: session.page_count }) }}</span>
          </div>
        </div>

        <!-- Actions dropdown -->
        <div class="wb-session-card__actions" @click.stop>
          <button
            type="button"
            class="wb-session-card__actions-btn"
            :aria-label="t('winterboard.sessions.actions.open')"
            @click="toggleMenu(session.id)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="3" r="1.5" fill="currentColor" />
              <circle cx="8" cy="8" r="1.5" fill="currentColor" />
              <circle cx="8" cy="13" r="1.5" fill="currentColor" />
            </svg>
          </button>

          <Transition name="wb-menu-fade">
            <div
              v-if="openMenuId === session.id"
              class="wb-session-card__menu"
              @click.stop
            >
              <button type="button" class="wb-session-card__menu-item" @click="openSession(session.id)">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="wb-menu-icon"><path d="M6 2l6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                {{ t('winterboard.sessions.actions.open') }}
              </button>
              <button type="button" class="wb-session-card__menu-item" @click="handleDuplicate(session.id)">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="wb-menu-icon"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.5"/></svg>
                {{ t('winterboard.sessions.actions.duplicate') }}
              </button>
              <button type="button" class="wb-session-card__menu-item" @click="handleShare(session.id)">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="wb-menu-icon"><circle cx="12" cy="4" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="4" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M5.7 7l4.6-2M5.7 9l4.6 2" stroke="currentColor" stroke-width="1.5"/></svg>
                {{ t('winterboard.sessions.actions.share') }}
              </button>
              <button type="button" class="wb-session-card__menu-item" @click="handleExport(session.id)">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="wb-menu-icon"><path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3M8 2v8M5 5l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                {{ t('winterboard.sessions.actions.export') }}
              </button>
              <div class="wb-session-card__menu-divider" />
              <button
                type="button"
                class="wb-session-card__menu-item wb-session-card__menu-item--danger"
                @click="confirmDelete(session)"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="wb-menu-icon"><path d="M2 4h12M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v4M10 7v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                {{ t('winterboard.sessions.actions.delete') }}
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- Delete confirmation dialog -->
    <Teleport to="body">
      <Transition name="wb-dialog-fade">
        <div v-if="deleteTarget" class="wb-dialog-overlay" @click.self="deleteTarget = null">
          <div class="wb-dialog" role="alertdialog" aria-modal="true">
            <h2 class="wb-dialog__title">{{ t('winterboard.sessions.confirmDelete.title') }}</h2>
            <p class="wb-dialog__message">
              {{ t('winterboard.sessions.confirmDelete.message', { name: deleteTarget.name || t('winterboard.sessionCard.untitled') }) }}
            </p>
            <div class="wb-dialog__actions">
              <button type="button" class="wb-dialog__btn wb-dialog__btn--cancel" @click="deleteTarget = null">
                {{ t('winterboard.sessions.confirmDelete.cancel') }}
              </button>
              <button
                type="button"
                class="wb-dialog__btn wb-dialog__btn--danger"
                :disabled="deleting"
                @click="handleDelete"
              >
                {{ deleting ? '…' : t('winterboard.sessions.confirmDelete.confirm') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Share dialog slot -->
    <WBShareDialog
      v-if="shareSessionId"
      :session-id="shareSessionId"
      :is-open="!!shareSessionId"
      @close="shareSessionId = null"
    />

    <!-- Export dialog slot -->
    <WBExportDialog
      v-if="exportSessionId"
      :session-id="exportSessionId"
      :is-open="!!exportSessionId"
      @close="exportSessionId = null"
    />
  </div>
</template>

<script setup lang="ts">
// WB: WBSessionList — full session list with CRUD
// Ref: TASK_BOARD.md B4.1
import { ref, defineAsyncComponent, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { winterboardApi, type WBSessionListItem } from '../api/winterboardApi'
import { useToast } from '../composables/useToast'

// A7.1: Lazy load dialogs — only loaded when user opens share/export
const WBShareDialog = defineAsyncComponent(() => import('../components/sharing/WBShareDialog.vue'))
const WBExportDialog = defineAsyncComponent(() => import('../components/export/WBExportDialog.vue'))

const { t } = useI18n()
const router = useRouter()
const { showToast } = useToast()

// ── State ─────────────────────────────────────────────────────────────────
const sessions = ref<WBSessionListItem[]>([])
const loading = ref(true)
const loadError = ref(false)
const openMenuId = ref<string | null>(null)
const deleteTarget = ref<WBSessionListItem | null>(null)
const deleting = ref(false)
const shareSessionId = ref<string | null>(null)
const exportSessionId = ref<string | null>(null)

// ── Fetch ─────────────────────────────────────────────────────────────────
async function fetchSessions(): Promise<void> {
  loading.value = true
  loadError.value = false
  try {
    const res = await winterboardApi.listSessions()
    sessions.value = (res.results ?? []).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
  } catch (err) {
    console.error('[WB:SessionList] Failed to load sessions', err)
    loadError.value = true
  } finally {
    loading.value = false
  }
}

// ── Actions ───────────────────────────────────────────────────────────────
function openSession(id: string): void {
  openMenuId.value = null
  router.push({ name: 'winterboard-solo', params: { id } })
}

async function handleDuplicate(id: string): Promise<void> {
  openMenuId.value = null
  try {
    const dup = await winterboardApi.duplicateSession(id)
    showToast(t('winterboard.sessions.duplicated'), 'success')
    router.push({ name: 'winterboard-solo', params: { id: dup.id } })
  } catch (err) {
    console.error('[WB:SessionList] Duplicate failed', err)
    showToast(t('winterboard.sessions.duplicateError'), 'error')
  }
}

function handleShare(id: string): void {
  openMenuId.value = null
  shareSessionId.value = id
}

function handleExport(id: string): void {
  openMenuId.value = null
  exportSessionId.value = id
}

function confirmDelete(session: WBSessionListItem): void {
  openMenuId.value = null
  deleteTarget.value = session
}

async function handleDelete(): Promise<void> {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await winterboardApi.deleteSession(deleteTarget.value.id)
    sessions.value = sessions.value.filter((s) => s.id !== deleteTarget.value!.id)
    showToast(t('winterboard.sessions.deleted'), 'success')
    deleteTarget.value = null
  } catch (err) {
    console.error('[WB:SessionList] Delete failed', err)
    showToast(t('winterboard.sessions.deleteError'), 'error')
  } finally {
    deleting.value = false
  }
}

function toggleMenu(id: string): void {
  openMenuId.value = openMenuId.value === id ? null : id
}

// ── Close menu on outside click ───────────────────────────────────────────
function handleOutsideClick(): void {
  if (openMenuId.value) openMenuId.value = null
}

// ── Time formatting ───────────────────────────────────────────────────────
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

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(() => {
  fetchSessions()
  document.addEventListener('click', handleOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
})
</script>

<style scoped>
.wb-session-list {
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px 24px;
}

/* ── Header ──────────────────────────────────────────────────────────── */
.wb-session-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
}

.wb-session-list__title {
  font-size: 24px;
  font-weight: 700;
  color: var(--wb-fg, #0f172a);
  margin: 0;
}

.wb-session-list__new-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: var(--wb-brand, #0066FF);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s ease;
}

.wb-session-list__new-btn:hover {
  background: var(--wb-brand-hover, #0052cc);
}

/* ── Grid ────────────────────────────────────────────────────────────── */
.wb-session-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

@media (min-width: 640px) {
  .wb-session-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 960px) {
  .wb-session-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* ── Card ────────────────────────────────────────────────────────────── */
.wb-session-card {
  position: relative;
  background: var(--wb-card-bg, #ffffff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 12px;
  cursor: pointer;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}

.wb-session-card:hover {
  border-color: var(--wb-brand, #0066FF);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.wb-session-card__thumb {
  height: 140px;
  background: var(--wb-canvas-bg, #f8fafc);
  border-radius: 12px 12px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.wb-session-card__thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wb-session-card__thumb-placeholder {
  color: var(--wb-fg-secondary, #cbd5e1);
}

.wb-session-card__body {
  padding: 14px 16px 16px;
}

.wb-session-card__name {
  font-size: 15px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
  margin: 0 0 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 8px);
}

.wb-session-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
}

/* ── Actions dropdown ────────────────────────────────────────────────── */
.wb-session-card__actions {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
}

.wb-session-card__actions-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--wb-card-bg, rgba(255, 255, 255, 0.95));
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 8px;
  cursor: pointer;
  color: var(--wb-fg-secondary, #64748b);
  transition: background 0.1s, box-shadow 0.1s;
}

.wb-session-card__actions-btn:hover {
  background: var(--wb-card-bg, #ffffff);
  color: var(--wb-fg, #0f172a);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.wb-session-card__menu {
  position: absolute;
  top: 36px;
  right: 0;
  min-width: 180px;
  background: var(--wb-card-bg, #ffffff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14);
  padding: 6px 0;
  z-index: 100;
}

.wb-session-card__menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 16px;
  background: none;
  border: none;
  font-size: 14px;
  color: var(--wb-fg, #0f172a);
  text-align: left;
  cursor: pointer;
  transition: background 0.1s;
  white-space: nowrap;
}

.wb-session-card__menu-item:hover {
  background: var(--wb-canvas-bg, #f1f5f9);
}

.wb-session-card__menu-item--danger {
  color: #ef4444;
}

.wb-session-card__menu-item--danger:hover {
  background: var(--wb-danger-bg, #fef2f2);
}

.wb-menu-icon {
  flex-shrink: 0;
  margin-right: 10px;
  opacity: 0.6;
}

.wb-session-card__menu-divider {
  height: 1px;
  background: var(--wb-toolbar-border, #e2e8f0);
  margin: 4px 0;
}

/* ── Menu transition ─────────────────────────────────────────────────── */
.wb-menu-fade-enter-active,
.wb-menu-fade-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.wb-menu-fade-enter-from,
.wb-menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Empty state ─────────────────────────────────────────────────────── */
.wb-session-list__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  border: 2px dashed var(--wb-toolbar-border, #e2e8f0);
  border-radius: 12px;
  text-align: center;
}

.wb-session-list__empty-icon {
  margin-bottom: 16px;
}

.wb-session-list__empty-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
  margin: 0 0 8px;
}

.wb-session-list__empty-message {
  font-size: 14px;
  color: var(--wb-fg-secondary, #94a3b8);
  margin: 0 0 24px;
}

.wb-session-list__cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  background: var(--wb-brand, #0066FF);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s ease;
}

.wb-session-list__cta-btn:hover {
  background: var(--wb-brand-hover, #0052cc);
}

/* ── Skeleton ────────────────────────────────────────────────────────── */
.wb-session-card--skeleton {
  cursor: default;
  pointer-events: none;
}

.wb-skeleton-pulse {
  background: linear-gradient(90deg, var(--wb-toolbar-border, #e2e8f0) 25%, var(--wb-canvas-bg, #f1f5f9) 50%, var(--wb-toolbar-border, #e2e8f0) 75%);
  background-size: 200% 100%;
  animation: wb-skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

.wb-skeleton-line {
  height: 14px;
  margin-bottom: 8px;
}

.wb-skeleton-line--title {
  width: 70%;
}

.wb-skeleton-line--meta {
  width: 40%;
  height: 12px;
}

@keyframes wb-skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Delete dialog ───────────────────────────────────────────────────── */
.wb-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.wb-dialog {
  background: var(--wb-card-bg, #ffffff);
  border-radius: 12px;
  padding: 24px;
  max-width: 420px;
  width: 90%;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.16);
}

.wb-dialog__title {
  font-size: 18px;
  font-weight: 700;
  color: var(--wb-fg, #0f172a);
  margin: 0 0 8px;
}

.wb-dialog__message {
  font-size: 14px;
  color: var(--wb-fg-secondary, #64748b);
  margin: 0 0 20px;
  line-height: 1.5;
}

.wb-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.wb-dialog__btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.15s;
}

.wb-dialog__btn--cancel {
  background: var(--wb-canvas-bg, #f1f5f9);
  color: var(--wb-fg, #0f172a);
}

.wb-dialog__btn--cancel:hover {
  background: var(--wb-toolbar-border, #e2e8f0);
}

.wb-dialog__btn--danger {
  background: #ef4444;
  color: #ffffff;
}

.wb-dialog__btn--danger:hover {
  background: #dc2626;
}

.wb-dialog__btn--danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Dialog transition ───────────────────────────────────────────────── */
.wb-dialog-fade-enter-active,
.wb-dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.wb-dialog-fade-enter-from,
.wb-dialog-fade-leave-to {
  opacity: 0;
}

/* ── B5.2: Reduced motion ────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .wb-session-card,
  .wb-session-list__new-btn,
  .wb-session-list__cta-btn,
  .wb-session-card__actions-btn,
  .wb-session-card__menu-item,
  .wb-dialog__btn {
    transition: none;
  }

  .wb-skeleton-pulse {
    animation: none;
  }

  .wb-menu-fade-enter-active,
  .wb-menu-fade-leave-active,
  .wb-dialog-fade-enter-active,
  .wb-dialog-fade-leave-active {
    transition: none;
  }
}
</style>
