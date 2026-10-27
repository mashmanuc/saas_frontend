// LAW §9 v1.63 + v1.65, маніфест пульта П8 (2026-10-26): запуск уроку з пульта.
// Комп'ютер: вкладка каже «мене щойно торкались» (remote.here), а за remote.launch робить
// «Провести» уроку з «Моїх уроків» (свіжа копія; шаблон Студії не відкривається); сторінка
// пульта й телефон не шлють. Пульт: «де відкриється», «Мої уроки», дотик → чекання дошки →
// підключення; кожна відмова — словами.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

// ── загальний канал ──────────────────────────────────────────────────────
type Handler = (data: any) => void
const handlers = new Map<string, Set<Handler>>()
let wsState = 'open'
const sent: any[] = []
vi.mock('@/services/realtime', () => ({
  realtimeService: {
    getState: () => wsState,
    send: (m: any) => { sent.push(m) },
    on: (event: string, h: Handler) => {
      const set = handlers.get(event) ?? new Set<Handler>()
      set.add(h)
      handlers.set(event, set)
      return () => set.delete(h)
    },
  },
}))
const fire = (event: string, data: any) => handlers.get(event)?.forEach((h) => h(data))

const getRemoteLaunch = vi.fn()
const remoteLaunch = vi.fn()
const getActiveRemoteSession = vi.fn()
vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    getRemoteLaunch: (...a: any[]) => getRemoteLaunch(...a),
    remoteLaunch: (...a: any[]) => remoteLaunch(...a),
    getActiveRemoteSession: (...a: any[]) => getActiveRemoteSession(...a),
  },
}))

const loadToSession = vi.fn()
const listConductStudents = vi.fn()
vi.mock('@/modules/knowledge/api/lessonViewApi', () => ({
  lessonViewApi: {
    loadToSession: (...a: any[]) => loadToSession(...a),
    listConductStudents: (...a: any[]) => listConductStudents(...a),
  },
}))
const notifyError = vi.fn()
vi.mock('@/utils/notify', () => ({ notifyError: (...a: any[]) => notifyError(...a) }))
vi.mock('@/i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))

import { installRemoteLaunchScreen, pageKeyFor, HERE_THROTTLE_MS } from '../remote/remoteLaunchScreen'
import RemoteLaunchList from '../components/remote/RemoteLaunchList.vue'

const BOARD = '817d5b00-8230-4b60-bab9-da6c5367a1ca'
const OTHER = '0ad194de-e783-4199-b171-0e5c73a668e0'
const LESSON = '5b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d'
const COPY = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

function fakeRouter(path: string, name = 'MyLessons', params: Record<string, string> = {}) {
  const currentRoute = ref<any>({ path, name, params })
  const after = new Set<() => void>()
  const push = vi.fn(async (to: any) => {
    currentRoute.value = { path: `/winterboard/${to.params.id}`, name: to.name, params: to.params }
    after.forEach((f) => f())
  })
  return {
    currentRoute,
    push,
    afterEach: (f: () => void) => { after.add(f); return () => after.delete(f) },
    go(p: string, n: string) { currentRoute.value = { path: p, name: n, params: {} }; after.forEach((f) => f()) },
  }
}

function setScreen(coarse: boolean, w: number, h: number) {
  window.matchMedia = ((q: string) => ({
    matches: q === '(pointer: coarse)' ? coarse : false,
    media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    onchange: null, dispatchEvent: () => false,
  })) as any
  Object.defineProperty(window, 'screen', { configurable: true, value: { width: w, height: h } })
}

describe('П8 · комп\'ютер: «мене торкались» і відкриття уроку', () => {
  let uninstall: () => void = () => {}
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    handlers.clear(); sent.length = 0; wsState = 'open'
    setScreen(false, 1920, 1080)
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  })
  afterEach(() => { uninstall(); vi.useRealTimers(); vi.restoreAllMocks() })

  it('назва сторінки — пункт бокового меню вчителя (найдовший збіг)', () => {
    expect(pageKeyFor('/tutor/schedule')).toBe('sidebar.item.schedule')
    expect(pageKeyFor('/tutor')).toBe('sidebar.item.dashboard')
    expect(pageKeyFor('/tutor/students/42')).toBe('sidebar.item.myStudents')
    expect(pageKeyFor('/knowledge/my-lessons')).toBe('sidebar.item.myLessons')
    expect(pageKeyFor('/winterboard/boards')).toBe('sidebar.item.myBoards')
    expect(pageKeyFor(`/winterboard/${BOARD}`)).toBeNull()
    expect(pageKeyFor('/tutorial')).toBeNull()
  })

  it('після підключення каже, де вона і скільки мс тому її торкались', () => {
    const router = fakeRouter('/tutor/schedule', 'TutorSchedule')
    uninstall = installRemoteLaunchScreen(router as any)
    vi.advanceTimersByTime(4_000)
    fire('protocol', { type: 'connection.established' })
    expect(sent).toEqual([{ type: 'remote.here', page: 'sidebar.item.schedule', ago: 4_000 }])
  })

  it('дотики — не частіше ніж раз на 3 с, але останній не губиться', () => {
    const router = fakeRouter('/knowledge/my-lessons')
    uninstall = installRemoteLaunchScreen(router as any)
    window.dispatchEvent(new Event('pointerdown'))
    expect(sent).toHaveLength(1)
    vi.advanceTimersByTime(1_000)
    window.dispatchEvent(new Event('keydown'))
    vi.advanceTimersByTime(1_000)
    window.dispatchEvent(new Event('pointerdown'))
    expect(sent).toHaveLength(1)
    vi.advanceTimersByTime(HERE_THROTTLE_MS - 2_000)
    expect(sent).toHaveLength(2)
    // надіслано вже після останнього дотику: ago — від нього, не від першого
    expect(sent[1].ago).toBe(HERE_THROTTLE_MS - 2_000)
  })

  it('перехід сторінкою одразу оновлює назву', () => {
    const router = fakeRouter('/knowledge/my-lessons')
    uninstall = installRemoteLaunchScreen(router as any)
    router.go('/tutor/schedule', 'TutorSchedule')
    expect(sent[sent.length - 1]).toEqual({ type: 'remote.here', page: 'sidebar.item.schedule', ago: 0 })
  })

  it('сторінка пульта й телефон не шлють; без зв\'язку — теж ні', () => {
    const pult = fakeRouter('/remote', 'winterboard-remote')
    uninstall = installRemoteLaunchScreen(pult as any)
    window.dispatchEvent(new Event('pointerdown'))
    fire('protocol', { type: 'connection.established' })
    expect(sent).toEqual([])
    uninstall()

    setScreen(true, 390, 844)                          // телефон на іншій сторінці сайту
    uninstall = installRemoteLaunchScreen(fakeRouter('/tutor/schedule') as any)
    window.dispatchEvent(new Event('pointerdown'))
    expect(sent).toEqual([])
    uninstall()

    setScreen(true, 1920, 1080)                        // велика сенсорна панель класу — екран
    wsState = 'connecting'
    uninstall = installRemoteLaunchScreen(fakeRouter('/tutor/schedule') as any)
    window.dispatchEvent(new Event('pointerdown'))
    expect(sent).toEqual([])
    wsState = 'open'
    fire('protocol', { type: 'connection.established' })
    expect(sent).toHaveLength(1)
  })

  it('remote.launch = «Провести»: свіжа копія уроку відкривається; дошку за id (шаблон) — ні', async () => {
    loadToSession.mockReset().mockResolvedValue({ session_id: COPY, board_id: COPY, name: 'Свято' })
    const router = fakeRouter('/tutor/schedule', 'TutorSchedule')
    uninstall = installRemoteLaunchScreen(router as any)
    fire('message', { type: 'remote.launch', lesson_id: 'не-id' })
    fire('message', { type: 'other', lesson_id: LESSON })
    fire('message', { type: 'remote.launch', session_id: BOARD })     // v1.63: шаблон за id — більше ні
    await vi.waitFor(() => expect(loadToSession).not.toHaveBeenCalled())
    expect(router.push).not.toHaveBeenCalled()
    fire('message', { type: 'remote.launch', lesson_id: LESSON })
    fire('message', { type: 'remote.launch', lesson_id: LESSON })     // друге, поки перше в роботі — ні
    await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith({ name: 'winterboard-solo', params: { id: COPY } }))
    expect(loadToSession).toHaveBeenCalledTimes(1)
    expect(loadToSession).toHaveBeenCalledWith(LESSON, null)
  })

  it('v1.68: учень з пульта — у той самий «Провести»; зіпсований id — «Без учня»', async () => {
    loadToSession.mockReset().mockResolvedValue({ session_id: COPY, board_id: COPY, name: 'Свято' })
    const router = fakeRouter('/tutor/schedule', 'TutorSchedule')
    uninstall = installRemoteLaunchScreen(router as any)
    fire('message', { type: 'remote.launch', lesson_id: LESSON, student_id: 7 })
    await vi.waitFor(() => expect(router.push).toHaveBeenCalledTimes(1))
    expect(loadToSession).toHaveBeenLastCalledWith(LESSON, 7)
    for (const bad of ['7', -1, 1.5, null]) {
      fire('message', { type: 'remote.launch', lesson_id: LESSON, student_id: bad })
      await vi.waitFor(() => expect(loadToSession).toHaveBeenLastCalledWith(LESSON, null))
      loadToSession.mockClear()
      await flushPromises()
    }
  })

  it('«Провести» не вийшло — на комп\'ютері та сама помилка, що в «Моїх уроках»', async () => {
    loadToSession.mockReset().mockRejectedValue(new Error('500'))
    notifyError.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = fakeRouter('/tutor/schedule', 'TutorSchedule')
    uninstall = installRemoteLaunchScreen(router as any)
    fire('message', { type: 'remote.launch', lesson_id: LESSON })
    await vi.waitFor(() => expect(notifyError).toHaveBeenCalledWith('knowledge.lesson.prepare.error'))
    expect(router.push).not.toHaveBeenCalled()
  })
})

describe('П8 · пульт: список уроків і запуск', () => {
  const i18n = () => createI18n({ legacy: false, locale: 'uk', messages: { uk } })
  const lessons = [
    { id: BOARD, name: 'Свято Шевченка', updated_at: '2026-10-25T10:00:00Z' },
    { id: OTHER, name: '', updated_at: null },
  ]
  const mountList = () => mount(RemoteLaunchList, { global: { plugins: [i18n()] } })
  // v1.68: дотик на уроці → «З ким урок?» → вибір
  async function tap(w: ReturnType<typeof mountList>, lessonId: string, who = 'conduct-student-none') {
    await w.get(`[data-testid=remote-launch-${lessonId}]`).trigger('click')
    await flushPromises()
    await w.get(`[data-testid=${who}]`).trigger('click')
  }
  const notFound = () => Object.assign(new Error('404'), { response: { status: 404, data: { error: 'no_active_board' } } })

  beforeEach(() => {
    vi.useFakeTimers()
    getRemoteLaunch.mockReset(); remoteLaunch.mockReset(); getActiveRemoteSession.mockReset()
    listConductStudents.mockReset().mockResolvedValue({ students: [{ id: 7, name: 'Толік' }] })
  })
  afterEach(() => { vi.useRealTimers() })

  it('показує, де відкриється, і уроки; без назви — «Без назви»', async () => {
    getRemoteLaunch.mockResolvedValue({ screen: { page: 'sidebar.item.schedule' }, lessons })
    const w = mountList()
    await flushPromises()
    expect(w.get('[data-testid=remote-launch-where]').text()).toBe('Урок відкриється на комп\'ютері, де зараз «Розклад».')
    expect(w.get(`[data-testid=remote-launch-${BOARD}]`).text()).toContain('Свято Шевченка')
    expect(w.get(`[data-testid=remote-launch-${OTHER}]`).text()).toContain('Без назви')
  })

  it('сторінка невідома / комп\'ютера немає — каже словами', async () => {
    getRemoteLaunch.mockResolvedValue({ screen: { page: null }, lessons })
    let w = mountList()
    await flushPromises()
    expect(w.get('[data-testid=remote-launch-where]').text()).toContain('де ви востаннє працювали на сайті')
    getRemoteLaunch.mockResolvedValue({ screen: null, lessons })
    w = mountList()
    await flushPromises()
    expect(w.get('[data-testid=remote-launch-where]').text()).toContain('Відкрийте M4SH на комп\'ютері в класі')
  })

  it('дотик → «Відкриваю…» → дошка відкрилась → підключаємось', async () => {
    getRemoteLaunch.mockResolvedValue({ screen: { page: 'sidebar.item.myLessons' }, lessons })
    remoteLaunch.mockResolvedValue({ page: 'sidebar.item.myLessons' })
    // id свіжої копії пульт не знає — чекає будь-яку відкриту дошку
    getActiveRemoteSession.mockRejectedValueOnce(notFound()).mockResolvedValue({ session_id: COPY, name: 'Свято', ts: 1 })
    const w = mountList()
    await flushPromises()
    await tap(w, BOARD)
    await flushPromises()
    expect(remoteLaunch).toHaveBeenCalledWith(BOARD, null)
    expect(w.get('[data-testid=remote-launch-who]').text()).toContain('Відкриваю на комп\'ютері…')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(w.emitted('opened')).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(w.emitted('opened')).toHaveLength(1)
  })

  it('комп\'ютер не відкрив за 20 с — пояснення, повторів немає', async () => {
    getRemoteLaunch.mockResolvedValue({ screen: { page: null }, lessons })
    remoteLaunch.mockResolvedValue({ page: null })
    getActiveRemoteSession.mockRejectedValue(notFound())
    const w = mountList()
    await flushPromises()
    await tap(w, BOARD)
    await vi.advanceTimersByTimeAsync(19_000)
    expect(w.find('[data-testid=remote-launch-note]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(1_000)
    await flushPromises()
    expect(getActiveRemoteSession).toHaveBeenCalledTimes(20)
    expect(remoteLaunch).toHaveBeenCalledTimes(1)
    expect(w.get('[data-testid=remote-launch-note]').text()).toContain('Клацніть на ньому мишкою')
    expect(w.emitted('opened')).toBeUndefined()
  })

  it('відмови сервера: немає комп\'ютера — словами; дошка вже відкрита — підключаємось', async () => {
    getRemoteLaunch.mockResolvedValue({ screen: { page: 'sidebar.item.schedule' }, lessons })
    remoteLaunch.mockRejectedValueOnce({ response: { status: 409, data: { error: 'no_screen' } } })
    const w = mountList()
    await flushPromises()
    await tap(w, BOARD)
    await flushPromises()
    expect(w.get('[data-testid=remote-launch-note]').text()).toContain('Відкрийте M4SH на комп\'ютері в класі')
    expect(w.get('[data-testid=remote-launch-where]').text()).toContain('Відкрийте M4SH')

    remoteLaunch.mockRejectedValueOnce({ response: { status: 409, data: { error: 'board_open' } } })
    // вибір лишився відкритим — учитель тапає ще раз
    await w.get('[data-testid=conduct-student-none]').trigger('click')
    await flushPromises()
    expect(w.emitted('opened')).toHaveLength(1)
  })

  it('v1.68: «З ким урок?» на пульті — учень іде з проханням; не свій — словами й свіжий список; «Інший урок»', async () => {
    getRemoteLaunch.mockResolvedValue({ screen: { page: 'sidebar.item.myLessons' }, lessons })
    remoteLaunch.mockRejectedValueOnce({ response: { status: 400, data: { error: 'student_not_yours' } } })
    const w = mountList()
    await flushPromises()
    await w.get(`[data-testid=remote-launch-${BOARD}]`).trigger('click')
    await flushPromises()
    expect(remoteLaunch).not.toHaveBeenCalled()                  // сам дотик на уроці ще нічого не просить
    expect(w.get('[data-testid=remote-launch-who]').text()).toContain('Свято Шевченка')
    await w.get('[data-testid=conduct-student-item]').trigger('click')
    await flushPromises()
    expect(remoteLaunch).toHaveBeenCalledWith(BOARD, 7)
    expect(w.get('[data-testid=remote-launch-note]').text()).toContain('Цього учня вже немає серед ваших')
    expect(listConductStudents).toHaveBeenCalledTimes(2)
    await w.get('[data-testid=remote-launch-back]').trigger('click')
    expect(w.find('[data-testid=remote-launch-who]').exists()).toBe(false)
    expect(w.find(`[data-testid=remote-launch-${OTHER}]`).exists()).toBe(true)
  })
})
