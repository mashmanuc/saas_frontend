<!-- WB: Classroom Hub — командна панель тьютора/студента
     SPEC: Classroom Pages (Student + Teacher) — FINAL
     Teacher → primary = список учнів → detail → уроки
     Student → тьютори (якщо >1) → уроки
     Інваріанти: 1 lesson_id = 1 карточка, active зверху, час = primary -->
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
      <!-- ═══════════════════════════════════════════════════════════════
           TEACHER UI: Рівень 1 = Учні, Рівень 2 = Уроки учня
           ═══════════════════════════════════════════════════════════════ -->
      <template v-if="isTutor">
        <!-- Рівень 1: Список учнів (якщо учень НЕ обраний) -->
        <template v-if="!selectedPerson">
          <section class="wb-hub__section">
            <h2 class="wb-hub__section-title">
              {{ t('winterboard.classroomHub.myStudents') }}
            </h2>

            <div v-if="personList.length === 0" class="wb-hub__empty">
              <p>{{ t('winterboard.classroomHub.noStudents') }}</p>
            </div>

            <div v-else class="wb-hub__cards">
              <div
                v-for="person in personList"
                :key="person.id"
                class="wb-hub-card wb-hub-card--person"
                :class="{ 'wb-hub-card--has-active': person.hasActive }"
                @click="selectPerson(person)"
              >
                <div class="wb-hub-card__info">
                  <span class="wb-hub-card__person-name">{{ person.name }}</span>
                  <span class="wb-hub-card__meta">
                    <span v-if="person.hasActive" class="wb-hub-card__active-indicator">●</span>
                    {{ person.hasActive
                      ? t('winterboard.classroomHub.hasActiveLesson')
                      : t('winterboard.classroomHub.lastActivity', { time: formatRelativeDate(person.lastActivityAt) })
                    }}
                  </span>
                  <span class="wb-hub-card__lesson-count">
                    {{ person.lessonCount }} {{ t('winterboard.classroomHub.lessonsCount') }}
                  </span>
                </div>
                <span class="wb-hub-card__arrow">›</span>
              </div>
            </div>
          </section>

          <!-- Інструменти (тільки teacher, рівень 1) -->
          <section class="wb-hub__section">
            <h2 class="wb-hub__section-title">{{ t('winterboard.classroomHub.tools') }}</h2>
            <div class="wb-hub__tools">
              <router-link :to="{ name: 'winterboard-boards' }" class="wb-hub__tool-card wb-hub__tool-card--primary">
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

        <!-- Рівень 2: Уроки обраного учня -->
        <template v-else>
          <LessonsList
            :person="selectedPerson"
            :lessons="selectedPersonLessons"
            :is-tutor="true"
            :starting-id="startingId"
            :visible-count="visibleCount"
            @back="selectedPerson = null"
            @start="handleStart"
            @resume="handleResume"
            @show-more="visibleCount += PAGE_SIZE"
          />
        </template>
      </template>

      <!-- ═══════════════════════════════════════════════════════════════
           STUDENT UI: Якщо >1 тьютор → список тьюторів, інакше уроки
           ═══════════════════════════════════════════════════════════════ -->
      <template v-else>
        <!-- Multi-tutor: показуємо список тьюторів -->
        <template v-if="personList.length > 1 && !selectedPerson">
          <section class="wb-hub__section">
            <h2 class="wb-hub__section-title">
              {{ t('winterboard.classroomHub.myTutors') }}
            </h2>
            <div class="wb-hub__cards">
              <div
                v-for="person in personList"
                :key="person.id"
                class="wb-hub-card wb-hub-card--person"
                :class="{ 'wb-hub-card--has-active': person.hasActive }"
                @click="selectPerson(person)"
              >
                <div class="wb-hub-card__info">
                  <span class="wb-hub-card__person-name">{{ person.name }}</span>
                  <span class="wb-hub-card__meta">
                    <span v-if="person.hasActive" class="wb-hub-card__active-indicator">●</span>
                    {{ person.hasActive
                      ? t('winterboard.classroomHub.hasActiveLesson')
                      : t('winterboard.classroomHub.lastActivity', { time: formatRelativeDate(person.lastActivityAt) })
                    }}
                  </span>
                </div>
                <span class="wb-hub-card__arrow">›</span>
              </div>
            </div>
          </section>
        </template>

        <!-- Single tutor або вибраний тьютор → уроки -->
        <template v-else>
          <LessonsList
            :person="selectedPerson || personList[0] || null"
            :lessons="selectedPerson ? selectedPersonLessons : allLessonsDeduped"
            :is-tutor="false"
            :starting-id="startingId"
            :visible-count="visibleCount"
            :show-back="personList.length > 1"
            @back="selectedPerson = null"
            @start="handleStart"
            @resume="handleResume"
            @show-more="visibleCount += PAGE_SIZE"
          />
        </template>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'
import lessonsApi from '@/api/lessons'
import LessonsList from '../components/LessonsList.vue'

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

/** Контрагент (учень для teacher, тьютор для student) */
export interface PersonEntry {
  id: number
  name: string
  hasActive: boolean
  lastActivityAt: string
  lessonCount: number
}

// ─── Constants ────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

// ─── State ────────────────────────────────────────────────────────────────

const lessons = ref<ActiveLesson[]>([])
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const startingId = ref<number | null>(null)
const selectedPerson = ref<PersonEntry | null>(null)
const visibleCount = ref(PAGE_SIZE)

let refreshTimer: ReturnType<typeof setInterval> | null = null

// ─── Computed ─────────────────────────────────────────────────────────────

const isTutor = computed(() => (authStore.user as any)?.role === 'tutor')

/** Dedup по lesson_id — кожен lesson_id = 1 карточка */
const allLessonsDeduped = computed(() => {
  const seen = new Set<number>()
  return lessons.value.filter((l) => {
    if (seen.has(l.id)) return false
    seen.add(l.id)
    return true
  })
})

/** Список контрагентів (учні для teacher, тьютори для student) */
const personList = computed((): PersonEntry[] => {
  const map = new Map<number, { name: string; lessons: ActiveLesson[] }>()

  for (const lesson of allLessonsDeduped.value) {
    const personId = isTutor.value ? lesson.student_id : lesson.tutor_id
    const personName = isTutor.value ? lesson.student_name : lesson.tutor_name

    if (!map.has(personId)) {
      map.set(personId, { name: personName, lessons: [] })
    }
    map.get(personId)!.lessons.push(lesson)
  }

  const result: PersonEntry[] = []
  for (const [id, data] of map) {
    const hasActive = data.lessons.some((l) => l.status === 'IN_PROGRESS')
    const latestDate = data.lessons.reduce((latest, l) => {
      const d = l.started_at || l.start || ''
      return d > latest ? d : latest
    }, '')

    result.push({
      id,
      name: data.name,
      hasActive,
      lastActivityAt: latestDate,
      lessonCount: data.lessons.length,
    })
  }

  // Сортування: active зверху, потім за останньою активністю
  result.sort((a, b) => {
    if (a.hasActive !== b.hasActive) return a.hasActive ? -1 : 1
    return b.lastActivityAt.localeCompare(a.lastActivityAt)
  })

  return result
})

/** Уроки обраного контрагента */
const selectedPersonLessons = computed(() => {
  if (!selectedPerson.value) return []
  const personId = selectedPerson.value.id

  return allLessonsDeduped.value.filter((l) => {
    const id = isTutor.value ? l.student_id : l.tutor_id
    return id === personId
  })
})

// ─── Data Loading ─────────────────────────────────────────────────────────

async function loadAll(): Promise<void> {
  loading.value = true
  errorMsg.value = null
  try {
    await loadLessons()
  } finally {
    loading.value = false
  }
}

async function loadLessons(silent = false): Promise<void> {
  try {
    // Завантажуємо паралельно: активні (DRAFT/SCHEDULED/CONFIRMED/IN_PROGRESS) + завершені (COMPLETED)
    const [activeRes, completedRes] = await Promise.all([
      lessonsApi.getActiveLessons({}, { silent }),
      lessonsApi.getActiveLessons({ status: 'COMPLETED' }, { silent }),
    ])

    const activeItems = ((activeRes as any).data?.results ?? (activeRes as any).results ?? []) as ActiveLesson[]
    const completedItems = ((completedRes as any).data?.results ?? (completedRes as any).results ?? []) as ActiveLesson[]

    // Merge: активні мають пріоритет (dedup по id)
    const seen = new Set<number>()
    const incoming: ActiveLesson[] = []
    for (const l of [...activeItems, ...completedItems]) {
      if (!seen.has(l.id)) {
        seen.add(l.id)
        incoming.push(l)
      }
    }

    // Smart merge: оновлюємо тільки якщо змінилось
    if (silent && lessons.value.length > 0) {
      const oldMap = new Map(lessons.value.map((l) => [l.id, l]))
      const changed =
        incoming.length !== lessons.value.length ||
        incoming.some((l) => {
          const old = oldMap.get(l.id)
          return (
            !old ||
            old.status !== l.status ||
            old.tutor_is_online !== l.tutor_is_online ||
            old.started_at !== l.started_at
          )
        })
      if (!changed) return
    }

    lessons.value = incoming
  } catch (err) {
    if (!silent) {
      errorMsg.value = t('winterboard.classroomHub.loadError')
    }
    console.error('[WB:Hub] loadLessons failed', err)
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────

function selectPerson(person: PersonEntry): void {
  selectedPerson.value = person
  visibleCount.value = PAGE_SIZE
}

async function handleStart(lesson: ActiveLesson): Promise<void> {
  if (startingId.value) return
  startingId.value = lesson.id
  try {
    const res = await lessonsApi.startSession(lesson.id)
    const roomUrl = (res as any).data?.room_url ?? res.room_url
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

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatRelativeDate(iso: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)

    if (diffMin < 1) return t('winterboard.classroomHub.justNow')
    if (diffMin < 60) return `${diffMin} ${t('winterboard.classroomHub.minutesAgo')}`

    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours} ${t('winterboard.classroomHub.hoursAgo')}`

    return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
  } catch {
    return iso
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────

onMounted(() => {
  loadAll()
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

/* ── Person card (student/tutor) ──────────────────────────────────────── */

.wb-hub-card--person {
  cursor: pointer;
}

.wb-hub-card--has-active {
  border-left: 4px solid #22c55e;
}

.wb-hub-card__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.wb-hub-card__person-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
}

.wb-hub-card__meta {
  font-size: 13px;
  color: var(--wb-fg-secondary, #94a3b8);
  display: flex;
  align-items: center;
  gap: 6px;
}

.wb-hub-card__active-indicator {
  color: #22c55e;
  font-size: 10px;
}

.wb-hub-card__lesson-count {
  font-size: 12px;
  color: var(--wb-fg-secondary, #b0bec5);
}

.wb-hub-card__arrow {
  font-size: 24px;
  color: var(--wb-fg-secondary, #94a3b8);
  flex-shrink: 0;
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
    gap: 12px;
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
