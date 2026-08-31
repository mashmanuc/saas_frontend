<template>
  <div class="course-list">
    <div class="course-list__head">
      <h2>{{ t('lessonConstructor.courses.listTitle') }}</h2>
      <button type="button" @click="$emit('new-course')">
        {{ t('lessonConstructor.courses.newCourse') }}
      </button>
    </div>

    <!-- Готовий курс — НЕ `TutorCourse`, а зібраний контент теми.
         Окремою секцією, а не рядком у списку: список показує курси,
         створені тьютором у планувальнику, і підмішати туди чуже за
         природою означало б збрехати про те, що це таке. -->
    <section class="course-list__ready">
      <h3>{{ t('lessonConstructor.courses.readyTitle') }}</h3>
      <a class="course-list__ready-card" href="/course">
        <span>
          <strong>{{ t('lessonConstructor.courses.readyPercent') }}</strong>
          <span class="course-list__meta">
            {{ t('lessonConstructor.courses.readyPercentHint') }}
          </span>
        </span>
        <span class="course-list__ready-go">
          {{ t('lessonConstructor.courses.readyOpen') }} →
        </span>
      </a>
    </section>

    <p v-if="loading">{{ t('lessonConstructor.courses.loading') }}</p>

    <p v-else-if="error" class="course-list__error" role="alert">
      {{ error === 'notFound'
        ? t('lessonConstructor.courses.notFound')
        : t('lessonConstructor.courses.listError') }}
    </p>

    <p v-else-if="!courses.length" class="course-list__empty">
      {{ t('lessonConstructor.courses.empty') }}
    </p>

    <ul v-else class="course-list__items">
      <li v-for="c in courses" :key="c.id" class="course-list__item">
        <button type="button" class="course-list__link" @click="open(c.id)">
          <strong>{{ c.title }}</strong>
          <span class="course-list__meta">
            {{ c.level }} · rev {{ c.rev }} ·
            {{ c.status === 'published'
              ? t('lessonConstructor.courses.published')
              : t('lessonConstructor.courses.draft') }}
          </span>
          <span class="course-list__built">
            {{ t('lessonConstructor.courses.builtOf', builtOf(c)) }}
          </span>
        </button>
      </li>
    </ul>

    <!-- ── Деталі обраного курсу ─────────────────────────────────────── -->
    <section v-if="detail" class="course-list__detail">
      <h3>{{ detail.title }}</h3>
      <p class="course-list__meta">
        {{ detail.level }} · rev {{ detail.rev }} ·
        {{ detail.status === 'published'
          ? t('lessonConstructor.courses.published')
          : t('lessonConstructor.courses.draft') }}
      </p>

      <!-- Опублікований курс read-only: правки створять нову ревізію (C7) -->
      <p v-if="isPublished" class="course-list__revision-note">
        {{ t('lessonConstructor.courses.publishedNote') }}
      </p>

      <table class="course-list__lessons">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">{{ t('lessonConstructor.courses.lesson') }}</th>
            <th scope="col">{{ t('lessonConstructor.courses.type') }}</th>
            <th scope="col">{{ t('lessonConstructor.courses.state') }}</th>
            <th scope="col"><span class="sr-only">{{ t('lessonConstructor.courses.actions') }}</span></th>
          </tr>
        </thead>
        <tbody>
          <CourseLessonRow
            v-for="l in detail.lessons || []"
            :key="l.order"
            :lesson="{ ...l, title: titleFor(l.order) }"
            show-state
            show-actions
            :readonly="isPublished"
            :busy="busy"
            @open="openSession"
            @build="buildOne"
          />
        </tbody>
      </table>

      <div class="course-list__detail-actions">
        <button
          v-if="!isPublished"
          type="button"
          :disabled="busy"
          @click="publish"
        >{{ t('lessonConstructor.courses.publish') }}</button>
      </div>

      <MaterializeReportView v-if="report" :report="report" @open="openSession" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import courseApi, { type Course, type MaterializeReport } from '../api/courseApi'
import CourseLessonRow from '../components/CourseLessonRow.vue'
import MaterializeReportView from '../components/MaterializeReport.vue'

defineEmits<{ (e: 'new-course'): void }>()

const { t } = useI18n()
const router = useRouter()

const courses = ref<Course[]>([])
const detail = ref<Course | null>(null)
const report = ref<MaterializeReport | null>(null)
const loading = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)

const isPublished = computed(() => detail.value?.status === 'published')

/**
 * Лічильник зібраного рахує саме `session_id != null` — це єдина ознака,
 * що урок існує як дошка. Статус курсу тут ні до чого: опублікований курс
 * може бути незібраним, і навпаки.
 */
function builtOf(c: Course): { built: number; total: number } {
  const lessons = c.lessons || []
  return {
    built: lessons.filter((l) => l.session_id).length,
    total: lessons.length || (c.plan?.lessons?.length ?? 0),
  }
}

function titleFor(order: number): string {
  return detail.value?.plan?.lessons?.find((l) => l.order === order)?.title || ''
}

function _fail(e: unknown): string {
  const anyE = e as { response?: { status?: number } }
  // 404 = «курс не знайдено», НЕ «немає прав»: BE свідомо не розкриває
  // існування чужих курсів (`_owned`), і UI не має цього зводити нанівець.
  return anyE?.response?.status === 404 ? 'notFound' : 'error'
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const res = await courseApi.list()
    courses.value = res.courses || []
  } catch (e) {
    error.value = _fail(e)
  } finally {
    loading.value = false
  }
}

async function open(id: number): Promise<void> {
  error.value = null
  report.value = null
  try {
    detail.value = await courseApi.detail(id)
  } catch (e) {
    error.value = _fail(e)
    detail.value = null
  }
}

async function buildOne(order: number): Promise<void> {
  if (!detail.value) return
  busy.value = true
  try {
    report.value = await courseApi.materialize(detail.value.id, [order])
    await open(detail.value.id)
  } catch (e) {
    error.value = _fail(e)
  } finally {
    busy.value = false
  }
}

async function publish(): Promise<void> {
  if (!detail.value) return
  if (!window.confirm(t('lessonConstructor.courses.confirmPublish'))) return
  busy.value = true
  try {
    detail.value = await courseApi.publish(detail.value.id)
    await load()
  } catch (e) {
    error.value = _fail(e)
  } finally {
    busy.value = false
  }
}

function openSession(sessionId: string): void {
  router.push({ name: 'winterboard-prepare', params: { id: sessionId } }).catch(() => {})
}

onMounted(load)
defineExpose({ load, open, builtOf })
</script>

<style scoped>
.course-list__ready { margin: 0 0 1.5em; }
.course-list__ready h3 { margin: 0 0 .5em; font-size: .95em; opacity: .7; }
.course-list__ready-card {
  display: flex; align-items: center; justify-content: space-between; gap: 1em;
  padding: .9em 1.1em; border: 1px solid var(--wb-border, #e5e7eb);
  border-radius: .75em; text-decoration: none; color: inherit;
}
.course-list__ready-card:hover { border-color: #818cf8; }
.course-list__ready-card strong { display: block; }
.course-list__ready-go { flex: none; color: #4f46e5; font-weight: 500; }
.course-list__head { display: flex; justify-content: space-between; align-items: center; }
.course-list__items { list-style: none; padding: 0; }
.course-list__item { border-bottom: 1px solid rgba(0,0,0,0.08); }
.course-list__link { display: flex; flex-direction: column; gap: 0.15em; width: 100%;
  text-align: left; padding: 0.6em 0.2em; background: none; border: 0; cursor: pointer; }
.course-list__meta { font-size: 0.85em; opacity: 0.7; }
.course-list__built { font-size: 0.85em; }
.course-list__revision-note { font-size: 0.85em; opacity: 0.8; font-style: italic; }
.course-list__lessons { width: 100%; border-collapse: collapse; }
.course-list__error { color: #dc3545; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
