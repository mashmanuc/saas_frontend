<!--
  WB: 8a-3 — поле «крок розв'язку» під задачею. Бачить УЧЕНЬ.

  Свідомо БЕЗ вердикту: тут немає ні «правильно», ні підсвітки, ні кольору.
  Учень бачить лише «записано ✓». Що саме не сходиться — йде тьютору
  шепотом, бо в 8a рішення ухвалює людина, а не програма.
  Показ вердикту учню — окреме рішення власника, не цей пакет.

  Поле — реюз `MathQuillField` як є: він сам вміє fallback у звичайний
  `<input>`, якщо MathQuill не завантажився.
-->
<template>
  <div v-if="live" class="wb-step" data-testid="step-input">
    <label class="wb-step__label" :for="fieldId">
      {{ t('winterboard.copilot.step.label') }}
    </label>

    <ol v-if="steps.length" class="wb-step__list" data-testid="step-list">
      <li v-for="s in steps" :key="s.step_no" class="wb-step__item">
        <span class="wb-step__no">{{ s.step_no }}.</span>
        <span class="wb-step__src">{{ s.src }}</span>
      </li>
    </ol>

    <div class="wb-step__row">
      <MathQuillField
        v-if="!mqFailed"
        v-model="draft"
        class="wb-step__field"
        data-testid="step-field-mq"
        @enter="onSubmit"
        @unavailable="mqFailed = true"
      />
      <input
        v-else
        :id="fieldId"
        v-model="draft"
        class="wb-step__field wb-step__field--plain"
        type="text"
        :placeholder="t('winterboard.copilot.step.placeholder')"
        data-testid="step-field-plain"
        @keyup.enter="onSubmit"
      />

      <button
        type="button"
        class="wb-step__btn"
        :disabled="!canSubmit"
        :aria-label="t('winterboard.copilot.step.submit')"
        data-testid="step-submit"
        @click="onSubmit"
      >
        {{ t('winterboard.copilot.step.submit') }}
      </button>
    </div>

    <span v-if="justSaved" class="wb-step__saved" data-testid="step-saved">
      {{ t('winterboard.copilot.step.saved') }}
    </span>
    <span v-else-if="failed" class="wb-step__failed" data-testid="step-failed">
      {{ t('winterboard.copilot.step.failed') }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import MathQuillField from '../shared/MathQuillField.vue'
import winterboardApi from '../../api/winterboardApi'
import { useStepInput } from '../../composables/useStepInput'
import { useClassroomRole } from '../../composables/useClassroomRole'
import { useOpsSyncStore } from '../../stores/opsSyncStore'

const props = defineProps<{ taskId: string }>()

const { t } = useI18n()
const live = ref(false)
const mqFailed = ref(false)
const fieldId = `wb-step-${Math.abs(hashCode(props.taskId))}`

// Сесію й роль компонент дізнається сам — зі стору й через `useClassroomRole`.
// Альтернатива (проброс через props) зачепила б і рендерер, і Classroom-view,
// а зона 8a-3 дозволяє рівно один дотик до рендерера.
const opsSync = useOpsSyncStore()
const sessionId = computed(() => opsSync.sessionId || '')
const { isStudent, fetchRole } = useClassroomRole(sessionId as Ref<string | null>)

const { steps, draft, justSaved, failed, canSubmit, submit, load } =
  useStepInput(sessionId.value, props.taskId)

onMounted(async () => {
  // Два незалежні гейти: прапорець фічі і роль. Поле бачить ЛИШЕ учень —
  // тьютору BE однаково відповість 403, але показувати йому поле не можна.
  if (!sessionId.value) return
  try {
    const [status] = await Promise.all([winterboardApi.copilotStatus(), fetchRole()])
    live.value = !!status?.live && isStudent.value
  } catch {
    live.value = false
  }
  if (live.value) void load()
})

async function onSubmit(): Promise<void> {
  await submit()
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}
</script>

<style scoped>
.wb-step {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  font-size: 13px;
}
.wb-step__label { font-weight: 600; opacity: 0.8; }
.wb-step__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.wb-step__item { display: flex; gap: 6px; opacity: 0.85; }
.wb-step__no { opacity: 0.6; min-width: 18px; }
.wb-step__src { font-family: ui-monospace, monospace; }
.wb-step__row { display: flex; align-items: center; gap: 6px; }
.wb-step__field { flex: 1 1 auto; min-width: 0; }
.wb-step__field--plain { padding: 4px 6px; border-radius: 6px; border: 1px solid rgba(0, 0, 0, 0.2); }
.wb-step__btn { padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(0, 0, 0, 0.15); background: transparent; cursor: pointer; }
.wb-step__btn:disabled { opacity: 0.4; cursor: default; }
.wb-step__saved { font-size: 11px; opacity: 0.7; }
.wb-step__failed { font-size: 11px; color: #b23; }
</style>
