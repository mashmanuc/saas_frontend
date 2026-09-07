/**
 * План уроку — стан на клієнті поверх серверного API (Г2).
 *
 * ТЗ: `saas_docs/plans/north_ship/TZ_G2_LESSON_PLAN_PERSISTED_2026-09-07.md` §2–§4.
 *
 * ДЖЕРЕЛО ПРАВДИ — СЕРВЕР. Тут немає ні локальної копії «на всяк випадок», ні
 * оптимізму: кожна дія — запит, відповідь сервера — єдиний стан, панель
 * перемальовується з неї. Без retry (LAW §12).
 *
 * 404 = «прапорець вимкнений» — штатний стан для майже всіх користувачів:
 * `enabled=false`, `plan=null`, і МОВЧКИ — без тосту, без console.error.
 * Решта кодів — звичайна помилка, її не глушимо.
 *
 * 409 = «нема куди» (план змінено в іншому вікні або урок завершено): без
 * `rev` (свідомий компроміс Г2) це єдиний сигнал про два вікна, тож НЕ тихо:
 * перечитуємо актуальний стан і показуємо коротке нейтральне повідомлення
 * (рішення власника 2026-09-07).
 *
 * Інтегралик цим модулем етапи НЕ перемикає: `stage()` кличе лише кнопка.
 * Чернетка від Інтегралика (`plan_action`) лежить у `draft` і на сервер іде
 * тільки через `saveDraft()` — тобто кнопкою «Зберегти».
 */
import { ref, computed } from 'vue'
import { winterboardApi } from '@/modules/winterboard/api/winterboardApi'

export const CONFLICT_MESSAGE = 'План змінено в іншому вікні; показано актуальну версію.'

export const KIND_LABELS = {
  motivation: 'Зацікавлення',
  explanation: 'Пояснення',
  example: 'Приклад',
  practice: 'Практика',
  check: 'Перевірка',
  summary: 'Підсумок',
}

/** Шаблон для кнопки «Новий план»: п'ять етапів, перший активний. */
export function defaultPlan(objective = '') {
  const kinds = ['explanation', 'example', 'practice', 'check', 'summary']
  return {
    version: 1,
    objective,
    subject: 'math',
    stages: kinds.map((kind, i) => ({
      id: kind, kind, title: KIND_LABELS[kind], goal: '',
      status: i === 0 ? 'active' : 'pending',
    })),
  }
}

/**
 * Чернетка від Інтегралика (`plan_action`) приходить у контракті Г2 — тому
 * самому, що приймає PUT lesson-plan/. Тут — лише погляд для панелі; старі
 * назви полів (role/planned) терпимо лише для читання, на сервер іде як є.
 */
export function draftView(raw) {
  if (!raw || !Array.isArray(raw.stages)) return null
  return {
    objective: raw.objective || raw.goal || raw.topic || '',
    stages: raw.stages.map(s => ({
      id: s.id,
      kind: s.kind || s.role,
      title: s.title || KIND_LABELS[s.kind || s.role] || s.role || '',
      goal: s.goal || '',
      status: s.status === 'planned' ? 'pending' : (s.status || 'pending'),
    })),
  }
}

function statusOf(err) {
  return err?.response?.status ?? err?.status ?? null
}

export function useLessonPlan(api = winterboardApi) {
  const boardId = ref(null)
  const enabled = ref(false)
  const plan = ref(null)
  const activeStageId = ref(null)
  const nextStageId = ref(null)
  const draft = ref(null)          // пропозиція Інтегралика, ще НЕ збережена
  const busy = ref(false)
  const notice = ref('')           // коротке нейтральне повідомлення (409)
  const error = ref('')            // справжня помилка (5xx, мережа)

  const activeStage = computed(() =>
    plan.value?.stages?.find(s => s.status === 'active') ?? null)
  const isCompleted = computed(() => !!plan.value && !activeStage.value)
  const activeIndex = computed(() =>
    plan.value?.stages?.findIndex(s => s.status === 'active') ?? -1)
  const canPrev = computed(() => !!plan.value && (
    isCompleted.value
      ? plan.value.stages.some(s => s.status === 'done' || s.status === 'skipped')
      : plan.value.stages.slice(0, activeIndex.value).some(s => s.status === 'done' || s.status === 'skipped')))
  const canNext = computed(() => !!plan.value && !isCompleted.value)

  function apply(resp) {
    enabled.value = !!resp?.enabled
    plan.value = resp?.plan ?? null
    activeStageId.value = resp?.active_stage_id ?? null
    nextStageId.value = resp?.next_stage_id ?? null
  }

  function reset() {
    enabled.value = false; plan.value = null
    activeStageId.value = null; nextStageId.value = null
    draft.value = null; notice.value = ''; error.value = ''
  }

  /** При вході на дошку / перезавантаженні. 404 → enabled=false, мовчки. */
  async function load(id) {
    boardId.value = id || null
    notice.value = ''; error.value = ''
    if (!id) { reset(); return }
    try {
      apply(await api.getLessonPlan(id))
    } catch (e) {
      if (statusOf(e) === 404) { reset(); return }   // прапорець вимкнений — штатно
      error.value = 'Не вдалося прочитати план уроку.'
    }
  }

  async function run(fn) {
    if (!boardId.value || busy.value) return false
    busy.value = true; notice.value = ''; error.value = ''
    try {
      apply(await fn(boardId.value))
      return true
    } catch (e) {
      const st = statusOf(e)
      if (st === 409) {
        // Без rev це єдиний сигнал про два вікна — НЕ тихо.
        const body = e?.response?.data
        if (body && 'plan' in body) apply(body)
        else await load(boardId.value)
        notice.value = CONFLICT_MESSAGE
      } else if (st === 404) {
        reset()
      } else if (st === 400) {
        error.value = 'План не відповідає контракту.'
      } else if (st === 403) {
        error.value = 'План уроку змінює лише вчитель.'
      } else {
        error.value = 'Не вдалося зберегти план уроку.'
      }
      return false
    } finally {
      busy.value = false
    }
  }

  /** Явне збереження — з форми «Новий план» або чернетки Інтегралика. */
  function save(newPlan) { return run(id => api.putLessonPlan(id, newPlan)) }
  function stage(action) { return run(id => api.postLessonPlanStage(id, action)) }
  async function remove() {
    if (!boardId.value || busy.value) return false
    busy.value = true; error.value = ''
    try { await api.deleteLessonPlan(boardId.value); apply({ enabled: true, plan: null }); return true }
    catch (e) { if (statusOf(e) === 404) reset(); else error.value = 'Не вдалося видалити план.'; return false }
    finally { busy.value = false }
  }

  /** Інтегралик запропонував план: показати, НЕ зберігати (рішення власника). */
  function proposeDraft(raw) { draft.value = draftView(raw) ? raw : null; return !!draft.value }
  function discardDraft() { draft.value = null }
  async function saveDraft() {
    if (!draft.value) return false
    const ok = await save(draft.value)
    if (ok) draft.value = null
    return ok
  }

  return {
    boardId, enabled, plan, activeStageId, nextStageId, draft, busy, notice, error,
    activeStage, isCompleted, canPrev, canNext,
    load, save, stage, remove, proposeDraft, discardDraft, saveDraft, reset,
  }
}
