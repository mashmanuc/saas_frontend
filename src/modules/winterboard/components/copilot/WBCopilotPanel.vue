<!--
  WB: 8a-2 — панель шепотів Copilot. Бачить ЛИШЕ тьютор.

  Панель свідомо показує дію й підставу («3 спроби, підказка не давалась»),
  а не «профіль дитини»: жодних лічильників-оцінок, сирих відповідей чи імен
  (ТЗ 8 §5.5). Учневі нічого з цього не доставляється взагалі — фільтр стоїть
  на BE, не в шаблоні.
-->
<template>
  <div v-if="live" class="wb-copilot" data-testid="copilot-panel">
    <header class="wb-copilot__head">
      <span class="wb-copilot__title">{{ t('winterboard.copilot.title') }}</span>

      <label class="wb-copilot__switch">
        <input
          type="checkbox"
          :checked="enabled"
          :aria-label="t('winterboard.copilot.toggle')"
          data-testid="copilot-toggle"
          @change="onToggle"
        />
        <span>{{ enabled ? t('winterboard.copilot.on') : t('winterboard.copilot.off') }}</span>
      </label>
    </header>

    <template v-if="enabled">
      <p v-if="enabled" class="wb-copilot__hint" data-testid="copilot-indicator">
        {{ t('winterboard.copilot.analyzing') }}
      </p>

      <select
        v-if="students.length > 1"
        class="wb-copilot__student"
        :value="studentId"
        :aria-label="t('winterboard.copilot.pickStudent')"
        data-testid="copilot-student"
        @change="onStudent"
      >
        <option v-for="s in students" :key="s.user_id" :value="String(s.user_id)">
          {{ s.display_name || s.user_id }}
        </option>
      </select>

      <p v-if="!whispers.length" class="wb-copilot__empty" data-testid="copilot-empty">
        {{ t('winterboard.copilot.empty') }}
      </p>

      <ul v-else class="wb-copilot__feed">
        <li
          v-for="w in whispers"
          :key="w.decision_id"
          class="wb-copilot__item"
          :class="{ 'is-answered': !!w.verdict }"
          data-testid="copilot-whisper"
        >
          <div class="wb-copilot__meta">
            <span class="wb-copilot__action" :data-action="w.action">
              {{ t(`winterboard.copilot.action.${w.action}`) }}
            </span>
            <span v-if="w.task_label" class="wb-copilot__task">{{ w.task_label }}</span>
            <time class="wb-copilot__time">{{ formatTime(w.ts) }}</time>
          </div>

          <p class="wb-copilot__text">{{ w.whisper }}</p>

          <div v-if="!w.verdict" class="wb-copilot__actions">
            <button
              type="button"
              class="wb-copilot__btn"
              :disabled="busy[w.decision_id]"
              :aria-label="t('winterboard.copilot.accept')"
              data-testid="copilot-accept"
              @click="accept(w.decision_id)"
            >
              👍
            </button>
            <button
              type="button"
              class="wb-copilot__btn"
              :disabled="busy[w.decision_id]"
              :aria-label="t('winterboard.copilot.reject')"
              data-testid="copilot-reject"
              @click="openScope(w.decision_id)"
            >
              👎
            </button>

            <div v-if="scopeFor === w.decision_id" class="wb-copilot__scope" data-testid="copilot-scope">
              <button
                v-for="opt in SCOPES"
                :key="opt"
                type="button"
                class="wb-copilot__scope-btn"
                :data-scope="opt"
                @click="reject(w.decision_id, opt); scopeFor = ''"
              >
                {{ t(`winterboard.copilot.scope.${opt}`) }}
              </button>
            </div>
          </div>

          <span v-else class="wb-copilot__verdict" data-testid="copilot-verdict">
            {{ t(`winterboard.copilot.verdict.${w.verdict}`) }}
          </span>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import winterboardApi from '../../api/winterboardApi'
import { useCopilotWhispers } from '../../composables/useCopilotWhispers'

/** Форма з `connectedStudents` у WBClassroomRoom (`user_id`/`display_name`),
 *  а не вигадані `id`/`name` — звірено з views/WBClassroomRoom.vue:1087. */
interface StudentLike {
  user_id: string
  display_name?: string
  role?: string
}

const props = withDefaults(
  defineProps<{
    sessionId: string
    students?: StudentLike[]
  }>(),
  { students: () => [] },
)

const { t } = useI18n()
const SCOPES = ['decision', 'task', 'session'] as const

const live = ref(false)
const scopeFor = ref('')

const { whispers, enabled, studentId, busy, setEnabled, setStudent, accept, reject } =
  useCopilotWhispers(props.sessionId)

onMounted(async () => {
  // Прапорець вирішує, чи панель узагалі існує: при OFF не показуємо
  // «сірий» UI, який нічого не робить (ТЗ §4).
  try {
    const res = await winterboardApi.copilotStatus()
    live.value = !!res?.live
  } catch {
    live.value = false
  }
  if (props.students.length) setStudent(String(props.students[0].user_id))
})

watch(
  () => props.students,
  (list) => {
    if (!studentId.value && list.length) setStudent(String(list[0].user_id))
  },
  { deep: true },
)

function onToggle(e: Event): void {
  setEnabled((e.target as HTMLInputElement).checked)
}

function onStudent(e: Event): void {
  setStudent((e.target as HTMLSelectElement).value)
}

function openScope(id: string): void {
  scopeFor.value = scopeFor.value === id ? '' : id
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}
</script>

<style scoped>
.wb-copilot {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--wb-panel-bg, rgba(255, 255, 255, 0.92));
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  font-size: 13px;
  max-width: 320px;
}
.wb-copilot__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.wb-copilot__title { font-weight: 600; }
.wb-copilot__switch { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.wb-copilot__hint,
.wb-copilot__empty { margin: 0; opacity: 0.7; font-size: 12px; }
.wb-copilot__student { width: 100%; padding: 4px 6px; border-radius: 6px; }
.wb-copilot__feed { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; }
.wb-copilot__item { padding: 8px; border-radius: 8px; background: rgba(0, 0, 0, 0.04); }
.wb-copilot__item.is-answered { opacity: 0.6; }
.wb-copilot__meta { display: flex; align-items: center; gap: 6px; font-size: 11px; opacity: 0.75; }
.wb-copilot__action { font-weight: 600; text-transform: uppercase; }
.wb-copilot__text { margin: 4px 0 6px; line-height: 1.35; }
.wb-copilot__actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.wb-copilot__btn { border: none; background: transparent; cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 6px; }
.wb-copilot__btn:disabled { opacity: 0.4; cursor: default; }
.wb-copilot__scope { display: flex; gap: 4px; flex-wrap: wrap; width: 100%; }
.wb-copilot__scope-btn { font-size: 11px; padding: 3px 7px; border-radius: 999px; border: 1px solid rgba(0, 0, 0, 0.15); background: transparent; cursor: pointer; }
.wb-copilot__verdict { font-size: 11px; opacity: 0.7; }
</style>
