<script setup lang="ts">
// F26: Checklist Category Component
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, ChevronUp } from 'lucide-vue-next'
import type { ChecklistItem as ChecklistItemType } from '../../api/onboarding'
import ChecklistItem from './ChecklistItem.vue'

const props = defineProps<{
  category: string
  items: ChecklistItemType[]
  progress: { completed: number; total: number; percentage?: number }
}>()

const emit = defineEmits<{
  action: [item: ChecklistItemType]
}>()

const { t } = useI18n()

const isExpanded = ref(true)

function toggle() {
  isExpanded.value = !isExpanded.value
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    profile: t('checklist.categories.profile'),
    verification: t('checklist.categories.verification'),
    settings: t('checklist.categories.settings'),
    engagement: t('checklist.categories.engagement'),
  }
  return labels[category] || category
}
</script>

<template>
  <div class="checklist-category">
    <button class="category-header" @click="toggle">
      <div class="header-left">
        <h3>{{ getCategoryLabel(category) }}</h3>
        <span class="category-progress">
          {{ progress.completed }}/{{ progress.total }}
        </span>
      </div>
      <component :is="isExpanded ? ChevronUp : ChevronDown" :size="20" />
    </button>

    <Transition name="collapse">
      <div v-if="isExpanded" class="category-items">
        <ChecklistItem
          v-for="item in items"
          :key="item.slug"
          :item="item"
          @action="emit('action', item)"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.checklist-category {
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  overflow: hidden;
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 16px 20px;
  background: none;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}

.category-header:hover {
  background: var(--color-bg-secondary, #f5f5f5);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.category-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.category-progress {
  padding: 4px 10px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
}

.category-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 16px 16px;
}

/* Collapse Transition */
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.2s ease;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
  padding-bottom: 0;
}
</style>
