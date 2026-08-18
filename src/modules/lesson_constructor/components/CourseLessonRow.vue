<template>
  <tr class="course-lesson-row" :class="{ 'course-lesson-row--check': lesson.checkpoint }">
    <td v-if="selectable" class="course-lesson-row__pick">
      <input
        type="checkbox"
        :checked="selected"
        :aria-label="t('lessonConstructor.courses.includeLesson', { n: lesson.order })"
        @change="$emit('toggle', lesson.order, ($event.target as HTMLInputElement).checked)"
      >
    </td>

    <td class="course-lesson-row__order">{{ lesson.order }}</td>

    <td class="course-lesson-row__title">
      <span class="course-lesson-row__name">{{ lesson.title || lesson.topic_id }}</span>
      <span v-if="lesson.objective" class="course-lesson-row__objective">
        {{ lesson.objective }}
      </span>
      <!--
        prereq_kind === 'ordering' -> «йде після», НЕ «потребує знань».
        Графи передумов у проєкті немає (C9), і UI не вдає, що є.
      -->
      <span
        v-if="orderingAfter.length"
        class="course-lesson-row__after"
      >{{ t('lessonConstructor.courses.goesAfter') }}: {{ orderingAfter.join(', ') }}</span>
    </td>

    <td class="course-lesson-row__type">
      <span class="course-lesson-row__badge" :class="`is-${lesson.lesson_type}`">
        {{ t(`lessonConstructor.courses.lessonType.${lesson.lesson_type}`) }}
      </span>
      <span v-if="lesson.checkpoint" class="course-lesson-row__check-mark" :title="t('lessonConstructor.courses.checkpoint')">
        ✓ {{ t('lessonConstructor.courses.checkpoint') }}
      </span>
    </td>

    <td v-if="showTasks" class="course-lesson-row__tasks">{{ lesson.tasks }}</td>

    <td v-if="showState" class="course-lesson-row__state">
      <span v-if="sessionId" class="course-lesson-row__built">
        {{ t('lessonConstructor.courses.built') }}
      </span>
      <span v-else class="course-lesson-row__planned">
        {{ t('lessonConstructor.courses.planned') }}
      </span>
    </td>

    <td v-if="showActions" class="course-lesson-row__actions">
      <button
        v-if="sessionId"
        type="button"
        class="course-lesson-row__btn course-lesson-row__btn--primary"
        @click="$emit('open', sessionId)"
      >{{ t('lessonConstructor.courses.conduct') }}</button>
      <button
        v-else-if="!readonly"
        type="button"
        class="course-lesson-row__btn"
        :disabled="busy"
        @click="$emit('build', lesson.order)"
      >{{ t('lessonConstructor.courses.buildOne') }}</button>
    </td>
  </tr>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { TOPICS } from '../api/lessonConstructorApi'

interface RowLesson {
  order: number
  topic_id: string
  title?: string
  objective?: string
  lesson_type: string
  checkpoint: boolean
  prerequisites?: string[]
  prereq_kind?: string
  tasks?: number
  session_id?: string | null
}

const props = withDefaults(defineProps<{
  lesson: RowLesson
  selected?: boolean
  selectable?: boolean
  showTasks?: boolean
  showState?: boolean
  showActions?: boolean
  readonly?: boolean
  busy?: boolean
}>(), {
  selected: true, selectable: false, showTasks: false,
  showState: false, showActions: false, readonly: false, busy: false,
})

defineEmits<{
  (e: 'toggle', order: number, on: boolean): void
  (e: 'open', sessionId: string): void
  (e: 'build', order: number): void
}>()

const { t } = useI18n()

const sessionId = computed(() => props.lesson.session_id || null)

const labelFor = (id: string) => TOPICS.find((x) => x.value === id)?.label || id

/**
 * Показуємо `prerequisites` ЛИШЕ коли `prereq_kind === 'ordering'` — тобто
 * коли ми точно знаємо, що це порядок. Будь-яке інше значення означало б
 * контракт, якого ми не бачили, і мовчки називати його «йде після» не можна.
 */
const orderingAfter = computed(() => {
  if (props.lesson.prereq_kind !== 'ordering') return []
  return (props.lesson.prerequisites || []).map(labelFor)
})
</script>

<style scoped>
.course-lesson-row__name { display: block; font-weight: 600; }
.course-lesson-row__objective { display: block; font-size: 0.85em; opacity: 0.75; }
.course-lesson-row__after { display: block; font-size: 0.78em; opacity: 0.6; }
.course-lesson-row__badge { padding: 0.1em 0.5em; border-radius: 0.4em; font-size: 0.8em; }
.course-lesson-row--check { background: rgba(255, 193, 7, 0.08); }
.course-lesson-row__check-mark { margin-left: 0.4em; font-size: 0.78em; }
.course-lesson-row__built { color: #197c4b; font-weight: 600; }
.course-lesson-row__planned { opacity: 0.6; }
.course-lesson-row__btn { padding: 0.25em 0.7em; cursor: pointer; }
</style>
