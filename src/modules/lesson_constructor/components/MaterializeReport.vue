<template>
  <section class="materialize-report" role="status" aria-live="polite">
    <h4 class="materialize-report__title">
      {{ t('lessonConstructor.courses.reportTitle') }}
    </h4>

    <!--
      ТРИ списки, не тост «готово».
      Якщо 2 з 8 уроків не зібрались через TaskSelectionError, тьютор має
      побачити це ЗАРАЗ, а не на уроці перед учнем. Тому failed іде першим
      і не згортається.
    -->
    <div v-if="report.failed.length" class="materialize-report__block materialize-report__block--failed">
      <h5>{{ t('lessonConstructor.courses.reportFailed', { n: report.failed.length }) }}</h5>
      <ul>
        <li v-for="f in report.failed" :key="f.order">
          <strong>{{ t('lessonConstructor.courses.lessonN', { n: f.order }) }}</strong>
          — <code>{{ f.error }}</code>
          <span class="materialize-report__detail">{{ f.detail }}</span>
        </li>
      </ul>
    </div>

    <div v-if="report.created.length" class="materialize-report__block materialize-report__block--created">
      <h5>{{ t('lessonConstructor.courses.reportCreated', { n: report.created.length }) }}</h5>
      <ul>
        <li v-for="c in report.created" :key="c.order">
          {{ t('lessonConstructor.courses.lessonN', { n: c.order }) }}
          <button type="button" class="materialize-report__open" @click="$emit('open', c.session_id)">
            {{ t('lessonConstructor.courses.conduct') }}
          </button>
        </li>
      </ul>
    </div>

    <div v-if="report.skipped.length" class="materialize-report__block materialize-report__block--skipped">
      <h5>{{ t('lessonConstructor.courses.reportSkipped', { n: report.skipped.length }) }}</h5>
      <ul>
        <li v-for="s in report.skipped" :key="s.order">
          {{ t('lessonConstructor.courses.lessonN', { n: s.order }) }}
          — {{ t('lessonConstructor.courses.alreadyBuilt') }}
        </li>
      </ul>
    </div>

    <p v-if="isEmpty" class="materialize-report__empty">
      {{ t('lessonConstructor.courses.reportEmpty') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MaterializeReport } from '../api/courseApi'

const props = defineProps<{ report: MaterializeReport }>()
defineEmits<{ (e: 'open', sessionId: string): void }>()

const { t } = useI18n()

const isEmpty = computed(() =>
  !props.report.created.length
  && !props.report.skipped.length
  && !props.report.failed.length)
</script>

<style scoped>
.materialize-report__block { margin-bottom: 0.8em; padding: 0.5em 0.8em; border-radius: 0.4em; }
.materialize-report__block--failed { background: rgba(220, 53, 69, 0.1); border-left: 4px solid #dc3545; }
.materialize-report__block--created { background: rgba(25, 124, 75, 0.08); border-left: 4px solid #197c4b; }
.materialize-report__block--skipped { background: rgba(0, 0, 0, 0.04); border-left: 4px solid #999; }
.materialize-report__block h5 { margin: 0 0 0.3em; font-size: 0.9em; }
.materialize-report__detail { display: block; font-size: 0.8em; opacity: 0.75; }
.materialize-report__open { margin-left: 0.5em; cursor: pointer; }
</style>
