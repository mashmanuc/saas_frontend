<template>
  <div class="activity-feed" data-testid="activity-feed">
    <div v-if="loading" class="feed-loading">
      <LoadingSpinner />
    </div>

    <div v-else-if="events.length === 0" class="feed-empty">
      {{ $t('staff.activityFeed.empty') }}
    </div>

    <div v-else class="feed-list">
      <div
        v-for="ev in events"
        :key="ev.id"
        class="feed-item"
        @click="navigateToEntity(ev)"
      >
        <span class="feed-icon">{{ iconForAction(ev.action) }}</span>
        <div class="feed-body">
          <div class="feed-action">
            <span class="feed-action-text">{{ ev.action }}</span>
            <span v-if="ev.entity_type" class="feed-entity">
              {{ ev.entity_type }}
              <span v-if="ev.entity_id" class="feed-entity-id">#{{ ev.entity_id.slice(0, 8) }}</span>
            </span>
          </div>
          <div class="feed-meta">
            <span v-if="ev.user_email" class="feed-user">{{ ev.user_email }}</span>
            <span class="feed-time">{{ relativeTime(ev.created_at) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import apiClient from '@/utils/apiClient'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'

interface AuditEvent {
  id: string
  action: string
  entity_type: string
  entity_id: string
  user_id: number | null
  user_email: string | null
  metadata: Record<string, any>
  created_at: string
}

const router = useRouter()
const { t } = useI18n()

const events = ref<AuditEvent[]>([])
const loading = ref(true)

const ACTION_ICONS: Record<string, string> = {
  login: '🔑',
  logout: '🚪',
  register: '✨',
  ban_create: '🚫',
  ban_lift: '✅',
  report_create: '🚩',
  report_resolve: '📋',
  subscription_create: '💳',
  subscription_cancel: '💔',
  profile_update: '✏️',
  email_verify: '📧',
  mfa_enable: '🔒',
}

function iconForAction(action: string): string {
  const key = Object.keys(ACTION_ICONS).find(k => action.toLowerCase().includes(k))
  return key ? ACTION_ICONS[key] : '📌'
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return t('staff.activityFeed.justNow')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('staff.activityFeed.minutesAgo', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('staff.activityFeed.hoursAgo', { n: hours })
  const days = Math.floor(hours / 24)
  return t('staff.activityFeed.daysAgo', { n: days })
}

function navigateToEntity(ev: AuditEvent) {
  if (ev.user_id) {
    router.push(`/staff/users/${ev.user_id}`)
  }
}

onMounted(async () => {
  try {
    const res = await apiClient.get('/v1/staff/stats/activity-feed/', {
      meta: { skipLoader: true },
    } as any)
    events.value = res.results || []
  } catch {
    // Silent
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.activity-feed {
  min-height: 100px;
}

.feed-loading,
.feed-empty {
  padding: var(--space-md);
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.feed-list {
  display: flex;
  flex-direction: column;
}

.feed-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-xs);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-base);
}

.feed-item:hover {
  background: var(--bg-secondary);
}

.feed-item + .feed-item {
  border-top: 1px solid var(--border-color);
}

.feed-icon {
  flex-shrink: 0;
  width: 24px;
  text-align: center;
  font-size: 0.875rem;
  padding-top: 2px;
}

.feed-body {
  flex: 1;
  min-width: 0;
}

.feed-action {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.feed-action-text {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.feed-entity {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.feed-entity-id {
  font-family: monospace;
  font-size: var(--text-xs);
  opacity: 0.7;
}

.feed-meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: 1px;
}

.feed-user {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.feed-time {
  font-size: var(--text-xs);
  color: var(--text-muted, var(--text-secondary));
  opacity: 0.7;
  flex-shrink: 0;
}
</style>
