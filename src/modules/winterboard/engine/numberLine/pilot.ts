/**
 * Метод інтервалів на числовій прямій — лише контрольний акаунт власника (id 40).
 *
 * Власник 2026-10-13: «Метод інтервалів… треба тільки включати для ID40. Бо він не дороблений… Багато
 * обмежень. І для пересічного користувача буде це як костиль». Нерівності й корені — для всіх.
 * Одне місце для гейту, щоб інспектор і майбутній шлях Інтегралика не розійшлись.
 */
export const NUMBER_LINE_INTERVALS_PILOT_USER_IDS: ReadonlySet<number> = new Set([40])

export function isIntervalsPilotUser(userId: unknown): boolean {
  return NUMBER_LINE_INTERVALS_PILOT_USER_IDS.has(Number(userId))
}
