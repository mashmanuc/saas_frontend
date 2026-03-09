<template>
  <div class="klc-card">
    <div class="flex items-start justify-between">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            :class="statusClass"
          >
            {{ lesson.status }}
          </span>
          <span
            v-if="lesson.student_is_demo"
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium klc-demo-badge"
          >
            Demo
          </span>
        </div>
        <p class="klc-student-name">
          {{ lesson.student_name }}
        </p>
        <p class="klc-meta">
          {{ formattedDate }}
          <span v-if="lesson.content_count" class="ml-2">
            · {{ lesson.content_count }} {{ $t('knowledge.materials') }}
          </span>
          <span v-if="lesson.template_count" class="ml-2">
            · {{ lesson.template_count }} {{ $t('knowledge.templates') }}
          </span>
        </p>
      </div>
    </div>
    <div class="mt-3 flex flex-wrap gap-2">
      <button
        v-if="lesson.has_board && lesson.session_uuid"
        @click="$emit('openBoard', lesson.session_uuid)"
        class="klc-action klc-action--primary"
      >
        {{ $t('knowledge.openBoard') }}
      </button>
      <button
        @click="$emit('clone', lesson.id)"
        class="klc-action"
      >
        {{ $t('lessons.history.clone') }}
      </button>
      <button
        @click="$emit('saveAsTemplate', lesson.id)"
        class="klc-action"
      >
        {{ $t('template.saveAsTemplate') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KnowledgeLesson } from '../api/knowledgeApi'

const props = defineProps<{
  lesson: KnowledgeLesson
}>()

defineEmits<{
  openBoard: [sessionUuid: string]
  clone: [lessonId: number]
  saveAsTemplate: [lessonId: number]
}>()

const formattedDate = computed(() => {
  return new Date(props.lesson.start).toLocaleDateString()
})

const statusClass = computed(() => {
  const s = props.lesson.status
  if (s === 'COMPLETED' || s === 'completed') return 'klc-status--completed'
  if (s === 'DRAFT') return 'klc-status--draft'
  if (s === 'IN_PROGRESS') return 'klc-status--in_progress'
  if (s === 'CANCELLED' || s === 'cancelled') return 'klc-status--cancelled'
  return 'klc-status--draft'
})
</script>

<style scoped>
.klc-card {
  border-radius: 0.5rem;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  padding: 1rem;
  transition: box-shadow 0.15s;
}
.klc-card:hover {
  box-shadow: 0 4px 12px var(--shadow);
}
.klc-student-name {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.klc-meta {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.125rem;
}
.klc-action {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  border-radius: 0.375rem;
  color: var(--text-primary);
  background: none;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}
.klc-action:hover {
  background: var(--bg-secondary);
}
.klc-action--primary {
  background: color-mix(in srgb, var(--accent) 10%, var(--card-bg));
  color: var(--accent);
}
.klc-action--primary:hover {
  background: color-mix(in srgb, var(--accent) 18%, var(--card-bg));
}
.klc-status--completed { background: color-mix(in srgb, var(--success-bg) 15%, var(--card-bg)); color: var(--success-bg); }
.klc-status--in_progress { background: color-mix(in srgb, var(--info-bg) 15%, var(--card-bg)); color: var(--info-bg); }
.klc-status--draft { background: var(--bg-secondary); color: var(--text-secondary); }
.klc-status--cancelled { background: color-mix(in srgb, var(--danger-bg) 12%, var(--card-bg)); color: var(--danger-bg); }
.klc-demo-badge { background: color-mix(in srgb, #7c3aed 12%, var(--card-bg)); color: #7c3aed; }
</style>
