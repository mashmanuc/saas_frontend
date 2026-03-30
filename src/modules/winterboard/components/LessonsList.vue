<!-- LessonsList — Рівень 2: список уроків контрагента
     Інваріанти:
     - 1 lesson_id = 1 карточка (dedup)
     - Active lesson зверху, НЕ дублюється в history
     - Час = primary UI, title = secondary
     - Групування: Сьогодні / Вчора / Цей тиждень / Старіше
     - Пагінація: limit + "Показати ще" -->
<template>
  <div class="lessons-list">
    <!-- Back button -->
    <button v-if="showBack" class="lessons-list__back" @click="$emit('back')">
      ‹ {{ t('winterboard.classroomHub.backToList') }}
    </button>

    <!-- Person header -->
    <div v-if="person" class="lessons-list__person-header">
      <span class="lessons-list__person-name">{{ person.name }}</span>
      <span class="lessons-list__person-count">
        {{ person.lessonCount }} {{ t('winterboard.classroomHub.lessonsCount') }}
      </span>
    </div>

    <!-- ═══ Active Lesson (max 1, pinned) ═══ -->
    <section v-if="activeLesson" class="lessons-list__section">
      <h3 class="lessons-list__section-title lessons-list__section-title--active">
        <span class="lessons-list__dot lessons-list__dot--active" />
        {{ t('winterboard.classroomHub.continueLesson') }}
      </h3>
      <div class="lessons-list__card lessons-list__card--active">
        <div class="lessons-list__card-main">
          <span class="lessons-list__time lessons-list__time--active">
            {{ formatTime(activeLesson.started_at || activeLesson.start) }}
          </span>
          <span class="lessons-list__title">{{ activeLesson.title }}</span>
          <span class="lessons-list__subtitle">
            {{ isTutor ? activeLesson.student_name : activeLesson.tutor_name }}
          </span>
        </div>
        <div class="lessons-list__actions">
          <button class="lessons-list__btn lessons-list__btn--resume" @click="$emit('resume', activeLesson)">
            {{ t('winterboard.classroomHub.resumeLesson') }}
          </button>
        </div>
      </div>
    </section>

    <!-- ═══ History (grouped by time) ═══ -->
    <section v-if="historyGroups.length > 0" class="lessons-list__section">
      <h3 class="lessons-list__section-title">
        {{ t('winterboard.classroomHub.history') }}
      </h3>

      <template v-for="group in visibleHistoryGroups" :key="group.label">
        <div class="lessons-list__time-group-label">{{ group.label }}</div>
        <div
          v-for="lesson in group.lessons"
          :key="lesson.id"
          class="lessons-list__card"
        >
          <div class="lessons-list__card-main">
            <span class="lessons-list__time">
              {{ formatTime(lesson.started_at || lesson.start) }}
            </span>
            <span class="lessons-list__title">{{ lesson.title }}</span>
            <span v-if="!isTutor" class="lessons-list__subtitle">
              {{ lesson.tutor_name }}
            </span>
          </div>
          <div class="lessons-list__actions">
            <!-- IN_PROGRESS уроки — кнопка "Продовжити" -->
            <button
              v-if="lesson.status === 'IN_PROGRESS'"
              class="lessons-list__btn lessons-list__btn--resume"
              @click="$emit('resume', lesson)"
            >
              {{ t('winterboard.classroomHub.resumeLesson') }}
            </button>
            <!-- Тьютор може почати запланований урок -->
            <button
              v-else-if="isTutor && lesson.can_start"
              class="lessons-list__btn lessons-list__btn--start"
              :disabled="startingId === lesson.id"
              @click="$emit('start', lesson)"
            >
              {{ startingId === lesson.id ? '...' : t('winterboard.classroomHub.startLesson') }}
            </button>
            <!-- Урок з сесією — відкрити -->
            <button
              v-else-if="lesson.has_session"
              class="lessons-list__btn lessons-list__btn--open"
              @click="$emit('resume', lesson)"
            >
              {{ t('winterboard.classroomHub.openLesson') }}
            </button>
            <span v-else class="lessons-list__status">
              {{ statusLabel(lesson.status) }}
            </span>
          </div>
        </div>
      </template>

      <!-- "Показати ще" -->
      <button
        v-if="hasMore"
        class="lessons-list__show-more"
        @click="$emit('show-more')"
      >
        {{ t('winterboard.classroomHub.showMore') }}
      </button>
    </section>

    <!-- Empty state -->
    <div v-if="!activeLesson && historyGroups.length === 0" class="lessons-list__empty">
      <p>{{ t('winterboard.classroomHub.noLessonsYet') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PersonEntry } from '../views/WBClassroomHub.vue'

const { t } = useI18n()

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

interface TimeGroup {
  label: string
  lessons: ActiveLesson[]
}

const props = defineProps<{
  person: PersonEntry | null
  lessons: ActiveLesson[]
  isTutor: boolean
  startingId: number | null
  visibleCount: number
  showBack?: boolean
}>()

defineEmits<{
  back: []
  start: [lesson: ActiveLesson]
  resume: [lesson: ActiveLesson]
  'show-more': []
}>()

// ─── Active Lesson (max 1) ───────────────────────────────────────────────

const activeLesson = computed(() =>
  props.lessons.find((l) => l.status === 'IN_PROGRESS') ?? null,
)

// ─── History (all except active, grouped by time) ────────────────────────
// Фільтруємо по ID активного уроку, а НЕ по статусу — бо може бути
// багато уроків зі статусом IN_PROGRESS (тьютор почав але не завершив)

const historyLessons = computed(() => {
  const activeId = activeLesson.value?.id ?? null
  return props.lessons
    .filter((l) => l.id !== activeId)
    .sort((a, b) => {
      const dateA = a.started_at || a.start || ''
      const dateB = b.started_at || b.start || ''
      return dateB.localeCompare(dateA) // найновіші зверху
    })
})

const historyGroups = computed((): TimeGroup[] => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const groups: Record<string, ActiveLesson[]> = {}
  const order: string[] = []

  for (const lesson of historyLessons.value) {
    const dateStr = lesson.started_at || lesson.start || ''
    const d = dateStr ? new Date(dateStr) : null
    let label: string

    if (!d || isNaN(d.getTime())) {
      label = t('winterboard.classroomHub.older')
    } else if (d >= today) {
      label = t('winterboard.classroomHub.today')
    } else if (d >= yesterday) {
      label = t('winterboard.classroomHub.yesterday')
    } else if (d >= weekAgo) {
      label = t('winterboard.classroomHub.thisWeek')
    } else {
      label = t('winterboard.classroomHub.older')
    }

    if (!groups[label]) {
      groups[label] = []
      order.push(label)
    }
    groups[label].push(lesson)
  }

  return order.map((label) => ({ label, lessons: groups[label] }))
})

/** Видимі групи з урахуванням пагінації */
const visibleHistoryGroups = computed((): TimeGroup[] => {
  let remaining = props.visibleCount
  const result: TimeGroup[] = []

  for (const group of historyGroups.value) {
    if (remaining <= 0) break
    const visibleLessons = group.lessons.slice(0, remaining)
    result.push({ label: group.label, lessons: visibleLessons })
    remaining -= visibleLessons.length
  }

  return result
})

const totalHistoryCount = computed(() =>
  historyGroups.value.reduce((sum, g) => sum + g.lessons.length, 0),
)

const hasMore = computed(() => totalHistoryCount.value > props.visibleCount)

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) {
      return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
    }
    return (
      d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }) +
      ' ' +
      d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
    )
  } catch {
    return '—'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'SCHEDULED':
    case 'CONFIRMED':
      return t('winterboard.classroomHub.scheduled', { time: '' }).trim()
    case 'COMPLETED':
      return t('winterboard.classroomHub.completed')
    case 'DRAFT':
      return t('winterboard.classroomHub.draft')
    default:
      return status
  }
}
</script>

<style scoped>
.lessons-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── Back ─────────────────────────────────────────────────────────────── */

.lessons-list__back {
  align-self: flex-start;
  background: none;
  border: none;
  color: var(--wb-brand, #0066ff);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 0;
}

.lessons-list__back:hover {
  text-decoration: underline;
}

/* ── Person header ────────────────────────────────────────────────────── */

.lessons-list__person-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.lessons-list__person-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--wb-fg, #0f172a);
}

.lessons-list__person-count {
  font-size: 13px;
  color: var(--wb-fg-secondary, #94a3b8);
}

/* ── Section ──────────────────────────────────────────────────────────── */

.lessons-list__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lessons-list__section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--wb-fg-secondary, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.lessons-list__section-title--active {
  color: #22c55e;
}

.lessons-list__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.lessons-list__dot--active {
  background: #22c55e;
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.4);
}

/* ── Time group label ─────────────────────────────────────────────────── */

.lessons-list__time-group-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-fg-secondary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 8px 0 4px;
  margin-top: 4px;
}

/* ── Card ─────────────────────────────────────────────────────────────── */

.lessons-list__card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px;
  background: var(--wb-card-bg, #ffffff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 12px;
  transition: border-color 0.15s;
}

.lessons-list__card:hover {
  border-color: var(--wb-brand, #0066ff);
}

.lessons-list__card--active {
  border-left: 4px solid #22c55e;
  background: linear-gradient(135deg, #f0fdf4 0%, var(--wb-card-bg, #ffffff) 100%);
}

.lessons-list__card-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

/* Час = primary UI */
.lessons-list__time {
  font-size: 15px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
}

.lessons-list__time--active {
  font-size: 18px;
  font-weight: 700;
  color: #16a34a;
}

/* Title = secondary */
.lessons-list__title {
  font-size: 14px;
  font-weight: 500;
  color: var(--wb-fg, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Tutor/Student = tertiary */
.lessons-list__subtitle {
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
}

/* ── Actions ──────────────────────────────────────────────────────────── */

.lessons-list__actions {
  flex-shrink: 0;
}

.lessons-list__btn {
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
  white-space: nowrap;
}

.lessons-list__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.lessons-list__btn--resume {
  background: #22c55e;
  color: #fff;
}

.lessons-list__btn--resume:hover:not(:disabled) {
  background: #16a34a;
}

.lessons-list__btn--start {
  background: var(--wb-brand, #0066ff);
  color: #fff;
}

.lessons-list__btn--start:hover:not(:disabled) {
  background: var(--wb-brand-hover, #0052cc);
}

.lessons-list__btn--open {
  background: var(--wb-card-bg, #ffffff);
  color: var(--wb-brand, #0066ff);
  border: 1px solid var(--wb-brand, #0066ff);
}

.lessons-list__btn--open:hover {
  background: var(--wb-brand, #0066ff);
  color: #fff;
}

.lessons-list__status {
  font-size: 13px;
  color: var(--wb-fg-secondary, #94a3b8);
  white-space: nowrap;
}

/* ── Show more ────────────────────────────────────────────────────────── */

.lessons-list__show-more {
  align-self: center;
  margin-top: 8px;
  padding: 8px 24px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 8px;
  background: var(--wb-card-bg, #ffffff);
  color: var(--wb-fg, #0f172a);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s;
}

.lessons-list__show-more:hover {
  border-color: var(--wb-brand, #0066ff);
  color: var(--wb-brand, #0066ff);
}

/* ── Empty ─────────────────────────────────────────────────────────────── */

.lessons-list__empty {
  padding: 24px;
  border: 2px dashed var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
  font-size: 14px;
  color: var(--wb-fg-secondary, #94a3b8);
  text-align: center;
}

.lessons-list__empty p {
  margin: 0;
}

/* ── Responsive ───────────────────────────────────────────────────────── */

@media (max-width: 768px) {
  .lessons-list__card {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .lessons-list__actions {
    align-self: stretch;
  }

  .lessons-list__btn {
    width: 100%;
    text-align: center;
  }

  .lessons-list__person-name {
    font-size: 18px;
  }
}
</style>
