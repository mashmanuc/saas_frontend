/**
 * Керування YouTube-картками дошки з пульта — V1 «відео з пульта» (2026-09-26).
 *
 * Лише ДОКУМЕНТОВАНИЙ плеєр: YouTube IFrame Player API (скрипт
 * https://www.youtube.com/iframe_api, клас YT.Player, під'єднаний до вже
 * наявного iframe картки з enablejsapi=1). Стан відтворення — ефемерний UI
 * ноутбука: не ops, не Replay, у БД не пишеться.
 *
 * Старт зі звуком браузер дозволяє лише після хоча б одного дотику до цієї
 * вкладки (заміряно 2026-09-25: Chrome 153 / Edge 154 / Firefox 144 однаково;
 * команда з мережі жестом не є). Тому без повторів-маскування: стан `blocked`
 * і видиме «Натисніть на дошку для запуску відео». Наступний дотик до сторінки
 * — це вже жест людини; у ньому один раз запускаємо відкладене відео.
 *
 * Помилки плеєра (документовані коди onError): 100 — відео немає / приватне,
 * 101 і 150 — власник заборонив вбудовування, решта — збій відтворення.
 */
import { reactive } from 'vue'

export type YtPlayState = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'blocked' | 'error'
export type YtPlayError = 'not_found' | 'not_embeddable' | 'playback'

/** Мінімальний опис YT.Player, який ми викликаємо (документовані методи). */
interface YtPlayer {
  playVideo(): void
  pauseVideo(): void
}
interface YtNamespace {
  Player: new (el: HTMLIFrameElement, opts: {
    events: {
      onReady?: (e: { target: YtPlayer }) => void
      onStateChange?: (e: { data: number }) => void
      onError?: (e: { data: number }) => void
    }
  }) => YtPlayer
}
declare global {
  interface Window { YT?: YtNamespace; onYouTubeIframeAPIReady?: () => void }
}

const API_SRC = 'https://www.youtube.com/iframe_api'
/** Не почало грати за цей час, а вкладку ще не чіпали → браузер заблокував. */
export const START_CHECK_MS = 1500

interface Entry {
  frame: HTMLIFrameElement
  player: YtPlayer | null
  ready: boolean
  /** ▶ натиснули раніше, ніж плеєр став готовий — виконаємо в onReady (один раз) */
  playWhenReady: boolean
}

const entries = new Map<string, Entry>()
/** Стан кожної YouTube-картки за id асета (реактивний — пульт і банер читають його). */
export const ytPlayStates = reactive<Record<string, YtPlayState>>({})
/** Причина стану `error` (для зрозумілого повідомлення на пульті). */
export const ytPlayErrors = reactive<Record<string, YtPlayError>>({})
const pendingOnTap = new Set<string>()
let apiPromise: Promise<YtNamespace> | null = null
let tapArmed = false

/** Документований спосіб: один <script src=iframe_api> + onYouTubeIframeAPIReady. */
export function loadYouTubeIframeApi(): Promise<YtNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise<YtNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT) resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = API_SRC
    script.async = true
    script.onerror = () => { apiPromise = null; reject(new Error('youtube_iframe_api_unavailable')) }
    document.head.appendChild(script)
  })
  return apiPromise
}

function hasBeenActive(): boolean {
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
  return ua ? ua.hasBeenActive : true
}

function applyPlayerState(id: string, s: number): void {
  // YT.PlayerState: -1 не почато, 0 кінець, 1 грає, 2 пауза, 3 буферизація, 5 підготовлено
  if (s === 1) { ytPlayStates[id] = 'playing'; pendingOnTap.delete(id) }
  else if (s === 2) ytPlayStates[id] = 'paused'
  else if (s === 0) ytPlayStates[id] = 'ended'
  else if (s === 5 && ytPlayStates[id] !== 'blocked') ytPlayStates[id] = 'idle'
  // -1 і 3 під час спроби старту стан не змінюють: рішення «blocked» — за таймером
}

function applyPlayerError(id: string, code: number): void {
  ytPlayErrors[id] = code === 100 ? 'not_found' : code === 101 || code === 150 ? 'not_embeddable' : 'playback'
  ytPlayStates[id] = 'error'
  pendingOnTap.delete(id)
}

function onUserTap(): void {
  window.removeEventListener('pointerdown', onUserTap, true)
  window.removeEventListener('keydown', onUserTap, true)
  tapArmed = false
  const ids = [...pendingOnTap]
  pendingOnTap.clear()
  // Ми в жесті людини: відкладене відео стартує зі звуком (один раз, без петлі)
  for (const id of ids) if (ytPlayStates[id] === 'blocked') playVideo(id)
}

function armTapToStart(): void {
  if (tapArmed) return
  tapArmed = true
  window.addEventListener('pointerdown', onUserTap, true)
  window.addEventListener('keydown', onUserTap, true)
}

export function registerYouTubeFrame(id: string, frame: HTMLIFrameElement): void {
  entries.set(id, { frame, player: null, ready: false, playWhenReady: false })
  if (!ytPlayStates[id]) ytPlayStates[id] = 'idle'
  loadYouTubeIframeApi().then((YT) => {
    const entry = entries.get(id)
    if (!entry || entry.frame !== frame || entry.player) return
    entry.player = new YT.Player(frame, {
      events: {
        onReady: () => {
          entry.ready = true
          if (entry.playWhenReady) { entry.playWhenReady = false; playVideo(id) }
        },
        onStateChange: (e) => applyPlayerState(id, e.data),
        onError: (e) => applyPlayerError(id, e.data),
      },
    })
  }).catch(() => {
    // Скрипт плеєра не завантажився (мережа/блокувальник) — кажемо, а не мовчимо
    if (entries.get(id)?.frame === frame) { ytPlayErrors[id] = 'playback'; ytPlayStates[id] = 'error' }
  })
}

export function unregisterYouTubeFrame(id: string, frame?: HTMLIFrameElement): void {
  const entry = entries.get(id)
  if (!entry || (frame && entry.frame !== frame)) return
  // destroy() НЕ викликаємо: він видаляє iframe, яким керує Vue
  entries.delete(id)
  pendingOnTap.delete(id)
  delete ytPlayStates[id]
  delete ytPlayErrors[id]
}

export function playVideo(id: string): boolean {
  const entry = entries.get(id)
  if (!entry) return false
  if (ytPlayStates[id] === 'error') return false
  if (ytPlayStates[id] !== 'playing') ytPlayStates[id] = 'loading'
  if (!entry.ready || !entry.player) entry.playWhenReady = true
  else entry.player.playVideo()
  setTimeout(() => {
    if (ytPlayStates[id] !== 'loading') return
    if (!hasBeenActive()) {
      entry.playWhenReady = false
      ytPlayStates[id] = 'blocked'
      pendingOnTap.add(id)
      armTapToStart()
    }
    // Вкладку чіпали, але ще не грає — повільна мережа: чекаємо подію плеєра, без повтору.
  }, START_CHECK_MS)
  return true
}

export function pauseVideo(id: string): boolean {
  const entry = entries.get(id)
  if (!entry) return false
  pendingOnTap.delete(id)
  entry.playWhenReady = false
  if (entry.ready && entry.player) entry.player.pauseVideo()
  if (ytPlayStates[id] === 'blocked' || ytPlayStates[id] === 'loading') ytPlayStates[id] = 'idle'
  return true
}

/** Лише для тестів. */
export function __resetYouTubeRemoteControlForTests(): void {
  entries.clear()
  pendingOnTap.clear()
  for (const k of Object.keys(ytPlayStates)) delete ytPlayStates[k]
  for (const k of Object.keys(ytPlayErrors)) delete ytPlayErrors[k]
  apiPromise = null
  if (tapArmed) {
    window.removeEventListener('pointerdown', onUserTap, true)
    window.removeEventListener('keydown', onUserTap, true)
  }
  tapArmed = false
}
