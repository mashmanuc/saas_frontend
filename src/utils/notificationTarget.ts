/**
 * Куди веде сповіщення зі сторінки «Сповіщення». `null` — нікуди (просто інформація).
 *
 * `/tutor/inquiries` навмисно НЕ використовується: маршрут — редірект на
 * Головну від часу вимкнення маркетплейсу (2026-06-17), а пункт меню прибрано
 * 2026-09-22. Запрошені учні живуть у «Мої учні».
 *
 * 2026-10-17: урок у розкладі учня (`data.url`, «Новий урок», «Урок перенесено»…) і живий урок
 * (`data.room_url`, «Урок розпочався») — раніше з цієї сторінки нікуди не вели.
 */
/** Лише адреса всередині сайту: «/шлях», не «//чужий-сайт» і не «https://…» */
function internal(value: unknown): string | null {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : null
}

export function notificationTarget(rawData: unknown, role: string | null | undefined): string | null {
  const data = (rawData || {}) as Record<string, unknown>
  const room = internal(data.room_url)
  if (room) return room
  const url = internal(data.url)
  if (url) return url
  if (data.thread_id) return `/tutor/messages/${data.thread_id}`
  if (data.inquiry_id || data.relation_id) {
    return role === 'tutor' ? '/tutor/students' : '/student/inquiries'
  }
  if (data.booking_id) return '/bookings'
  if (data.billing) return '/tutor/billing'
  return null
}
