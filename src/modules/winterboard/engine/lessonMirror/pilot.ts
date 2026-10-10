/**
 * Пілот «Дзеркала уроку» — лише контрольні акаунти власника (ТЗ §2): 40 і 220 (урок 09.10 вів 220).
 * Одне місце для плеєра запису й списку «Мої записи», щоб гейти не розійшлись.
 */
export const MIRROR_CLIP_PILOT_USER_IDS: ReadonlySet<number> = new Set([40, 220])

export function isMirrorClipPilotUser(userId: unknown): boolean {
  return MIRROR_CLIP_PILOT_USER_IDS.has(Number(userId))
}
