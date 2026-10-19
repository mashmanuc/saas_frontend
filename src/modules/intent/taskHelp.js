/**
 * «💡 Підказка» і «⚠ Типова помилка» на виділеній задачі (пакет 3 «один Інтегралик», 2026-10-19;
 * LAW §9 v1.33; план — saas_docs/domains/intent/INTEGRALYK_UNIFICATION_2026-10-18.md).
 *
 * Новий механізм не потрібен: це той самий запит Інтегралика, що й з вікна (`parseAi`), з виділеним
 * об'єктом у стані дошки і закритим `context.quick`. Інструкцію ставить сервер, модель отримує лише
 * картку, підпис і перевірку «без відповіді» — теж сервер. Тут — лише:
 *   • зібрати стан дошки (виділене — та сама задача, на якій натиснули);
 *   • покласти картку штатним `add_card` поруч із задачею (`ctx.near`) — звичайний `asset_add`;
 *   • сказати вчителю словами, якщо картки не буде.
 * Вікно Інтегралика не відкривається, історія розмови не росте. Одна дія за раз (`taskHelpBusy`).
 */
import { ref } from 'vue'
import i18n from '@/i18n'
import { notifyInfo, notifyWarning } from '@/utils/notify'
import { parseAi } from './sendIntent'
import { buildBoardSummary, runBoardAction } from './boardActions'

export const TASK_HELP_KINDS = Object.freeze(['hint', 'mistake'])

/** Розмір картки підказки: 1–3 речення; довшу картку висота доросте сама (стандарт карток). */
export const TASK_HELP_CARD = Object.freeze({ w: 460, h: 220 })

/** Що зараз просимо: `{ id, kind }` — натиснутий значок пульсує, обидва не натискаються. */
export const taskHelpBusy = ref(null)

const t = (key) => i18n.global.t(key)

async function defaultDeps() {
  const { useWBStore } = await import('@/modules/winterboard/board/state/boardStore')
  const store = useWBStore()
  return {
    boardId: store.workspaceId || null,
    locale: i18n.global.locale.value,
    summary: buildBoardSummary,
    parse: parseAi,
    run: runBoardAction,
    info: notifyInfo,
    warn: notifyWarning,
  }
}

/**
 * Попросити Інтегралика про підказку чи типову помилку до `asset` (він виділений або розгорнутий —
 * саме його `buildBoardSummary` позначає `selected`). → 'placed' | 'refused' | 'busy' | 'failed'.
 */
export async function askTaskHelp(kind, asset, deps = null) {
  if (!TASK_HELP_KINDS.includes(kind) || !asset?.id) return 'failed'
  if (taskHelpBusy.value) {
    notifyInfo(t('winterboard.taskHelp.busy'))
    return 'busy'
  }
  taskHelpBusy.value = { id: asset.id, kind }
  const d = deps ?? await defaultDeps()
  try {
    const summary = await d.summary()
    const r = await d.parse(t(`winterboard.taskHelp.phrase.${kind}`), d.boardId, [], summary, null, d.locale,
      null, null, null, { quick: kind })
    if (r?.status === 'board_action' && r.action?.kind === 'add_card') {
      await d.run(r.action, { near: { assetId: asset.id, ...TASK_HELP_CARD } })
      return 'placed'
    }
    // Сервер пояснив словами (нічого не виділено, підказка вийшла з відповіддю тощо).
    d.info(String(r?.explain || '').trim() || t('winterboard.taskHelp.failed'))
    return 'refused'
  } catch (err) {
    // 503 / мережа — загальне повідомлення вже показав apiClient; тут — що саме не вийшло.
    console.error('[Інтегралик] підказка до задачі не вийшла:', err)
    d.warn(t('winterboard.taskHelp.failed'))
    return 'failed'
  } finally {
    taskHelpBusy.value = null
  }
}
