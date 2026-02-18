<!-- WB: Presence Panel — online users, follow, connection status
     Ref: TASK_BOARD_PHASES.md B6.1, LAW-16 (Multi-User Presence) -->
<template>
  <div
    class="wb-presence-panel"
    :class="{
      'wb-presence-panel--collapsed': isCollapsed,
      'wb-presence-panel--disconnected': connectionStatus === 'disconnected',
    }"
    role="region"
    :aria-label="t('winterboard.collaboration.onlineUsers')"
  >
    <!-- Toggle button -->
    <button
      type="button"
      class="wb-presence-panel__toggle"
      :aria-label="isCollapsed
        ? t('winterboard.collaboration.expandPanel')
        : t('winterboard.collaboration.collapsePanel')"
      :aria-expanded="!isCollapsed"
      @click="isCollapsed = !isCollapsed"
    >
      <!-- Connection dot -->
      <span
        class="wb-presence-panel__status-dot"
        :class="'wb-presence-panel__status-dot--' + connectionStatus"
        :title="connectionStatusText"
      />
      <span v-if="isCollapsed" class="wb-presence-panel__badge">
        {{ displayUsers.length }}
      </span>
      <span v-else class="wb-presence-panel__title">
        {{ t('winterboard.collaboration.onlineUsers') }}
        <span class="wb-presence-panel__count">({{ displayUsers.length }})</span>
      </span>
      <svg
        class="wb-presence-panel__chevron"
        :class="{ 'wb-presence-panel__chevron--up': !isCollapsed }"
        width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
      >
        <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <!-- Connection status bar -->
    <div
      v-if="connectionStatus !== 'connected' && !isCollapsed"
      class="wb-presence-panel__connection"
      :class="'wb-presence-panel__connection--' + connectionStatus"
      role="status"
      aria-live="polite"
    >
      <span>{{ connectionStatusText }}</span>
    </div>

    <!-- User list -->
    <Transition name="wb-slide">
      <ul v-if="!isCollapsed" class="wb-presence-panel__list" role="list">
        <li
          v-for="u in displayUsers"
          :key="u.userId"
          class="wb-presence-panel__user"
          :class="{
            'wb-presence-panel__user--you': u.isYou,
            'wb-presence-panel__user--following': followingUserId === u.userId,
          }"
          :style="followingUserId === u.userId ? { borderColor: u.color } : undefined"
        >
          <!-- Avatar -->
          <span
            class="wb-presence-panel__avatar"
            :style="{ backgroundColor: u.color }"
            :aria-label="u.displayName"
          >
            {{ u.initial }}
          </span>

          <!-- Info -->
          <div class="wb-presence-panel__info">
            <span class="wb-presence-panel__name">
              {{ u.displayName }}
              <span v-if="u.isYou" class="wb-presence-panel__you-badge">
                {{ t('winterboard.collaboration.you') }}
              </span>
              <span
                v-if="followingUserId === u.userId"
                class="wb-presence-panel__following-badge"
              >
                {{ t('winterboard.collaboration.following') }}
              </span>
            </span>
            <span class="wb-presence-panel__meta">
              <span v-if="u.tool" class="wb-presence-panel__tool">{{ toolLabel(u.tool) }}</span>
              <span v-if="u.pageIndex != null" class="wb-presence-panel__page">
                {{ t('winterboard.collaboration.page') }} {{ u.pageIndex + 1 }}
              </span>
            </span>
          </div>

          <!-- Follow button (not for yourself) -->
          <button
            v-if="!u.isYou"
            type="button"
            class="wb-presence-panel__follow-btn"
            :class="{ 'wb-presence-panel__follow-btn--active': followingUserId === u.userId }"
            :aria-label="followingUserId === u.userId
              ? t('winterboard.collaboration.unfollow')
              : t('winterboard.collaboration.follow') + ' ' + u.displayName"
            @click="toggleFollow(u.userId)"
          >
            {{ followingUserId === u.userId
              ? t('winterboard.collaboration.unfollow')
              : t('winterboard.collaboration.follow') }}
          </button>
        </li>
      </ul>
    </Transition>

    <!-- Screen reader announcements -->
    <div class="wb-sr-only" aria-live="assertive" aria-atomic="true">
      {{ srAnnouncement }}
    </div>
  </div>
</template>

<script setup lang="ts">
// WB: WBPresencePanel — online users list with follow mode & connection status
// Ref: TASK_BOARD_PHASES.md B6.1
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { OnlineUser } from '../../composables/useYjsPresence'
import type { WBToolType } from '../../types/winterboard'

const props = defineProps<{
  /** Current user ID */
  currentUserId: string
  /** Current user display name */
  currentUserName: string
  /** Current user color */
  currentUserColor: string
  /** Online users from useYjsPresence */
  onlineUsers: OnlineUser[]
  /** WebSocket connected */
  isConnected: boolean
  /** Initial sync complete */
  isSynced: boolean
}>()

const emit = defineEmits<{
  follow: [userId: string]
  unfollow: []
}>()

const { t } = useI18n()

// ── State ─────────────────────────────────────────────────────────────────
const isCollapsed = ref(false)
const followingUserId = ref<string | null>(null)
const srAnnouncement = ref('')

// ── Connection status ─────────────────────────────────────────────────────
const connectionStatus = computed<'connected' | 'syncing' | 'disconnected'>(() => {
  if (!props.isConnected) return 'disconnected'
  if (!props.isSynced) return 'syncing'
  return 'connected'
})

const connectionStatusText = computed(() => {
  switch (connectionStatus.value) {
    case 'connected': return t('winterboard.collaboration.connected')
    case 'syncing': return t('winterboard.collaboration.syncing')
    case 'disconnected': return t('winterboard.collaboration.reconnecting')
  }
})

// ── Display users (you first, then alphabetical) ──────────────────────────
interface DisplayUser extends OnlineUser {
  isYou: boolean
  initial: string
}

const displayUsers = computed<DisplayUser[]>(() => {
  const you: DisplayUser = {
    userId: props.currentUserId,
    displayName: props.currentUserName,
    color: props.currentUserColor,
    tool: null,
    pageIndex: null,
    isYou: true,
    initial: props.currentUserName.charAt(0).toUpperCase() || '?',
  }

  const others: DisplayUser[] = props.onlineUsers
    .filter(u => u.userId !== props.currentUserId)
    .map(u => ({
      ...u,
      isYou: false,
      initial: u.displayName.charAt(0).toUpperCase() || '?',
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))

  return [you, ...others]
})

// ── Follow mode ───────────────────────────────────────────────────────────
function toggleFollow(userId: string): void {
  if (followingUserId.value === userId) {
    followingUserId.value = null
    srAnnouncement.value = t('winterboard.collaboration.unfollowed')
    emit('unfollow')
  } else {
    followingUserId.value = userId
    const user = displayUsers.value.find(u => u.userId === userId)
    srAnnouncement.value = t('winterboard.collaboration.nowFollowing', { name: user?.displayName ?? '' })
    emit('follow', userId)
  }
}

// ── Tool labels ───────────────────────────────────────────────────────────
function toolLabel(tool: WBToolType): string {
  const map: Record<string, string> = {
    pen: '✏️',
    highlighter: '🖍️',
    eraser: '🧹',
    select: '👆',
    text: '📝',
    shape: '⬜',
    pan: '✋',
    laser: '🔴',
  }
  return map[tool] || tool
}

// ── Watch for user join/leave → screen reader announce ────────────────────
let prevUserIds = new Set<string>()

watch(() => props.onlineUsers, (newUsers) => {
  const newIds = new Set(newUsers.map(u => u.userId))

  // Joined
  for (const u of newUsers) {
    if (!prevUserIds.has(u.userId)) {
      srAnnouncement.value = t('winterboard.collaboration.userJoined', { name: u.displayName })
    }
  }

  // Left
  for (const id of prevUserIds) {
    if (!newIds.has(id)) {
      srAnnouncement.value = t('winterboard.collaboration.userLeft', { name: id })
    }
  }

  // If following user left → unfollow
  if (followingUserId.value && !newIds.has(followingUserId.value)) {
    followingUserId.value = null
    emit('unfollow')
  }

  prevUserIds = newIds
}, { deep: true })

// ── Expose for testing ────────────────────────────────────────────────────
defineExpose({
  isCollapsed,
  followingUserId,
  toggleFollow,
  connectionStatus,
  displayUsers,
  srAnnouncement,
})
</script>

<style scoped>
.wb-presence-panel {
  display: flex;
  flex-direction: column;
  background: var(--wb-panel-bg, #ffffff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
  overflow: hidden;
  min-width: 200px;
  max-width: 280px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  font-size: 13px;
}

.wb-presence-panel--collapsed {
  min-width: auto;
  max-width: auto;
}

/* ── Toggle ─────────────────────────────────────────────────────── */
.wb-presence-panel__toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
  width: 100%;
  text-align: left;
}

.wb-presence-panel__toggle:hover {
  background: var(--wb-canvas-bg, #f8fafc);
}

.wb-presence-panel__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.wb-presence-panel__status-dot--connected { background: #22c55e; }
.wb-presence-panel__status-dot--syncing { background: #eab308; }
.wb-presence-panel__status-dot--disconnected { background: #ef4444; }

.wb-presence-panel__badge {
  background: var(--wb-brand, #0066FF);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.wb-presence-panel__title {
  flex: 1;
}

.wb-presence-panel__count {
  font-weight: 400;
  color: var(--wb-fg-secondary, #94a3b8);
}

.wb-presence-panel__chevron {
  transition: transform 0.2s ease;
}

.wb-presence-panel__chevron--up {
  transform: rotate(180deg);
}

/* ── Connection bar ─────────────────────────────────────────────── */
.wb-presence-panel__connection {
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 500;
}

.wb-presence-panel__connection--syncing {
  background: #fef9c3;
  color: #854d0e;
}

.wb-presence-panel__connection--disconnected {
  background: #fef2f2;
  color: #dc2626;
}

/* ── User list ──────────────────────────────────────────────────── */
.wb-presence-panel__list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  max-height: 240px;
  overflow-y: auto;
}

.wb-presence-panel__user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-left: 3px solid transparent;
  transition: background 0.15s;
}

.wb-presence-panel__user:hover {
  background: var(--wb-canvas-bg, #f8fafc);
}

.wb-presence-panel__user--following {
  border-left-width: 3px;
  background: rgba(0, 102, 255, 0.04);
}

.wb-presence-panel__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.wb-presence-panel__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.wb-presence-panel__name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 4px;
}

.wb-presence-panel__you-badge {
  font-size: 10px;
  font-weight: 600;
  color: var(--wb-brand, #0066FF);
  background: rgba(0, 102, 255, 0.1);
  padding: 0 4px;
  border-radius: 4px;
}

.wb-presence-panel__following-badge {
  font-size: 10px;
  font-weight: 600;
  color: #059669;
  background: rgba(5, 150, 105, 0.1);
  padding: 0 4px;
  border-radius: 4px;
}

.wb-presence-panel__meta {
  font-size: 11px;
  color: var(--wb-fg-secondary, #94a3b8);
  display: flex;
  gap: 6px;
}

.wb-presence-panel__follow-btn {
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 4px;
  background: none;
  color: var(--wb-fg-secondary, #64748b);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;
}

.wb-presence-panel__follow-btn:hover {
  background: var(--wb-canvas-bg, #f1f5f9);
  border-color: var(--wb-brand, #0066FF);
}

.wb-presence-panel__follow-btn--active {
  background: rgba(0, 102, 255, 0.08);
  border-color: var(--wb-brand, #0066FF);
  color: var(--wb-brand, #0066FF);
}

/* ── SR only ────────────────────────────────────────────────────── */
.wb-sr-only {
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

/* ── Transition ─────────────────────────────────────────────────── */
.wb-slide-enter-active,
.wb-slide-leave-active {
  transition: max-height 0.2s ease, opacity 0.2s ease;
  overflow: hidden;
}

.wb-slide-enter-from,
.wb-slide-leave-to {
  max-height: 0;
  opacity: 0;
}

.wb-slide-enter-to,
.wb-slide-leave-from {
  max-height: 300px;
  opacity: 1;
}

/* ── Reduced motion ─────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .wb-presence-panel__chevron,
  .wb-presence-panel__user,
  .wb-presence-panel__follow-btn {
    transition: none;
  }

  .wb-slide-enter-active,
  .wb-slide-leave-active {
    transition: none;
  }
}
</style>
