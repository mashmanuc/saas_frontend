/**
 * Пошта, з якою щойно зареєструвались, — щоб після листа «Підтвердити пошту» сторінка входу вже мала її в полі.
 *
 * Прохід «очима вчителя 60 років» (2026-10-19): після посилання в листі людину знову просили ввести пошту й пароль,
 * а пароль, набраний дві хвилини тому, вона може вже не пам'ятати; власник 2026-10-20: «роби».
 * Лише на цьому пристрої (localStorage) і лише 7 днів; після входу — стирається. Пароля тут немає й не буде:
 * безпека входу та сама, просто не треба вдруге набирати адресу.
 */
const KEY = 'm4sh.auth.pendingEmail'
const TTL_MS = 7 * 24 * 60 * 60 * 1000

export function rememberPendingEmail(email: string, now: number = Date.now()): void {
  const value = (email || '').trim()
  if (!value) return
  try {
    localStorage.setItem(KEY, JSON.stringify({ email: value, at: now }))
  } catch (e) {
    console.warn('[auth] pendingEmail: localStorage недоступний', e)
  }
}

export function readPendingEmail(now: number = Date.now()): string {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { email?: unknown; at?: unknown }
    if (typeof parsed.email !== 'string' || typeof parsed.at !== 'number' || now - parsed.at > TTL_MS) return ''
    return parsed.email
  } catch (e) {
    console.warn('[auth] pendingEmail: не прочитали', e)
    return ''
  }
}

export function clearPendingEmail(): void {
  try {
    localStorage.removeItem(KEY)
  } catch (e) {
    console.warn('[auth] pendingEmail: localStorage недоступний', e)
  }
}
