<template>
  <section class="course-plan-preview">
    <!--
      warnings ПЕРШИМИ і помітно, не дрібним шрифтом унизу.
      Це головна чесність планувальника: «тему пропущено — 0 задач»,
      «рівень не фільтрує теми». Сховати їх = віддати тьютору курс,
      який виглядає повним, а насправді не той, що він просив.
    -->
    <div v-if="warnings.length" class="course-plan-preview__warnings" role="status">
      <h4 class="course-plan-preview__warnings-title">
        {{ t('lessonConstructor.courses.warningsTitle', { n: warnings.length }) }}
      </h4>
      <ul>
        <li v-for="(w, i) in warnings" :key="i">{{ w }}</li>
      </ul>
    </div>

    <div class="course-plan-preview__bar">
      <strong>{{ t('lessonConstructor.courses.lessonsCount', { n: plan.lessons.length }) }}</strong>
      <span v-if="selectable" class="course-plan-preview__selected">
        {{ t('lessonConstructor.courses.selected', { n: selectedOrders.size }) }}
      </span>
      <button v-if="selectable" type="button" @click="$emit('select-all', true)">
        {{ t('lessonConstructor.courses.selectAll') }}
      </button>
      <button v-if="selectable" type="button" @click="$emit('select-all', false)">
        {{ t('lessonConstructor.courses.selectNone') }}
      </button>
    </div>

    <table class="course-plan-preview__table">
      <thead>
        <tr>
          <th v-if="selectable" scope="col"><span class="sr-only">{{ t('lessonConstructor.courses.include') }}</span></th>
          <th scope="col">#</th>
          <th scope="col">{{ t('lessonConstructor.courses.lesson') }}</th>
          <th scope="col">{{ t('lessonConstructor.courses.type') }}</th>
          <th scope="col">{{ t('lessonConstructor.courses.tasks') }}</th>
        </tr>
      </thead>
      <tbody>
        <CourseLessonRow
          v-for="l in plan.lessons"
          :key="l.order"
          :lesson="l"
          :selectable="selectable"
          :selected="selectedOrders.has(l.order)"
          show-tasks
          @toggle="(order, on) => $emit('toggle', order, on)"
        />
      </tbody>
    </table>

    <!-- density згорнутий: корисний, але не те, з чого починають читати план -->
    <details v-if="densityRows.length" class="course-plan-preview__density">
      <summary>{{ t('lessonConstructor.courses.densityTitle') }}</summary>
      <ul>
        <li v-for="row in densityRows" :key="row.topic">
          {{ row.label }} — {{ t('lessonConstructor.courses.inBank', { n: row.n }) }}
        </li>
      </ul>
    </details>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { CoursePlan } from '../api/courseApi'
import { TOPICS } from '../api/lessonConstructorApi'
import CourseLessonRow from './CourseLessonRow.vue'

const props = withDefaults(defineProps<{
  plan: CoursePlan
  warnings?: string[]
  density?: Record<string, { n_bank: number }>
  selectedOrders?: Set<number>
  selectable?: boolean
}>(), {
  warnings: () => [], density: () => ({}),
  selectedOrders: () => new Set<number>(), selectable: true,
})

defineEmits<{
  (e: 'toggle', order: number, on: boolean): void
  (e: 'select-all', on: boolean): void
}>()

const { t } = useI18n()

const densityRows = computed(() =>
  Object.entries(props.density || {}).map(([topic, d]) => ({
    topic,
    label: TOPICS.find((x) => x.value === topic)?.label || topic,
    n: d?.n_bank ?? 0,
  })).sort((a, b) => b.n - a.n),
)
</script>

<style scoped>
.course-plan-preview__warnings {
  border-left: 4px solid #e0a800;
  background: rgba(255, 193, 7, 0.1);
  padding: 0.6em 0.9em;
  margin-bottom: 1em;
}
.course-plan-preview__warnings-title { margin: 0 0 0.3em; font-size: 0.95em; }
.course-plan-preview__bar { display: flex; gap: 0.7em; align-items: center; margin-bottom: 0.6em; }
.course-plan-preview__table { width: 100%; border-collapse: collapse; }
.course-plan-preview__table th { text-align: left; font-size: 0.85em; opacity: 0.7; }
.course-plan-preview__density { margin-top: 1em; font-size: 0.9em; }
.sr-only {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap;
}
</style>
