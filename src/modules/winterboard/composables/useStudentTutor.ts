// WB: 8b-2 — канал учня до AI-репетитора (поверх BE 8b-1 `reply/`).
//
// Історія — ЛИШЕ на клієнті: BE свідомо не зберігає ані реплік учня
// (у журналі hash+len, §3.5 ТЗ 8b-1), ані відповідей. Тому «видалити мою
// історію» — чесна кнопка: після очищення слідів розмови немає ніде.
//
// Reveal gate (ескіз §6): «Показати відповідь/розбір» у задачі заблоковані,
// доки репетитор не дійшов до стадії 3. Стан гейта — module-scoped reactive,
// щоб `NmtTaskRenderer` міг спитати без пробросу через пів-дерева props.
// Гейт вмикається ТІЛЬКИ коли канал активний (учень + прапорець ON) — у
// тьютора на його дошці кнопки працюють як працювали.
import { computed, reactive, ref } from 'vue'

import winterboardApi from '../api/winterboardApi'

export interface TutorMessage {
  role: 'student' | 'ai'
  text: string
  stage?: number | null
  action?: string
  ts: number
}

// ── module-scoped стан reveal-гейта ─────────────────────────────────────────
const gate = reactive({
  active: false,                          // канал живий (учень + прапорець)
  stageByTask: {} as Record<string, number>,
})

/** Для `NmtTaskRenderer`: чи можна показувати відповідь/розбір цієї задачі. */
export function useTutorRevealGate(taskId: () => string) {
  return computed(() => {
    if (!gate.active) return true         // поза режимом уроку з engine — як було
    return (gate.stageByTask[taskId()] ?? 0) >= 3
  })
}

/** Тестам і teardown-у: скинути module-scoped стан. */
export function resetTutorGate(): void {
  gate.active = false
  gate.stageByTask = {}
}

export function useStudentTutor(sessionId: string) {
  const messages = ref<TutorMessage[]>([])
  const draft = ref('')
  const busy = ref(false)
  const failed = ref(false)
  const throttled = ref(false)
  const disabled = ref(false)             // 403 FEATURE_OFF посеред уроку

  const canSend = computed(() =>
    !!draft.value.trim() && !busy.value && !disabled.value)

  function activateGate(): void {
    gate.active = true
  }

  async function send(text?: string): Promise<boolean> {
    const body = (text ?? draft.value).trim()
    if (!body || busy.value || disabled.value) return false
    busy.value = true
    failed.value = false
    throttled.value = false
    messages.value = [...messages.value,
      { role: 'student', text: body, ts: Date.now() }]
    try {
      const res = await winterboardApi.copilotReply(sessionId, body)
      messages.value = [...messages.value, {
        role: 'ai',
        text: String(res?.reply ?? ''),
        stage: res?.stage ?? null,
        action: res?.action,
        ts: Date.now(),
      }]
      // Стадія 3 по задачі відчиняє reveal. task_id BE не віддає (бідна
      // відповідь §3.5) — v0 гейт сесійний: стадія 3 будь-де = розбір
      // дозволено. Точніше — коли BE віддасть task-контекст (питання Феї).
      if ((res?.stage ?? 0) >= 3) {
        for (const k of Object.keys(gate.stageByTask)) gate.stageByTask[k] = 3
        gate.stageByTask['*'] = 3
      }
      if (!text) draft.value = ''
      return true
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 429) {
        throttled.value = true
      } else if (status === 403) {
        disabled.value = true             // канал вимкнено — ховаємось
        gate.active = false
      } else {
        failed.value = true
      }
      return false
    } finally {
      busy.value = false
    }
  }

  /** Кнопка «не зрозумів»: фіксована фраза тим самим каналом. */
  async function markUnclear(phrase: string): Promise<boolean> {
    return send(phrase)
  }

  /** «Видалити мою історію» — чесно: сервер тексту й так не тримає. */
  function clearHistory(): void {
    messages.value = []
  }

  /** Задача потрапила в поле зору гейта (рендерер повідомляє про себе). */
  function watchTask(taskId: string): void {
    if (!(taskId in gate.stageByTask)) {
      gate.stageByTask[taskId] = gate.stageByTask['*'] ?? 0
    }
  }

  return {
    messages, draft, busy, failed, throttled, disabled, canSend,
    send, markUnclear, clearHistory, activateGate, watchTask,
  }
}

export default useStudentTutor
