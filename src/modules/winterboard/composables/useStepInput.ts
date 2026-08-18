// WB: 8a-3 — кроки розв'язку, стан на боці учня.
//
// Навіщо це взагалі: поза запущеним тестом BE досі не бачив нічого, що
// учень пише в задачі — `openAnswerValue` у `NMTTaskRenderer.vue:320`
// живе лише в пам'яті вкладки. Крок — перший канал, який працює на
// звичайному уроці.
//
// Учень **не отримує вердикту**: відповідь сервера містить лише
// `{accepted, step_no}`. Що саме не сходиться — йде тьютору шепотом
// (8a = людина в контурі).
import { computed, ref } from 'vue'

import winterboardApi from '../api/winterboardApi'

export interface RecordedStep {
  step_no: number
  src: string
  task_id: string
  ts: number
}

export function useStepInput(sessionId: string, taskId: string) {
  const steps = ref<RecordedStep[]>([])
  const draft = ref('')
  const busy = ref(false)
  const justSaved = ref(false)
  const failed = ref(false)

  const canSubmit = computed(() => !!draft.value.trim() && !busy.value)

  async function load(): Promise<void> {
    if (!sessionId || !taskId) return
    try {
      const res = await winterboardApi.copilotSteps(sessionId, taskId)
      steps.value = res?.steps || []
    } catch {
      // Не показуємо помилку: список кроків — допоміжний, а урок триває.
      steps.value = []
    }
  }

  async function submit(): Promise<boolean> {
    const src = draft.value.trim()
    if (!src || busy.value) return false        // порожнє не шлемо
    busy.value = true
    failed.value = false
    try {
      const res = await winterboardApi.copilotSubmitStep(sessionId, taskId, src)
      steps.value = [...steps.value, {
        step_no: res?.step_no ?? steps.value.length + 1,
        src,
        task_id: taskId,
        ts: Date.now(),
      }]
      draft.value = ''
      justSaved.value = true
      setTimeout(() => { justSaved.value = false }, 2000)
      return true
    } catch {
      failed.value = true
      return false
    } finally {
      busy.value = false
    }
  }

  // Свідомо БЕЗ `onMounted(load)`: момент завантаження вирішує компонент —
  // уже після перевірки прапорця й ролі. Інакше учень при вимкненому
  // Copilot усе одно бив би по API (і в тесті список приходив двічі).

  return { steps, draft, busy, justSaved, failed, canSubmit, submit, load }
}

export default useStepInput
