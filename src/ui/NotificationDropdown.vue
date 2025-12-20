<template>
  <div class="relative" ref="rootRef">
    <button
      type="button"
      class="notif-btn"
      :aria-label="$t('notifications.dropdown.ariaLabel')"
      @click="toggle"
    >
      <span class="icon" aria-hidden="true">🔔</span>
      <span v-if="unreadCount" class="badge">
        {{ unreadCount > 9 ? '9+' : unreadCount }}
      </span>
      <span class="sr-only">{{ $t('notifications.dropdown.open') }}</span>
    </button>

    <transition name="fade-scale">
      <div v-if="open" class="notif-panel" role="menu">
        <header class="panel-header">
          <div class="panel-title-group">
            <div class="panel-title-row">
              <p class="panel-title">{{ $t('notifications.dropdown.title') }}</p>
              <span v-if="isRealtimeOffline" class="status-pill status-pill--offline">
                {{ $t('notifications.dropdown.offlineBadge') }}
              </span>
            </div>
            <p class="panel-subtitle">{{ headerSubtitle }}</p>
          </div>
          <button
            v-if="canMarkAll"
            type="button"
            class="link-button"
            @click="markAllAsRead"
          >
            {{ $t('notifications.dropdown.markAll') }}
          </button>
        </header>

        <section class="panel-body">
          <ul v-if="showList" class="notif-list">
            <li
              v-for="item in displayItems"
              :key="item.id"
              class="notif-item"
              :class="itemClasses(item)"
              @click="handleItemClick(item)"
            >
              <div class="notif-avatar" :style="{ background: item.avatarBg }" aria-hidden="true">
                <span>{{ item.initials }}</span>
              </div>

              <div class="notif-content">
                <p class="notif-title">{{ item.title }}</p>
                <p class="notif-body">
                  {{ item.description || $t('notifications.dropdown.genericDescription') }}
                </p>
                <div class="notif-meta">
                  <span>{{ item.timeAgo }}</span>
                  <span v-if="item.tag" class="meta-pill">{{ item.tag }}</span>
                </div>
              </div>

              <span v-if="!item.read" class="unread-dot" aria-hidden="true" />
            </li>
          </ul>

          <div v-else-if="showSkeleton" class="notif-skeleton">
            <div class="skeleton-row" v-for="idx in skeletonItems" :key="idx">
              <div class="avatar-skeleton" aria-hidden="true" />
              <div class="text-skeleton" aria-hidden="true">
                <span />
                <span />
              </div>
            </div>
          </div>

          <div v-else-if="hasError" class="notif-state notif-state--error" role="alert">
            <p class="notif-state__title">{{ $t('notifications.dropdown.errorTitle') }}</p>
            <p class="notif-state__description">
              {{ $t('notifications.dropdown.errorDescription') }}
            </p>
            <button type="button" class="ghost-button" @click="refresh">
              {{ $t('notifications.dropdown.retry') }}
            </button>
          </div>

          <div v-else class="notif-state" role="status">
            <p class="notif-state__title">{{ $t('notifications.dropdown.emptyTitle') }}</p>
            <p class="notif-state__description">
              {{ $t('notifications.dropdown.emptyDescription') }}
            </p>
            <button type="button" class="ghost-button" @click="refresh">
              {{ $t('notifications.dropdown.refresh') }}
            </button>
          </div>
        </section>

        <footer class="panel-footer">
          <button
            v-if="hasMore"
            type="button"
            class="link-button"
            :disabled="loading"
            @click="handleLoadMore"
          >
            {{ loading ? $t('notifications.dropdown.loadingMore') : $t('notifications.dropdown.loadMore') }}
          </button>
          <button type="button" class="link-button" :disabled="loading" @click="refresh">
            {{ $t('notifications.dropdown.refresh') }}
          </button>
        </footer>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useNotificationsStore } from '../stores/notificationsStore'

dayjs.extend(relativeTime)

const router = useRouter()
const { t, te } = useI18n()
const rootRef = ref(null)
const open = ref(false)

const notificationsStore = useNotificationsStore()
const { sortedItems, unreadCount, loading, hasMore, lastError, realtimeStatus } = storeToRefs(notificationsStore)

const palette = {
  success: 'linear-gradient(135deg, #c8f5cb, #9de29a)',
  warning: 'linear-gradient(135deg, #ffe4c7, #ffc192)',
  danger: 'linear-gradient(135deg, #ffd4d4, #ff9f9f)',
  info: 'linear-gradient(135deg, #d7e7ff, #b3d3ff)',
  default: 'linear-gradient(135deg, #e8eaf1, #d8dbe7)',
}

const skeletonItems = [1, 2, 3]
const showSkeleton = computed(() => loading.value && !sortedItems.value.length)
const showList = computed(() => displayItems.value.length > 0)
const canMarkAll = computed(() => sortedItems.value.some((item) => !item.read_at))
const hasError = computed(() => Boolean(lastError.value))
const isRealtimeOffline = computed(() => realtimeStatus.value !== 'open')

const headerSubtitle = computed(() => {
  if (isRealtimeOffline.value) {
    return t('notifications.dropdown.offlineSubtitle')
  }
  if (loading.value && !sortedItems.value.length) {
    return t('notifications.dropdown.loadingSubtitle')
  }
  if (!sortedItems.value.length) {
    return t('notifications.dropdown.emptySubtitle')
  }
  if (!unreadCount.value) {
    return t('notifications.dropdown.noUnread')
  }
  return t('notifications.dropdown.unread', { count: unreadCount.value })
})

const displayItems = computed(() => sortedItems.value.slice(0, 5).map(enhanceItem))

function enhanceItem(item) {
  const payload = item.payload || {}
  const titleTemplate = te('notifications.dropdown.titleTemplate') ? t('notifications.dropdown.titleTemplate') : ''
  const title =
    payload.title ||
    payload.message ||
    titleTemplate ||
    item.type?.replace(/\./g, ' ')
  const description = payload.description || payload.body || payload.message || ''
  const tone = payload.tone || deriveTone(item.type)
  return {
    id: item.id,
    raw: item,
    title,
    description,
    timeAgo: dayjs(item.created_at).fromNow(),
    tag: payload.tag || item.type?.split?.('.')?.pop(),
    read: Boolean(item.read_at),
    initials: buildInitials(title),
    avatarBg: palette[tone] || palette.default,
    link: resolveLink(payload),
  }
}

function deriveTone(type = '') {
  if (type.includes('lesson')) return 'info'
  if (type.includes('chat')) return 'warning'
  if (type.includes('board')) return 'success'
  return 'default'
}

function buildInitials(source = '') {
  const parts = source.split(' ').filter(Boolean)
  if (!parts.length) return '•'
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function resolveLink(payload) {
  if (payload.lesson_id) {
    return { name: 'lesson', params: { id: payload.lesson_id } }
  }
  if (payload.url) {
    return payload.url
  }
  return null
}

function itemClasses(item) {
  return [
    'notif-item',
    {
      'notif-item--unread': !item.read,
    },
  ]
}

function toggle() {
  open.value = !open.value
  if (open.value) {
    ensureLoaded()
  }
}

function close() {
  open.value = false
}

async function ensureLoaded(force = false) {
  if (!force && sortedItems.value.length) return
  await notificationsStore.fetchNotifications({ replace: true })
}

function handleOutside(event) {
  if (!open.value || !rootRef.value) return
  if (!rootRef.value.contains(event.target)) {
    close()
  }
}

async function handleItemClick(item) {
  await notificationsStore.markAsRead(item.id)
  if (item.link) {
    close()
    if (typeof item.link === 'string') {
      router.push(item.link).catch(() => {})
    } else {
      router.push(item.link).catch(() => {})
    }
  }
}

function markAllAsRead() {
  notificationsStore.markAllAsRead()
}

function refresh() {
  ensureLoaded(true)
}

function handleLoadMore() {
  if (!hasMore.value || loading.value) return
  notificationsStore.loadMore()
}

onMounted(() => {
  window.addEventListener('click', handleOutside)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', handleOutside)
})

defineExpose({ close })
</script>

<style scoped>
.notif-btn {
  position: relative;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--nav-bg);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.notif-btn:hover {
  border-color: var(--accent);
}

.icon {
  display: block;
}

.badge {
  position: absolute;
  top: 0;
  right: 0;
  transform: translate(40%, -30%);
  background: #d63a3a;
  color: white;
  font-size: 0.65rem;
  line-height: 1;
  padding: 0.2rem 0.35rem;
  border-radius: 999px;
  font-weight: 700;
  min-width: 1.15rem;
  text-align: center;
}

.notif-panel {
  position: absolute;
  right: 0;
  margin-top: 0.5rem;
  width: min(360px, 80vw);
  background: var(--surface-card, #fff);
  color: var(--text-primary);
  border-radius: 1.25rem;
  box-shadow: 0 35px 80px -60px rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(15, 23, 42, 0.08);
  z-index: 60;
  overflow: hidden;
}

.panel-header,
.panel-footer {
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.panel-body {
  padding: 0.25rem 0;
}

.panel-title {
  font-weight: 700;
  font-size: 1rem;
}

.panel-subtitle {
  font-size: 0.85rem;
  color: var(--text-muted, rgba(15, 23, 42, 0.55));
}

.link-button {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent, #4f46e5);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.link-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.notif-list {
  max-height: 18rem;
  overflow-y: auto;
}

.notif-item {
  padding: 0.85rem 1.25rem;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.85rem;
  align-items: center;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background 0.2s ease;
}

.notif-item + .notif-item {
  border-top: 1px solid rgba(15, 23, 42, 0.05);
}

.notif-item:hover {
  background: rgba(79, 70, 229, 0.05);
}

.notif-item--unread {
  border-left-color: var(--accent, #4f46e5);
  background: rgba(79, 70, 229, 0.04);
}

.notif-avatar {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.9);
}

.notif-content {
  flex: 1;
  min-width: 0;
}

.notif-title {
  font-weight: 600;
  font-size: 0.92rem;
  margin: 0;
}

.notif-body {
  font-size: 0.82rem;
  color: var(--text-muted, rgba(15, 23, 42, 0.6));
  margin: 0.2rem 0 0;
}

.notif-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-muted, rgba(15, 23, 42, 0.6));
}

.meta-pill {
  font-size: 0.7rem;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
}

.unread-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: var(--accent, #4f46e5);
}

.notif-item--tone-success {
  border-left-color: #0f9c5c;
}

.notif-item--tone-warning {
  border-left-color: #f59e0b;
}

.notif-item--tone-danger {
  border-left-color: #ef4444;
}

.notif-item--tone-info {
  border-left-color: #2f54eb;
}

.notif-skeleton {
  padding: 0.75rem 1.25rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.skeleton-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.avatar-skeleton {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.06));
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}

.text-skeleton {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.text-skeleton span {
  display: block;
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.04));
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}

.text-skeleton span:last-child {
  width: 60%;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.notif-state {
  padding: 1.25rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.notif-state__title {
  font-weight: 600;
  margin: 0;
}

.notif-state__description {
  margin: 0;
  color: var(--text-muted, rgba(15, 23, 42, 0.63));
  font-size: 0.9rem;
}

.ghost-button {
  border: 1px solid var(--border-color, rgba(15, 23, 42, 0.15));
  background: transparent;
  padding: 0.45rem 1rem;
  border-radius: 999px;
  font-size: 0.85rem;
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.ghost-button:hover {
  border-color: var(--accent);
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: translateY(-4px);
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
</style>
