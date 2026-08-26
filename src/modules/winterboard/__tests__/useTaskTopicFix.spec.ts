/**
 * useTaskTopicFix — виправлення теми задачі на картці.
 *
 * ЧОМУ ЦІ ІНВАРІАНТИ
 *
 * Це дія по СПІЛЬНОМУ банку: задача одна на всіх тьюторів. Тому:
 *
 *   INV-FIX-1  учень контролу не бачить. Бекенд теж віддає 403 — і це не
 *              дубль: сховати кнопку це зручність, 403 це межа. Прибрати
 *              один із шарів «бо є другий» — типова помилка.
 *   INV-FIX-2  список тем вантажиться ЛІНИВО, за кліком. Картка на дошці
 *              буває у двадцяти примірниках, і кожна не мусить смикати
 *              мережу під час уроку.
 *   INV-FIX-3  помилка мережі ВИДНА. Мовчазне ковтання тут найгірше:
 *              тьютор клікнув і не знає, зберіглося чи ні.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const get = vi.fn()
const post = vi.fn()
vi.mock('@/utils/apiClient', () => ({
  default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
}))

let role = 'tutor'
let isStaff = false
vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({ userRole: role, user: { is_staff: isStaff } }),
}))

import { useTaskTopicFix } from '../composables/useTaskTopicFix'

const OPTIONS = {
  current: { id: 'areas.polygon', label: 'Площа многокутника' },
  suggestions: [{ id: 'areas.triangle', label: 'Площа трикутника' }],
  all: [{ id: 'areas.triangle', label: 'Площа трикутника' },
        { id: 'triangles', label: 'Трикутники' }],
}

describe('useTaskTopicFix', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    get.mockReset(); post.mockReset()
    get.mockResolvedValue(OPTIONS)
    post.mockResolvedValue({ data: { action: 'retag' } })
    role = 'tutor'; isStaff = false
  })

  it('INV-FIX-1: учень контролу не бачить', () => {
    role = 'student'
    expect(useTaskTopicFix(() => 'x').canFix.value).toBe(false)
  })

  it('INV-FIX-1: тьютор бачить', () => {
    expect(useTaskTopicFix(() => 'x').canFix.value).toBe(true)
  })

  it('INV-FIX-1: staff бачить — власник чистить банк зі свого акаунта', () => {
    role = 'student'; isStaff = true
    expect(useTaskTopicFix(() => 'x').canFix.value).toBe(true)
  })

  it('INV-FIX-2: до кліку мережі не чіпаємо', () => {
    useTaskTopicFix(() => 'legacy-a-1')
    expect(get).not.toHaveBeenCalled()
  })

  it('INV-FIX-2: список вантажиться за першим кліком, і лише раз', async () => {
    const fix = useTaskTopicFix(() => 'legacy-a-1')
    await fix.toggle()
    expect(get).toHaveBeenCalledTimes(1)
    expect(fix.suggestions.value).toHaveLength(1)
    await fix.toggle()          // закрили
    await fix.toggle()          // відкрили знову
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('вибір теми шле POST і закриває меню', async () => {
    const fix = useTaskTopicFix(() => 'legacy-a-1')
    await fix.toggle()
    const ok = await fix.apply('areas.triangle')
    expect(ok).toBe(true)
    expect(post).toHaveBeenCalledWith(
      '/lesson-constructor/problems/legacy-a-1/retag/',
      { topic: 'areas.triangle' })
    expect(fix.open.value).toBe(false)
    expect(fix.done.value).toBe('Площа трикутника')
  })

  it('«задача погана» шле reject, а не тему', async () => {
    const fix = useTaskTopicFix(() => 'legacy-a-1')
    await fix.reject()
    expect(post).toHaveBeenCalledWith(
      '/lesson-constructor/problems/legacy-a-1/retag/',
      { action: 'reject' })
  })

  it('INV-FIX-3: помилка збереження видима, а не проковтнута', async () => {
    post.mockRejectedValue(new Error('500'))
    const fix = useTaskTopicFix(() => 'legacy-a-1')
    const ok = await fix.apply('areas.triangle')
    expect(ok).toBe(false)
    expect(fix.error.value).not.toBe('')
    expect(fix.saving.value).toBe(false)
  })

  it('external_id екранується — у нього трапляється двокрапка', async () => {
    const fix = useTaskTopicFix(() => 'legacy-a/b 1')
    await fix.reject()
    expect(post.mock.calls[0][0]).toBe(
      '/lesson-constructor/problems/legacy-a%2Fb%201/retag/')
  })
})
