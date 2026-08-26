/**
 * Виправлення теми задачі просто на картці — «перегляд у потоці роботи».
 *
 * Рішення власника 2026-08-26. Ручна перевірка 40 випадкових задач банку
 * дала 11 із хибною темою, і детектора для цього не існує: машина не бачить,
 * що «Знайдіть суму кутів восьмикутника» лежить у «Площі многокутника»
 * помилково. Бачить лише людина — і лише тоді, коли читає задачу. Тож
 * виправлення живе там, де задачу вже читають.
 *
 * ⚠️ ЦЕ ДІЯ ПО СПІЛЬНОМУ БАНКУ, не по своїй копії задачі. Звідси:
 *   • контрол показуємо ЛИШЕ тьютору (`canFix`) — учень не має міняти дані,
 *     якими користуються всі; бекенд теж віддає 403, і це не дубль, а два
 *     незалежні шари: сховати кнопку — зручність, 403 — межа;
 *   • список тем вантажимо ЛІНИВО, за кліком: картка на дошці може бути в
 *     двадцяти примірниках, і кожна не мусить смикати мережу;
 *   • після успіху не перезавантажуємо дошку — міняється лише банк, а
 *     картка вже показує правильний текст задачі.
 */
import { computed, ref } from 'vue'
import apiClient from '@/utils/apiClient'
import { useAuthStore } from '@/modules/auth/store/authStore'

export interface TopicOption {
  id: string
  label: string
}

interface TopicOptionsResponse {
  current: TopicOption | null
  suggestions: TopicOption[]
  all: TopicOption[]
}

export function useTaskTopicFix(externalId: () => string) {
  const auth = useAuthStore()

  /** Лише тьютор. `staff` теж — щоб власник міг чистити банк зі свого акаунта. */
  const canFix = computed(() => {
    const role = String(auth.userRole ?? '').toLowerCase()
    return role === 'tutor' || Boolean(auth.user?.is_staff)
  })

  const open = ref(false)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const current = ref<TopicOption | null>(null)
  const suggestions = ref<TopicOption[]>([])
  const allTopics = ref<TopicOption[]>([])
  const showAll = ref(false)
  /** Локальна мітка: задачу вже виправлено в цій сесії. */
  const done = ref('')

  const base = () =>
    `/lesson-constructor/problems/${encodeURIComponent(externalId())}`

  async function load(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      // apiClient віддає ТІЛО відповіді, не `.data` (reference_apiclient_response_unwrap)
      const body = (await apiClient.get(`${base()}/topic-options/`)) as TopicOptionsResponse
      current.value = body.current ?? null
      suggestions.value = body.suggestions ?? []
      allTopics.value = body.all ?? []
    } catch (e: unknown) {
      // Мовчазне ковтання тут було б найгіршим: тьютор клікнув і не знає,
      // чи щось сталося. Кажемо прямо.
      error.value = 'Не вдалося отримати список тем'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function toggle(): Promise<void> {
    open.value = !open.value
    showAll.value = false
    if (open.value && !suggestions.value.length && !allTopics.value.length) {
      await load().catch(() => {})
    }
  }

  async function apply(topicId: string): Promise<boolean> {
    saving.value = true
    error.value = ''
    try {
      await apiClient.post(`${base()}/retag/`, { topic: topicId })
      const picked = [...suggestions.value, ...allTopics.value]
        .find((t) => t.id === topicId)
      done.value = picked?.label ?? topicId
      current.value = picked ?? current.value
      open.value = false
      return true
    } catch {
      error.value = 'Не вдалося зберегти тему'
      return false
    } finally {
      saving.value = false
    }
  }

  async function reject(): Promise<boolean> {
    saving.value = true
    error.value = ''
    try {
      await apiClient.post(`${base()}/retag/`, { action: 'reject' })
      done.value = 'задачу прибрано з добірок'
      open.value = false
      return true
    } catch {
      error.value = 'Не вдалося прибрати задачу'
      return false
    } finally {
      saving.value = false
    }
  }

  return {
    canFix, open, loading, saving, error,
    current, suggestions, allTopics, showAll, done,
    toggle, apply, reject, load,
  }
}
