import { computed } from 'vue'
import { useDashboardStore } from '../store/dashboardStore'
import { useRelationsStore } from '@/stores/relationsStore'
import { useChatThreadsStore } from '@/stores/chatThreadsStore'

export interface DashboardStat {
  key: string
  icon: string
  label: string
  value: number | string
  trend?: { direction: 'up' | 'down' | 'flat'; text: string }
  to?: string
}

/**
 * Aggregates dashboard stats from multiple stores.
 * Does NOT make API calls — reads reactive state only.
 * Ref: UX_PRODUCT_VISION.md §R2.4
 */
export function useDashboardStats(role: 'tutor' | 'student') {
  const dashboard = useDashboardStore()
  // as any casts: relationsStore and chatThreadsStore are JS (Options API / mixed),
  // TS cannot infer their state shape. We read only, never mutate.
  const relations = useRelationsStore() as any
  const chat = useChatThreadsStore() as any

  const tutorStats = computed<DashboardStat[]>(() => {
    const rels = relations.tutorRelations ?? []
    const activeCount = Array.isArray(rels)
      ? rels.filter((r: any) => r.status === 'active').length
      : 0
    const invitedCount = Array.isArray(rels)
      ? rels.filter((r: any) => r.status === 'invited').length
      : 0

    return [
      {
        key: 'lessonsToday',
        icon: 'calendar',
        label: 'dashboard.stats.lessonsToday',
        value: dashboard.todaysLessons?.length ?? 0,
        to: '/tutor/schedule',
      },
      {
        key: 'activeStudents',
        icon: 'users',
        label: 'dashboard.stats.activeStudents',
        value: activeCount,
      },
      {
        key: 'pendingInquiries',
        icon: 'inbox',
        label: 'dashboard.stats.pendingInquiries',
        value: invitedCount,
        to: '/tutor/inquiries',
      },
      {
        key: 'balance',
        icon: 'wallet',
        label: 'dashboard.stats.balance',
        value: '—',
      },
    ]
  })

  const studentStats = computed<DashboardStat[]>(() => [
    {
      key: 'upcomingLessons',
      icon: 'calendar',
      label: 'dashboard.stats.upcomingLessons',
      value: dashboard.upcomingLessons?.length ?? 0,
      to: '/student/schedule',
    },
    {
      key: 'activeTutors',
      icon: 'graduation-cap',
      label: 'dashboard.stats.activeTutors',
      value: dashboard.activeTutors?.length ?? 0,
      to: '/marketplace',
    },
    {
      key: 'unreadMessages',
      icon: 'message-circle',
      label: 'dashboard.stats.unreadMessages',
      // as any cast: chatThreadsStore is JS, totalUnread is a computed ref
      value: chat.totalUnread ?? 0,
      to: '/student/messages',
    },
  ])

  return {
    stats: role === 'tutor' ? tutorStats : studentStats,
  }
}
