<!-- Phase 21: My Lessons page — list of tutor's saved lessons
     Ref: PHASE21_KNOWLEDGE_CORE.md -->
<template>
  <div class="wb-my-lessons max-w-6xl mx-auto px-4 py-8">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">{{ $t('winterboard.lesson.myLessonsTitle') }}</h1>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-16">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
    </div>

    <!-- Empty state -->
    <div v-else-if="lessons.length === 0" class="text-center py-16">
      <div class="text-5xl mb-4">📚</div>
      <h2 class="text-lg font-semibold text-gray-700">{{ $t('winterboard.lesson.emptyTitle') }}</h2>
      <p class="text-sm text-gray-500 mt-1">{{ $t('winterboard.lesson.emptySubtitle') }}</p>
    </div>

    <!-- Grid of lessons -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="lesson in lessons"
        :key="lesson.id"
        class="wb-lesson-card bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
      >
        <!-- Preview thumbnail or placeholder -->
        <div class="aspect-video bg-gray-100 flex items-center justify-center">
          <div class="text-4xl text-gray-300">📝</div>
        </div>

        <!-- Info -->
        <div class="p-4">
          <h3 class="font-semibold text-gray-900 truncate" :title="lesson.title">
            {{ lesson.title }}
          </h3>
          <p class="text-xs text-gray-400 mt-1">
            {{ formatDate(lesson.created_at) }}
          </p>
          <div class="mt-1 inline-flex items-center gap-1">
            <span
              class="inline-block px-2 py-0.5 text-xs rounded-full"
              :class="lesson.status === 'draft'
                ? 'bg-gray-100 text-gray-600'
                : 'bg-green-100 text-green-700'"
            >
              {{ lesson.status }}
            </span>
          </div>

          <!-- Actions -->
          <div class="mt-3 flex gap-2">
            <button
              type="button"
              class="flex-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
              :disabled="loadingLessonId === lesson.id"
              @click="openLesson(lesson)"
            >
              {{ loadingLessonId === lesson.id
                ? $t('winterboard.lesson.opening')
                : $t('winterboard.lesson.openButton') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error -->
    <p v-if="loadError" class="mt-4 text-sm text-red-600 text-center" role="alert">{{ loadError }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { lessonSaveApi } from '../api/lessonSaveApi'
import type { MyLesson } from '../api/lessonSaveApi'

const router = useRouter()
const { t } = useI18n()

const lessons = ref<MyLesson[]>([])
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const loadingLessonId = ref<string | null>(null)

onMounted(async () => {
  try {
    lessons.value = await lessonSaveApi.getMyLessons()
  } catch (err) {
    console.error('[WBMyLessonsPage] fetch error:', err)
    loadError.value = t('winterboard.lesson.fetchError')
  } finally {
    isLoading.value = false
  }
})

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

async function openLesson(lesson: MyLesson): Promise<void> {
  if (loadingLessonId.value) return
  loadingLessonId.value = lesson.id
  loadError.value = null

  try {
    const { session_id } = await lessonSaveApi.createSessionFromLesson(lesson.id)
    await router.push({ name: 'winterboard-solo', params: { id: session_id } })
  } catch (err) {
    console.error('[WBMyLessonsPage] open lesson error:', err)
    loadError.value = t('winterboard.lesson.openError')
  } finally {
    loadingLessonId.value = null
  }
}
</script>
