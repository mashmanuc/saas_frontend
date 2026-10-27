/**
 * Вікно «Урок завершено → Як пройшов урок?» одразу після «Завершити урок» (власник 2026-10-27; П7).
 * Клас (WBClassroomRoom) лише подає сигнал з id дошки уроку й іде на головну; вікно живе в App.vue, тож
 * переживає перехід. Урок розкладу шукає сервер (той самий учитель і учень, час перетинається); немає — вікна немає.
 */
import { ref } from 'vue'

const pendingSessionId = ref<string | null>(null)

export function requestAfterLessonOutcome(sessionId: string | null | undefined): void {
  if (sessionId) pendingSessionId.value = String(sessionId)
}

export function useAfterLessonOutcome() {
  return {
    pendingSessionId,
    clear: () => { pendingSessionId.value = null },
  }
}
