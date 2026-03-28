<!-- WB: Classroom Hub — командна панель тьютора/студента для входу в уроки
     Ref: docs/lesson_session/CLASSROOM_ENTRY_PLAN.md
     Секції: "Зараз проводжу" + "Готові до початку" + "Провести з шаблону" + "Інструменти" -->
<template>
  <div class="wb-hub">
    <!-- Header -->
    <header class="wb-hub__header">
      <div>
        <h1 class="wb-hub__title">{{ t('winterboard.classroomHub.title') }}</h1>
        <p class="wb-hub__subtitle">{{ t('winterboard.classroomHub.subtitle') }}</p>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="wb-hub__loading" aria-busy="true">
      <div v-for="i in 3" :key="i" class="wb-hub-card wb-hub-card--skeleton">
        <div class="wb-skeleton-pulse wb-skeleton-bar" />
        <div class="wb-skeleton-pulse wb-skeleton-bar wb-skeleton-bar--short" />
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="errorMsg" class="wb-hub__error">
      <p>{{ errorMsg }}</p>
      <button class="wb-hub__retry-btn" @click="loadAll">{{ t('common.retry') }}</button>
    </div>

    <template v-else>
      <!-- Секція: Зараз проводжу / Активні уроки (IN_PROGRESS) -->
      <section v-if="activeLessons.length > 0" class="wb-hub__section">
        <h2 class="wb-hub__section-title">
          <span class="wb-hub__dot wb-hub__dot--active" />
          {{ isTutor ? t('winterboard.classroomHub.activeSection') : t('winterboard.classroomHub.activeSectionStudent') }}
        </h2>
        <div class="wb-hub__cards">
          <div
            v-for="lesson in activeLessons"
            :key="lesson.id"
            class="wb-hub-card wb-hub-card--active"
            :class="{ 'wb-hub-card--tutor-waiting': !isTutor && lesson.tutor_is_online }"
          >
            <div class="wb-hub-card__info">
              <span class="wb-hub-card__title">{{ lesson.title }}</span>
              <span class="wb-hub-card__student">
                {{ isTutor ? lesson.student_name : lesson.tutor_name }}
              </span>
              <span v-if="!isTutor && lesson.tutor_is_online" class="wb-hub-card__live-badge">
                <span class="wb-hub-card__live-dot" />
                {{ t('winterboard.classroomHub.tutorWaiting') }}
              </span>
              <span v-else-if="lesson.started_at" class="wb-hub-card__meta">
                {{ t('winterboard.classroomHub.startedAt', { time: formatTime(lesson.started_at) }) }}
              </span>
            </div>
            <button
              class="wb-hub-card__btn"
              :class="!isTutor && lesson.tutor_is_online ? 'wb-hub-card__btn--join-now' : 'wb-hub-card__btn--resume'"
              @click="handleResume(lesson)"
            >
              {{ isTutor ? t('winterboard.classroomHub.resumeLesson') : (lesson.tutor_is_online ? t('winterboard.classroomHub.joinNow') : t('winterboard.classroomHub.joinLesson')) }}
            </button>
          </div>
        </div>
      </section>

      <!-- Секція: Готові до початку (DRAFT / SCHEDULED / CONFIRMED) -->
      <section class="wb-hub__section">
        <h2 class="wb-hub__section-title">
          {{ t('winterboard.classroomHub.readySection') }}
        </h2>

        <div v-if="readyLessons.length === 0" class="wb-hub__empty">
          <p>{{ t('winterboard.classroomHub.noReadyLessons') }}</p>
        </div>

        <div v-else class="wb-hub__cards">
          <div
            v-for="lesson in readyLessons"
            :key="lesson.id"
            class="wb-hub-card"
          >
            <div class="wb-hub-card__info">
              <span class="wb-hub-card__title">{{ lesson.title }}</span>
              <span class="wb-hub-card__student">
                {{ isTutor ? lesson.student_name : lesson.tutor_name }}
              </span>
              <span v-if="lesson.start" class="wb-hub-card__meta">
                {{ t('winterboard.classroomHub.scheduled', { time: formatDateTime(lesson.start) }) }}
              </span>
            </div>
            <button
              v-if="isTutor"
              class="wb-hub-card__btn wb-hub-card__btn--start"
              :disabled="startingId === lesson.id"
              @click="handleStart(lesson)"
            >
              {{ startingId === lesson.id ? '...' : t('winterboard.classroomHub.startLesson') }}
            </button>
            <span v-else class="wb-hub-card__status">
              {{ t('winterboard.classroomHub.waitingForTutor') }}
            </span>
          </div>
        </div>
      </section>

      <!-- Секція: Провести з шаблону (тільки тьютор) -->
      <section v-if="isTutor && templates.length > 0" class="wb-hub__section">
        <h2 class="wb-hub__section-title">
          {{ t('winterboard.classroomHub.fromTemplate') }}
        </h2>

        <!-- Компактна форма: шаблон + студент → Провести -->
        <div v-if="!showTemplateForm" class="wb-hub__cards">
          <div
            v-for="tpl in templates"
            :key="tpl.id"
            class="wb-hub-card wb-hub-card--template"
          >
            <div class="wb-hub-card__info">
              <span class="wb-hub-card__title">{{ tpl.title || `Шаблон #${tpl.id}` }}</span>
              <span class="wb-hub-card__meta">{{ tpl.subject || tpl.lesson_type }}</span>
            </div>
            <button
              class="wb-hub-card__btn wb-hub-card__btn--template"
              @click="openTemplateForm(tpl)"
            >
              {{ t('winterboard.classroomHub.conductLesson') }}
            </button>
          </div>
        </div>

        <!-- Розгорнута форма: обраний шаблон + вибір студента -->
        <div v-if="showTemplateForm" class="wb-hub__template-form">
          <div class="wb-hub__template-form-header">
            <div>
              <span class="wb-hub-card__title">{{ selectedTemplate?.title }}</span>
              <span class="wb-hub-card__meta">{{ selectedTemplate?.subject }}</span>
            </div>
            <button class="wb-hub__template-form-close" @click="closeTemplateForm">
              &times;
            </button>
          </div>

          <label class="wb-hub__label">
            {{ t('winterboard.classroomHub.selectStudent') }}
          </label>
          <select
            v-model="selectedStudentId"
            class="wb-hub__select"
          >
            <option :value="null" disabled>
              {{ t('winterboard.classroomHub.chooseStudent') }}
            </option>
            <option
              v-for="s in students"
              :key="s.id"
              :value="s.id"
            >
              {{ s.name }}
            </option>
          </select>

          <button
            class="wb-hub-card__btn wb-hub-card__btn--start wb-hub__template-form-submit"
            :disabled="!selectedStudentId || conductingTemplate"
            @click="handleConductFromTemplate"
          >
            {{ conductingTemplate ? '...' : t('winterboard.classroomHub.startLesson') }}
          </button>
        </div>
      </section>

      <!-- Секція: Інструменти -->
      <section v-if="isTutor" class="wb-hub__section">
        <h2 class="wb-hub__section-title">{{ t('winterboard.classroomHub.tools') }}</h2>
        <div class="wb-hub__tools">
          <router-link :to="{ name: 'winterboard-new' }" class="wb-hub__tool-card wb-hub__tool-card--primary">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span>{{ t('winterboard.classroomHub.newBoard') }}</span>
          </router-link>
          <router-link :to="{ name: 'winterboard-library' }" class="wb-hub__tool-card">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 19V7a2 2 0 012-2h12a2 2 0 012 2v12" stroke="currentColor" stroke-width="1.5"/>
              <path d="M4 19h16M9 7v12M15 7v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>{{ t('winterboard.dashboard.library') }}</span>
          </router-link>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'
import lessonsApi from '@/api/lessons'
import { lessonsTemplateApi } from '@/modules/lessons/api/lessonsTemplateApi'
import { ordersApi } from '@/modules/booking/api/ordersApi'
import type { Order } from '@/modules/booking/api/ordersApi'

// ─── Composables ──────────────────────────────────────────────────────────

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

// ─── Types ────────────────────────────────────────────────────────────────

interface ActiveLesson {
  id: number
  title: string
  student_name: string
  student_id: number
  tutor_name: string
  tutor_id: number
  start: string | null
  end: string | null
  started_at: string | null
  status: string
  lesson_type: string
  has_session: boolean
  can_start: boolean
  tutor_is_online: boolean
}

interface TemplateSummary {
  id: number
  title: string
  subject?: string
  lesson_type?: string
}

interface StudentOption {
  id: number
  name: string
}

// ─── State ────────────────────────────────────────────────────────────────

const lessons = ref<ActiveLesson[]>([])
const templates = ref<TemplateSummary[]>([])
const students = ref<StudentOption[]>([])
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const startingId = ref<number | null>(null)

// Template form state
const showTemplateForm = ref(false)
const selectedTemplate = ref<TemplateSummary | null>(null)
const selectedStudentId = ref<number | null>(null)
const conductingTemplate = ref(false)

let refreshTimer: ReturnType<typeof setInterval> | null = null

// ─── Computed ─────────────────────────────────────────────────────────────

const isTutor = computed(() => (authStore.user as any)?.role === 'tutor')

const activeLessons = computed(() =>
  lessons.value.filter((l) => l.status === 'IN_PROGRESS'),
)

const readyLessons = computed(() => {
  if (isTutor.value) {
    // Тьютор бачить все, що може стартанути (DRAFT, SCHEDULED, CONFIRMED)
    return lessons.value.filter((l) => l.can_start)
  }
  // Студент бачить тільки SCHEDULED/CONFIRMED — DRAFT = внутрішня кухня тьютора
  return lessons.value.filter((l) =>
    l.status === 'SCHEDULED' || l.status === 'CONFIRMED',
  )
})

// ─── Data Loading ─────────────────────────────────────────────────────────

async function loadAll(): Promise<void> {
  loading.value = true
  errorMsg.value = null
  try {
    await Promise.all([loadLessons(), loadTemplates(), loadStudents()])
  } catch {
    // individual loaders handle their own errors
  } finally {
    loading.value = false
  }
}

async function loadLessons(silent = false): Promise<void> {
  try {
    const res = await lessonsApi.getActiveLessons({}, { silent })
    const incoming = (res.data?.results ?? res.results ?? []) as ActiveLesson[]

    // Smart merge: оновлюємо тільки те, що змінилось (уникаємо re-render flash)
    if (silent && lessons.value.length > 0) {
      const oldMap = new Map(lessons.value.map(l => [l.id, l]))
      const changed = incoming.length !== lessons.value.length
        || incoming.some(l => {
          const old = oldMap.get(l.id)
          return !old
            || old.status !== l.status
            || old.tutor_is_online !== l.tutor_is_online
            || old.started_at !== l.started_at
        })
      if (!changed) return  // нічого не змінилось — не чіпаємо DOM
    }

    lessons.value = incoming
  } catch (err) {
    // На background refresh не показуємо error — тільки логуємо
    if (!silent) {
      errorMsg.value = t('winterboard.classroomHub.loadError')
    }
    console.error('[WB:Hub] loadLessons failed', err)
  }
}

async function loadTemplates(): Promise<void> {
  if (!isTutor.value) return
  try {
    const res = await lessonsTemplateApi.getTemplates()
    const data = (res as any)?.data ?? res
    const list = Array.isArray(data) ? data : (data?.results ?? [])
    templates.value = list.map((t: any) => ({
      id: t.id,
      title: t.title,
      subject: t.subject,
      lesson_type: t.lesson_type,
    }))
  } catch (err) {
    console.error('[WB:Hub] loadTemplates failed', err)
    // не блокуємо — шаблони optional
  }
}

async function loadStudents(): Promise<void> {
  if (!isTutor.value) return
  try {
    const res = await ordersApi.listOrders()
    const orders: Order[] = res.results ?? []
    // Унікальні студенти з Orders
    const seen = new Set<number>()
    students.value = orders
      .filter((o) => {
        if (seen.has(o.student.id)) return false
        seen.add(o.student.id)
        return true
      })
      .map((o) => ({
        id: o.student.id,
        name: o.student.fullName || `${o.student.firstName} ${o.student.lastName}`.trim() || o.student.email,
      }))
  } catch (err) {
    console.error('[WB:Hub] loadStudents failed', err)
  }
}

// ─── Lesson Actions ───────────────────────────────────────────────────────

async function handleStart(lesson: ActiveLesson): Promise<void> {
  if (startingId.value) return
  startingId.value = lesson.id
  try {
    const res = await lessonsApi.startSession(lesson.id)
    const roomUrl = res.data?.room_url ?? res.room_url
    if (roomUrl) {
      router.push(roomUrl)
    }
  } catch (err) {
    console.error('[WB:Hub] startSession failed', err)
    errorMsg.value = t('winterboard.classroomHub.startError')
  } finally {
    startingId.value = null
  }
}

async function handleResume(lesson: ActiveLesson): Promise<void> {
  router.push(`/winterboard/classroom/${lesson.id}`)
}

// ─── Template Actions ─────────────────────────────────────────────────────

function openTemplateForm(tpl: TemplateSummary): void {
  selectedTemplate.value = tpl
  selectedStudentId.value = null
  showTemplateForm.value = true
}

function closeTemplateForm(): void {
  showTemplateForm.value = false
  selectedTemplate.value = null
  selectedStudentId.value = null
}

async function handleConductFromTemplate(): Promise<void> {
  if (!selectedTemplate.value || !selectedStudentId.value || conductingTemplate.value) return
  conductingTemplate.value = true

  try {
    // Крок 1: Створити Lesson з шаблону (час = зараз, тривалість 60 хв)
    const now = new Date()
    const end = new Date(now.getTime() + 60 * 60 * 1000)

    const createRes = await lessonsTemplateApi.createLessonFromTemplate(
      selectedTemplate.value.id,
      {
        student_id: selectedStudentId.value,
        start: now.toISOString(),
        end: end.toISOString(),
      },
    )

    const lessonId = (createRes as any)?.data?.lesson_id ?? (createRes as any)?.lesson_id
    if (!lessonId) {
      throw new Error('lesson_id not returned')
    }

    // Крок 2: Почати урок (start-session)
    const startRes = await lessonsApi.startSession(lessonId)
    const roomUrl = (startRes as any)?.data?.room_url ?? (startRes as any)?.room_url

    // Крок 3: Перехід у дошку
    if (roomUrl) {
      router.push(roomUrl)
    } else {
      router.push(`/winterboard/classroom/${lessonId}`)
    }
  } catch (err: any) {
    console.error('[WB:Hub] conductFromTemplate failed', err)
    const detail = err?.response?.data?.detail || err?.response?.data?.error || err?.message
    errorMsg.value = detail || t('winterboard.classroomHub.startError')
  } finally {
    conductingTemplate.value = false
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    if (isToday) {
      return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }) +
      ' ' + d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────

onMounted(() => {
  loadAll()
  // Тихе оновлення уроків кожні 15 секунд (без loader/error flash)
  refreshTimer = setInterval(() => loadLessons(true), 15_000)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<style scoped>
.wb-hub {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* ── Header ──────────────────────────────────────────────────────────── */

.wb-hub__title {
  font-size: 28px;
  font-weight: 700;
  color: var(--wb-fg, #0f172a);
  margin: 0 0 4px;
}

.wb-hub__subtitle {
  font-size: 14px;
  color: var(--wb-fg-secondary, #94a3b8);
  margin: 0;
}

/* ── Section ─────────────────────────────────────────────────────────── */

.wb-hub__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wb-hub__section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.wb-hub__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.wb-hub__dot--active {
  background: #22c55e;
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.4);
}

/* ── Cards ────────────────────────────────────────────────────────────── */

.wb-hub__cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wb-hub-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  background: var(--wb-card-bg, #ffffff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 12px;
  transition: border-color 0.15s;
}

.wb-hub-card:hover {
  border-color: var(--wb-brand, #0066ff);
}

.wb-hub-card--active {
  border-left: 4px solid #22c55e;
}

.wb-hub-card--tutor-waiting {
  border-left: 4px solid #f59e0b;
  background: linear-gradient(135deg, #fffbeb 0%, #ffffff 100%);
  border-color: #f59e0b;
  box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.2), 0 4px 12px rgba(245, 158, 11, 0.1);
  animation: wb-pulse-border 2s ease-in-out infinite;
}

@keyframes wb-pulse-border {
  0%, 100% { box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.2), 0 4px 12px rgba(245, 158, 11, 0.1); }
  50% { box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.3), 0 4px 16px rgba(245, 158, 11, 0.2); }
}

.wb-hub-card--template {
  border-left: 4px solid #8b5cf6;
}

.wb-hub-card__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.wb-hub-card__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wb-hub-card__student {
  font-size: 13px;
  color: var(--wb-fg-secondary, #64748b);
}

.wb-hub-card__meta {
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
}

.wb-hub-card__status {
  font-size: 13px;
  color: var(--wb-fg-secondary, #94a3b8);
  white-space: nowrap;
}

.wb-hub-card__live-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #d97706;
}

.wb-hub-card__live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f59e0b;
  animation: wb-live-pulse 1.5s ease-in-out infinite;
}

@keyframes wb-live-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.3); }
}

/* ── Buttons ─────────────────────────────────────────────────────────── */

.wb-hub-card__btn {
  flex-shrink: 0;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
  white-space: nowrap;
}

.wb-hub-card__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.wb-hub-card__btn--start {
  background: var(--wb-brand, #0066ff);
  color: #fff;
}

.wb-hub-card__btn--start:hover:not(:disabled) {
  background: var(--wb-brand-hover, #0052cc);
}

.wb-hub-card__btn--resume {
  background: #22c55e;
  color: #fff;
}

.wb-hub-card__btn--resume:hover {
  background: #16a34a;
}

.wb-hub-card__btn--join-now {
  background: #f59e0b;
  color: #fff;
  font-size: 14px;
  padding: 10px 24px;
  animation: wb-btn-glow 2s ease-in-out infinite;
}

.wb-hub-card__btn--join-now:hover {
  background: #d97706;
}

@keyframes wb-btn-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
  50% { box-shadow: 0 0 12px 4px rgba(245, 158, 11, 0.3); }
}

.wb-hub-card__btn--template {
  background: #8b5cf6;
  color: #fff;
}

.wb-hub-card__btn--template:hover {
  background: #7c3aed;
}

/* ── Template Form ───────────────────────────────────────────────────── */

.wb-hub__template-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: var(--wb-card-bg, #ffffff);
  border: 2px solid #8b5cf6;
  border-radius: 12px;
}

.wb-hub__template-form-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.wb-hub__template-form-close {
  background: none;
  border: none;
  font-size: 22px;
  color: var(--wb-fg-secondary, #94a3b8);
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.wb-hub__template-form-close:hover {
  color: var(--wb-fg, #0f172a);
}

.wb-hub__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--wb-fg, #0f172a);
}

.wb-hub__select {
  padding: 8px 12px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 8px;
  font-size: 14px;
  color: var(--wb-fg, #0f172a);
  background: var(--wb-card-bg, #ffffff);
  width: 100%;
}

.wb-hub__select:focus {
  outline: 2px solid var(--wb-brand, #0066ff);
  outline-offset: -1px;
}

.wb-hub__template-form-submit {
  align-self: flex-start;
  margin-top: 4px;
}

/* ── Tools ────────────────────────────────────────────────────────────── */

.wb-hub__tools {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.wb-hub__tool-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 16px;
  background: var(--wb-card-bg, #ffffff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 12px;
  text-decoration: none;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  color: var(--wb-fg, #0f172a);
  font-size: 13px;
  font-weight: 600;
}

.wb-hub__tool-card:hover {
  border-color: var(--wb-brand, #0066ff);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.wb-hub__tool-card--primary {
  background: var(--wb-brand, #0066ff);
  border-color: var(--wb-brand, #0066ff);
  color: #fff;
}

.wb-hub__tool-card--primary:hover {
  background: var(--wb-brand-hover, #0052cc);
  box-shadow: 0 4px 12px rgba(0, 102, 255, 0.2);
}

/* ── Empty / Error / Loading ──────────────────────────────────────────── */

.wb-hub__empty {
  padding: 24px;
  border: 2px dashed var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
  font-size: 14px;
  color: var(--wb-fg-secondary, #94a3b8);
}

.wb-hub__empty p {
  margin: 0;
}

.wb-hub__error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 24px;
  border: 1px solid #fca5a5;
  border-radius: 10px;
  background: #fef2f2;
  color: #b91c1c;
}

.wb-hub__error p {
  margin: 0;
}

.wb-hub__retry-btn {
  padding: 6px 16px;
  border: 1px solid #b91c1c;
  border-radius: 6px;
  background: transparent;
  color: #b91c1c;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.wb-hub__loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Skeleton ─────────────────────────────────────────────────────────── */

.wb-hub-card--skeleton {
  pointer-events: none;
  padding: 20px;
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

.wb-skeleton-bar {
  height: 16px;
  width: 60%;
  margin-bottom: 8px;
}

.wb-skeleton-bar--short {
  width: 35%;
  height: 12px;
}

@keyframes wb-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Responsive ───────────────────────────────────────────────────────── */

@media (max-width: 768px) {
  .wb-hub {
    padding: 20px 12px;
    gap: 24px;
  }

  .wb-hub__title {
    font-size: 22px;
  }

  .wb-hub__tools {
    grid-template-columns: 1fr;
  }

  .wb-hub-card {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .wb-hub-card__btn {
    width: 100%;
    text-align: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wb-hub-card,
  .wb-hub__tool-card {
    transition: none;
  }

  .wb-skeleton-pulse {
    animation: none;
  }
}
</style>
