<template>
  <section v-if="state !== 'hidden'" class="pls" data-testid="lp-program-step">
    <p class="pls__title">{{ t('learningPrograms.step.title') }}</p>
    <p v-if="state === 'loading'" class="pls__muted">{{ t('loader.loading') }}</p>
    <div v-else-if="state === 'choose'" class="pls__choose">
      <button v-for="pr in programs" :key="pr.id" type="button" class="pls__option" @click="pick(pr.id)">{{ pr.title }}</button>
    </div>
    <template v-else-if="state === 'ready' && program && lesson">
      <p class="pls__lesson">{{ lesson.title }}</p>
      <LessonOutcomeActions
        :program="program"
        :lesson="lesson"
        :calendar-ref="eventId ? { provider: 'booking.event', id: String(eventId) } : null"
        :attendance="attendance ?? null"
        @changed="emit('changed')"
      />
    </template>
    <p v-else-if="state === 'done'" class="pls__muted">{{ t('learningPrograms.workspace.allDone') }}</p>
  </section>
</template>

<script setup lang="ts">
/**
 * Крок програми у «Підсумку уроку» (ТЗ §7, П8 Лони): під її «Відбувся / Не відбувся» — що з програмою учня.
 * Програму шукає сервер за учнем (лише власні активні програми); кілька — явний вибір, жодної або модуль вимкнено —
 * блоку немає. Підсумок іде з посиланням на подію розкладу, тож відвідування звіряє сервер (розклад — джерело).
 * Вставка в її вікно: `<ProgramLessonStep :student-id="…" :event-id="…" :attendance="outcome" />` нижче панелі.
 */
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'
import LessonOutcomeActions from './LessonOutcomeActions.vue'
import { learningProgramsApi, type ProgramDetail, type ProgramLesson } from '../api/learningProgramsApi'
import { useProgramsAvailability } from '../composables/useProgramsAvailability'
import { latestOnly } from '../intent'

const props = defineProps<{ studentId: number | null; eventId?: number | null; attendance?: 'held' | 'not_held' | null }>()
const emit = defineEmits<{ (e: 'changed'): void }>()
const { t } = useI18n({ useScope: 'global' })
const auth = useAuthStore()
const availability = useProgramsAvailability()

const state = ref<'hidden' | 'loading' | 'choose' | 'ready' | 'done'>('hidden')
const programs = ref<{ id: string; title: string }[]>([])
const program = ref<ProgramDetail | null>(null)
const lesson = ref<ProgramLesson | null>(null)

// Учня на уроці могли змінити: відповіді для попереднього учня відкидаються (review F4).
const loads = latestOnly()

async function pick(id: string, token = loads.start()) {
  state.value = 'loading'
  try {
    const fresh = await learningProgramsApi.detail(id)
    if (!loads.isCurrent(token)) return
    program.value = fresh
    const tid = fresh.summary.today?.lesson_id
    lesson.value = tid ? fresh.lessons.find((l) => l.lesson_id === tid) ?? null : null
    state.value = lesson.value ? 'ready' : 'done'
  } catch {
    if (loads.isCurrent(token)) state.value = 'hidden'
  }
}

watch(() => props.studentId, async (sid) => {
  const token = loads.start()
  state.value = 'hidden'
  program.value = null
  lesson.value = null
  if (!sid || !(await availability.ensure(auth.user?.id, auth.user?.role)) || !loads.isCurrent(token)) return
  state.value = 'loading'
  try {
    const page = await learningProgramsApi.list({ learner: sid, status: 'active' })
    if (!loads.isCurrent(token)) return
    programs.value = page.results.map((r) => ({ id: r.id, title: r.title }))
    if (!programs.value.length) state.value = 'hidden'
    else if (programs.value.length === 1) await pick(programs.value[0].id, token)
    else state.value = 'choose'
  } catch {
    if (loads.isCurrent(token)) state.value = 'hidden'
  }
}, { immediate: true })
</script>

<style scoped>
.pls { display: flex; flex-direction: column; gap: 8px; padding-top: 12px; border-top: 1px solid var(--border-color); }
.pls__title { margin: 0; font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.pls__lesson { margin: 0; font-weight: 600; color: var(--text-primary); }
.pls__muted { margin: 0; color: var(--text-secondary); font-size: var(--text-sm); }
.pls__choose { display: flex; flex-direction: column; gap: 6px; }
.pls__option {
  text-align: left; padding: 8px 10px; border-radius: var(--radius-md); border: 1px solid var(--border-color);
  background: var(--card-bg); color: var(--text-primary); cursor: pointer;
}
</style>
