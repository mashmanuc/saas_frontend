/**
 * План уроку на клієнті — ТИМЧАСОВЕ сховище гейта Г1.
 *
 * ТЗ: `saas_docs/plans/north_ship/TZ_INTEGRALYK_LESSON_PLAN_2026-09-06.md`.
 *
 * ⏳ ЦЕЙ ФАЙЛ ПРОЖИВЕ ОДИН ГЕЙТ. Г1 доводить рівно одне: що модель ПОМІЧАЄ
 * план у промпті. Доки це не доведено, сховище на сервері будувати рано —
 * тому план поки лежить у `sessionStorage` і їде в кожен parse-запит. На Г2
 * він переїде в поле сесії, а звідси зникне і файл, і поле `lesson_plan` у
 * запиті.
 *
 * ⚠️ ПЕРЕХОДИ ТУТ — ДЗЕРКАЛО бекенду (`winterboard/services/lesson_plan.py`).
 * Дзеркало завжди ризик розходження, тому воно (а) тимчасове, (б) накрите
 * тестами, які перевіряють ТІ САМІ випадки, що й бекендні. Свідомий вибір:
 * альтернатива — ендпойнт, а ендпойнт — це вже Г2, тобто робота, яку гейт
 * може й не виправдати.
 *
 * ⛔ План — НЕ стан дошки. Він не операція, не йде в ops і не потрапляє в
 * реплей (LAW §9). `sessionStorage`, а не `localStorage`: план живе один
 * урок, а не назавжди.
 */

const KEY_PREFIX = 'm4sh:lessonPlan:'

export const ROLES = ['motivation', 'explanation', 'example', 'practice', 'check', 'summary']
export const STATUSES = ['planned', 'active', 'done', 'skipped']

export const ROLE_LABELS = {
  motivation: 'зацікавлення',
  explanation: 'пояснення',
  example: 'приклад',
  practice: 'практика',
  check: 'перевірка',
  summary: 'підсумок',
}

const MIN_STAGES = 3
const MAX_STAGES = 9

/** Ключ на дошку: два уроки в двох вкладках не мають ділити план. */
function keyFor(boardId) {
  return `${KEY_PREFIX}${boardId || 'none'}`
}

/**
 * Чи це схоже на план. НЕ повна валідація — вона на сервері й лишається там:
 * дві повні валідації розійшлися б, і клієнтська почала б відхиляти те, що
 * сервер приймає. Тут лише захист від сміття в сховищі.
 */
export function looksLikePlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return false
  if (!Array.isArray(plan.stages)) return false
  if (plan.stages.length < MIN_STAGES || plan.stages.length > MAX_STAGES) return false
  return plan.stages.every(s => s && typeof s.id === 'string'
    && ROLES.includes(s.role) && STATUSES.includes(s.status))
}

export function activeStage(plan) {
  if (!plan || !Array.isArray(plan.stages)) return null
  return plan.stages.find(s => s.status === 'active') || null
}

/** Урок завершено: жодного активного етапу. Це нормальний фінал, не помилка. */
export function isCompleted(plan) {
  return !!plan && activeStage(plan) === null
}

/**
 * Наступний крок — перший `planned` ПІСЛЯ активного.
 * Дзеркало `next_stage()` на бекенді, включно з тим, що назад не обертається:
 * пропущене позаду лишається позаду, повернення — окреме рішення вчителя.
 */
export function nextStage(plan) {
  if (!plan || !Array.isArray(plan.stages)) return null
  const i = plan.stages.findIndex(s => s.status === 'active')
  if (i < 0) return null
  return plan.stages.slice(i + 1).find(s => s.status === 'planned') || null
}

/**
 * Перевести план на інший етап. Повертає НОВИЙ об'єкт, вхід не міняє.
 * `next` | `skip` | `set`. Немає наступного `planned` → урок завершено
 * (`current_stage: null`), і це успіх, а не помилка.
 * Рухати вже завершений план — `null` (нема чого закривати вдруге).
 */
export function advanceStage(plan, action, stageId = null) {
  if (!looksLikePlan(plan)) return null
  const stages = plan.stages.map(s => ({ ...s }))
  const bump = next => ({ ...plan, stages, current_stage: next, rev: (plan.rev || 0) + 1 })

  if (action === 'set') {
    const target = stages.findIndex(s => s.id === stageId)
    if (target < 0) return null
    stages.forEach((s, i) => {
      if (s.status !== 'active') return
      // Уперед — вважаємо пройденим; назад — повертаємо в «заплановано»,
      // щоб «повернися до пояснення» не викреслювало все, що між ними.
      s.status = i < target ? 'done' : 'planned'
    })
    stages[target].status = 'active'
    return bump(stageId)
  }

  if (action !== 'next' && action !== 'skip') return null

  const current = activeStage(plan)
  if (!current) return null            // план завершено
  const upcoming = nextStage(plan)

  const cur = stages.find(s => s.id === current.id)
  cur.status = action === 'next' ? 'done' : 'skipped'
  if (!upcoming) return bump(null)     // урок завершено — штатний фінал

  stages.find(s => s.id === upcoming.id).status = 'active'
  return bump(upcoming.id)
}

// ── Сховище ───────────────────────────────────────────────────────────────
export function loadPlan(boardId) {
  try {
    const raw = sessionStorage.getItem(keyFor(boardId))
    if (!raw) return null
    const plan = JSON.parse(raw)
    // Сміття в сховищі — не привід тягти його в промпт. Чистимо мовчки:
    // це не помилка користувача й нічого йому не каже.
    if (!looksLikePlan(plan)) { clearPlan(boardId); return null }
    return plan
  } catch {
    return null
  }
}

export function savePlan(boardId, plan) {
  if (!looksLikePlan(plan)) return false
  try {
    sessionStorage.setItem(keyFor(boardId), JSON.stringify(plan))
    return true
  } catch {
    // Приватне вікно, повне сховище — план просто не переживе перезавантаження.
    // Урок від цього не ламається, тож і кричати нема про що.
    return false
  }
}

export function clearPlan(boardId) {
  try { sessionStorage.removeItem(keyFor(boardId)) } catch { /* нема що чистити */ }
}
