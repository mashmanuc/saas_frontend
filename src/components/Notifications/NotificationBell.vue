<template>
  <div class="relative" ref="rootRef">
    <button
      type="button"
      class="bell-button"
      :aria-label="$t('notifications.bell.ariaLabel')"
      @click="toggle"
    >
      <span class="bell-icon" aria-hidden="true">🔔</span>
      <span v-if="unreadCount > 0" class="badge">
        {{ unreadCount > 9 ? '9+' : unreadCount }}
      </span>
    </button>

    <transition name="fade-scale">
      <div v-if="isOpen" class="dropdown-panel" role="menu">
        <header class="panel-header">
          <h3 class="panel-title">{{ $t('notifications.bell.title') }}</h3>
          <button
            v-if="canMarkAll"
            type="button"
            class="link-btn"
            @click="handleMarkAllAsRead"
          >
            {{ $t('notifications.bell.markAllRead') }}
          </button>
        </header>

        <div class="panel-body">
          <div v-if="isLoading && items.length === 0" class="loading-state">
            <div v-for="i in 3" :key="i" class="skeleton-item">
              <div class="skeleton-avatar" />
              <div class="skeleton-text">
                <div class="skeleton-line" />
                <div class="skeleton-line short" />
              </div>
            </div>
          </div>

          <div v-else-if="error" class="error-state" role="alert">
            <p class="error-title">{{ $t('notifications.bell.errorTitle') }}</p>
            <p class="error-desc">{{ $t('notifications.bell.errorDesc') }}</p>
            <button type="button" class="retry-btn" @click="handleRetry">
              {{ $t('notifications.bell.retry') }}
            </button>
          </div>

          <ul v-else-if="latestItems.length > 0" class="notifications-list">
            <li
              v-for="item in latestItems"
              :key="item.id"
              class="notification-item"
              :class="{ 'unread': !item.read_at }"
              @click="handleNotificationClick(item)"
            >
              <div class="item-content">
                <p class="item-title">{{ item.title }}</p>
                <p class="item-body">{{ item.body }}</p>
                <span class="item-time">{{ formatTime(item.created_at) }}</span>
              </div>
              <span v-if="!item.read_at" class="unread-dot" aria-hidden="true" />
            </li>
          </ul>

          <div v-else class="empty-state">
            <p class="empty-title">{{ $t('notifications.bell.emptyTitle') }}</p>
            <p class="empty-desc">{{ $t('notifications.bell.emptyDesc') }}</p>
          </div>
        </div>

        <footer class="panel-footer">
          <router-link to="/notifications" class="view-all-link" @click="close">
            {{ $t('notifications.bell.viewAll') }}
          </router-link>
        </footer>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
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
const rootRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)

// SSOT: Bell ONLY reads from store. WS subscription is in App.vue
const notificationsStore = useNotificationsStore()
const { items, unreadCount, latestItems, isLoading, error } = storeToRefs(notificationsStore)

const canMarkAll = computed(() => unreadCount.value > 0)

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value && items.value.length === 0) {
    notificationsStore.loadNotifications({ limit: 10 })
  }
}

function close() {
  isOpen.value = false
}

function handleOutsideClick(event: MouseEvent) {
  if (!isOpen.value || !rootRef.value) return
  if (!rootRef.value.contains(event.target as Node)) {
    close()
  }
}

async function handleNotificationClick(notification: InAppNotification) {
  if (!notification.read_at) {
    await notificationsStore.markAsRead(notification.id)
  }

  close()

  if (notification.data?.relation_id) {
    router.push(`/relations/${notification.data.relation_id}`)
  } else if (notification.data?.inquiry_id) {
    router.push(`/inquiries/${notification.data.inquiry_id}`)
  } else if (notification.data?.billing) {
    router.push('/billing')
  }
}

async function handleMarkAllAsRead() {
  try {
    await notificationsStore.markAllAsRead()
  } catch (err) {
    // Silent fail
  }
}

function handleRetry() {
  notificationsStore.loadNotifications({ limit: 10 })
}

function formatTime(timestamp: string): string {
  return dayjs(timestamp).fromNow()
}

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
  // Polling is managed by App.vue, Bell just displays store state
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick)
})
</script>

<style scoped>
.bell-button {
  position: relative;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  background: var(--nav-bg);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bell-button:hover {
  border-color: var(--accent);
  background: var(--bg-hover, rgba(0, 0, 0, 0.02));
}

.bell-icon {
  display: block;
}

.badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background: #d63a3a;
  color: white;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.2rem 0.35rem;
  border-radius: 999px;
  min-width: 1.2rem;
  text-align: center;
  line-height: 1;
}

.dropdown-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 0.5rem);
  width: min(380px, 90vw);
  background: var(--surface-card, #fff);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  border: 1px solid var(--border-color);
  z-index: 1000;
  overflow: hidden;
}

.panel-header {
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color);
}

.panel-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.link-btn {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.link-btn:hover {
  text-decoration: underline;
}

.panel-body {
  max-height: 400px;
  overflow-y: auto;
}

.loading-state {
  padding: 1rem;
}

.skeleton-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem 0;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.06));
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}

.skeleton-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skeleton-line {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.04));
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}

.skeleton-line.short {
  width: 60%;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.error-state,
.empty-state {
  padding: 2rem 1.25rem;
  text-align: center;
}

.error-title,
.empty-title {
  font-weight: 600;
  margin: 0 0 0.5rem;
  color: var(--text-primary);
}

.error-desc,
.empty-desc {
  margin: 0 0 1rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.retry-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.9rem;
}

.retry-btn:hover {
  border-color: var(--accent);
}

.notifications-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.notification-item {
  padding: 0.875rem 1.25rem;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background 0.2s ease;
}

.notification-item + .notification-item {
  border-top: 1px solid var(--border-color);
}

.notification-item:hover {
  background: var(--bg-hover, rgba(0, 0, 0, 0.02));
}

.notification-item.unread {
  border-left-color: var(--accent);
  background: rgba(79, 70, 229, 0.04);
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-weight: 600;
  font-size: 0.9rem;
  margin: 0 0 0.25rem;
  color: var(--text-primary);
}

.item-body {
  font-size: 0.85rem;
  margin: 0 0 0.25rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.item-time {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
  margin-top: 0.25rem;
}

.panel-footer {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--border-color);
  text-align: center;
}

.view-all-link {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--accent);
  text-decoration: none;
}

.view-all-link:hover {
  text-decoration: underline;
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
