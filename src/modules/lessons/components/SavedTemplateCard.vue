<template>
  <div class="stc">
    <div class="stc__header">
      <div>
        <h3 class="stc__title">{{ template.title }}</h3>
        <p class="stc__meta">
          {{ formattedDate }}
          <span v-if="template.content_count" class="stc__sep">
            · {{ template.content_count }} {{ $t('template.materials') }}
          </span>
          <span v-if="template.has_board" class="stc__sep">
            · {{ $t('template.hasBoard') }}
          </span>
        </p>
      </div>
    </div>
    <div class="stc__actions">
      <button
        @click="$emit('createLesson', template.id)"
        class="stc__btn stc__btn--create"
      >
        {{ $t('template.createLesson') }}
      </button>
      <button
        @click="confirmDelete"
        class="stc__btn stc__btn--delete"
      >
        {{ $t('common.delete') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { activeLocale } from '@/utils/i18nDate'

export interface SavedTemplateItem {
  id: number
  title: string
  content_count?: number
  has_board?: boolean
  source_lesson_id?: number | null
  created_at: string
}

const props = defineProps<{
  template: SavedTemplateItem
}>()

const emit = defineEmits<{
  createLesson: [templateId: number]
  delete: [templateId: number]
}>()

const formattedDate = computed(() => {
  return new Date(props.template.created_at).toLocaleDateString(activeLocale())
})

function confirmDelete() {
  if (window.confirm('Delete template?')) {
    emit('delete', props.template.id)
  }
}
</script>

<style scoped>
.stc {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--card-bg);
  padding: 14px;
  transition: box-shadow 0.15s;
}
.stc:hover {
  box-shadow: 0 2px 8px var(--shadow);
}
.stc__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.stc__title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
}
.stc__meta {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 4px 0 0;
}
.stc__sep {
  margin-left: 2px;
}
.stc__actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
}
.stc__btn {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  border: none;
  transition: background 0.15s;
}
.stc__btn--create {
  background: color-mix(in srgb, var(--accent) 10%, var(--card-bg));
  color: var(--accent);
}
.stc__btn--create:hover {
  background: color-mix(in srgb, var(--accent) 18%, var(--card-bg));
}
.stc__btn--delete {
  background: none;
  color: var(--danger-bg);
}
.stc__btn--delete:hover {
  background: color-mix(in srgb, var(--danger-bg) 8%, var(--card-bg));
}
</style>
