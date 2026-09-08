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

/** Підписи ЕТАПІВ плану (не плутати з типом уроку нижче). */
export const KIND_LABELS = {
  motivation: 'Зацікавлення',
  explanation: 'Пояснення',
  example: 'Приклад',
  practice: 'Практика',
  check: 'Перевірка',
  summary: 'Підсумок',
}

/**
 * Типи УРОКУ — словник проєкту (`lesson_constructor.course_constraints`).
 * Порядок тут і є порядком у селекторі: від «нова тема» до «повторення».
 *
 * `custom` у виборі НЕМАЄ свідомо: це не педагогічний намір, а позначка
 * «типу ніхто не заявляв» для ручних і старих дошок. Показати його як
 * варіант — запросити вчителя обрати «нічого конкретного».
 */
export const LESSON_KINDS = ['intro', 'practice', 'generalize', 'control', 'repeat']

export const LESSON_KIND_LABELS = {
  intro: 'Вивчення нової теми',
  practice: 'Закріплення',
  generalize: 'Узагальнення',
  control: 'Контроль',
  repeat: 'Повторення',
  custom: 'Свій',
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
  const lessonKind = ref(null)     // заява вчителя; null = ручна дошка
  const draft = ref(null)          // пропозиція Інтегралика, ще НЕ збережена
  const draftKind = ref(null)      // тип, ЗАПИТАНИЙ для цієї чернетки
  const composeTick = ref(0)       // сигнал панелі: відкрий порожню форму
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
    // Ключа немає — тип НЕ ЗМІНЮЄМО. Так відповідає старий бекенд (FE може
    // приїхати раніше за BE) і так виглядає локальний apply після DELETE:
    // план зник, а заявлений тип уроку на сервері лишився, як був.
    if (resp && 'lesson_kind' in resp) lessonKind.value = resp.lesson_kind ?? null
    activeStageId.value = resp?.active_stage_id ?? null
    nextStageId.value = resp?.next_stage_id ?? null
  }

  function reset() {
    enabled.value = false; plan.value = null
    activeStageId.value = null; nextStageId.value = null
    lessonKind.value = null; draftKind.value = null
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
        // Сервер уже пояснив людською мовою («Мета уроку задовга — до 200
        // символів»), і це точніше за наше загальне «не відповідає контракту».
        error.value = e?.response?.data?.detail || 'План не відповідає контракту.'
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

  /**
   * Явне збереження — з форми «Новий план» або чернетки.
   *
   * З типом іде КОНВЕРТ `{plan, lesson_kind}`: план і тип мусять оновитись
   * одним записом, інакше «Оновити шаблон» збереже шаблон, де тип `intro`, а
   * каркас `control` (знахідка рев'ю 2026-09-08). Без типу — голий план, як
   * було: старий виклик не змінює заяву вчителя.
   */
  function save(newPlan, kind = null) {
    const body = kind ? { plan: newPlan, lesson_kind: kind } : newPlan
    return run(id => api.putLessonPlan(id, body))
  }
  function stage(action) { return run(id => api.postLessonPlanStage(id, action)) }
  async function remove() {
    if (!boardId.value || busy.value) return false
    busy.value = true; error.value = ''
    try { await api.deleteLessonPlan(boardId.value); apply({ enabled: true, plan: null }); return true }
    catch (e) { if (statusOf(e) === 404) reset(); else error.value = 'Не вдалося видалити план.'; return false }
    finally { busy.value = false }
  }

  /**
   * Наміру без теми сервер НЕ вигадує тему і навіть не питає модель: віддає
   * `compose`. Панель відкриває порожню форму й ставить курсор у мету.
   * Лічильник, а не булеве: друге таке саме прохання теж має спрацювати.
   */
  function requestCompose() { draft.value = null; composeTick.value += 1; return true }

  /** Інтегралик запропонував план: показати, НЕ зберігати (рішення власника). */
  function proposeDraft(raw) {
    draft.value = draftView(raw) ? raw : null
    draftKind.value = null          // Інтегралик типу уроку не заявляє
    return !!draft.value
  }
  function discardDraft() { draft.value = null; draftKind.value = null }
  async function saveDraft() {
    if (!draft.value) return false
    const ok = await save(draft.value, draftKind.value)
    if (ok) { draft.value = null; draftKind.value = null }
    return ok
  }

  /**
   * Каркас для обраного типу уроку. Нуль моделі: сервер складає його
   * детерміновано з (тип, мета, кількість підготовлених задач).
   *
   * Нічого не зберігає — ні тут, ні на сервері. Тому поточний стан
   * (`plan`, `lessonKind`) свідомо НЕ чіпаємо: у відповіді `lesson_kind` —
   * тип чернетки, і застосувати його до стану означало б збрехати, що вчитель
   * уже змінив тип уроку. Змінює його лише «Зберегти план».
   *
   * `objective` потрібен формі «новий план»: там плану ще немає, і мету, яку
   * вчитель щойно вписав, сервер більше нізвідки не візьме.
   */
  async function requestKindDraft(kind, objective = '') {
    if (!boardId.value || busy.value) return false
    if (!LESSON_KINDS.includes(kind)) return false
    busy.value = true; notice.value = ''; error.value = ''
    try {
      const resp = await api.postLessonPlanKind(
        boardId.value, kind, (objective || '').trim() || undefined)
      draft.value = resp?.draft ?? null
      draftKind.value = resp?.lesson_kind ?? kind
      return !!draft.value
    } catch (e) {
      const st = statusOf(e)
      if (st === 404) reset()
      else if (st === 403) error.value = 'План уроку змінює лише вчитель.'
      else if (st === 400) error.value = e?.response?.data?.detail || 'Не вдалося скласти каркас.'
      else error.value = 'Не вдалося скласти каркас плану.'
      return false
    } finally {
      busy.value = false
    }
  }

  return {
    boardId, enabled, plan, activeStageId, nextStageId, draft, busy, notice, error,
    composeTick, lessonKind, draftKind,
    activeStage, isCompleted, canPrev, canNext,
    load, save, stage, remove, proposeDraft, discardDraft, saveDraft, reset,
    requestCompose, requestKindDraft,
  }
}
