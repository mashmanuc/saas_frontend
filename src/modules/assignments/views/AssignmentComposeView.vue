<!--
  Vertical Slice — тьютор створює ДЗ: назва + учень + 2–3 задачі → «Призначити».
  Одна дія = create draft → add items → assign. Без фільтрів/таблиць/статистики.
-->
<template>
  <div class="asg-compose">
    <h1 class="asg-h1">Нове домашнє завдання</h1>

    <label class="asg-label">Назва</label>
    <input v-model="title" class="asg-input" placeholder="Напр. Похідна — задачі 3–7" />

    <label class="asg-label">Учень</label>
    <select v-model="assigneeId" class="asg-input">
      <option :value="null" disabled>Оберіть учня…</option>
      <option v-for="s in students" :key="s.id" :value="s.id">{{ s.label }}</option>
    </select>
    <p v-if="!studentsLoading && !students.length" class="asg-hint">
      Немає активних учнів. Спершу запросіть учня.
    </p>

    <label class="asg-label">Задачі</label>
    <div v-for="(it, i) in items" :key="i" class="asg-item">
      <select v-model="it.item_type" class="asg-input asg-item-type">
        <option value="math_problem">Задача</option>
        <option value="text">Текст</option>
      </select>
      <textarea v-model="it.text" class="asg-input" rows="2" placeholder="Умова задачі…" />
      <button class="asg-x" title="Прибрати" :disabled="items.length <= 1" @click="items.splice(i, 1)">✕</button>
    </div>
    <button class="asg-btn asg-btn--ghost" @click="items.push({ item_type: 'math_problem', text: '' })">+ Ще задача</button>

    <div class="asg-actions">
      <button class="asg-btn" :disabled="!canAssign || busy" @click="assign">
        {{ busy ? 'Створюю…' : 'Призначити учню' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { assignmentsApi } from '../api/assignmentsApi'
import { useRelationsStore } from '@/stores/relationsStore'
import { notifyError, notifySuccess } from '@/utils/notify'

const router = useRouter()
const relations = useRelationsStore()

const title = ref('')
const assigneeId = ref(null)
const items = ref([{ item_type: 'math_problem', text: '' }])
const busy = ref(false)
const studentsLoading = ref(false)

const students = computed(() =>
  (relations.tutorRelations || [])
    .filter((r) => r.status === 'active' && r.student)
    .map((r) => ({ id: r.student.id, label: r.student.full_name || r.student.email || `#${r.student.id}` })),
)

const canAssign = computed(
  () => title.value.trim() && assigneeId.value && items.value.some((i) => i.text.trim()),
)

onMounted(async () => {
  studentsLoading.value = true
  try {
    await relations.fetchTutorRelations({ force: true })
  } catch (e) {
    notifyError('Не вдалося завантажити список учнів')
  } finally {
    studentsLoading.value = false
  }
})

async function assign() {
  if (!canAssign.value || busy.value) return
  busy.value = true
  try {
    const created = await assignmentsApi.createDraft({ assignee_id: assigneeId.value, title: title.value.trim() })
    const id = created.id
    for (const it of items.value.filter((i) => i.text.trim())) {
      await assignmentsApi.addItem(id, { item_type: it.item_type, content: { text: it.text.trim() } })
    }
    await assignmentsApi.assign(id)
    notifySuccess('Домашнє завдання призначено')
    router.push({ name: 'assignment-detail', params: { id } })
  } catch (e) {
    notifyError(e?.response?.data?.detail || 'Не вдалося призначити ДЗ')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.asg-compose { max-width: 640px; margin: 0 auto; padding: 24px 16px; }
.asg-h1 { font-size: 22px; font-weight: 700; margin-bottom: 16px; }
.asg-label { display: block; margin: 16px 0 6px; font-weight: 600; font-size: 14px; }
.asg-input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 15px; }
.asg-item { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 8px; }
.asg-item-type { width: 130px; flex: none; }
.asg-x { border: 0; background: #f3f3f3; border-radius: 8px; padding: 8px 10px; cursor: pointer; }
.asg-x:disabled { opacity: .4; cursor: default; }
.asg-hint { color: #999; font-size: 13px; margin-top: 6px; }
.asg-actions { margin-top: 24px; }
.asg-btn { background: #16a34a; color: #fff; border: 0; border-radius: 8px; padding: 12px 20px; font-size: 15px; font-weight: 600; cursor: pointer; }
.asg-btn:disabled { opacity: .5; cursor: default; }
.asg-btn--ghost { background: #f3f3f3; color: #111; margin-top: 4px; padding: 8px 14px; font-size: 14px; }
</style>
