<script setup lang="ts">
// F14: Checklist View
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useChecklistStore } from '../stores/checklistStore'
import ChecklistCategory from '../components/checklist/ChecklistCategory.vue'
import ChecklistItem from '../components/checklist/ChecklistItem.vue'
import CompletionBadge from '../components/checklist/CompletionBadge.vue'

const router = useRouter()
const { t } = useI18n()
const store = useChecklistStore()

const {
  itemsByCategory,
  categoryProgress,
  completionPercentage,
  nextSuggestedItem,
  earnedPoints,
  totalPoints,
  isLoading,
} = storeToRefs(store)

onMounted(async () => {
  await store.loadChecklist()
  await store.syncChecklist()
})

function handleItemAction(item: any) {
  const routes: Record<string, string> = {
    'complete-profile': '/profile/edit',
    'add-avatar': '/profile/edit#avatar',
    'add-subjects': '/profile/edit#subjects',
    'set-availability': '/tutor/availability',
    'verify-identity': '/verification',
    'first-booking': '/tutors',
    'first-lesson': '/lessons',
    'add-payment': '/settings/payments',
  }

  const route = routes[item.slug]
  if (route) {
    router.push(route)
  }
}
</script>

<template>
  <div class="checklist-view">
    <header class="checklist-header">
      <div class="header-content">
        <h1>{{ t('checklist.title') }}</h1>
        <p class="subtitle">{{ t('checklist.subtitle') }}</p>
      </div>
      <CompletionBadge :percentage="completionPercentage" size="lg" />
    </header>

    <!-- Points Summary -->
    <div class="points-summary">
      <span class="points-earned">{{ earnedPoints }}</span>
      <span class="points-divider">/</span>
      <span class="points-total">{{ totalPoints }} {{ t('checklist.points') }}</span>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner" />
    </div>

    <template v-else>
      <!-- Next Suggested Item -->
      <div v-if="nextSuggestedItem" class="next-suggestion">
        <h3>{{ t('checklist.nextStep') }}</h3>
        <ChecklistItem
          :item="nextSuggestedItem"
          highlighted
          @action="handleItemAction"
        />
      </div>

      <!-- Categories -->
      <div class="checklist-categories">
        <ChecklistCategory
          v-for="(items, category) in itemsByCategory"
          :key="category"
          :category="String(category)"
          :items="items"
          :progress="categoryProgress[category]"
          @action="handleItemAction"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.checklist-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 16px;
}

.checklist-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-content h1 {
  margin: 0 0 4px;
  font-size: 28px;
  font-weight: 700;
}

.subtitle {
  margin: 0;
  color: var(--color-text-secondary, #6b7280);
}

/* Points Summary */
.points-summary {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 32px;
  padding: 16px 20px;
  background: linear-gradient(135deg, var(--color-primary, #3b82f6) 0%, var(--color-primary-dark, #2563eb) 100%);
  border-radius: 12px;
  color: white;
}

.points-earned {
  font-size: 32px;
  font-weight: 700;
}

.points-divider {
  font-size: 24px;
  opacity: 0.6;
}

.points-total {
  font-size: 16px;
  opacity: 0.9;
}

/* Loading */
.loading-state {
  display: flex;
  justify-content: center;
  padding: 64px 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Next Suggestion */
.next-suggestion {
  margin-bottom: 32px;
  padding: 20px;
  background: var(--color-success-light, #d1fae5);
  border-radius: 12px;
}

.next-suggestion h3 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-success-dark, #065f46);
}

/* Categories */
.checklist-categories {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
