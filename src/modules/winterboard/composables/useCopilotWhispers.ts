// WB: 8a-2 — стрічка шепотів Copilot для панелі тьютора.
//
// Джерело шепотів — WS-подія `wb:copilot-whisper` (її розкладає usePresence).
// Реакція тьютора (👍/👎) йде REST: SYSTEM_LAW §9 — «WS is NOT a writer».
//
// Про idle-таймер: він тут лише **привід спитати**, а не джерело істини.
// Справжній `idle_seconds` рахує BE з ops у БД. Тому підкручений годинник
// на клієнті не змусить engine вигадати підказку — сервер просто відповість
// `decision: null`.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import winterboardApi from '../api/winterboardApi'

export interface CopilotWhisper {
  decision_id: string
  student_id: string
  action: 'HINT' | 'REMEDIATE' | 'REVIEW' | string
  stage?: number | null
  task_id?: string
  task_label?: string
  whisper: string
  reason?: string
  verdict?: string
  ts: number
}

const MAX_FEED = 20
export const IDLE_POLL_SEC = 120     // одне число з BE IDLE_TO_HINT_SEC
const TICK_MS = 15_000

export function useCopilotWhispers(sessionId: string) {
  const whispers = ref<CopilotWhisper[]>([])
  const enabled = ref(false)
  const studentId = ref<string>('')
  const busy = ref<Record<string, boolean>>({})
  const lastStudentActivityTs = ref<number>(Date.now())

  let timer: ReturnType<typeof setInterval> | null = null
  let lastIdleAsk = 0

  const storageKey = `wb:copilot:${sessionId}`
  const pending = computed(() => whispers.value.filter((w) => !w.verdict))

  function upsert(w: CopilotWhisper): void {
    const i = whispers.value.findIndex((x) => x.decision_id === w.decision_id)
    if (i >= 0) {
      whispers.value[i] = { ...whispers.value[i], ...w }
      return
    }
    // Нові згори — тьютор дивиться в панель мигцем і читає перший рядок.
    whispers.value = [w, ...whispers.value].slice(0, MAX_FEED)
  }

  function onWhisper(e: Event): void {
    const detail = (e as CustomEvent).detail as CopilotWhisper
    if (!detail?.decision_id) return
    if (studentId.value && detail.student_id !== studentId.value) return
    upsert(detail)
  }

  function onStudentActivity(): void {
    lastStudentActivityTs.value = Date.now()
  }

  async function respond(id: string, verdict: 'accept' | 'reject', scope = 'task'): Promise<void> {
    if (busy.value[id]) return
    busy.value = { ...busy.value, [id]: true }
    try {
      await winterboardApi.copilotOverride(id, verdict, scope)
      // Позначаємо локально: панель має одразу показати, що тьютор відповів,
      // не чекаючи наступного завантаження історії.
      upsert({ ...(whispers.value.find((w) => w.decision_id === id) as CopilotWhisper), verdict })
    } finally {
      busy.value = { ...busy.value, [id]: false }
    }
  }

  const accept = (id: string) => respond(id, 'accept', 'decision')
  const reject = (id: string, scope = 'task') => respond(id, 'reject', scope)

  async function evaluate(trigger: 'idle' | 'manual' = 'manual'): Promise<void> {
    if (!enabled.value || !studentId.value) return
    const res = await winterboardApi.copilotEvaluate(sessionId, studentId.value, trigger)
    // WS однаково принесе те саме повідомлення; upsert за decision_id
    // не дасть дублю з'явитись двічі.
    if (res?.decision) upsert(res.decision)
  }

  async function loadHistory(): Promise<void> {
    if (!studentId.value) return
    const res = await winterboardApi.copilotDecisions(sessionId, studentId.value)
    whispers.value = (res?.decisions || []).slice(0, MAX_FEED)
  }

  function tick(): void {
    if (!enabled.value || !studentId.value) return
    const idleSec = (Date.now() - lastStudentActivityTs.value) / 1000
    const sinceAsk = (Date.now() - lastIdleAsk) / 1000
    if (idleSec < IDLE_POLL_SEC || sinceAsk < IDLE_POLL_SEC) return
    lastIdleAsk = Date.now()
    void evaluate('idle')
  }

  function setEnabled(on: boolean): void {
    enabled.value = on
    try {
      localStorage.setItem(storageKey, on ? '1' : '0')
    } catch {
      // приватний режим/повне сховище — не привід ламати урок
    }
    if (on) void loadHistory()
  }

  function setStudent(id: string): void {
    if (studentId.value === id) return
    studentId.value = id
    whispers.value = []
    if (enabled.value) void loadHistory()
  }

  onMounted(() => {
    try {
      enabled.value = localStorage.getItem(storageKey) === '1'
    } catch {
      enabled.value = false
    }
    window.addEventListener('wb:copilot-whisper', onWhisper)
    window.addEventListener('wb:test-answer', onStudentActivity)
    window.addEventListener('wb:stroke', onStudentActivity)
    timer = setInterval(tick, TICK_MS)
    if (enabled.value) void loadHistory()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('wb:copilot-whisper', onWhisper)
    window.removeEventListener('wb:test-answer', onStudentActivity)
    window.removeEventListener('wb:stroke', onStudentActivity)
    if (timer) clearInterval(timer)
  })

  return {
    whispers,
    pending,
    enabled,
    studentId,
    busy,
    lastStudentActivityTs,
    setEnabled,
    setStudent,
    accept,
    reject,
    evaluate,
    loadHistory,
    // для тестів — щоб таймер можна було штовхнути без чекання 15 с
    __tick: tick,
  }
}

export default useCopilotWhispers
