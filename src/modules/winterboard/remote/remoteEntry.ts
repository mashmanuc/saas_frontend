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

// Підказка після першого підключення — раз на пристрій (localStorage).
// ⚠️ «Все одно відкрити пульт тут» НЕ зберігається (власник 2026-09-22: «інші
// спроби зразу перекидають на пульт без попередньої сторінки, і це не добре»).
// Вибір діє на один перегляд: пішов зі сторінки — наступного разу знову
// пояснення. Інакше вчитель залишався в пульті з «дошка не відкрита» й без
// виходу, бо меню веде на ту саму адресу.
const TIP_KEY = 'wb.remote.firstTipSeen'

function read(storage: () => Storage, key: string): boolean {
  try { return storage().getItem(key) === '1' } catch { return false }
}
function write(storage: () => Storage, key: string): void {
  // Сховище може бути вимкнене (приватне вікно) — тоді підказка з'явиться ще раз.
  try { storage().setItem(key, '1') } catch { /* сховище недоступне — не критично */ }
}

export const firstTipSeen = (): boolean => read(() => window.localStorage, TIP_KEY)
export const markFirstTipSeen = (): void => write(() => window.localStorage, TIP_KEY)
