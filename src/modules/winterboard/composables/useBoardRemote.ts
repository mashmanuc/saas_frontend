// WB Remote: НОУТБУК-проєктор приймає команди пульта й виконує ЛОКАЛЬНІ дії.
// Ref: LAW §9 «Remote control», CLASSROOM_REMOTE_VISION_2026-09-02.md крок 5.
//
// Пульт НЕ є писарем: сюди приходить намір («перейди на сторінку 4»), а запис у
// стан і реплей іде штатним шляхом від локальної дії (goToPage → op page_navigate
// через REST, як від кліку). undo — локальний стек. phrase → штатний конвеєр
// Інтегралика (CustomEvent m4sh:integralyk-ask), як від голосу з ноутбука.
//
// Код зв'язки `pair` перевіряється ТУТ: сервер лише ретранслює. Команди з чужим
// pair (стара вкладка, інший пристрій того ж юзера) ігноруються.

import { ref, computed, watch, onUnmounted, type Ref, type ComputedRef } from 'vue'

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
}

export interface RemoteCommandDetail {
  userId: string
  pair: string
  clientId: string
  cmd: 'hello' | 'page.goto' | 'page.new' | 'undo' | 'phrase'
  args: { index?: number; text?: string }
}

/** Мінімальна пауза між remote.state при швидкому гортанні (сервер: 10/с). */
export const REMOTE_STATE_THROTTLE_MS = 150

function randomPairCode(): string {
  // 6 цифр: легко продиктувати, якщо QR не зчитався
  const n = Math.floor(Math.random() * 1_000_000)
  return String(n).padStart(6, '0')
}

function randomClientId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch { /* fallthrough */ }
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function useBoardRemote(opts: UseBoardRemoteOptions) {
  const pairCode = ref(randomPairCode())
  const clientId = randomClientId()
  /** Останній hello від пульта (ms) — null = пульт ще не підключався */
  const lastRemoteSeenAt = ref<number | null>(null)
  const remoteConnected = computed(() => lastRemoteSeenAt.value !== null)
  const ignoredCount = ref(0)

  const remoteUrl = computed(() => {
    const sid = opts.sessionId.value
    if (!sid || typeof window === 'undefined') return ''
    return `${window.location.origin}/winterboard/${sid}/remote?pair=${pairCode.value}`
  })

  // ── remote.state → пульт ─────────────────────────────────────────────
  let stateTimer: ReturnType<typeof setTimeout> | null = null
  let lastStateSentAt = 0

  function sendStateNow(): void {
    lastStateSentAt = Date.now()
    opts.sendMessage({
      type: 'remote.state',
      pair: pairCode.value,
      client_id: clientId,
      page_index: opts.store.currentPageIndex,
      page_count: opts.store.pageCount,
    })
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
    () => { if (remoteConnected.value && opts.enabled.value) sendState() },
  )

  // ── remote.command ← пульт ───────────────────────────────────────────
  function onRemoteCommand(e: Event): void {
    const d = (e as CustomEvent<RemoteCommandDetail>).detail
    if (!d || !opts.enabled.value) return
    if (d.pair !== pairCode.value) { ignoredCount.value += 1; return }

    lastRemoteSeenAt.value = Date.now()
    const store = opts.store

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
