/**
 * Чи доступні вчителю «Програми». Сервер — єдине джерело: поза пілотом усі адреси модуля відповідають 404,
 * тож пункт меню й кнопка на дошці з'являються лише після успішної відповіді (не прапорцем збірки й не localStorage).
 * Одна перевірка на вхід користувача; зміна користувача — нова перевірка.
 */
import { ref } from 'vue'
import { learningProgramsApi, errorStatus } from '../api/learningProgramsApi'

const available = ref<boolean | null>(null)
let checkedFor: number | null = null
let inflight: Promise<boolean> | null = null

export function useProgramsAvailability() {
  async function ensure(userId: number | null | undefined, role: string | null | undefined): Promise<boolean> {
    if (!userId || role !== 'tutor') {
      available.value = false
      checkedFor = null
      return false
    }
    if (checkedFor === userId && available.value !== null) return available.value
    if (inflight && checkedFor === userId) return inflight
    checkedFor = userId
    inflight = learningProgramsApi.list({ status: 'active' })
      .then(() => true)
      .catch((e) => {
        // 404 — модуль вимкнений для цього вчителя; інші збої теж не відкривають вхід до неготового модуля
        if (errorStatus(e) !== 404) console.warn('[learning-programs] availability check failed', e)
        return false
      })
      .then((ok) => {
        available.value = ok
        inflight = null
        return ok
      })
    return inflight
  }
  return { available, ensure }
}
