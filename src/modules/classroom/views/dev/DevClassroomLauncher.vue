<template>
  <div class="dev-classroom-launcher">
    <header class="launcher-header">
      <h1 class="launcher-title">{{ $t('dev.classroom.launcher.title') }}</h1>
      <p class="launcher-description">{{ $t('dev.classroom.launcher.description') }}</p>
    </header>

    <div class="launcher-actions">
      <button
        class="btn btn-primary btn-create"
        :disabled="isCreating"
        @click="handleCreateAndJoin"
        data-testid="create-join-btn"
      >
        <span v-if="!isCreating">{{ $t('dev.classroom.launcher.createAndJoin') }}</span>
        <span v-else class="btn-loading">
          <span class="spinner"></span>
          {{ $t('dev.classroom.launcher.creating') }}
        </span>
      </button>
    </div>

    <div v-if="sessions.length > 0" class="launcher-sessions">
      <h2 class="sessions-title">{{ $t('dev.classroom.launcher.recentSessions') }}</h2>
      
      <div v-if="isLoading" class="sessions-loading">
        <div class="spinner"></div>
        <p>{{ $t('dev.classroom.launcher.loadingSessions') }}</p>
      </div>

      <div v-else class="sessions-list">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="session-item"
          :class="{ 'session-item--archived': session.is_archived }"
          :data-testid="`session-${session.id}`"
        >
          <div class="session-info">
            <div class="session-header">
              <span class="session-id">{{ session.id }}</span>
              <span
                class="session-status"
                :class="`session-status--${getSessionStatus(session)}`"
              >
                {{ $t(`dev.classroom.launcher.status.${getSessionStatus(session)}`) }}
              </span>
            </div>
            <div class="session-meta">
              <span class="session-date">{{ formatDate(session.created_at) }}</span>
            </div>
          </div>

          <div class="session-actions">
            <button
              v-if="!session.is_archived"
              class="btn btn-secondary btn-sm"
              :disabled="isJoining === session.id"
              @click="handleJoin(session.id)"
              :data-testid="`join-btn-${session.id}`"
            >
              <span v-if="isJoining !== session.id">{{ $t('dev.classroom.launcher.join') }}</span>
              <span v-else class="btn-loading">
                <span class="spinner-sm"></span>
              </span>
            </button>

            <button
              class="btn btn-ghost btn-sm"
              @click="handleCopyId(session.id)"
              :data-testid="`copy-btn-${session.id}`"
              :title="$t('dev.classroom.launcher.copyId')"
            >
              📋
            </button>

            <button
              v-if="!session.is_archived"
              class="btn btn-ghost btn-sm btn-archive"
              :disabled="isArchiving === session.id"
              @click="handleArchive(session.id)"
              :data-testid="`archive-btn-${session.id}`"
              :title="$t('dev.classroom.launcher.archive')"
            >
              🗄️
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="error" class="launcher-error" role="alert">
      <span class="error-icon">⚠️</span>
      <p class="error-message">{{ error }}</p>
      <button class="btn btn-secondary btn-sm" @click="handleRetry">
        {{ $t('dev.classroom.launcher.retry') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDevClassroomLauncher } from '../../composables/useDevClassroomLauncher'
import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const {
  sessions,
  isLoading,
  isCreating,
  isJoining,
  isArchiving,
  error,
  fetchSessions,
  createAndJoinSession,
  joinSession,
  archiveSession
} = useDevClassroomLauncher()

onMounted(async () => {
  await fetchSessions()
})

async function handleCreateAndJoin() {
  try {
    const sessionId = await createAndJoinSession()
    if (sessionId) {
      toast.success(t('dev.classroom.launcher.sessionCreated'))
      await router.push({ name: 'lesson-room', params: { sessionId } })
    }
  } catch (err) {
    toast.error(t('dev.classroom.launcher.createError'))
  }
}

async function handleJoin(sessionId: string) {
  try {
    const success = await joinSession(sessionId)
    if (success) {
      await router.push({ name: 'lesson-room', params: { sessionId } })
    }
  } catch (err) {
    toast.error(t('dev.classroom.launcher.joinError'))
  }
}

async function handleArchive(sessionId: string) {
  try {
    await archiveSession(sessionId)
    toast.success(t('dev.classroom.launcher.archived'))
    await fetchSessions()
  } catch (err) {
    toast.error(t('dev.classroom.launcher.archiveError'))
  }
}

function handleCopyId(sessionId: string) {
  navigator.clipboard.writeText(sessionId)
  toast.success(t('dev.classroom.launcher.copiedToClipboard'))
}

function handleRetry() {
  fetchSessions()
}

function getSessionStatus(session: any): string {
  if (session.is_archived) return 'archived'
  return 'ready'
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return t('dev.classroom.launcher.justNow')
  if (diffMins < 60) return t('dev.classroom.launcher.minutesAgo', { count: diffMins })
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return t('dev.classroom.launcher.hoursAgo', { count: diffHours })
  
  const diffDays = Math.floor(diffHours / 24)
  return t('dev.classroom.launcher.daysAgo', { count: diffDays })
}
</script>

<style scoped>
.dev-classroom-launcher {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.launcher-header {
  margin-bottom: 2rem;
}

.launcher-title {
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--color-text-primary, #1f2937);
}

.launcher-description {
  color: var(--color-text-secondary, #6b7280);
  font-size: 1rem;
}

.launcher-actions {
  margin-bottom: 3rem;
}

.btn-create {
  min-width: 200px;
}

.btn-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.spinner-sm {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.launcher-sessions {
  margin-top: 3rem;
}

.sessions-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  color: var(--color-text-primary, #1f2937);
}

.sessions-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem;
  color: var(--color-text-secondary, #6b7280);
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  background: var(--color-bg-secondary, #f9fafb);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  transition: all 0.2s;
}

.session-item:hover {
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.session-item--archived {
  opacity: 0.6;
}

.session-info {
  flex: 1;
}

.session-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.session-id {
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary, #1f2937);
}

.session-status {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.session-status--ready {
  background: #d1fae5;
  color: #065f46;
}

.session-status--archived {
  background: #e5e7eb;
  color: #6b7280;
}

.session-status--error {
  background: #fee2e2;
  color: #991b1b;
}

.session-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
}

.session-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark, #2563eb);
}

.btn-secondary {
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--color-text-primary, #1f2937);
  border: 1px solid var(--color-border, #e5e7eb);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.btn-ghost {
  background: transparent;
  color: var(--color-text-secondary, #6b7280);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--color-bg-secondary, #f3f4f6);
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

.launcher-error {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  margin-top: 2rem;
}

.error-icon {
  font-size: 1.5rem;
}

.error-message {
  flex: 1;
  color: #991b1b;
  margin: 0;
}
</style>
