/**
 * Коректор розпізнаного — хто бачить «Що прочитав Інтегралик» (ТЗ TZ_IMAGE_READING_CORRECTOR_2026-10-08 §0 К1).
 *
 * Одне правило на кнопку в тулбарі виділення й на сам блок — щоб вони не розійшлись.
 *   • той самий гейт, що в палітри Інтегралика (`integralykAccess.js`): роль tutor/staff,
 *     дозволений маршрут, персональний вимикач. Учень і глядач Інтегралика не мають;
 *   • власник дошки. З ролей К1 (owner/host) фронт знає лише власника, а запит від
 *     не-учасника дав би 403 — і `apiClient` показав би глобальний тост на кожне виділення.
 * Сервер перевіряє право сам (К1); це лише «не показувати того, що однаково заборонено».
 */
import { canUseIntegralyk, isIntegralykOn } from './integralykAccess'

export function canSeeImageReading({ user, route, settings, boardOwnerId }) {
  if (!user || boardOwnerId == null) return false
  if (String(boardOwnerId) !== String(user.id)) return false
  return canUseIntegralyk(user, route ?? {}) && isIntegralykOn(settings)
}
