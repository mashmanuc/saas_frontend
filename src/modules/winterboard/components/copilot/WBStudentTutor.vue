<!--
  WB: 8b-2 — канал учня до AI-репетитора. Бачить УЧЕНЬ, лише коли
  `status.tutor === true` (прапорець `LEARNING_ENGINE_TUTOR`, дефолт OFF).

  Що тут СВІДОМО немає (§3.5 ТЗ 8b-1 — «бідна відповідь»):
  ні стадій-лічильників, ні причин рішення, ні «профілю учня». Учень
  бачить текст — механіка лишається в журналі на BE.

  Історія живе тільки в цій вкладці: сервер реплік не зберігає (hash+len),
  тож «видалити мою історію» справді видаляє все, що існує.
-->
<template>
  <div v-if="live" class="wb-tutor" data-testid="student-tutor">
    <div class="wb-tutor__head">
      <span class="wb-tutor__title">{{ t('winterboard.copilot.tutor.title') }}</span>
      <button
        type="button"
        class="wb-tutor__clear"
        :aria-label="t('winterboard.copilot.tutor.clear')"
        data-testid="tutor-clear"
        @click="clearHistory"
      >
        {{ t('winterboard.copilot.tutor.clear') }}
      </button>
    </div>

    <div ref="scrollEl" class="wb-tutor__log" data-testid="tutor-log">
      <p v-if="!messages.length" class="wb-tutor__empty">
        {{ t('winterboard.copilot.tutor.empty') }}
      </p>
      <div
        v-for="(m, i) in messages"
        :key="i"
        class="wb-tutor__msg"
        :class="m.role === 'student' ? 'wb-tutor__msg--me' : 'wb-tutor__msg--ai'"
      >
        {{ m.text }}
      </div>
      <div v-if="busy" class="wb-tutor__thinking" data-testid="tutor-thinking">
        {{ t('winterboard.copilot.tutor.thinking') }}
      </div>
    </div>

    <p v-if="throttled" class="wb-tutor__note" data-testid="tutor-throttled">
      {{ t('winterboard.copilot.tutor.throttled') }}
    </p>
    <p v-else-if="failed" class="wb-tutor__note wb-tutor__note--err" data-testid="tutor-failed">
      {{ t('winterboard.copilot.tutor.failed') }}
    </p>

    <div class="wb-tutor__row">
      <input
        v-model="draft"
        class="wb-tutor__field"
        type="text"
        maxlength="2000"
        :placeholder="t('winterboard.copilot.tutor.placeholder')"
        data-testid="tutor-field"
        @keyup.enter="onSend"
      />
      <!-- Голос = диктовка в це ж поле (реюз useVoiceDictation, як у чаті).
           Це НЕ Ф9: відповідь лишається текстом, канал і валідатори ті самі. -->
      <button
        v-if="micSupported"
        type="button"
        class="wb-tutor__mic"
        :class="{ 'is-on': micListening }"
        :aria-label="t('winterboard.copilot.tutor.mic')"
        :aria-pressed="micListening"
        data-testid="tutor-mic"
        @click="onMic"
      >
        🎤
      </button>
      <button
        type="button"
        class="wb-tutor__btn"
        :disabled="!canSend"
        data-testid="tutor-send"
        @click="onSend"
      >
        {{ t('winterboard.copilot.tutor.send') }}
      </button>
    </div>

    <button
      type="button"
      class="wb-tutor__unclear"
      :disabled="busy || disabled"
      data-testid="tutor-unclear"
      @click="onUnclear"
    >
      {{ t('winterboard.copilot.tutor.unclear') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import winterboardApi from '../../api/winterboardApi'
import { useVoiceDictation } from '../../../../composables/useVoiceDictation'
import { useClassroomRole } from '../../composables/useClassroomRole'
import { useStudentTutor } from '../../composables/useStudentTutor'
import { useOpsSyncStore } from '../../stores/opsSyncStore'

const { t } = useI18n()
const live = ref(false)
const scrollEl = ref<HTMLElement | null>(null)

// Той самий прийом, що у WBStepInput (8a-3): сесію й роль компонент
// дізнається сам — зона не тягне props через Classroom-view.
const opsSync = useOpsSyncStore()
const sessionId = computed(() => opsSync.sessionId || '')
const { isStudent, fetchRole } = useClassroomRole(sessionId as Ref<string | null>)

const {
  messages, draft, busy, failed, throttled, disabled, canSend,
  send, markUnclear, clearHistory, activateGate,
} = useStudentTutor(sessionId.value)

const { supported: micSupported, listening: micListening,
        toggle: micToggle, reset: micReset } = useVoiceDictation()

onMounted(async () => {
  // Два незалежні гейти, як у 8a-3: прапорець і роль. BE однаково
  // відповість 403 не-учню — але показувати канал не можна нікому, крім
  // учня цієї сесії.
  if (!sessionId.value) return
  try {
    const [status] = await Promise.all([winterboardApi.copilotStatus(), fetchRole()])
    live.value = !!status?.tutor && isStudent.value
  } catch {
    live.value = false
  }
  if (live.value) activateGate()
})

// 403 посеред уроку (прапорець вимкнули) → канал зникає, не «сіріє».
watch(disabled, (d) => { if (d) live.value = false })

watch(() => messages.value.length, async () => {
  await nextTick()
  const el = scrollEl.value
  // typeof-гейт: happy-dom/jsdom не реалізують scrollTo — без нього зелений
  // тест мав би червоний лог (клас, який ловили DIR-хвости §2).
  if (el && typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight })
})

function onMic(): void {
  micToggle(draft)            // draft тут — Ref, не розгорнутий string
}

async function onSend(): Promise<void> {
  const ok = await send()
  if (ok) micReset()          // диктовка далі не дописує вже надіслане
}

async function onUnclear(): Promise<void> {
  await markUnclear(t('winterboard.copilot.tutor.unclearPhrase'))
}
</script>

<style scoped>
.wb-tutor {
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: 300px;
  max-height: 50vh;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: var(--wb-panel-bg, #fff);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
  font-size: 13px;
  z-index: 40;
}
.wb-tutor__head { display: flex; justify-content: space-between; align-items: center; }
.wb-tutor__title { font-weight: 600; }
.wb-tutor__clear {
  border: none; background: transparent; cursor: pointer;
  font-size: 11px; opacity: 0.6; padding: 2px 4px;
}
.wb-tutor__clear:hover { opacity: 1; }
.wb-tutor__log {
  flex: 1 1 auto; min-height: 60px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 6px; padding: 4px 0;
}
.wb-tutor__empty { opacity: 0.55; margin: 0; }
.wb-tutor__msg {
  max-width: 85%; padding: 6px 10px; border-radius: 10px; white-space: pre-wrap;
}
.wb-tutor__msg--me { align-self: flex-end; background: rgba(59, 130, 246, 0.12); }
.wb-tutor__msg--ai { align-self: flex-start; background: rgba(0, 0, 0, 0.06); }
.wb-tutor__thinking { opacity: 0.6; font-style: italic; }
.wb-tutor__note { margin: 0; font-size: 11px; opacity: 0.75; }
.wb-tutor__note--err { color: #b23; }
.wb-tutor__row { display: flex; gap: 6px; }
.wb-tutor__field {
  flex: 1 1 auto; min-width: 0; padding: 6px 8px;
  border-radius: 8px; border: 1px solid rgba(0, 0, 0, 0.2);
}
.wb-tutor__btn {
  padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(0, 0, 0, 0.15);
  background: transparent; cursor: pointer;
}
.wb-tutor__btn:disabled { opacity: 0.4; cursor: default; }
.wb-tutor__mic {
  padding: 6px 8px; border-radius: 8px; border: 1px solid rgba(0, 0, 0, 0.15);
  background: transparent; cursor: pointer; line-height: 1;
}
.wb-tutor__mic.is-on { background: rgba(220, 38, 38, 0.15); border-color: rgba(220, 38, 38, 0.5); }
.wb-tutor__unclear {
  align-self: flex-start; border: none; background: transparent;
  cursor: pointer; font-size: 11px; opacity: 0.65; padding: 0;
  text-decoration: underline;
}
.wb-tutor__unclear:disabled { opacity: 0.3; cursor: default; }
</style>
