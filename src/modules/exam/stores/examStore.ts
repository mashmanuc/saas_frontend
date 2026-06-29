/**
 * examStore — стан Solo-проходження НМТ-симулятора.
 * Серверний таймер = SSOT: remaining рахуємо від deadline_at (не довіряємо локальному годиннику
 * як істині — лише як відліку між polling-ами). Відповіді UPSERT-яться на сервер при commit.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { examApi, type RunResult, type RunState } from '../api/examApi'

interface FlatItem {
  external_id: string
  problem_type: string
  text: string
  content: any
  section_order: number
  section_name: string
}

export const useExamStore = defineStore('exam', () => {
  const run = ref<RunState | null>(null)
  const result = ref<RunResult | null>(null)
  const answers = ref<Record<string, Record<string, any>>>({})
  const savingExt = ref<Set<string>>(new Set())
  const currentIndex = ref(0)
  const remainingSec = ref<number | null>(null)
  const loading = ref(false)
  const finishing = ref(false)
  const error = ref<string | null>(null)

  const items = computed<FlatItem[]>(() => {
    const out: FlatItem[] = []
    for (const s of run.value?.sections || []) {
      for (const it of s.items) {
        out.push({
          external_id: it.external_id,
          problem_type: it.problem_type,
          text: it.text,
          content: it.content,
          section_order: s.section_order,
          section_name: s.name,
        })
      }
    }
    return out
  })

  const total = computed(() => items.value.length)
  const current = computed<FlatItem | null>(() => items.value[currentIndex.value] ?? null)
  const answeredCount = computed(() => Object.keys(answers.value).length)
  const isActive = computed(() => run.value?.status === 'in_progress')

  function _recomputeRemaining() {
    if (!run.value?.deadline_at) {
      remainingSec.value = null
      return
    }
    const ms = new Date(run.value.deadline_at).getTime() - Date.now()
    remainingSec.value = Math.max(0, Math.round(ms / 1000))
  }

  async function load(runId: string) {
    loading.value = true
    error.value = null
    try {
      const data = await examApi.getRun(runId)
      run.value = data
      answers.value = { ...(data.answers || {}) }
      currentIndex.value = 0
      _recomputeRemaining()
    } catch (e: any) {
      error.value = e?.message || 'load_failed'
    } finally {
      loading.value = false
    }
  }

  function setRun(data: RunState) {
    run.value = data
    answers.value = { ...(data.answers || {}) }
    currentIndex.value = 0
    _recomputeRemaining()
  }

  function goTo(index: number) {
    if (index >= 0 && index < total.value) currentIndex.value = index
  }
  function next() {
    if (currentIndex.value < total.value - 1) currentIndex.value++
  }
  function prev() {
    if (currentIndex.value > 0) currentIndex.value--
  }

  async function saveAnswer(externalId: string, answer: Record<string, any>) {
    if (!run.value || !isActive.value) return
    answers.value = { ...answers.value, [externalId]: answer } // optimistic
    savingExt.value = new Set(savingExt.value).add(externalId)
    try {
      await examApi.saveAnswer(run.value.id, externalId, answer)
    } catch (e: any) {
      // 409 (дедлайн/finished) → перезавантажити стан Run
      if (run.value) await load(run.value.id)
    } finally {
      const s = new Set(savingExt.value)
      s.delete(externalId)
      savingExt.value = s
    }
  }

  /** Тік таймера: перерахунок із deadline (серверний SSOT). Повертає true, якщо час вичерпано. */
  function tick(): boolean {
    _recomputeRemaining()
    return remainingSec.value !== null && remainingSec.value <= 0
  }

  async function finish(): Promise<RunResult | null> {
    if (!run.value) return null
    finishing.value = true
    try {
      result.value = await examApi.finishRun(run.value.id)
      if (run.value) run.value.status = result.value.status as RunState['status']
      return result.value
    } catch (e: any) {
      error.value = e?.message || 'finish_failed'
      return null
    } finally {
      finishing.value = false
    }
  }

  async function loadResult(runId: string) {
    loading.value = true
    try {
      result.value = await examApi.getResult(runId)
    } catch (e: any) {
      error.value = e?.message || 'result_failed'
    } finally {
      loading.value = false
    }
  }

  function reset() {
    run.value = null
    result.value = null
    answers.value = {}
    savingExt.value = new Set()
    currentIndex.value = 0
    remainingSec.value = null
    error.value = null
  }

  return {
    run, result, answers, savingExt, currentIndex, remainingSec, loading, finishing, error,
    items, total, current, answeredCount, isActive,
    load, setRun, goTo, next, prev, saveAnswer, tick, finish, loadResult, reset,
  }
})
