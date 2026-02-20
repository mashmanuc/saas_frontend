<script setup lang="ts">
// F25: Checklist Item Component
import { useI18n } from 'vue-i18n'
import { CheckCircle, Circle, ArrowRight } from 'lucide-vue-next'
import type { ChecklistItem } from '../../api/onboarding'
import Button from '@/ui/Button.vue'

const props = defineProps<{
  item: ChecklistItem
  highlighted?: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  action: [item: ChecklistItem]
}>()

const { t } = useI18n()
</script>

<template>
  <div
    :class="[
      'checklist-item',
      {
        completed: item.is_completed,
        highlighted,
        compact,
      },
    ]"
  >
    <div class="item-checkbox">
      <CheckCircle v-if="item.is_completed" :size="20" class="completed-icon" />
      <Circle v-else :size="20" class="pending-icon" />
    </div>

    <div class="item-content">
      <h4 class="item-title">{{ item.title }}</h4>
      <p v-if="item.description && !compact" class="item-description">
        {{ item.description }}
      </p>
    </div>

    <div v-if="!item.is_completed" class="item-action">
      <Button variant="primary" size="sm" @click="emit('action', item)">
        <span v-if="!compact">{{ t('checklist.complete') }}</span>
        <ArrowRight :size="16" />
      </Button>
    </div>

    <div v-if="item.points && !compact" class="item-points">
      +{{ item.points }} {{ t('checklist.points') }}
    </div>
  </div>
</template>

<style scoped>
.checklist-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
  transition: all 0.15s;
}

.checklist-item.compact {
  padding: 12px;
}

.checklist-item.highlighted {
  background: var(--color-bg-primary, white);
  border-color: var(--color-success, #10b981);
}

.checklist-item.completed {
  opacity: 0.7;
}

.item-checkbox {
  flex-shrink: 0;
  margin-top: 2px;
}

.completed-icon {
  color: var(--color-success, #10b981);
}

.pending-icon {
  color: var(--color-text-tertiary, #9ca3af);
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
}

.checklist-item.completed .item-title {
  text-decoration: line-through;
  color: var(--color-text-secondary, #6b7280);
}

.item-description {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
  line-height: 1.4;
}

.item-action {
  flex-shrink: 0;
}

.item-points {
  flex-shrink: 0;
  padding: 4px 10px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
}
</style>
