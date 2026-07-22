<!--
  ДЗ конкретного учня (product intent 2026-07-22, ASSIGNMENT_SSOT §План активації п.1).
  Вхід — кнопка «Домашні завдання» на картці учня (TutorStudents). Показує ДЗ саме
  цього учня (фільтр по assignee на FE — щоб не міняти BE-контракт, INV-UX-1) +
  кнопку створити нове (compose з передвибраним учнем). За флагом ASSIGNMENTS_ENABLED.
-->
<template>
  <div class="stu-asg">
    <div class="stu-asg__top">
      <div>
        <button class="stu-asg__back" @click="goBack">← {{ t('assignments.student.backToStudents') }}</button>
        <h1 class="stu-asg__h1">{{ t('assignments.student.title', { name: studentName }) }}</h1>
      </div>
      <button class="stu-asg__new" @click="createNew">+ {{ t('assignments.student.create') }}</button>
    </div>

    <p v-if="loading" class="stu-asg__hint">{{ t('common.loading') }}</p>

    <template v-else>
      <p v-if="!items.length" class="stu-asg__empty">{{ t('assignments.student.empty') }}</p>
      <ul v-else class="stu-asg__ul">
        <li
          v-for="a in items"
          :key="a.id"
          class="stu-asg__row"
          @click="open(a.id)"
        >
          <span class="stu-asg__title">{{ a.title }}</span>
          <span class="stu-asg__status" :data-s="a.status">{{ statusLabel(a.status) }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { assignmentsApi } from '../api/assignmentsApi'
import { useRelationsStore } from '@/stores/relationsStore'
import { notifyError } from '@/utils/notify'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const relations = useRelationsStore()

const studentId = computed(() => String(route.params.studentId || ''))
const items = ref([])
const loading = ref(true)

// Ім'я учня — зі store relations (для заголовка); fallback — query ?name.
const studentName = computed(() => {
  const r = (relations.tutorRelations || []).find((x) => x.student && String(x.student.id) === studentId.value)
  return (r && r.student && (r.student.full_name || r.student.email))
    || String(route.query.name || '')
    || `#${studentId.value}`
})

const STATUS = {
  draft: () => t('assignments.status.draft'),
  assigned: () => t('assignments.status.assigned'),
  submitted: () => t('assignments.status.submitted'),
  graded: () => t('assignments.status.graded'),
  closed: () => t('assignments.status.closed'),
}
const statusLabel = (s) => (STATUS[s] ? STATUS[s]() : s)

onMounted(async () => {
  try {
    // relations — для імені; можуть бути ще не завантажені
    if (!relations.tutorRelations || !relations.tutorRelations.length) {
      await relations.fetchTutorRelations({ force: false }).catch(() => {})
    }
    const all = await assignmentsApi.list()
    // Фільтр по учню на FE (BE-list віддає всі ДЗ тьютора; контракт не міняємо).
    items.value = (Array.isArray(all) ? all : []).filter(
      (a) => String(a.assignee_id ?? a.assignee?.id ?? '') === studentId.value,
    )
  } catch (e) {
    notifyError(t('assignments.student.loadError'))
  } finally {
    loading.value = false
  }
})

function open(id) {
  router.push({ name: 'assignment-detail', params: { id } })
}
function createNew() {
  router.push({ name: 'assignment-compose', query: { student: studentId.value, name: studentName.value } })
}
function goBack() {
  router.push('/tutor/students')
}
</script>

<style scoped>
.stu-asg { max-width: 720px; margin: 0 auto; padding: 24px 16px; }
.stu-asg__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.stu-asg__back { background: none; border: 0; color: var(--text-secondary, #6b7280); cursor: pointer; padding: 0 0 6px; font-size: 13px; }
.stu-asg__back:hover { color: var(--accent, #16a34a); }
.stu-asg__h1 { font-size: 22px; font-weight: 700; color: var(--text-primary, #111827); }
.stu-asg__new { background: var(--accent, #16a34a); color: #fff; border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.stu-asg__new:hover { filter: brightness(0.95); }
.stu-asg__hint, .stu-asg__empty { color: var(--text-secondary, #9ca3af); padding: 24px 0; text-align: center; }
.stu-asg__ul { list-style: none; margin: 0; padding: 0; }
.stu-asg__row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border: 1px solid var(--border-color, #eee); border-radius: 10px; margin-bottom: 8px; cursor: pointer; }
.stu-asg__row:hover { background: var(--bg-hover, #f7f7f8); }
.stu-asg__title { font-weight: 600; color: var(--text-primary, #111827); }
.stu-asg__status { font-size: 13px; color: #555; background: #f1f1f1; border-radius: 999px; padding: 3px 10px; white-space: nowrap; }
.stu-asg__status[data-s="graded"] { background: #dcfce7; color: #166534; }
.stu-asg__status[data-s="submitted"] { background: #fef9c3; color: #854d0e; }
</style>
