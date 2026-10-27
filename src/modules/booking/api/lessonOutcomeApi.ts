/**
 * Підсумок уроку (власник 2026-10-27, «роби»): «Відбувся / Не відбувся» — у розкладі й одразу після уроку.
 * Правила П1–П8 — backend apps/booking/BOOKING_DOMAIN_SSOT.md, розділ «Підсумок уроку».
 */
import api from '@/utils/apiClient'

export type LessonOutcome = 'held' | 'not_held'

export interface OutcomeEvent {
  id: number
  start: string
  end: string
  studentId: number | null
  studentName: string
  outcome: LessonOutcome | null
}

// apiClient віддає тіло відповіді: { status, data: { event } }
type Body = { data?: { event?: OutcomeEvent | null } }

export const lessonOutcomeApi = {
  async setOutcome(eventId: number, outcome: LessonOutcome): Promise<OutcomeEvent> {
    const body = (await api.post(`/v1/calendar/event/${eventId}/outcome/`, { outcome })) as unknown as Body
    const event = body?.data?.event
    if (!event) throw new Error('lesson_outcome_empty_response')
    return event
  },

  /** Урок розкладу, що відповідає уроку в класі (П7); немає пари — null. */
  async eventForSession(sessionId: string): Promise<OutcomeEvent | null> {
    const body = (await api.get('/v1/calendar/lesson-outcome/', { params: { session: sessionId } })) as unknown as Body
    return body?.data?.event ?? null
  },
}
