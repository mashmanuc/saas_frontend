<!-- Knowledge: Demo lessons section for tutor marketplace profile
     Ref: Phase 13 B2.2 — fetches and displays demo lessons for a tutor -->
<template>
  <section v-if="!isLoading && lessons.length > 0" class="demo-lessons-section">
    <h2 class="demo-lessons-section__title">{{ t('knowledge.demo.title') }}</h2>
    <p class="demo-lessons-section__subtitle">{{ t('knowledge.demo.subtitle') }}</p>
    <div class="demo-lessons-grid">
      <DemoLessonCard
        v-for="lesson in lessons"
        :key="lesson.id"
        :lesson="lesson"
      />
    </div>
  </section>

  <div v-else-if="isLoading" class="demo-lessons-section demo-lessons-section--loading">
    <div class="demo-lessons-section__skeleton" v-for="i in 3" :key="i" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DemoLessonCard from './DemoLessonCard.vue'
import type { DemoLesson } from './DemoLessonCard.vue'
import { apiClient } from '@/api/client'

const props = defineProps<{
  tutorSlug: string
}>()

const { t } = useI18n()

const lessons = ref<DemoLesson[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

async function fetchDemoLessons(slug: string): Promise<void> {
  if (!slug) return
  isLoading.value = true
  error.value = null
  try {
    const response = await apiClient.get(
      `/api/v1/knowledge/public/tutors/${encodeURIComponent(slug)}/demo-lessons/`,
    )
    lessons.value = response.data?.results ?? response.data ?? []
  } catch (err) {
    error.value = 'Failed to load demo lessons'
    lessons.value = []
    console.warn('[DemoLessonsSection] fetch error:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchDemoLessons(props.tutorSlug)
})

watch(() => props.tutorSlug, (newSlug) => {
  fetchDemoLessons(newSlug)
})
</script>

<style scoped>
.demo-lessons-section {
  padding: 0;
}

.demo-lessons-section__title {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 4px;
}

.demo-lessons-section__subtitle {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 16px;
}

.demo-lessons-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.demo-lessons-section--loading {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.demo-lessons-section__skeleton {
  aspect-ratio: 16 / 12;
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 10px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 640px) {
  .demo-lessons-grid {
    grid-template-columns: 1fr;
  }
}
</style>
