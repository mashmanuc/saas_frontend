// WB Remote: НОУТБУК-проєктор приймає команди пульта й виконує ЛОКАЛЬНІ дії.
// Ref: LAW §9 «Remote control», CLASSROOM_REMOTE_VISION_2026-09-02.md крок 5.
//
// Пульт НЕ є писарем: сюди приходить намір («перейди на сторінку 4»), а запис у
// стан і реплей іде штатним шляхом від локальної дії (goToPage → op page_navigate
// через REST, як від кліку). undo — локальний стек. phrase → штатний конвеєр
// Інтегралика (CustomEvent m4sh:integralyk-ask), як від голосу з ноутбука.
//
// v1.1 (2026-09-02): код зв'язки СТАБІЛЬНИЙ — виводиться з id дошки
// (remotePair.derivePair), не випадковий на кожен mount. Пульт відкривається
// універсальною адресою /remote і сам знаходить активну дошку; QR — лише
// зручний спосіб відкрити ту адресу на телефоні.
//
// v1.2 (2026-09-03, з уроку): view.fit / view.zoom / view.scroll / card.reveal
// через RemoteViewAdapter (масштаб і скрол полотна, «відповідь/розбір» на
// картках задач). Стан для пульта доповнено `cards` і `zoom`.

import { ref, computed, watch, onUnmounted, type Ref, type ComputedRef } from 'vue'
import { derivePair } from '../remote/remotePair'
import type { RemoteViewAdapter } from './useRemoteViewAdapter'

export interface BoardRemoteStore {
  currentPageIndex: number
  pageCount: number
  goToPage: (index: number) => void
  addPage: () => void
}

export interface UseBoardRemoteOptions {
  sessionId: Ref<string | null>
  store: BoardRemoteStore
  undo: () => void
  /** presence.sendMessage — той самий сокет ноутбука */
  sendMessage: (data: Record<string, unknown>) => void
  /** Ноутбук виконує команди лише коли він власник/учитель */
  enabled: Ref<boolean> | ComputedRef<boolean>
  /** v1.2: масштаб/скрол/картки. Необов'язково — без нього v1.2-команди ігноруються. */
  view?: RemoteViewAdapter
  /** Дошка з фіналізованим записом (writes відхиляються) — пульт має сказати це вчителю */
  frozen?: Ref<boolean> | ComputedRef<boolean>
}

export interface RemoteCommandDetail {
  userId: string
  pair: string
  clientId: string
  cmd: 'hello' | 'page.goto' | 'page.new' | 'undo' | 'phrase' | 'view.fit' | 'view.zoom' | 'view.scroll' | 'card.reveal'
  args: { index?: number; text?: string; delta?: number; dir?: number; what?: 'answer' | 'solution' }
}

/** Мінімальна пауза між remote.state при швидкому гортанні (сервер: 10/с). */
export const REMOTE_STATE_THROTTLE_MS = 150

function randomClientId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch { /* fallthrough */ }
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function useBoardRemote(opts: UseBoardRemoteOptions) {
  /** Стабільний код дошки — той самий після перезавантаження ноутбука */
  const pairCode = computed(() => derivePair(opts.sessionId.value ?? ''))
  const clientId = randomClientId()
  /** Останній hello від пульта (ms) — null = пульт ще не підключався */
  const lastRemoteSeenAt = ref<number | null>(null)
  const remoteConnected = computed(() => lastRemoteSeenAt.value !== null)
  const ignoredCount = ref(0)

  /** Універсальна адреса пульта: без id, без коду — сам знайде активну дошку */
  const remoteUrl = computed(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/remote`
  })

  // ── remote.state → пульт ─────────────────────────────────────────────
  let stateTimer: ReturnType<typeof setTimeout> | null = null
  let lastStateSentAt = 0

  function sendStateNow(): void {
    lastStateSentAt = Date.now()
    const msg: Record<string, unknown> = {
      type: 'remote.state',
      pair: pairCode.value,
      client_id: clientId,
      page_index: opts.store.currentPageIndex,
      page_count: opts.store.pageCount,
    }
    if (opts.view) {
      const s = opts.view.summary()
      msg.zoom = s.zoom
      msg.cards = { count: s.count, answer: s.answer, solution: s.solution }
    }
    if (opts.frozen) msg.frozen = !!opts.frozen.value
    opts.sendMessage(msg)
  }

  // Заморозка змінилась (фіналізували / «Новий запис») → пульт має знати одразу
  if (opts.frozen) {
    watch(opts.frozen, () => { if (remoteConnected.value && opts.enabled.value) sendState() })
  }

  function sendState(): void {
    const since = Date.now() - lastStateSentAt
    if (since >= REMOTE_STATE_THROTTLE_MS) {
      if (stateTimer) { clearTimeout(stateTimer); stateTimer = null }
      sendStateNow()
      return
    }
    if (stateTimer) return
    stateTimer = setTimeout(() => { stateTimer = null; sendStateNow() }, REMOTE_STATE_THROTTLE_MS - since)
  }

  // Пульт підключений → тримати його в курсі, де дошка
  watch(
    () => [opts.store.currentPageIndex, opts.store.pageCount] as const,
    ([idx], [prevIdx]) => {
      if (idx !== prevIdx) opts.view?.resetFocus()
      if (remoteConnected.value && opts.enabled.value) sendState()
    },
  )

  // Сторінка може перемкнутися РАНІШЕ, ніж конструктор уроку догрузить її
  // картки. Якщо стежити лише за індексом сторінки, пульт чесно отримує
  // `cards: { count: 0 }` і назавжди вимикає «Задача на екран» / «Відповідь» /
  // «Розбір», хоча картка вже з'явилась на полотні. summary() читає саме
  // реактивні дані поточної сторінки; тому цей watcher посилає свіжий стан
  // щойно картка з'явилась, зникла або змінила answer/solution.
  watch(
    () => opts.view?.summary(),
    () => {
      if (remoteConnected.value && opts.enabled.value) sendState()
    },
  )

  // ── remote.command ← пульт ───────────────────────────────────────────
  function onRemoteCommand(e: Event): void {
    const d = (e as CustomEvent<RemoteCommandDetail>).detail
    if (!d || !opts.enabled.value) return
    if (d.pair !== pairCode.value) { ignoredCount.value += 1; return }

    lastRemoteSeenAt.value = Date.now()
    const store = opts.store
    const view = opts.view

    switch (d.cmd) {
      case 'hello':
        sendStateNow()
        return
      case 'page.goto': {
        const index = d.args?.index
        if (typeof index !== 'number' || !Number.isInteger(index)) return
        if (index < 0 || index >= store.pageCount) return
        if (index !== store.currentPageIndex) store.goToPage(index)
        // стан піде через watch; якщо індекс не змінився — підтвердити явно
        else sendState()
        return
      }
      case 'page.new':
        store.addPage()
        return
      case 'undo':
        opts.undo()
        return
      case 'phrase': {
        const text = String(d.args?.text ?? '').trim()
        if (!text) return
        window.dispatchEvent(new CustomEvent('m4sh:integralyk-ask', { detail: { text } }))
        return
      }
      // v1.2 — вигляд полотна і картки задач; стан підтверджуємо явно, бо
      // watch стежить лише за сторінками
      case 'view.fit':
        if (!view) return
        view.fitTask()
        sendState()
        return
      case 'view.zoom': {
        if (!view) return
        const delta = Number(d.args?.delta)
        if (!Number.isInteger(delta) || delta === 0) return
        view.zoomBy(delta)
        sendState()
        return
      }
      case 'view.scroll': {
        if (!view) return
        const dir = Number(d.args?.dir)
        if (dir !== 1 && dir !== -1) return
        view.scrollBy(dir)
        return
      }
      case 'card.reveal': {
        if (!view) return
        const what = d.args?.what
        if (what !== 'answer' && what !== 'solution') return
        view.reveal(what)
        sendState()
        return
      }
      default:
        return
    }
  }

  window.addEventListener('wb:remote-command', onRemoteCommand)
  onUnmounted(() => {
    window.removeEventListener('wb:remote-command', onRemoteCommand)
    if (stateTimer) clearTimeout(stateTimer)
  })

  return { pairCode, clientId, remoteUrl, remoteConnected, lastRemoteSeenAt, ignoredCount, sendState }
}
