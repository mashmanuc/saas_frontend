/**
 * Вхід у пульт: який вигляд показати на цьому пристрої і куди веде QR
 * (ТЗ Салюта TZ_REMOTE_DESKTOP_CONNECT_2026-09-22 §2.1–2.4).
 *
 * Великий екран пояснює, як підключитись; сам пульт живе на телефоні
 * (так роблять WhatsApp Web, Spotify Connect, YouTube на ТВ).
 */

/**
 * Універсальна адреса пульта — ОДНЕ джерело для QR у модалці дошки і на
 * сторінці підключення: без id і без коду, пульт сам знаходить дошку.
 */
export function remoteEntryUrl(): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/remote`
}

/**
 * Пульт — лише коли введення тільки дотиком. Ноутбук із тачскріном чи
 * графічним планшетом (перо = вказівник) має кілька режимів введення →
 * сторінка підключення. Правило — з `useDeviceMode`, без розбору user-agent.
 */
export function isRemoteDevice(input: { isTouchInput: boolean; hasMultipleInputModes: boolean }): boolean {
  return input.isTouchInput && !input.hasMultipleInputModes
}

// «Все одно відкрити пульт тут» — до кінця вкладки (sessionStorage).
const FORCE_KEY = 'wb.remote.forceHere'
// Підказка після першого підключення — раз на пристрій (localStorage).
const TIP_KEY = 'wb.remote.firstTipSeen'

function read(storage: () => Storage, key: string): boolean {
  try { return storage().getItem(key) === '1' } catch { return false }
}
function write(storage: () => Storage, key: string): void {
  // Сховище може бути вимкнене (приватне вікно) — тоді вибір живе до перезавантаження.
  try { storage().setItem(key, '1') } catch { /* сховище недоступне — не критично */ }
}

export const remoteForcedHere = (): boolean => read(() => window.sessionStorage, FORCE_KEY)
export const forceRemoteHere = (): void => write(() => window.sessionStorage, FORCE_KEY)
export const firstTipSeen = (): boolean => read(() => window.localStorage, TIP_KEY)
export const markFirstTipSeen = (): void => write(() => window.localStorage, TIP_KEY)
