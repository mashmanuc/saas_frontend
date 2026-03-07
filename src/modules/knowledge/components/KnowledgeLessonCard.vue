<template>
  <div class="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow">
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
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800"
          >
            Demo
          </span>
        </div>
        <p class="mt-1 text-sm font-medium text-gray-900 truncate">
          {{ lesson.student_name }}
        </p>
        <p class="text-xs text-gray-500 mt-0.5">
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
        class="px-3 py-1.5 text-xs rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100"
      >
        {{ $t('knowledge.openBoard') }}
      </button>
      <button
        @click="$emit('clone', lesson.id)"
        class="px-3 py-1.5 text-xs rounded-md text-gray-700 hover:bg-gray-100"
      >
        {{ $t('lessons.history.clone') }}
      </button>
      <button
        @click="$emit('saveAsTemplate', lesson.id)"
        class="px-3 py-1.5 text-xs rounded-md text-gray-700 hover:bg-gray-100"
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
  if (s === 'COMPLETED' || s === 'completed') return 'bg-green-100 text-green-800'
  if (s === 'DRAFT') return 'bg-gray-100 text-gray-800'
  if (s === 'IN_PROGRESS') return 'bg-blue-100 text-blue-800'
  if (s === 'CANCELLED' || s === 'cancelled') return 'bg-red-100 text-red-800'
  return 'bg-gray-100 text-gray-800'
})
</script>
