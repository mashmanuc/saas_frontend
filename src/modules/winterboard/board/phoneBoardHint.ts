/**
 * Б-202 (власник 2026-10-15, «так і зроби»): дошка на телефоні вертикально — лише вузька смужка.
 *
 * Прод 15.10: новий учитель з реклами (iPhone) відкрив дошку, провів одну лінію й пішов за ~6 с.
 * Виміряно на 390×844: аркуш 16:9 займає 219 з 844 пікселів, під ним сіра порожнеча, внизу три
 * ряди інструментів. Дошку ведуть з комп'ютера чи планшета, а телефон у нас — пульт (LAW §9),
 * але сказано це ніде не було. Тому власнику дошки на телефоні вертикально — одне вікно:
 * «Дошку зручніше вести з комп'ютера або планшета» · [Зрозуміло] · [Все одно відкрити дошку].
 *
 * Власник 2026-10-21 («роби, на телефоні горизонтально — пульт»): і телефон горизонтально. Там аркуш
 * невисокий (844×390 — масштаб ~0,2), кнопки картки ширші за саму картку й закривають її (стенд 21.10).
 *
 * Лише вигляд на цьому пристрої: дошки, операцій і стану не чіпає.
 */
import { WB_BREAKPOINTS } from '../types/responsive'

/** «Все одно відкрити дошку» — більше не питати на цьому пристрої. */
export const PHONE_BOARD_HINT_DISMISSED_KEY = 'm4sh:wb-phone-hint-dismissed'

export interface PhoneBoardHintInput {
  viewportWidth: number
  viewportHeight: number
  /** Власник хмарної дошки. Учень-глядач і гість локальної дошки вікна не бачать. */
  isSessionOwner: boolean
  isLocalWorkspace: boolean
  dismissed: boolean
  /** Керують пальцем (`pointer: coarse`). Невисоке вікно браузера на ноутбуці — не телефон. */
  coarsePointer?: boolean
}

/** Телефон вертикально: вужче за мобільний поріг дошки (640) і вищий, ніж широкий. Планшет — ні. */
export function isPhonePortrait(width: number, height: number): boolean {
  return width > 0 && width < WB_BREAKPOINTS.mobile && height > width
}

/**
 * Телефон горизонтально: нижчий за мобільний поріг (640), вужчий за поріг планшета (1024), ширший, ніж
 * високий, і з дотиком. Планшет горизонтально (1024×768 і більше) — ні.
 */
export function isPhoneLandscape(width: number, height: number, coarsePointer: boolean): boolean {
  return coarsePointer && height > 0 && height < WB_BREAKPOINTS.mobile && width > height
    && width < WB_BREAKPOINTS.tabletL
}

export function shouldShowPhoneBoardHint(input: PhoneBoardHintInput): boolean {
  if (input.dismissed || input.isLocalWorkspace || !input.isSessionOwner) return false
  return isPhonePortrait(input.viewportWidth, input.viewportHeight)
    || isPhoneLandscape(input.viewportWidth, input.viewportHeight, input.coarsePointer === true)
}

/** Чи керують пальцем — для `coarsePointer`. Без `matchMedia` (тести, старий браузер) — ні. */
export function hasCoarsePointer(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
  } catch {
    return false
  }
}

export function readPhoneBoardHintDismissed(): boolean {
  try {
    return localStorage.getItem(PHONE_BOARD_HINT_DISMISSED_KEY) === '1'
  } catch {
    // Приватне вікно без localStorage — питаємо щоразу; дошку це не блокує.
    return false
  }
}

export function rememberPhoneBoardHintDismissed(): void {
  try {
    localStorage.setItem(PHONE_BOARD_HINT_DISMISSED_KEY, '1')
  } catch {
    // Не вдалось запам'ятати — наступного разу вікно з'явиться знову, і тільки.
  }
}
