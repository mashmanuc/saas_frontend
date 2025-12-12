<script setup lang="ts">
// F24: Checklist Panel Component (Sidebar)
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { ChevronDown, ChevronUp, CheckCircle } from 'lucide-vue-next'
import { useChecklistStore } from '../../stores/checklistStore'
import ChecklistItem from './ChecklistItem.vue'
import CompletionBadge from './CompletionBadge.vue'

const { t } = useI18n()
const store = useChecklistStore()

const { pendingItems, completionPercentage, nextSuggestedItem, isLoading } = storeToRefs(store)

const isExpanded = ref(false)

onMounted(async () => {
  await store.loadChecklist()
})

function toggle() {
  isExpanded.value = !isExpanded.value
}

const emit = defineEmits<{
  action: [item: any]
}>()
</script>

<template>
  <div :class="['checklist-panel', { expanded: isExpanded }]">
    <button class="panel-header" @click="toggle">
      <div class="header-left">
        <CompletionBadge :percentage="completionPercentage" size="sm" />
        <span class="header-title">{{ t('checklist.panelTitle') }}</span>
      </div>
      <component :is="isExpanded ? ChevronUp : ChevronDown" :size="20" />
    </button>

    <Transition name="expand">
      <div v-if="isExpanded" class="panel-content">
        <!-- Loading -->
        <div v-if="isLoading" class="loading">
          <div class="spinner" />
        </div>

        <template v-else>
          <!-- Next Suggested -->
          <div v-if="nextSuggestedItem" class="next-item">
            <span class="next-label">{{ t('checklist.nextStep') }}</span>
            <ChecklistItem
              :item="nextSuggestedItem"
              compact
              @action="emit('action', nextSuggestedItem)"
            />
          </div>

          <!-- Pending Items -->
          <div class="pending-list">
            <ChecklistItem
              v-for="item in pendingItems.slice(0, 3)"
              :key="item.slug"
              :item="item"
              compact
              @action="emit('action', item)"
            />
          </div>

          <!-- View All Link -->
          <router-link to="/checklist" class="view-all">
            {{ t('checklist.viewAll') }}
          </router-link>
        </template>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.checklist-panel {
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 16px;
  background: none;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}

.panel-header:hover {
  background: var(--color-bg-secondary, #f5f5f5);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.panel-content {
  padding: 0 16px 16px;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.next-item {
  margin-bottom: 12px;
  padding: 12px;
  background: var(--color-success-light, #d1fae5);
  border-radius: 8px;
}

.next-label {
  display: block;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-success-dark, #065f46);
}

.pending-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.view-all {
  display: block;
  margin-top: 12px;
  font-size: 13px;
  color: var(--color-primary, #3b82f6);
  text-decoration: none;
  text-align: center;
}

.view-all:hover {
  text-decoration: underline;
}

/* Expand Transition */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
