<!--
  GlobalActiveLessonBanner — тонка смужка «🔴 Урок зараз іде → Повернутися» на КОЖНІЙ
  authenticated page-сторінці (монтується у PageShell), поки в користувача є IN_PROGRESS урок.

  Навіщо: discoverability. Учитель, що випадково вийшов / втратив зв'язок, повертається на
  сайт і потрапляє НЕ на Головну — без цього банера він не знає, як повернутись у живий урок
  (раніше шукав «Проведені уроки» → solo-в'юха → розсинхрон). Тепер бачить кнопку «Повернутися»
  → classroom-рантайм (де reconnect/catchUp resync-ить).

  Не дублює home: на dashboard-home DashboardHero вже показує цей CTA → тут ховаємо.
  Best-effort: помилка fetch → банер просто не показується, сторінку не блокує.
-->
<template>
  <div v-if="show" class="gal-banner" role="status" aria-live="polite">
    <span class="gal-banner__pulse" aria-hidden="true" />
    <span class="gal-banner__text">
      {{ t('dashboard.cta.join_lesson.in_progress') }}<template v-if="peerName"> · {{ peerName }}</template>
    </span>
    <button type="button" class="gal-banner__btn" @click="goToLesson">
      {{ t('dashboard.cta.join_lesson.label') }}
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import lessonsApi from '@/api/lessons'
import { useAuthStore } from '@/modules/auth/store/authStore'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const activeLesson = ref(null)
let pollTimer = null

// На dashboard-home DashboardHero вже рендерить «Урок зараз іде» → не дублюємо.
const HOME_ROUTES = ['tutor-dashboard', 'student-dashboard']
const show = computed(
  () => !!activeLesson.value && !HOME_ROUTES.includes(String(route.name)),
)

const peerName = computed(() => {
  const l = activeLesson.value
  if (!l) return ''
  return authStore.user?.role === 'tutor' ? (l.student_name || '') : (l.tutor_name || '')
})

async function fetchActiveLesson() {
  try {
    const res = await lessonsApi.getActiveLessons({ status: 'in_progress' }, { silent: true })
    const list = res?.results ?? res?.data?.results ?? []
    activeLesson.value = list.find((l) => String(l?.status).toLowerCase() === 'in_progress') ?? null
  } catch {
    activeLesson.value = null // best-effort discoverability — never blocks the page
  }
}

function goToLesson() {
  const id = activeLesson.value?.id
  if (id != null) router.push(`/winterboard/classroom/${id}`)
}

onMounted(() => {
  fetchActiveLesson()
  // Лёгкий poll — банер з'являється при старті уроку і зникає при завершенні.
  // Ключовий кейс (reopen після розриву) покривається mount-фетчем одразу.
  pollTimer = window.setInterval(fetchActiveLesson, 60_000)
})
onBeforeUnmount(() => {
  if (pollTimer) window.clearInterval(pollTimer)
})
</script>

<style scoped>
.gal-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1.25rem;
  background: #fef2f2;
  border-bottom: 1px solid #fca5a5;
  color: #b91c1c;
  font-size: 0.875rem;
  font-weight: 600;
}
.gal-banner__pulse {
  flex: none;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background: #ef4444;
  animation: gal-pulse 1.5s ease-in-out infinite;
}
@keyframes gal-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}
.gal-banner__text { flex: 1 1 auto; }
.gal-banner__btn {
  flex: none;
  padding: 0.35rem 1.1rem;
  border: none;
  border-radius: 0.5rem;
  background: #ef4444;
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
}
.gal-banner__btn:hover { background: #dc2626; }
</style>
