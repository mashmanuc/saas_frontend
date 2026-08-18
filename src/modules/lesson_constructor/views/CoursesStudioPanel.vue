<template>
  <div class="courses-studio">
    <CoursePlannerPage v-if="view === 'planner'" />
    <CourseListPage v-else @new-course="view = 'planner'" />

    <div class="courses-studio__switch">
      <button type="button" @click="view = view === 'planner' ? 'list' : 'planner'">
        {{ view === 'planner'
          ? t('lessonConstructor.courses.listTitle')
          : t('lessonConstructor.courses.plannerTitle') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Обгортка режиму «Курси» у Студії уроків.
 *
 * Існує, щоб `WBBoardList.vue` (чужий файл, бюджет ≤ 15 рядків) знав про
 * ОДИН компонент, а перемикання «планувальник ↔ список» жило у нашій зоні.
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import CourseListPage from './CourseListPage.vue'
import CoursePlannerPage from './CoursePlannerPage.vue'

const { t } = useI18n()
const view = ref<'planner' | 'list'>('list')
</script>

<style scoped>
.courses-studio__switch { margin-top: 1em; }
</style>
