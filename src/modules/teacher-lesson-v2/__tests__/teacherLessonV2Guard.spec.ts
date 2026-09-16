/**
 * TLV2-01/02 · оболонка Teacher Lesson V2: доступ вирішує лише бекенд (паспорт TLV2-00 §7, K8–K10).
 *
 * 200 → оболонка; 404 → назад на студію V1, оболонки немає; інша помилка → видимий alert без
 * повтору. Модуль не має FE-прапорця, шляху запису в дошку, WebSocket і порожніх catch.
 *
 * TLV2-02: «Підготувати урок на дошці» — один POST до API V2 і перехід на чинну дошку за id
 * сесії; помилка — видимий alert без автоматичного повтору; подвійне натискання — один запит.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import uk from '../../../i18n/locales/uk.json'
import TeacherLessonV2Home from '../views/TeacherLessonV2Home.vue'
import {
  BOARD_ROUTE,
  PILOT_LESSON_KEY,
  TEACHER_LESSON_V2_HOME,
  TEACHER_LESSON_V2_PATH,
  V1_FALLBACK_ROUTE,
} from '../routes'
import { fetchTeacherLessonV2Access, prepareTeacherLesson } from '../api/teacherLessonV2Api'

vi.mock('../api/teacherLessonV2Api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/teacherLessonV2Api')>()
  return { ...actual, fetchTeacherLessonV2Access: vi.fn(), prepareTeacherLesson: vi.fn() }
})

const MODULE_DIR = resolve(__dirname, '..')
const fetchAccess = vi.mocked(fetchTeacherLessonV2Access)
const prepareLesson = vi.mocked(prepareTeacherLesson)

function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status } })
}

async function mountShell() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: TEACHER_LESSON_V2_PATH, name: TEACHER_LESSON_V2_HOME, component: TeacherLessonV2Home },
      { path: '/winterboard/boards', name: V1_FALLBACK_ROUTE, component: { template: '<div data-testid="v1-studio" />' } },
      { path: '/winterboard/:id', name: BOARD_ROUTE, component: { template: '<div data-testid="v1-board" />' } },
    ],
  })
  await router.push(TEACHER_LESSON_V2_PATH)
  const wrapper = mount(TeacherLessonV2Home, {
    global: { plugins: [router, createI18n({ legacy: false, locale: 'uk', messages: { uk } as never })] },
  })
  await flushPromises()
  return { wrapper, router }
}

afterEach(() => {
  vi.restoreAllMocks()
  fetchAccess.mockReset()
  prepareLesson.mockReset()
})

describe('K8 · доступ вирішує бекенд', () => {
  it('200 → оболонка, один запит', async () => {
    fetchAccess.mockResolvedValue({ enabled: true })
    const { wrapper, router } = await mountShell()
    expect(wrapper.find('[data-testid="tlv2-shell"]').exists()).toBe(true)
    expect(router.currentRoute.value.name).toBe(TEACHER_LESSON_V2_HOME)
    expect(fetchAccess).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('404 → повернення на студію V1, оболонку не показано', async () => {
    fetchAccess.mockRejectedValue(httpError(404))
    const { wrapper, router } = await mountShell()
    expect(router.currentRoute.value.name).toBe(V1_FALLBACK_ROUTE)
    expect(wrapper.find('[data-testid="tlv2-shell"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tlv2-error"]').exists()).toBe(false)
    expect(fetchAccess).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('інша помилка → видимий alert, без повтору й без переходу', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    fetchAccess.mockRejectedValue(httpError(500))
    const { wrapper, router } = await mountShell()
    const alert = wrapper.get('[data-testid="tlv2-error"]')
    expect(alert.attributes('role')).toBe('alert')
    expect(wrapper.find('[data-testid="tlv2-shell"]').exists()).toBe(false)
    expect(router.currentRoute.value.name).toBe(TEACHER_LESSON_V2_HOME)
    expect(fetchAccess).toHaveBeenCalledTimes(1)
    expect(logged).toHaveBeenCalled()
    wrapper.unmount()
  })
})

describe('TLV2-02 · підготовка уроку на дошці', () => {
  const lesson = { session_id: 'sess-1', lesson_key: PILOT_LESSON_KEY, pages: [] }

  it('кнопка → один POST пілотного уроку → чинна дошка за id сесії', async () => {
    fetchAccess.mockResolvedValue({ enabled: true })
    prepareLesson.mockResolvedValue(lesson)
    const { wrapper, router } = await mountShell()

    await wrapper.get('[data-testid="tlv2-prepare"]').trigger('click')
    await flushPromises()

    expect(prepareLesson).toHaveBeenCalledTimes(1)
    expect(prepareLesson).toHaveBeenCalledWith('triangles.correspondence')
    expect(router.currentRoute.value.name).toBe(BOARD_ROUTE)
    expect(router.currentRoute.value.params.id).toBe('sess-1')
    wrapper.unmount()
  })

  it('подвійне натискання, поки запит іде, — один POST; кнопка неактивна', async () => {
    fetchAccess.mockResolvedValue({ enabled: true })
    let release!: (v: typeof lesson) => void
    prepareLesson.mockImplementation(() => new Promise((res) => { release = res }))
    const { wrapper } = await mountShell()

    const button = wrapper.get('[data-testid="tlv2-prepare"]')
    await button.trigger('click')
    await button.trigger('click')
    expect(prepareLesson).toHaveBeenCalledTimes(1)
    expect((button.element as HTMLButtonElement).disabled).toBe(true)

    release(lesson)
    await flushPromises()
    wrapper.unmount()
  })

  it('помилка → видимий alert, без переходу й без автоматичного повтору; кнопка знову доступна', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    fetchAccess.mockResolvedValue({ enabled: true })
    prepareLesson.mockRejectedValue(httpError(500))
    const { wrapper, router } = await mountShell()

    await wrapper.get('[data-testid="tlv2-prepare"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="tlv2-prepare-error"]').attributes('role')).toBe('alert')
    expect(router.currentRoute.value.name).toBe(TEACHER_LESSON_V2_HOME)
    expect(prepareLesson).toHaveBeenCalledTimes(1)
    expect((wrapper.get('[data-testid="tlv2-prepare"]').element as HTMLButtonElement).disabled).toBe(false)
    expect(logged).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('404 під час підготовки (прибрали з allowlist) → назад на студію V1', async () => {
    fetchAccess.mockResolvedValue({ enabled: true })
    prepareLesson.mockRejectedValue(httpError(404))
    const { wrapper, router } = await mountShell()

    await wrapper.get('[data-testid="tlv2-prepare"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe(V1_FALLBACK_ROUTE)
    wrapper.unmount()
  })
})

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path)
    return /\.(ts|vue|js)$/.test(name) ? [path] : []
  })
}

const stripComments = (code: string) =>
  code.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** Що не може з'явитися в модулі оболонки TLV2-01. */
const FORBIDDEN: Record<string, RegExp> = {
  'FE-прапорець': /import\.meta\.env|VITE_/,
  'запис у дошку': /opsSync|recordOperationsBatch|replayRecorder|boardStore|addAsset|WBBoardOperation/,
  'WebSocket / presence': /WebSocket|usePresence|realtime/,
  'імпорт V1-модулів': /@\/modules\/(winterboard|lesson_constructor|intent)|modules\/winterboard\//,
  'порожній catch': /catch\s*(\([^)]*\))?\s*\{\s*\}/,
  'повтор запиту': /\bretry\b|setTimeout|setInterval/i,
}

describe('K9 · K10 · модуль ізольований', () => {
  it('у модулі немає FE-прапорця, запису, WS, імпорту V1, порожніх catch і повторів', () => {
    const files = sources(MODULE_DIR)
    expect(files.map((f) => f.replace(MODULE_DIR, '').replace(/\\/g, '/')).sort()).toEqual([
      '/api/teacherLessonV2Api.ts',
      '/routes.ts',
      '/views/TeacherLessonV2Home.vue',
    ])
    for (const file of files) {
      const code = stripComments(readFileSync(file, 'utf-8'))
      for (const [label, pattern] of Object.entries(FORBIDDEN)) {
        expect(pattern.test(code), `${file}: ${label}`).toBe(false)
      }
    }
  })

  it('TLV2-02: модуль звертається лише до API V2', () => {
    const calls = sources(MODULE_DIR).flatMap((file) =>
      [...stripComments(readFileSync(file, 'utf-8')).matchAll(/apiClient\.(\w+)\(\s*[`'"]([^`'"]+)/g)]
        .map((m) => `${m[1]} ${m[2]}`))
    expect(calls.sort()).toEqual([
      'get /v1/teacher-lesson-v2/access/',
      'post /v1/teacher-lesson-v2/lessons/${encodeURIComponent(lessonKey)}/prepare/',
    ])
  })

  it('контроль: кожен шаблон ловить свою заборону', () => {
    const samples: Record<string, string> = {
      'FE-прапорець': "if (import.meta.env.VITE_TLV2 === 'true') {}",
      'запис у дошку': 'store.addAsset(asset, pageId)',
      'WebSocket / presence': 'new WebSocket(url)',
      'імпорт V1-модулів': "import { winterboardApi } from '@/modules/winterboard/api/winterboardApi'",
      'порожній catch': 'try { go() } catch (e) {}',
      'повтор запиту': 'setTimeout(check, 30000)',
    }
    for (const [label, sample] of Object.entries(samples)) expect(FORBIDDEN[label].test(sample), label).toBe(true)
  })
})
