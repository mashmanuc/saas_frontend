import type { RouteRecordRaw } from 'vue-router'

const classroomRoutes: RouteRecordRaw[] = [
  {
    path: '/classroom/:sessionId',
    name: 'lesson-room',
    component: () => import('./views/LessonRoom.vue'),
    meta: {
      requiresAuth: true,
      title: 'Lesson Room',
    },
  },
  {
    path: '/classroom/solo',
    name: 'solo-room',
    component: () => import('./views/SoloRoom.vue'),
    meta: {
      requiresAuth: true,
      title: 'Solo Practice',
    },
  },
]

export default classroomRoutes
