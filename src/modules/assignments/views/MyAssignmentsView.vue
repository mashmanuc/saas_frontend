<!--
  Vertical Slice — список ДЗ (role-aware: тьютор бачить створені, учень — видані).
  Мінімум: назва + статус + клік у деталі. Без фільтрів/сортувань/пошуку/таблиць.
-->
<template>
  <div class="asg-list">
    <div class="asg-top">
      <h1 class="asg-h1">Домашні завдання</h1>
      <button v-if="isTutor" class="asg-btn" @click="router.push({ name: 'assignment-compose' })">+ Створити ДЗ</button>
    </div>

    <p v-if="loading" class="asg-hint">Завантаження…</p>
    <p v-else-if="!items.length" class="asg-hint">Домашніх завдань ще немає.</p>

    <ul v-else class="asg-ul">
      <li v-for="a in items" :key="a.id" class="asg-row" @click="router.push({ name: 'assignment-detail', params: { id: a.id } })">
        <span class="asg-title">{{ a.title }}</span>
        <span class="asg-status" :data-s="a.status">{{ statusLabel(a.status) }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { assignmentsApi } from '../api/assignmentsApi'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { notifyError } from '@/utils/notify'

const router = useRouter()
const auth = useAuthStore()
const items = ref([])
const loading = ref(true)

const isTutor = computed(() => ['tutor', 'admin', 'superadmin'].includes(auth.user?.role))

const STATUS = {
  draft: 'Чернетка', assigned: 'Видано', submitted: 'Здано', graded: 'Оцінено', closed: 'Закрито',
}
const statusLabel = (s) => STATUS[s] || s

onMounted(async () => {
  try {
    items.value = await assignmentsApi.list()
  } catch (e) {
    notifyError('Не вдалося завантажити ДЗ')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.asg-list { max-width: 720px; margin: 0 auto; padding: 24px 16px; }
.asg-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.asg-h1 { font-size: 22px; font-weight: 700; }
.asg-hint { color: #999; }
.asg-ul { list-style: none; margin: 0; padding: 0; }
.asg-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border: 1px solid #eee; border-radius: 10px; margin-bottom: 8px; cursor: pointer; }
.asg-row:hover { background: #f7f7f8; }
.asg-title { font-weight: 600; }
.asg-status { font-size: 13px; color: #555; background: #f1f1f1; border-radius: 999px; padding: 3px 10px; }
.asg-status[data-s="graded"] { background: #dcfce7; color: #166534; }
.asg-status[data-s="submitted"] { background: #fef9c3; color: #854d0e; }
.asg-btn { background: #16a34a; color: #fff; border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 600; cursor: pointer; }
</style>
