/**
 * Next Actions V1 — клік по дії на картці → чинний будівник на бекенді → штатні ops.
 *
 * Рішення власника 2026-09-21. Фронт НЕ знає, що таке «сторони битви» чи
 * «родина»: дії приходять із бекенду готовими (`{id, label}`), а результат —
 * той самий план `board_action_plan`, що й у палітри. Кладеться він тим самим
 * `runBoardAction`, тобто через штатні ops, — окремого шляху запису немає.
 *
 * Список дій — НЕ стан дошки: у картці лише `entity_ref`, а доступні дії жива
 * картка питає тут (`loadNextActions`). Replay сюди не потрапляє: обробників
 * шар оверлеїв дає картці лише в живому редагуванні тьютора, тож у Replay
 * немає ні кнопок, ні запитів.
 */
import apiClient from '../../utils/apiClient'
import { notifyError, notifyWarning } from '../../utils/notify'
import { runBoardAction, sanitizeTeachingActions } from './boardActions'

const inFlight = new Set()
// Одна сутність — один запит за сесію сторінки: картку перемальовують часто,
// а бекенд і так кешує. Невдалий запит із кешу прибираємо — наступний спробує.
const available = new Map()

function currentBoardId() {
  // Id дошки потрібен бекенду лише для мови матеріалу; без нього дія працює.
  return import('@/modules/winterboard/stores/opsSyncStore')
    .then(({ useOpsSyncStore }) => useOpsSyncStore().sessionId ?? null)
    .catch((e) => {
      console.warn('[nextActions] board id unavailable', e)
      return null
    })
}

export function loadNextActions(ref) {
  if (!ref?.provider || !ref?.id) return Promise.resolve([])
  const key = `${ref.provider}:${ref.id}`
  if (!available.has(key)) {
    const request = currentBoardId()
      .then((boardId) => apiClient.post('/v1/intents/next-actions/available/', {
        board_id: boardId,
        entity_ref: { provider: ref.provider, id: ref.id },
      }))
      .then((res) => sanitizeTeachingActions((res?.actions ? res : (res?.data ?? {})).actions))
      .catch((e) => {
        // Кнопки — надбудова: без них картка повноцінна. Не мовчимо в консоль.
        console.warn('[nextActions] available actions failed', e)
        available.delete(key)
        return []
      })
    available.set(key, request)
  }
  return available.get(key)
}

/** Лише для тестів: скинути кеш доступних дій. */
export function _resetNextActionsCache() {
  available.clear()
}

export async function runNextAction(source, action) {
  const ref = source?.data?.entity_ref
  if (!ref || !action?.id) return
  const key = `${source.id}:${action.id}`
  if (inFlight.has(key)) return            // повторний клік, поки перший ще йде
  inFlight.add(key)
  try {
    const res = await apiClient.post('/v1/intents/next-actions/run/', {
      board_id: await currentBoardId(),
      entity_ref: ref,
      action_id: action.id,
    })
    const plan = res?.status ? res : (res?.data ?? {})
    if (plan.status !== 'board_action_plan') {
      notifyWarning(plan.explain || 'Для цієї дії зараз немає результату.')
      return
    }
    for (const step of plan.actions || []) {
      await runBoardAction(step)
      // дати вставці «осісти» — той самий ритм, що в плані палітри
      await new Promise((resolve) => setTimeout(resolve, 130))
    }
  } catch (e) {
    notifyError(`Не вдалося виконати «${action.label}»: ${e?.message || 'невідома помилка'}`)
  } finally {
    inFlight.delete(key)
  }
}
