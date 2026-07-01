<!--
  Vertical Slice — деталі ДЗ. Задачі + role-aware дія:
  учень (assigned) → «Здати»; тьютор (submitted) → «Оцінити». Мінімум.
-->
<template>
  <div class="asg-detail" v-if="a">
    <button class="asg-back" @click="router.push({ name: 'assignments-list' })">← До списку</button>
    <h1 class="asg-h1">{{ a.title }}</h1>
    <span class="asg-status" :data-s="a.status">{{ statusLabel(a.status) }}</span>

    <h2 class="asg-h2">Задачі</h2>
    <ol class="asg-items">
      <li v-for="it in a.items" :key="it.id">{{ it.content?.text || '—' }}</li>
    </ol>

    <!-- Учень: здати -->
    <section v-if="isStudent && a.status === 'assigned'" class="asg-block">
      <h2 class="asg-h2">Ваша відповідь</h2>
      <textarea v-model="answer" class="asg-input" rows="4" placeholder="Напишіть розв’язок…" />
      <button class="asg-btn" :disabled="!answer.trim() || busy" @click="submit">
        {{ busy ? 'Надсилаю…' : 'Здати' }}
      </button>
    </section>

    <!-- Здача (видно обом) -->
    <section v-if="latestSubmission" class="asg-block">
      <h2 class="asg-h2">Здача</h2>
      <p class="asg-sub-text">{{ latestSubmission.text || '(без тексту)' }}</p>
      <p v-if="latestSubmission.status === 'graded'" class="asg-grade">
        Оцінка: <b>{{ latestSubmission.grade }}</b> · {{ latestSubmission.feedback }}
      </p>
    </section>

    <!-- Тьютор: оцінити -->
    <section v-if="isTutor && a.status === 'submitted'" class="asg-block">
      <h2 class="asg-h2">Оцінювання</h2>
      <input v-model="grade" class="asg-input asg-grade-input" type="number" step="0.01" placeholder="Оцінка" />
      <textarea v-model="feedback" class="asg-input" rows="3" placeholder="Фідбек…" />
      <button class="asg-btn" :disabled="busy" @click="doGrade">
        {{ busy ? 'Зберігаю…' : 'Оцінити' }}
      </button>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { assignmentsApi } from '../api/assignmentsApi'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { notifyError, notifySuccess } from '@/utils/notify'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const a = ref(null)
const answer = ref('')
const grade = ref('')
const feedback = ref('')
const busy = ref(false)

const isTutor = computed(() => a.value && auth.user?.id === a.value.created_by_id)
const isStudent = computed(() => a.value && auth.user?.id === a.value.assignee_id)
const latestSubmission = computed(() => a.value?.submissions?.[0] || null)

const STATUS = { draft: 'Чернетка', assigned: 'Видано', submitted: 'Здано', graded: 'Оцінено', closed: 'Закрито' }
const statusLabel = (s) => STATUS[s] || s

async function load() {
  a.value = await assignmentsApi.get(route.params.id)
}

onMounted(async () => {
  try {
    await load()
  } catch (e) {
    notifyError('Не вдалося завантажити ДЗ')
  }
})

async function submit() {
  if (!answer.value.trim() || busy.value) return
  busy.value = true
  try {
    await assignmentsApi.submit(a.value.id, { text: answer.value.trim() })
    notifySuccess('Відповідь надіслано')
    answer.value = ''
    await load()
  } catch (e) {
    notifyError(e?.response?.data?.detail || 'Не вдалося здати')
  } finally {
    busy.value = false
  }
}

async function doGrade() {
  if (busy.value) return
  busy.value = true
  try {
    await assignmentsApi.grade(a.value.id, { grade: grade.value || null, feedback: feedback.value })
    notifySuccess('Оцінку збережено')
    await load()
  } catch (e) {
    notifyError(e?.response?.data?.detail || 'Не вдалося оцінити')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.asg-detail { max-width: 720px; margin: 0 auto; padding: 24px 16px; }
.asg-back { border: 0; background: #f3f3f3; border-radius: 8px; padding: 6px 12px; cursor: pointer; margin-bottom: 12px; }
.asg-h1 { font-size: 22px; font-weight: 700; display: inline-block; margin-right: 10px; }
.asg-h2 { font-size: 16px; font-weight: 700; margin: 20px 0 8px; }
.asg-status { font-size: 13px; color: #555; background: #f1f1f1; border-radius: 999px; padding: 3px 10px; }
.asg-status[data-s="graded"] { background: #dcfce7; color: #166534; }
.asg-status[data-s="submitted"] { background: #fef9c3; color: #854d0e; }
.asg-items { padding-left: 20px; }
.asg-items li { margin-bottom: 6px; }
.asg-block { border-top: 1px solid #eee; margin-top: 16px; padding-top: 8px; }
.asg-input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 15px; margin-bottom: 8px; }
.asg-grade-input { width: 140px; }
.asg-sub-text { white-space: pre-wrap; background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 10px 12px; }
.asg-grade { margin-top: 8px; color: #166534; }
.asg-btn { background: #16a34a; color: #fff; border: 0; border-radius: 8px; padding: 10px 18px; font-weight: 600; cursor: pointer; }
.asg-btn:disabled { opacity: .5; cursor: default; }
</style>
