/**
 * Інтегралик текстом з пульта — LAW §9 v1.20 (власник 2026-09-29, після уроку: «в пультові додали
 * для інтегралика тільки кнопку голосу, а не поле вводу… поки учні працюють над одним, а я можу
 * готувати матеріал далі… тексти з пульта лишати на пультові, щоб дошка була чистою»).
 *
 * Окрема розмова ноутбука: свій conversation_id і своя історія; вікно Інтегралика не відкривається,
 * маскот не реагує. Конвеєр той самий, що у вікна (parse із «зором» і каталогом → дія на дошці).
 * Новий матеріал — на ПІДГОТОВЧУ сторінку одразу після поточної, без переходу (екран лишається
 * на своїй). Зміни наявного, навігація, план уроку, збереження — не з пульта: чесна відповідь.
 * На телефон іде лише ОСТАННЯ відповідь (`reply`) — діалог телефон складає сам.
 *
 * Залежності — параметром (палітра дає справжні, тест — підробки).
 */
import { watch } from 'vue'
import { PREP_PAGE_KINDS } from './boardActions'

/** = REMOTE_ASSISTANT_REPLY_TEXT_MAX_LEN на сервері (довше сервер відкине поле цілим). */
export const REMOTE_REPLY_TEXT_MAX = 600
/** Скільки останніх id запитів пам'ятаємо проти повтору з телефона. */
const HANDLED_MAX = 50
/** Історія — як у вікна: ≤ 6 реплік (ліміт ратифіковано; сервер теж обрізає). */
const HISTORY_MAX = 6
/** Пауза між кроками плану — як у вікна (runPlan): вставці через подію дати «осісти». */
const PLAN_STEP_PAUSE_MS = 130

const PREP_KINDS = new Set(PREP_PAGE_KINDS)

function clip(text) {
  const s = String(text ?? '').trim()
  return s.length > REMOTE_REPLY_TEXT_MAX ? `${s.slice(0, REMOTE_REPLY_TEXT_MAX - 1)}…` : s
}

export function createRemoteAssistant(deps) {
  const handled = []           // id запитів, що вже прийшли (повтор телефона не виконується вдруге)
  let busy = false
  let pending = null           // { requestId, actions, explain } — підтвердження чекає «Так/Ні»
  let prepPageId = null        // підготовча сторінка: нова, поки вчитель на неї не перейшов
  let stopWatch = null
  let history = []
  const conversationId = deps.newConversationId()

  function send(requestId, status, text, pageId) {
    const reply = { request_id: requestId, status }
    if (text) reply.text = clip(text)
    if (pageId) reply.page_id = pageId
    deps.reply(reply)
  }

  function remember(role, content) {
    if (!content) return
    history = [...history, { role, content: String(content) }].slice(-HISTORY_MAX)
  }

  /** Відповідь без дії на дошці: на телефон і в історію. */
  function answerText(requestId, text) {
    remember('assistant', text)
    send(requestId, 'reply', text)
  }

  async function prepPage() {
    const store = await deps.getStore()
    if (!stopWatch) {
      // Учитель перейшов на підготовчу сторінку — вона показана; наступний матеріал — на нову
      stopWatch = watch(() => store.currentPage?.id, (id) => { if (id && id === prepPageId) prepPageId = null })
    }
    const alive = prepPageId && store.pages.some((p) => p.id === prepPageId)
    if (!alive || store.currentPage?.id === prepPageId) {
      prepPageId = store.insertPageAfterCurrent() || null
    }
    return { store, pageId: prepPageId }
  }

  /** Покласти матеріал на підготовчу сторінку; поза історією ↶ ноутбука. */
  async function place(requestId, actions, explain) {
    const { store, pageId } = await prepPage()
    if (!pageId) {
      remember('assistant', deps.t('winterboard.remote.assistant.maxPages'))
      return send(requestId, 'error', deps.t('winterboard.remote.assistant.maxPages'))
    }
    const ctx = { pageId }
    await store.runWithoutHistory(async () => {
      for (let i = 0; i < actions.length; i++) {
        try {
          await deps.runAction(actions[i], ctx)
        } catch (e) {
          const reason = e?.message || deps.t('winterboard.remote.assistant.actionFailed')
          throw new Error(actions.length > 1 ? deps.t('winterboard.remote.assistant.stepFailed', { n: i + 1, reason }) : reason)
        }
        if (i < actions.length - 1) await new Promise((res) => setTimeout(res, PLAN_STEP_PAUSE_MS))
      }
    })
    const text = explain || deps.t('winterboard.remote.assistant.done')
    remember('assistant', `Виконано: ${text}`)   // як в історії вікна (aiHistory, kind 'done')
    send(requestId, 'done', text, pageId)
  }

  function onlyNewMaterial(requestId) {
    answerText(requestId, deps.t('winterboard.remote.assistant.onlyNew'))
  }

  async function handle(requestId, r) {
    switch (r?.status) {
      case 'board_action': {
        if (!PREP_KINDS.has(r.action?.kind)) return onlyNewMaterial(requestId)
        if (r.risk === 'medium' || r.risk === 'high') {
          pending = { requestId, actions: [r.action], explain: r.explain }
          remember('assistant', r.explain)
          return send(requestId, 'confirm', r.explain || deps.t('winterboard.remote.assistant.confirm'))
        }
        return place(requestId, [r.action], r.explain)
      }
      case 'board_action_plan': {
        // План із кількох дій — лише коли ВСІ кроки створюють новий матеріал; вікно план не
        // підтверджує (runPlan) — і пульт так само.
        const actions = Array.isArray(r.actions) ? r.actions : []
        if (!actions.length || !actions.every((a) => PREP_KINDS.has(a?.kind))) return onlyNewMaterial(requestId)
        return place(requestId, actions, r.explain)
      }
      case 'clarify': {
        const options = (r.candidates || []).map((c, i) => `${i + 1}) ${c?.label ?? ''}`).join('\n')
        return answerText(requestId, [r.question, options].filter(Boolean).join('\n'))
      }
      case 'propose':
        // дії робочого простору (зберегти, опублікувати, експорт, інша дошка) — з ноутбука
        return onlyNewMaterial(requestId)
      case 'plan_action':
        return answerText(requestId, deps.t('winterboard.remote.assistant.planOnLaptop'))
      default:
        return answerText(requestId, r?.explain || deps.t('winterboard.remote.assistant.noAnswer'))
    }
  }

  function errorText(e) {
    if (deps.isLimitError(e)) return deps.t('winterboard.remote.assistant.limit')
    if (deps.isServerDisabled(e)) return deps.serverDisabledText
    if (deps.errorCode(e) === 'AI_UNAVAILABLE') return deps.t('winterboard.remote.assistant.unavailable')
    return deps.humanError(e)
  }

  async function ask({ requestId, text }) {
    const phrase = String(text ?? '').trim()
    if (!requestId || !phrase || handled.includes(requestId)) return
    handled.push(requestId)
    if (handled.length > HANDLED_MAX) handled.shift()
    const deny = deps.canUse()
    if (deny !== true) return send(requestId, 'error', deny)
    if (busy) return send(requestId, 'error', deps.t('winterboard.remote.assistant.busy'))
    pending = null                     // новий запит скасовує підтвердження, що чекає
    busy = true
    send(requestId, 'thinking')
    const past = history.slice(-HISTORY_MAX)
    remember('user', phrase)
    try {
      let summary = null
      let summaryError = null
      let tools = null
      if (deps.boardId()) {
        // Як у вікна: без «зору» parse не блокуємо, але причину кажемо моделі (Б-13), а не мовчимо
        try { summary = await deps.buildSummary() } catch (e) {
          summaryError = String(e?.message || e).slice(0, 200)
          console.error('[Інтегралик · пульт] стан дошки не зібрано:', e)
        }
        try { tools = await deps.buildTools() } catch (e) {
          console.error('[Інтегралик · пульт] каталог інструментів дошки не зібрано:', e)
        }
      }
      let r
      try {
        r = await deps.parse(phrase, deps.boardId(), past, summary, tools, deps.locale(), conversationId, deps.page(), summaryError)
      } catch (e) {
        return send(requestId, 'error', errorText(e))
      }
      if (r?.corridor) deps.applyCorridor(r.corridor)
      await handle(requestId, r)
    } catch (e) {
      // дія на дошці не вдалася — людський текст обробника (як «Не вдалося…» у вікні)
      console.warn('[Інтегралик · пульт] дія на дошці не вдалася:', e)
      remember('assistant', e?.message)
      send(requestId, 'error', e?.message || deps.t('winterboard.remote.assistant.actionFailed'))
    } finally {
      busy = false
    }
  }

  async function answer({ requestId, choice }) {
    if (!pending || pending.requestId !== requestId || busy) return
    const p = pending
    pending = null
    if (choice !== 'yes') {
      remember('assistant', deps.t('winterboard.remote.assistant.cancelled'))
      return send(requestId, 'cancelled')
    }
    busy = true
    send(requestId, 'thinking')
    try {
      await place(requestId, p.actions, p.explain)
    } catch (e) {
      console.warn('[Інтегралик · пульт] дія на дошці не вдалася:', e)
      send(requestId, 'error', e?.message || deps.t('winterboard.remote.assistant.actionFailed'))
    } finally {
      busy = false
    }
  }

  function dispose() {
    stopWatch?.()
    stopWatch = null
  }

  return { ask, answer, dispose }
}
