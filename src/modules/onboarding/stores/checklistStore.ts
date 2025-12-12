// F10: Checklist Store
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { onboardingApi, ChecklistItem, ChecklistSummary } from '../api/onboarding'

export const useChecklistStore = defineStore('checklist', () => {
  // State
  const items = ref<ChecklistItem[]>([])
  const summary = ref<ChecklistSummary | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const completedItems = computed(() => items.value.filter((i) => i.is_completed))

  const pendingItems = computed(() => items.value.filter((i) => !i.is_completed))

  const completionPercentage = computed(() => summary.value?.percentage || 0)

  const nextSuggestedItem = computed(
    () => summary.value?.next_item || pendingItems.value[0] || null
  )

  const itemsByCategory = computed(() => {
    const grouped: Record<string, ChecklistItem[]> = {}
    for (const item of items.value) {
      if (!grouped[item.category]) {
        grouped[item.category] = []
      }
      grouped[item.category].push(item)
    }
    return grouped
  })

  const categories = computed(() => Object.keys(itemsByCategory.value))

  const categoryProgress = computed(() => {
    const progress: Record<string, { completed: number; total: number; percentage: number }> = {}
    for (const [category, categoryItems] of Object.entries(itemsByCategory.value)) {
      const completed = categoryItems.filter((i) => i.is_completed).length
      const total = categoryItems.length
      progress[category] = {
        completed,
        total,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      }
    }
    return progress
  })

  const totalPoints = computed(() =>
    items.value.reduce((sum, item) => sum + item.points, 0)
  )

  const earnedPoints = computed(() =>
    completedItems.value.reduce((sum, item) => sum + item.points, 0)
  )

  // Actions
  async function loadChecklist() {
    isLoading.value = true
    error.value = null
    try {
      items.value = await onboardingApi.getChecklist()
    } catch (e: any) {
      error.value = e.message || 'Failed to load checklist'
    } finally {
      isLoading.value = false
    }
  }

  async function loadChecklistByCategory(category: string) {
    isLoading.value = true
    try {
      const categoryItems = await onboardingApi.getChecklistByCategory(category)
      // Merge with existing items
      for (const item of categoryItems) {
        const idx = items.value.findIndex((i) => i.id === item.id)
        if (idx >= 0) {
          items.value[idx] = item
        } else {
          items.value.push(item)
        }
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to load category'
    } finally {
      isLoading.value = false
    }
  }

  async function syncChecklist() {
    try {
      summary.value = await onboardingApi.syncChecklist()
      await loadChecklist()
    } catch (e: any) {
      error.value = e.message || 'Failed to sync checklist'
    }
  }

  async function loadCompletionPercentage() {
    try {
      const result = await onboardingApi.getCompletionPercentage()
      if (summary.value) {
        summary.value.percentage = result.percentage
      } else {
        summary.value = {
          completed: completedItems.value.length,
          total: items.value.length,
          percentage: result.percentage,
          next_item: pendingItems.value[0] || null,
        }
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to load percentage'
    }
  }

  function markItemCompleted(slug: string) {
    const item = items.value.find((i) => i.slug === slug)
    if (item) {
      item.is_completed = true
      item.completed_at = new Date().toISOString()
    }
  }

  function getItemBySlug(slug: string): ChecklistItem | undefined {
    return items.value.find((i) => i.slug === slug)
  }

  function $reset() {
    items.value = []
    summary.value = null
    isLoading.value = false
    error.value = null
  }

  return {
    // State
    items,
    summary,
    isLoading,
    error,

    // Computed
    completedItems,
    pendingItems,
    completionPercentage,
    nextSuggestedItem,
    itemsByCategory,
    categories,
    categoryProgress,
    totalPoints,
    earnedPoints,

    // Actions
    loadChecklist,
    loadChecklistByCategory,
    syncChecklist,
    loadCompletionPercentage,
    markItemCompleted,
    getItemBySlug,
    $reset,
  }
})
