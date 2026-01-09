<template>
  <div class="notifications-view">
    <header class="view-header">
      <h1 class="view-title">{{ $t('notifications.view.title') }}</h1>
      <div class="header-actions">
        <div class="filter-tabs">
          <button
            type="button"
            class="filter-tab"
            :class="{ active: filter === 'all' }"
            @click="setFilter('all')"
          >
            {{ $t('notifications.view.filterAll') }}
          </button>
          <button
            type="button"
            class="filter-tab"
            :class="{ active: filter === 'unread' }"
            @click="setFilter('unread')"
          >
            {{ $t('notifications.view.filterUnread') }}
            <span v-if="unreadCount > 0" class="count-badge">{{ unreadCount }}</span>
          </button>
        </div>
        <button
          v-if="canMarkAll"
          type="button"
          class="mark-all-btn"
          :disabled="isLoading"
          @click="handleMarkAllAsRead"
        >
          {{ $t('notifications.view.markAllRead') }}
        </button>
      </div>
    </header>

    <div class="view-body">
      <div v-if="isLoading && displayedItems.length === 0" class="loading-state">
        <div v-for="i in 5" :key="i" class="skeleton-card">
          <div class="skeleton-avatar" />
          <div class="skeleton-content">
            <div class="skeleton-line" />
            <div class="skeleton-line short" />
            <div class="skeleton-line shorter" />
          </div>
        </div>
      </div>

      <div v-else-if="error" class="error-state" role="alert">
        <div class="error-icon">⚠️</div>
        <h2 class="error-title">{{ $t('notifications.view.errorTitle') }}</h2>
        <p class="error-desc">{{ $t('notifications.view.errorDesc') }}</p>
        <button type="button" class="retry-btn" @click="handleRetry">
          {{ $t('notifications.view.retry') }}
        </button>
      </div>

      <div v-else-if="displayedItems.length === 0" class="empty-state">
        <div class="empty-icon">🔔</div>
        <h2 class="empty-title">{{ emptyTitle }}</h2>
        <p class="empty-desc">{{ emptyDesc }}</p>
      </div>

      <ul v-else class="notifications-list">
        <li
          v-for="item in displayedItems"
          :key="item.id"
          class="notification-card"
          :class="{ 'unread': !item.read_at }"
          @click="handleNotificationClick(item)"
        >
          <div class="card-indicator" />
          <div class="card-content">
            <div class="card-header">
              <h3 class="card-title">{{ item.title }}</h3>
              <span class="card-time">{{ formatTime(item.created_at) }}</span>
            </div>
            <p class="card-body">{{ item.body }}</p>
            <div class="card-footer">
              <span class="card-type">{{ item.type }}</span>
              <button
                v-if="!item.read_at"
                type="button"
                class="mark-read-btn"
                @click.stop="handleMarkAsRead(item.id)"
              >
                {{ $t('notifications.view.markRead') }}
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useNotificationsStore } from '@/stores/notificationsStore'
import type { InAppNotification } from '@/types/notifications'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const router = useRouter()
const { t } = useI18n()
const filter = ref<'all' | 'unread'>('all')

const notificationsStore = useNotificationsStore()
const { items, unreadCount, isLoading, error } = storeToRefs(notificationsStore)

const displayedItems = computed(() => {
  if (filter.value === 'unread') {
    return items.value.filter(n => !n.read_at)
  }
  return items.value
})

const canMarkAll = computed(() => unreadCount.value > 0)

const emptyTitle = computed(() => {
  return filter.value === 'unread'
    ? t('notifications.view.emptyUnreadTitle')
    : t('notifications.view.emptyAllTitle')
})

const emptyDesc = computed(() => {
  return filter.value === 'unread'
    ? t('notifications.view.emptyUnreadDesc')
    : t('notifications.view.emptyAllDesc')
})

function setFilter(newFilter: 'all' | 'unread') {
  filter.value = newFilter
}

async function handleNotificationClick(notification: InAppNotification) {
  if (!notification.read_at) {
    await notificationsStore.markAsRead(notification.id)
  }

  if (notification.data?.relation_id) {
    router.push(`/relations/${notification.data.relation_id}`)
  } else if (notification.data?.inquiry_id) {
    router.push(`/inquiries/${notification.data.inquiry_id}`)
  } else if (notification.data?.billing) {
    router.push('/billing')
  }
}

async function handleMarkAsRead(id: string) {
  try {
    await notificationsStore.markAsRead(id)
  } catch (err) {
    console.error('[NotificationsView] Failed to mark as read:', err)
  }
}

async function handleMarkAllAsRead() {
  try {
    await notificationsStore.markAllAsRead()
  } catch (err) {
    console.error('[NotificationsView] Failed to mark all as read:', err)
  }
}

function handleRetry() {
  notificationsStore.loadNotifications()
}

function formatTime(timestamp: string): string {
  return dayjs(timestamp).fromNow()
}

onMounted(() => {
  notificationsStore.loadNotifications()
})
</script>

<style scoped>
.notifications-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.view-header {
  margin-bottom: 2rem;
}

.view-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 1.5rem;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.filter-tabs {
  display: flex;
  gap: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.25rem;
  background: var(--bg-secondary);
}

.filter-tab {
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-tab:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.filter-tab.active {
  background: var(--accent);
  color: white;
}

.count-badge {
  background: rgba(255, 255, 255, 0.3);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.mark-all-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: white;
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mark-all-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.mark-all-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.view-body {
  min-height: 400px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.skeleton-card {
  display: flex;
  gap: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--surface-card);
}

.skeleton-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.06));
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
  flex-shrink: 0;
}

.skeleton-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skeleton-line {
  height: 14px;
  border-radius: 7px;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.04));
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}

.skeleton-line.short {
  width: 70%;
}

.skeleton-line.shorter {
  width: 40%;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.error-state,
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
}

.error-icon,
.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.error-title,
.empty-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.75rem;
  color: var(--text-primary);
}

.error-desc,
.empty-desc {
  font-size: 1rem;
  margin: 0 0 1.5rem;
  color: var(--text-secondary);
}

.retry-btn {
  padding: 0.75rem 1.5rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: white;
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.notifications-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.notification-card {
  display: flex;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--surface-card);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
}

.notification-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.notification-card.unread {
  border-left-width: 4px;
  border-left-color: var(--accent);
  background: rgba(79, 70, 229, 0.02);
}

.card-indicator {
  width: 4px;
  background: transparent;
}

.notification-card.unread .card-indicator {
  background: var(--accent);
}

.card-content {
  flex: 1;
  padding: 1.25rem;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.card-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
  flex: 1;
}

.card-time {
  font-size: 0.85rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.card-body {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0 0 1rem;
  line-height: 1.5;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.card-type {
  font-size: 0.8rem;
  color: var(--text-muted);
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--bg-secondary);
}

.mark-read-btn {
  padding: 0.4rem 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: white;
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mark-read-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

@media (max-width: 640px) {
  .notifications-view {
    padding: 1rem 0.75rem;
  }

  .view-title {
    font-size: 1.5rem;
  }

  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-tabs {
    width: 100%;
  }

  .filter-tab {
    flex: 1;
    justify-content: center;
  }

  .mark-all-btn {
    width: 100%;
  }

  .card-header {
    flex-direction: column;
    gap: 0.5rem;
  }

  .card-time {
    align-self: flex-start;
  }
}
</style>
