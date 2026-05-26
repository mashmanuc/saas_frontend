/**
 * Platform Feedback routes.
 * Mounted у головному router/index.js під PageShell layout.
 */
const FeedbackLanding = () => import('./views/FeedbackLanding.vue')
const NewThread = () => import('./views/NewThread.vue')
const ThreadDetail = () => import('./views/ThreadDetail.vue')
const Roadmap = () => import('./views/Roadmap.vue')

export const platformFeedbackRoutes = [
  {
    path: 'feedback',
    name: 'FeedbackLanding',
    component: FeedbackLanding,
    meta: { requiresAuth: true, title: 'Ideas & Feedback' },
  },
  {
    path: 'feedback/new',
    name: 'NewFeedbackThread',
    component: NewThread,
    meta: { requiresAuth: true, title: 'New idea' },
  },
  {
    path: 'feedback/roadmap',
    name: 'FeedbackRoadmap',
    component: Roadmap,
    meta: { requiresAuth: true, title: 'Roadmap' },
  },
  {
    path: 'feedback/thread/:id',
    name: 'FeedbackThread',
    component: ThreadDetail,
    meta: { requiresAuth: true, title: 'Feedback thread' },
    props: true,
  },
]
