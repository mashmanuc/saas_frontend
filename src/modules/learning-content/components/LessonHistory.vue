<template>
  <div class="lesson-history">
    <h3 class="lesson-history__title">{{ t('lessons.history.title') }}</h3>

    <div v-if="isLoading" class="lesson-history__loading">
      {{ t('lessons.history.loading') }}
    </div>

    <div v-else-if="error" class="lesson-history__error">
      <span>{{ error }}</span>
      <button class="lesson-history__retry" @click="reload">&#8635;</button>
    </div>

    <div v-else-if="lessons.length === 0" class="lesson-history__empty">
      {{ t('lessons.history.empty') }}
    </div>

    <div
      v-for="lesson in lessons"
      :key="lesson.id"
      class="lesson-history__item"
    >
      <div class="lesson-history__info">
        <span class="lesson-history__student">{{ lesson.student_name || t('lessons.history.unknownStudent') }}</span>
        <span class="lesson-history__date">{{ formatDate(lesson.started_at || lesson.start) }}</span>
        <span
          class="lesson-history__status"
          :class="`lesson-history__status--${lesson.status.toLowerCase()}`"
        >
          {{ t(`lessons.status.${lesson.status}`) }}
        </span>
      </div>
      <div class="lesson-history__actions">
        <button
          class="lesson-history__clone-btn"
          :disabled="cloningId === lesson.id"
          :title="t('lessons.history.clone')"
          @click="handleClone(lesson.id)"
        >
          <template v-if="cloningId === lesson.id">
            <svg class="lesson-history__spinner" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </template>
          <template v-else>
            <svg xmlns="http://www.w3.org/2000/svg" class="lesson-history__icon" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z"/>
              <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z"/>
            </svg>
            {{ t('lessons.history.clone') }}
          </template>
        </button>
        <button
          class="lesson-history__save-tmpl-btn"
          :title="t('template.saveAsTemplate')"
          @click="openSaveAsTemplate(lesson.id)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="lesson-history__icon" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"/>
          </svg>
          {{ t('template.saveAsTemplate') }}
        </button>
      </div>
    </div>

    <SaveAsTemplateModal
      v-model="showTemplateModal"
      :lesson-id="selectedLessonId"
      @saved="onTemplateSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLessonHistory } from '../composables/useLessonHistory'
import SaveAsTemplateModal from '@/modules/lessons/components/SaveAsTemplateModal.vue'

const { t } = useI18n()
const { lessons, isLoading, error, reload, cloningId, cloneError, cloneLesson } = useLessonHistory()

async function handleClone(lessonId: number) {
  const result = await cloneLesson(lessonId)
  if (result) {
    // Clone succeeded — list already reloaded by composable
  }
}

const showTemplateModal = ref(false)
const selectedLessonId = ref<number | null>(null)

function openSaveAsTemplate(lessonId: number) {
  selectedLessonId.value = lessonId
  showTemplateModal.value = true
}

function onTemplateSaved(templateId: number) {
  // Template saved successfully
  showTemplateModal.value = false
  selectedLessonId.value = null
}

function formatDate(dt: string | null): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped>
.lesson-history {
  padding: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.lesson-history__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px;
}
.lesson-history__loading,
.lesson-history__empty {
  padding: 24px 8px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}
.lesson-history__error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  color: var(--danger-bg);
  font-size: 13px;
  background: color-mix(in srgb, var(--danger-bg) 8%, var(--card-bg));
  border-radius: 6px;
}
.lesson-history__retry {
  background: none;
  border: 1px solid color-mix(in srgb, var(--danger-bg) 40%, transparent);
  border-radius: 4px;
  color: var(--danger-bg);
  font-size: 14px;
  cursor: pointer;
  padding: 2px 8px;
}
.lesson-history__item {
  padding: 10px 8px;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.1s;
}
.lesson-history__item:hover {
  background: var(--bg-secondary);
}
.lesson-history__info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.lesson-history__student {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}
.lesson-history__date {
  font-size: 12px;
  color: var(--text-secondary);
}
.lesson-history__status {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}
.lesson-history__status--completed {
  background: color-mix(in srgb, var(--success-bg) 15%, var(--card-bg));
  color: var(--success-bg);
}
.lesson-history__status--in_progress {
  background: color-mix(in srgb, var(--info-bg) 15%, var(--card-bg));
  color: var(--info-bg);
}
.lesson-history__status--draft,
.lesson-history__status--scheduled {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}
.lesson-history__status--cancelled {
  background: color-mix(in srgb, var(--danger-bg) 12%, var(--card-bg));
  color: var(--danger-bg);
}
.lesson-history__actions {
  margin-top: 6px;
}
.lesson-history__clone-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.lesson-history__clone-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}
.lesson-history__clone-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.lesson-history__icon {
  width: 14px;
  height: 14px;
}
.lesson-history__spinner {
  width: 14px;
  height: 14px;
  animation: lh-spin 0.8s linear infinite;
}
.lesson-history__save-tmpl-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.lesson-history__save-tmpl-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}
@keyframes lh-spin {
  to { transform: rotate(360deg); }
}
</style>
