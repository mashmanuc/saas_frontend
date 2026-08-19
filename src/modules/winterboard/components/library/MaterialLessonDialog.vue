<template>
  <div class="material-lesson" role="dialog" :aria-label="t('winterboard.materials.lessonTitle')">
    <h4>{{ t('winterboard.materials.lessonTitle') }}</h4>

    <!--
      Режими підписані людською мовою, а не enum-ами: тьютор не має знати
      слів `bank_only` / `materials` / `mixed`, він має розуміти, звідки
      візьмуться задачі.
    -->
    <fieldset class="material-lesson__policy">
      <legend>{{ t('winterboard.materials.policyLegend') }}</legend>
      <label v-for="p in POLICIES" :key="p" class="material-lesson__radio">
        <input v-model="policy" type="radio" :value="p" name="source-policy">
        <span>{{ t(`winterboard.materials.policy.${p}`) }}</span>
      </label>
    </fieldset>

    <label class="material-lesson__count">
      {{ t('winterboard.materials.taskCount') }}
      <input v-model.number="taskCount" type="number" min="1" max="30">
    </label>

    <!--
      Заглушку знято в 6-5: серіалізатор тепер оголошує `source_policy` і
      `source_material_ids` І передає їх у `to_lesson_spec()` — оголошення без
      мапінгу було б тією самою дірою, тільки на рядок нижче.
    -->
    <div class="material-lesson__actions">
      <button
        type="button"
        :disabled="busy"
        @click="$emit('generate', { policy, taskCount })"
      >
        {{ t('winterboard.materials.generate') }}
      </button>
      <button type="button" @click="$emit('close')">{{ t('winterboard.materials.close') }}</button>
    </div>

    <p v-if="busy" class="material-lesson__busy" role="status">
      {{ t('winterboard.materials.generating') }}
    </p>

    <p v-if="error" class="material-lesson__error" role="alert">{{ error }}</p>

    <template v-if="result">
      <p class="material-lesson__ok">
        {{ t('winterboard.materials.lessonReady', { n: result.task_count }) }}
      </p>

      <!--
        `shortfall` помітно, не виноскою: тьютор просив 10, отримав 6 — він
        має розуміти, що це не збій, а межа його матеріалу, і що банк у
        цьому режимі свідомо не добирає.
      -->
      <p v-if="result.shortfall" class="material-lesson__shortfall" role="status">
        {{ t('winterboard.materials.shortfall', {
          requested: result.shortfall.requested, got: result.shortfall.got }) }}
        <span class="material-lesson__shortfall-detail">{{ result.shortfall.detail }}</span>
      </p>

      <!--
        `rejected` показуємо ПОВНІСТЮ й із причинами від BE
        (`materials_source.REJECT_REASONS`) — свої не вигадуємо. Мовчазний
        зріз заборонено: урок Хвилі 5.
      -->
      <section v-if="rejectedGroups.length" class="material-lesson__rejected">
        <h5>{{ t('winterboard.materials.rejectedTitle', { n: rejectedCount }) }}</h5>
        <ul>
          <li v-for="g in rejectedGroups" :key="g.reason">
            <strong>{{ g.count }}</strong> — {{ g.detail }}
            <span v-if="g.numbers.length" class="material-lesson__numbers">
              ({{ t('winterboard.materials.rejectedNumbers', { list: g.numbers.join(', ') }) }})
            </span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

/** Порядок навмисний: спершу те, заради чого пакет існує. */
const POLICIES = ['materials', 'mixed', 'bank_only'] as const

export interface RejectedItem {
  reason: string
  detail: string
  page_no: number
  number?: string
}

export interface LessonResult {
  session_id?: string
  task_count: number
  shortfall?: { requested: number; got: number; detail: string }
  rejected?: RejectedItem[]
}

const props = defineProps<{
  busy?: boolean
  error?: string | null
  result?: LessonResult | null
}>()
defineEmits<{
  (e: 'generate', payload: { policy: string; taskCount: number }): void
  (e: 'close'): void
}>()

const { t } = useI18n()
const policy = ref<string>('materials')
const taskCount = ref(6)

const rejectedCount = computed(() => (props.result?.rejected || []).length)

/** Групуємо за причиною — 22 однакових рядки нічого не пояснюють. */
const rejectedGroups = computed(() => {
  const map = new Map<string, { reason: string; detail: string; count: number; numbers: string[] }>()
  for (const r of props.result?.rejected || []) {
    const g = map.get(r.reason) || { reason: r.reason, detail: r.detail, count: 0, numbers: [] }
    g.count += 1
    if (r.number) g.numbers.push(r.number)
    map.set(r.reason, g)
  }
  return [...map.values()]
})

defineExpose({ policy, taskCount })
</script>

<style scoped>
.material-lesson { border: 1px solid rgba(0,0,0,0.14); padding: 0.9em 1.1em; margin: 0.8em 0; }
.material-lesson__policy { border: 0; padding: 0; margin: 0.6em 0; }
.material-lesson__radio { display: block; margin: 0.25em 0; }
.material-lesson__count { display: block; margin: 0.6em 0; }
.material-lesson__actions { display: flex; gap: 0.6em; margin: 0.8em 0; }
.material-lesson__ok { color: #197c4b; font-weight: 600; }
.material-lesson__shortfall { border-left: 4px solid #d97706; background: rgba(217,119,6,0.07);
  padding: 0.5em 0.8em; }
.material-lesson__shortfall-detail { display: block; font-size: 0.86em; opacity: 0.85; }
.material-lesson__rejected { margin-top: 0.8em; font-size: 0.9em; }
.material-lesson__numbers { opacity: 0.7; }
.material-lesson__error { color: #dc3545; }
</style>
