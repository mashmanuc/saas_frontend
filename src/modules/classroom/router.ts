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
    path: '/classroom/board',
    name: 'classroom-board',
    component: () => import('./views/ClassroomBoard.vue'),
    meta: {
      requiresAuth: true,
      title: 'Classroom Board',
    },
  },
  {
    path: '/classroom/solo',
    redirect: '/winterboard',
  },
]

export default classroomRoutes
