<template>
  <div class="course-planner">
    <h2 class="course-planner__title">{{ t('lessonConstructor.courses.plannerTitle') }}</h2>

    <form class="course-planner__form" @submit.prevent="onBuild">
      <label class="course-planner__field">
        <span>{{ t('lessonConstructor.courses.fieldTitle') }}</span>
        <input v-model="spec.title" type="text" required maxlength="256">
      </label>

      <label class="course-planner__field">
        <span>{{ t('lessonConstructor.courses.fieldLevel') }}</span>
        <input v-model="spec.level" type="text" required maxlength="64" placeholder="5 клас">
      </label>

      <label class="course-planner__field">
        <span>{{ t('lessonConstructor.courses.fieldLessons') }}</span>
        <input v-model.number="spec.n_lessons" type="number" min="1" max="200" required>
      </label>

      <label class="course-planner__field">
        <span>{{ t('lessonConstructor.courses.fieldTasksPer') }}</span>
        <input v-model.number="spec.tasks_per_lesson" type="number" min="1" max="30">
      </label>

      <label class="course-planner__field">
        <span>{{ t('lessonConstructor.courses.fieldCheckEvery') }}</span>
        <input v-model.number="checkpointEvery" type="number" min="1" max="50"
               :placeholder="t('lessonConstructor.courses.checkAuto')">
      </label>

      <!--
        ⚠️ Порядок вибору тем ЗБЕРІГАЄТЬСЯ і йде в topics_scope як є.
        Це вхід tie-break планувальника (ТЗ 7-1 §3.3.2): якби список
        сортувався за алфавітом, ми б відновили на рівні UI рівно той баг,
        який щойно виправили на BE — «Відсотки» перед «Дробами».
      -->
      <fieldset class="course-planner__topics">
        <legend>{{ t('lessonConstructor.courses.fieldTopics') }}</legend>
        <p class="course-planner__hint">{{ t('lessonConstructor.courses.topicsOrderHint') }}</p>

        <ol v-if="pickedTopics.length" class="course-planner__picked">
          <li v-for="(tid, i) in pickedTopics" :key="tid">
            <span>{{ i + 1 }}. {{ labelFor(tid) }}</span>
            <button type="button" :aria-label="t('lessonConstructor.courses.removeTopic')"
                    @click="removeTopic(tid)">×</button>
          </li>
        </ol>
        <p v-else class="course-planner__hint">{{ t('lessonConstructor.courses.topicsEmpty') }}</p>

        <select
          class="course-planner__topic-add"
          :value="''"
          :aria-label="t('lessonConstructor.courses.addTopic')"
          @change="addTopic(($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ t('lessonConstructor.courses.addTopic') }}</option>
          <option v-for="opt in availableTopics" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </fieldset>

      <div class="course-planner__actions">
        <button type="submit" :disabled="loading">
          {{ loading ? t('lessonConstructor.courses.building') : t('lessonConstructor.courses.buildPlan') }}
        </button>
      </div>
    </form>

    <p v-if="error" class="course-planner__error" role="alert">
      {{ error === 'notFound'
        ? t('lessonConstructor.courses.notFound')
        : t('lessonConstructor.courses.planError', { detail: error }) }}
    </p>

    <template v-if="hasPlan && plan">
      <CoursePlanPreview
        :plan="plan"
        :warnings="warnings"
        :density="density"
        :selected-orders="selectedOrders"
        selectable
        @toggle="toggleLesson"
        @select-all="setAllSelected"
      />

      <div class="course-planner__save">
        <button type="button" :disabled="saving" @click="onSave">
          {{ t('lessonConstructor.courses.saveDraft') }}
        </button>
        <button type="button" :disabled="saving || selectedCount === 0" @click="onSaveAndBuild">
          {{ t('lessonConstructor.courses.saveAndBuild', { n: selectedCount }) }}
        </button>
      </div>
    </template>

    <MaterializeReportView v-if="report" :report="report" @open="openSession" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { TOPICS } from '../api/lessonConstructorApi'
import CoursePlanPreview from '../components/CoursePlanPreview.vue'
import MaterializeReportView from '../components/MaterializeReport.vue'
import useCoursePlanner from '../composables/useCoursePlanner'

const { t } = useI18n()
const router = useRouter()

const {
  spec, plan, warnings, density, selectedOrders, loading, saving, error, report,
  hasPlan, selectedCount, buildPlan, toggleLesson, setAllSelected, saveCourse,
  saveAndMaterialize,
} = useCoursePlanner()

/** Локальний масив — саме він тримає ПОРЯДОК вибору. */
const pickedTopics = ref<string[]>([])
watch(pickedTopics, (v) => { spec.value.topics_scope = [...v] }, { deep: true })

const checkpointEvery = ref<number | null>(null)
watch(checkpointEvery, (v) => { spec.value.checkpoint_every = v || null })

const labelFor = (id: string) => TOPICS.find((x) => x.value === id)?.label || id
const availableTopics = computed(() =>
  TOPICS.filter((x) => !pickedTopics.value.includes(x.value)))

function addTopic(value: string): void {
  if (value && !pickedTopics.value.includes(value)) pickedTopics.value.push(value)
}
function removeTopic(value: string): void {
  pickedTopics.value = pickedTopics.value.filter((x) => x !== value)
}

async function onBuild(): Promise<void> { await buildPlan() }

async function onSave(): Promise<void> {
  const course = await saveCourse()
  if (course) router.push({ name: 'lesson-constructor-courses' }).catch(() => {})
}

async function onSaveAndBuild(): Promise<void> {
  if (!window.confirm(t('lessonConstructor.courses.confirmBuild', { n: selectedCount.value }))) return
  await saveAndMaterialize()
}

function openSession(sessionId: string): void {
  router.push({ name: 'winterboard-prepare', params: { id: sessionId } }).catch(() => {})
}
</script>

<style scoped>
.course-planner__form { display: flex; flex-wrap: wrap; gap: 0.9em; margin-bottom: 1.2em; }
.course-planner__field { display: flex; flex-direction: column; gap: 0.2em; font-size: 0.9em; }
.course-planner__topics { flex: 1 1 100%; border: 1px solid rgba(0,0,0,0.12); padding: 0.6em 0.9em; }
.course-planner__hint { font-size: 0.82em; opacity: 0.7; margin: 0.2em 0; }
.course-planner__picked { margin: 0.4em 0; padding-left: 1.2em; }
.course-planner__picked li { display: flex; gap: 0.5em; align-items: center; }
.course-planner__actions, .course-planner__save { display: flex; gap: 0.6em; margin: 1em 0; }
.course-planner__error { color: #dc3545; }
</style>
