<!--
  TLV2-01/02 · оболонка Teacher Lesson V2.

  Сторінка питає бекенд, чи існує V2 для цього користувача:
    200 → оболонка з пілотним уроком;
    404 → повертає на студію V1, нічого не показуючи;
    інше → видима помилка без повтору.

  TLV2-02: «Підготувати урок на дошці» — один POST; бекенд створює нову WBSession з
  п'ятьма сторінками через Ops, а сторінка відкриває її чинною дошкою Winterboard.
  Дошки, ops, WebSocket і власного запису в модулі немає.
-->
<template>
  <main class="tlv2" data-testid="tlv2-home" :data-state="state">
    <p v-if="state === 'checking'" class="tlv2-muted" data-testid="tlv2-checking">
      {{ t('teacherLessonV2.checking') }}
    </p>
    <div v-else-if="state === 'error'" role="alert" class="tlv2-error" data-testid="tlv2-error">
      {{ t('teacherLessonV2.error') }}
    </div>
    <section v-else-if="state === 'enabled'" class="tlv2-shell" data-testid="tlv2-shell">
      <h1 class="tlv2-title">{{ t('teacherLessonV2.title') }}</h1>
      <p class="tlv2-muted">{{ t('teacherLessonV2.shellNote') }}</p>

      <article class="tlv2-lesson" data-testid="tlv2-pilot">
        <h2 class="tlv2-lesson-title">{{ t('teacherLessonV2.pilot.title') }}</h2>
        <p class="tlv2-muted">{{ t('teacherLessonV2.pilot.pages') }}</p>
        <button
          type="button"
          class="tlv2-button"
          data-testid="tlv2-prepare"
          :disabled="preparing"
          @click="prepare"
        >
          {{ preparing ? t('teacherLessonV2.pilot.preparing') : t('teacherLessonV2.pilot.prepare') }}
        </button>
        <div v-if="prepareFailed" role="alert" class="tlv2-error" data-testid="tlv2-prepare-error">
          {{ t('teacherLessonV2.pilot.prepareError') }}
        </div>
      </article>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  fetchTeacherLessonV2Access,
  httpStatusOf,
  prepareTeacherLesson,
} from '../api/teacherLessonV2Api'
import { BOARD_ROUTE, PILOT_LESSON_KEY, V1_FALLBACK_ROUTE } from '../routes'

type State = 'checking' | 'enabled' | 'redirecting' | 'error'

const { t } = useI18n()
const router = useRouter()
const state = ref<State>('checking')
const preparing = ref(false)
const prepareFailed = ref(false)

onMounted(async () => {
  try {
    await fetchTeacherLessonV2Access()
    state.value = 'enabled'
  } catch (err) {
    if (httpStatusOf(err) === 404) {
      state.value = 'redirecting'
      await router.replace({ name: V1_FALLBACK_ROUTE })
      return
    }
    state.value = 'error'
    console.error('[TeacherLessonV2] перевірка доступу не вдалася', err)
  }
})

async function prepare(): Promise<void> {
  if (preparing.value) return
  preparing.value = true
  prepareFailed.value = false
  try {
    const lesson = await prepareTeacherLesson(PILOT_LESSON_KEY)
    await router.push({ name: BOARD_ROUTE, params: { id: lesson.session_id } })
  } catch (err) {
    if (httpStatusOf(err) === 404) {
      await router.replace({ name: V1_FALLBACK_ROUTE })
      return
    }
    prepareFailed.value = true
    console.error('[TeacherLessonV2] підготовка уроку не вдалася', err)
  } finally {
    preparing.value = false
  }
}
</script>

<style scoped>
.tlv2 {
  padding: 32px 16px;
  max-width: 760px;
  margin: 0 auto;
}
.tlv2-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 8px;
}
.tlv2-muted {
  color: #475569;
}
.tlv2-lesson {
  margin-top: 24px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tlv2-lesson-title {
  font-size: 1.125rem;
  font-weight: 600;
}
.tlv2-button {
  align-self: flex-start;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  background: #2563eb;
  color: #ffffff;
  font-weight: 500;
  cursor: pointer;
}
.tlv2-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.tlv2-error {
  padding: 12px;
  border: 1px solid #dc2626;
  border-radius: 6px;
  color: #991b1b;
  background: #fef2f2;
}
</style>
