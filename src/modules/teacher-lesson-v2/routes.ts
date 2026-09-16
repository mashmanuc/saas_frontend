/**
 * Teacher Lesson V2 (TLV2-01/02) — ізольований маршрут оболонки.
 *
 * Межа: saas_docs/plans/two_apps/lesson_content/TLV2_00_BOUNDARY_MANIFEST_2026-09-16.md §4.
 * Доступ вирішує лише бекенд (`GET /v1/teacher-lesson-v2/access/`). FE-прапорця немає й не
 * буде: гейт `import.meta.env.DEV || VITE_*` — пастка з `debts/FROZEN.md`. Посилань із V1 на
 * цей маршрут у TLV2-01 немає — вхід лише за URL.
 */
import type { RouteRecordRaw } from 'vue-router'

export const TEACHER_LESSON_V2_PATH = '/teacher-lesson-v2'
export const TEACHER_LESSON_V2_HOME = 'teacher-lesson-v2-home'
/** Куди повертаємо того, для кого V2 не існує: студія уроків V1. */
export const V1_FALLBACK_ROUTE = 'winterboard-boards'
/** TLV2-02: підготовлений урок відкривається справжньою дошкою — чинним маршрутом V1. */
export const BOARD_ROUTE = 'winterboard-solo'
/** Пілотний урок (план 34 §4). */
export const PILOT_LESSON_KEY = 'triangles.correspondence'

export const teacherLessonV2Routes: RouteRecordRaw[] = [
  {
    path: TEACHER_LESSON_V2_PATH,
    name: TEACHER_LESSON_V2_HOME,
    component: () => import('./views/TeacherLessonV2Home.vue'),
    meta: { requiresAuth: true, title: 'Teacher Lesson V2' },
  },
]
