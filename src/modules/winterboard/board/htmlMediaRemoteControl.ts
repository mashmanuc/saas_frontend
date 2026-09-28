/**
 * Керування відео-файлом і аудіо дошки з пульта — «Сценарій» (LAW §9 v1.15, ТЗ §4.2).
 *
 * Дзеркало `youtubeRemoteControl.ts`, але для HTML-програвачів (`<video>` / `<audio>`):
 * картка вчителя реєструє свій елемент за id об'єкта при монтуванні й знімає при
 * розмонтуванні. Стан береться з ПОДІЙ елемента (play, pause, ended, waiting, error,
 * volumechange) — тож рідні кнопки плеєра на ноутбуці теж оновлюють пульт.
 *
 * Стан відтворення й гучність — властивість цього ноутбука: не ops, не Replay, у БД не
 * пишеться, до учня не йде (у нього свій програвач).
 *
 * Звук без жесту: `play()` відхиляється з `NotAllowedError`, поки вкладку не чіпали
 * (LAW v1.8, заміряно 2026-09-25). Тоді стан `blocked` і той самий запуск першим дотиком
 * до сторінки, що в YouTube: один раз, без повторів кодом (LAW §12).
 */
import { reactive } from 'vue'
import type { YtPlayError, YtPlayState } from './youtubeRemoteControl'

export type MediaPlayState = YtPlayState
export type MediaPlayError = YtPlayError

/** Крок «Тихіше / Гучніше» пульта — 10 процентних пунктів (ТЗ Р3). */
export const VOLUME_STEP = 10

interface Entry {
  el: HTMLMediaElement
  off: () => void
}

const entries = new Map<string, Entry>()
/** Стан кожного HTML-програвача за id асета (реактивний — пульт читає його). */
export const mediaPlayStates = reactive<Record<string, MediaPlayState>>({})
/** Причина стану `error` (HTML-програвач знає лише «збій відтворення»). */
export const mediaPlayErrors = reactive<Record<string, MediaPlayError>>({})
/** Чутна гучність 0…100 (вимкнений звук = 0). */
export const mediaVolumes = reactive<Record<string, number>>({})
const pendingOnTap = new Set<string>()
let tapArmed = false

function effectiveVolume(el: HTMLMediaElement): number {
  return el.muted ? 0 : Math.round(el.volume * 100)
}

function onUserTap(): void {
  window.removeEventListener('pointerdown', onUserTap, true)
  window.removeEventListener('keydown', onUserTap, true)
  tapArmed = false
  const ids = [...pendingOnTap]
  pendingOnTap.clear()
  // Ми в жесті людини: відкладене відтворення стартує зі звуком (один раз, без петлі)
  for (const id of ids) if (mediaPlayStates[id] === 'blocked') playMedia(id)
}

function armTapToStart(): void {
  if (tapArmed) return
  tapArmed = true
  window.addEventListener('pointerdown', onUserTap, true)
  window.addEventListener('keydown', onUserTap, true)
}

export function registerMediaElement(id: string, el: HTMLMediaElement): void {
  unregisterMediaElement(id)
  const on = (type: string, fn: () => void) => {
    el.addEventListener(type, fn)
    return () => el.removeEventListener(type, fn)
  }
  const offs = [
    on('play', () => { mediaPlayStates[id] = 'playing'; pendingOnTap.delete(id); delete mediaPlayErrors[id] }),
    on('playing', () => { mediaPlayStates[id] = 'playing' }),
    on('pause', () => { if (!el.ended && mediaPlayStates[id] !== 'blocked') mediaPlayStates[id] = 'paused' }),
    on('ended', () => { mediaPlayStates[id] = 'ended' }),
    on('waiting', () => { if (!el.paused) mediaPlayStates[id] = 'loading' }),
    on('error', () => { mediaPlayErrors[id] = 'playback'; mediaPlayStates[id] = 'error'; pendingOnTap.delete(id) }),
    on('volumechange', () => { mediaVolumes[id] = effectiveVolume(el) }),
  ]
  entries.set(id, { el, off: () => offs.forEach((f) => f()) })
  mediaPlayStates[id] = el.paused ? 'idle' : 'playing'
  mediaVolumes[id] = effectiveVolume(el)
}

export function unregisterMediaElement(id: string, el?: HTMLMediaElement): void {
  const entry = entries.get(id)
  if (!entry || (el && entry.el !== el)) return
  entry.off()
  entries.delete(id)
  pendingOnTap.delete(id)
  delete mediaPlayStates[id]
  delete mediaPlayErrors[id]
  delete mediaVolumes[id]
}

export function hasMediaElement(id: string): boolean {
  return entries.has(id)
}

/** ▶ з пульта: `el.play()`. Заборона звуку без жесту → `blocked` + запуск першим дотиком. */
export function playMedia(id: string): boolean {
  const entry = entries.get(id)
  if (!entry) return false
  if (!entry.el.paused) return true
  mediaPlayStates[id] = 'loading'
  let started: Promise<void> | undefined
  try {
    started = entry.el.play()
  } catch (err) {
    // Старі браузери кидають синхронно — кажемо, а не мовчимо
    console.warn('[WB:remote] media play failed:', err)
    mediaPlayErrors[id] = 'playback'
    mediaPlayStates[id] = 'error'
    return false
  }
  started?.catch((err: unknown) => {
    if (entries.get(id)?.el !== entry.el) return
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      mediaPlayStates[id] = 'blocked'
      pendingOnTap.add(id)
      armTapToStart()
      return
    }
    // AbortError — pause() перервав play(): це не збій, стан скаже подія pause
    if (err instanceof DOMException && err.name === 'AbortError') return
    console.warn('[WB:remote] media play rejected:', err)
    mediaPlayErrors[id] = 'playback'
    mediaPlayStates[id] = 'error'
  })
  return true
}

export function pauseMedia(id: string): boolean {
  const entry = entries.get(id)
  if (!entry) return false
  pendingOnTap.delete(id)
  entry.el.pause()
  if (mediaPlayStates[id] === 'blocked' || mediaPlayStates[id] === 'loading') mediaPlayStates[id] = 'idle'
  return true
}

/**
 * 🔉/🔊 з пульта: ±10 п.п. у межах 0…100 від ПОТОЧНОГО значення (ручний повзунок не
 * збиває). Вимкнений звук: «Гучніше» спершу вмикає його (а з нуля — одразу 10 %).
 * Повертає чутну гучність після команди або null, якщо елемента немає.
 */
export function changeMediaVolume(id: string, delta: -1 | 1): number | null {
  const entry = entries.get(id)
  if (!entry) return null
  const el = entry.el
  if (delta > 0 && el.muted) {
    el.muted = false
    if (el.volume === 0) el.volume = VOLUME_STEP / 100
  } else {
    const next = Math.max(0, Math.min(100, effectiveVolume(el) + delta * VOLUME_STEP))
    el.volume = next / 100
    if (next > 0 && el.muted) el.muted = false
  }
  mediaVolumes[id] = effectiveVolume(el)
  return mediaVolumes[id]
}

/** Лише для тестів. */
export function __resetHtmlMediaRemoteControlForTests(): void {
  for (const id of [...entries.keys()]) unregisterMediaElement(id)
  pendingOnTap.clear()
  if (tapArmed) {
    window.removeEventListener('pointerdown', onUserTap, true)
    window.removeEventListener('keydown', onUserTap, true)
  }
  tapArmed = false
}
