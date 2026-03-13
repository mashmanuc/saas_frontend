<!-- WB B17: WBStudents — list of tutor's students with session stats
     Ref: DAY19_AGENT-B.md B17
     API: TODO — replace with real endpoint when available -->
<template>
  <div class="wb-students">
    <header class="wb-students__header">
      <h1 class="wb-students__title">{{ t('winterboard.students.title') }}</h1>
    </header>

    <!-- Loading state -->
    <div v-if="loading" class="wb-students__loading" data-testid="students-loading" aria-live="polite" aria-busy="true">
      <div v-for="i in 5" :key="i" class="wb-student-skeleton">
        <div class="wb-skeleton-pulse wb-skeleton-avatar" />
        <div class="wb-student-skeleton__info">
          <div class="wb-skeleton-pulse wb-skeleton-line" />
          <div class="wb-skeleton-pulse wb-skeleton-line wb-skeleton-line--short" />
        </div>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="wb-students__error" data-testid="students-error" role="alert">
      <p>{{ error }}</p>
      <button class="wb-students__retry" :aria-label="t('common.retry')" @click="fetchStudents">
        {{ t('common.retry') }}
      </button>
    </div>

    <!-- Empty state -->
    <div v-else-if="students.length === 0" class="wb-students__empty" data-testid="students-empty">
      <p>{{ t('winterboard.students.noStudents') }}</p>
    </div>

    <!-- Students list -->
    <div v-else class="wb-students__list" data-testid="students-list">
      <div
        v-for="student in students"
        :key="student.id"
        class="wb-student-card"
        data-testid="student-card"
      >
        <img
          :src="student.avatar_url || '/default-avatar.svg'"
          :alt="student.display_name"
          class="wb-student-card__avatar"
          width="48"
          height="48"
        />
        <div class="wb-student-card__info">
          <h3 class="wb-student-card__name">{{ student.display_name }}</h3>
          <p v-if="student.last_session_at" class="wb-student-card__meta">
            {{ t('winterboard.students.lastSession') }}: {{ formatDate(student.last_session_at) }}
          </p>
          <p class="wb-student-card__meta">
            {{ t('winterboard.students.sessions', { count: student.sessions_count ?? 0 }) }}
          </p>
        </div>
        <button
          class="wb-student-card__action"
          data-testid="view-sessions"
          @click="viewStudentSessions(student)"
        >
          {{ t('winterboard.students.viewSessions') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// B17: WBStudents — list of tutor's students with session stats
// Ref: DAY19_AGENT-B.md

import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import apiClient from '@/utils/apiClient'

const { t } = useI18n()
const router = useRouter()

interface Student {
  id: string | number
  display_name: string
  avatar_url?: string
  last_session_at?: string
  sessions_count?: number
}

const students = ref<Student[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

async function fetchStudents(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const res = await apiClient.get('/classroom/my-students/', { params: { limit: 200 } })
    const data = res?.results ?? res ?? []
    students.value = data.map((s: any) => ({
      id: s.student_id ?? s.id,
      display_name: [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email || t('winterboard.students.unknown'),
      avatar_url: s.avatar_url || null,
      last_session_at: s.last_session_at || null,
      sessions_count: s.sessions_count ?? 0,
    }))
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('winterboard.students.loadError')
    console.error('[WB:Students] Failed to load students', e)
  } finally {
    loading.value = false
  }
}

function viewStudentSessions(student: Student): void {
  // Filter boards list by student
  router.push({
    name: 'winterboard-boards',
    query: { student: student.id.toString() },
  })
}

function formatDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('uk-UA')
}

onMounted(fetchStudents)
</script>

<style scoped>
.wb-students {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.wb-students__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wb-students__title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
  color: var(--wb-fg, #0f172a);
}

.wb-students__error {
  padding: 24px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fef2f2;
  color: #dc2626;
  display: flex;
  align-items: center;
  gap: 16px;
}

.wb-students__retry {
  padding: 6px 14px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

.wb-students__empty {
  padding: 48px;
  text-align: center;
  color: var(--wb-fg-secondary, #94a3b8);
  border: 2px dashed var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
}

.wb-students__loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wb-student-skeleton {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
}

.wb-student-skeleton__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wb-students__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wb-student-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--wb-card-bg, #fff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
  transition: box-shadow 0.15s;
}

.wb-student-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.wb-student-card__avatar {
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.wb-student-card__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wb-student-card__name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wb-student-card__meta {
  margin: 0;
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
}

.wb-student-card__action {
  flex-shrink: 0;
  padding: 6px 14px;
  background: none;
  color: var(--wb-brand, #0066ff);
  border: 1px solid var(--wb-brand, #0066ff);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition: background 0.1s, color 0.1s;
}

.wb-student-card__action:hover {
  background: var(--wb-brand, #0066ff);
  color: white;
}

.wb-skeleton-pulse {
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: wb-shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

.wb-skeleton-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  flex-shrink: 0;
}

.wb-skeleton-line { height: 13px; width: 60%; }
.wb-skeleton-line--short { width: 40%; height: 11px; }

@keyframes wb-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 640px) {
  .wb-students { padding: 20px 12px; }
  .wb-student-card { flex-wrap: wrap; }
  .wb-student-card__action { width: 100%; text-align: center; }
}
</style>
