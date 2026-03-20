<!-- Phase 22: Lesson View Page
     Unified route /l/:lessonSlug with access policy.
     Three states: loading → hero preview → replay.
     Ref: PHASE22_LESSON_CONSUMPTION.md §Frontend Components -->
<template>
  <div class="lesson-view-page">
    <!-- Loading -->
    <div v-if="loading" class="lesson-view-page__loading">
      <div class="lesson-view-page__spinner"></div>
    </div>

    <!-- Error -->
    <LessonErrorPage v-else-if="errorState" :error="errorState" />

    <!-- Replay mode -->
    <LessonReplayPlayer
      v-else-if="replayStarted && lesson?.snapshot_url"
      :snapshot-url="lesson.snapshot_url"
      :lesson-title="lesson.title"
      @exit="exitReplay"
    />

    <!-- Hero preview -->
    <template v-else-if="lesson && access">
      <LessonHero
        :lesson="lesson"
        :access="access"
        :is-owner="access.source === 'OWNER'"
        @start-replay="startReplay"
      />

      <!-- Phase 24 SSOT: Owner actions — "Використати" = PRIMARY, above replay -->
      <div
        v-if="access.can_view && access.source === 'OWNER'"
        class="lesson-view-page__owner-cta"
      >
        <button
          @click="useLessonInSession"
          :disabled="loadingSession"
          class="lesson-view-page__use-btn lesson-view-page__use-btn--primary"
        >
          {{ loadingSession
            ? $t('knowledge.lesson.reuse.loading')
            : $t('knowledge.lesson.reuse.useLesson') }}
        </button>
      </div>

      <!-- Non-owner CTA -->
      <LessonCTA
        v-if="access.can_view && access.source !== 'OWNER'"
        :tutor="lesson.tutor"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { lessonViewApi } from '@/modules/knowledge/api/lessonViewApi'
// Phase 27: catalogApi.logView() removed — view logging is now backend-only
import LessonHero from '@/modules/knowledge/components/LessonHero.vue'
import LessonReplayPlayer from '@/modules/knowledge/components/LessonReplayPlayer.vue'
import LessonCTA from '@/modules/knowledge/components/LessonCTA.vue'
import LessonErrorPage from '@/modules/knowledge/components/LessonErrorPage.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const lesson = ref(null)
const access = ref(null)
const replayStarted = ref(false)
const errorState = ref(null)
const loadingSession = ref(false)

onMounted(async () => {
  const slug = route.params.lessonSlug
  const shareToken = route.query.token

  try {
    const response = await lessonViewApi.getLesson(slug, shareToken)
    lesson.value = response.lesson
    access.value = response.access

    // Phase 26 BUG-2 fix: redirect to full PublicLessonPage for public lessons
    if (lesson.value?.status === 'public' && lesson.value?.tutor?.slug && lesson.value?.slug) {
      router.replace({
        path: `/lesson/${lesson.value.tutor.slug}/${lesson.value.slug}`,
      })
      return
    }

    // Phase 27: view logging moved to backend (auto-log on GET PublicLessonDetailView)
  } catch (err) {
    const status = err?.response?.status
    if (status === 404) {
      errorState.value = {
        type: '404',
        message: 'This lesson does not exist or you do not have access.',
      }
    } else {
      errorState.value = {
        type: 'server_error',
        message: 'Something went wrong. Please try again later.',
      }
    }
  } finally {
    loading.value = false
  }
})

function startReplay() {
  if (lesson.value?.snapshot_url) {
    replayStarted.value = true
  } else {
    errorState.value = {
      type: 'broken_snapshot',
      message: 'Lesson content is not available for replay.',
    }
  }
}

function exitReplay() {
  replayStarted.value = false
}

async function useLessonInSession() {
  if (!lesson.value || loadingSession.value) return
  loadingSession.value = true
  try {
    const { session_id } = await lessonViewApi.loadToSession(lesson.value.id)
    await router.push({ name: 'winterboard-solo', params: { id: session_id } })
  } catch (err) {
    errorState.value = {
      type: 'server_error',
      message: 'Failed to load lesson into session.',
    }
  } finally {
    loadingSession.value = false
  }
}
</script>

<style scoped>
.lesson-view-page {
  min-height: 100vh;
  background: var(--color-bg-primary, #fff);
}

.lesson-view-page__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

.lesson-view-page__spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-accent, #6366f1);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.lesson-view-page__owner-cta {
  max-width: 800px;
  margin: 2rem auto;
  padding: 0 1.5rem;
  text-align: center;
}

.lesson-view-page__use-btn {
  padding: 0.75rem 2rem;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
}

.lesson-view-page__use-btn--primary {
  background: var(--color-primary, #16a34a);
  color: #fff;
}

.lesson-view-page__use-btn--primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.lesson-view-page__use-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
</style>
