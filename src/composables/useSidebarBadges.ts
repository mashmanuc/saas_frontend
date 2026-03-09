import { computed } from 'vue'
import { useChatThreadsStore } from '@/stores/chatThreadsStore'
import { useRelationsStore } from '@/stores/relationsStore'

interface BadgeInfo {
  count: number
  type: 'danger' | 'warning' | 'info'
}

/**
 * Composable that aggregates badge counts for sidebar items.
 * Reads from existing stores — does NOT make API calls.
 *
 * Returns a reactive Map<routePath, BadgeInfo> and a getter function.
 */
export function useSidebarBadges() {
  const chatStore = useChatThreadsStore()
  const relationsStore = useRelationsStore()

  const badges = computed<Map<string, BadgeInfo>>(() => {
    const map = new Map<string, BadgeInfo>()

    // Messages: unread count from chatThreadsStore
    const unreadMessages = chatStore.totalUnread ?? 0
    if (unreadMessages > 0) {
      map.set('/tutor/messages', { count: unreadMessages, type: 'danger' })
      map.set('/student/messages', { count: unreadMessages, type: 'danger' })
    }

    // Inquiries (tutor): invited/pending students
    // Runtime relationsStore uses options API (.js) with tutorRelations array.
    // TS sees setup API (.ts) which lacks this field — safe cast needed.
    const store = relationsStore as any
    const tutorRels = store.tutorRelations ?? store.relations ?? []
    const invitedCount = Array.isArray(tutorRels)
      ? tutorRels.filter((r: any) => r.status === 'invited').length
      : 0
    if (invitedCount > 0) {
      map.set('/tutor/inquiries', { count: invitedCount, type: 'warning' })
    }

    // Dashboard (tutor): same invited count as info CTA
    if (invitedCount > 0) {
      map.set('/tutor', { count: invitedCount, type: 'info' })
    }

    return map
  })

  /**
   * Get badge for a specific route path.
   * Used by PageShell to inject badges into menu items.
   */
  function getBadge(path: string): BadgeInfo | null {
    return badges.value.get(path) || null
  }

  return {
    badges,
    getBadge,
  }
}
