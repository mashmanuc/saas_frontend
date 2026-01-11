// F32: useChecklist Composable
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useChecklistStore } from '../stores/checklistStore'
import type { ChecklistItem } from '../api/onboarding'

export function useChecklist() {
  const router = useRouter()
  const store = useChecklistStore()

  const {
    items,
    summary,
    completedItems,
    pendingItems,
    completionPercentage,
    nextSuggestedItem,
    itemsByCategory,
    categories,
    categoryProgress,
    totalPoints,
    earnedPoints,
    isLoading,
    error,
  } = storeToRefs(store)

  onMounted(async () => {
    await store.loadChecklist()
    await store.syncChecklist()
  })

  function handleItemAction(item: ChecklistItem) {
    // Navigate to relevant page based on item slug
    const routes: Record<string, string> = {
      'complete-profile': '/profile/edit',
      'add-avatar': '/profile/edit#avatar',
      'add-bio': '/profile/edit#bio',
      'add-subjects': '/profile/edit#subjects',
      'set-availability': '/tutor/availability',
      'set-pricing': '/tutor/pricing',
      'verify-identity': '/verification',
      'verify-email': '/settings/email',
      'add-payment-method': '/settings/payments',
      'first-booking': '/tutors',
      'first-lesson': '/calendar',
      'leave-review': '/reviews',
      'complete-lesson': '/calendar',
    }

    const route = routes[item.slug]
    if (route) {
      router.push(route)
    }
  }

  async function refreshChecklist() {
    await store.syncChecklist()
  }

  function getItemBySlug(slug: string): ChecklistItem | undefined {
    return store.getItemBySlug(slug)
  }

  function isItemCompleted(slug: string): boolean {
    const item = store.getItemBySlug(slug)
    return item?.is_completed || false
  }

  return {
    // State
    items,
    summary,
    completedItems,
    pendingItems,
    completionPercentage,
    nextSuggestedItem,
    itemsByCategory,
    categories,
    categoryProgress,
    totalPoints,
    earnedPoints,
    isLoading,
    error,

    // Actions
    handleItemAction,
    refreshChecklist,
    getItemBySlug,
    isItemCompleted,

    // Store actions
    loadChecklist: store.loadChecklist,
    loadChecklistByCategory: store.loadChecklistByCategory,
    syncChecklist: store.syncChecklist,
    loadCompletionPercentage: store.loadCompletionPercentage,
    markItemCompleted: store.markItemCompleted,
  }
}
