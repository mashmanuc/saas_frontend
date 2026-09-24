/**
 * Чи показувати картки «Навчальних обʼєктів» (шкала часу, карта подій).
 *
 * Домовленість власника: шар ще не прийнято, його бачить лише його акаунт
 * (rollout-гейт коридорів, на проді `{40}`). 2026-09-24 гейта не було зовсім:
 * і плитку в інструментах, і самі картки бачили всі.
 *
 * Ховаємо рівно там, де «чужий учитель у своїй дошці»:
 *   • учень на уроці бачить усе, що показує вчитель — інакше урок власника
 *     розвалився б посеред заняття;
 *   • Replay показує запис як він був — інакше з готового запису зникав би шматок.
 * Тобто гейт стосується РЕДАГУВАННЯ чужим учителем, а не перегляду.
 */
export const EVIDENCE_CARD_TYPES: ReadonlySet<string> = new Set(['timeline_card', 'map_card'])

export interface EvidenceVisibility {
  /** Відповідь сервера: акаунт у rollout-гейті коридорів. */
  evidenceEnabled: boolean
  /** Клієнт учителя (не учень). */
  isTutor: boolean
  /** `wbStore.mode`: 'edit' | 'replay' | … */
  mode: string
}

export function hideEvidenceCards(v: EvidenceVisibility): boolean {
  return !v.evidenceEnabled && v.isTutor && v.mode === 'edit'
}

/** Прибрати картки шару з того, що піде на полотно (і в Konva-проксі теж). */
export function filterEvidenceCards<T extends { type: string }>(
  assets: readonly T[],
  v: EvidenceVisibility,
): T[] {
  if (!hideEvidenceCards(v)) return assets as T[]
  return assets.filter((a) => !EVIDENCE_CARD_TYPES.has(a.type))
}
