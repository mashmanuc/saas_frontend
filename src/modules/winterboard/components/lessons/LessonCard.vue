<!-- WB B16: LessonCard — name, date, clone/delete actions
     Ref: DAY18_AGENT-B.md B16 -->
<template>
  <div
    class="lesson-card"
    role="button"
    tabindex="0"
    :aria-label="lesson.name"
    data-testid="lesson-card"
    @click="$emit('click')"
    @keydown.enter="$emit('click')"
  >
    <div class="lesson-card__info">
      <h3 class="lesson-card__name">{{ lesson.name }}</h3>
      <p v-if="lesson.description" class="lesson-card__description">{{ lesson.description }}</p>
      <span class="lesson-card__meta">
        {{ t('winterboard.lessons.created') }}: {{ formatDate(lesson.created_at) }}
      </span>
      <span
        v-if="lesson.materials_count !== undefined"
        class="lesson-card__materials"
      >
        {{ lesson.materials_count }} {{ t('winterboard.lessons.materials') }}
      </span>
    </div>

    <div class="lesson-card__actions">
      <button
        class="lesson-card__action-btn"
        :aria-label="t('winterboard.lessons.clone')"
        data-testid="clone-button"
        @click.stop="$emit('clone')"
      >
        📋
      </button>
      <button
        class="lesson-card__action-btn lesson-card__action-btn--danger"
        :aria-label="t('winterboard.lessons.delete')"
        data-testid="delete-button"
        @click.stop="$emit('delete')"
      >
        🗑
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  lesson: {
    id: string | number
    name: string
    description?: string
    materials_count?: number
    created_at: string
  }
}>()

defineEmits<{
  click: []
  clone: []
  delete: []
}>()

function formatDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('uk-UA')
}
</script>

<style scoped>
.lesson-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  background: var(--wb-card-bg, #fff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}

.lesson-card:hover,
.lesson-card:focus-visible {
  border-color: var(--wb-brand, #0066ff);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.lesson-card__info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.lesson-card__name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lesson-card__description {
  margin: 0;
  font-size: 13px;
  color: var(--wb-fg-secondary, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lesson-card__meta,
.lesson-card__materials {
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
}

.lesson-card__actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.lesson-card__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.1s, border-color 0.1s;
}

.lesson-card__action-btn:hover {
  background: var(--wb-canvas-bg, #f1f5f9);
  border-color: var(--wb-fg-secondary, #94a3b8);
}

.lesson-card__action-btn--danger:hover {
  background: #fef2f2;
  border-color: #fecaca;
}
</style>
