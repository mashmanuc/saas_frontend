/**
 * «Ідеї та відгуки»: скарга тестувальника 2026-10-11 «Не можу надіслати коментар».
 * Прод (FrontendError, користувач 242): три відповіді 400 від сервера — коментар коротший за
 * 2 символи — і щоразу весь застосунок падав у «Щось пішло не так» (AppErrorBoundary ловив
 * помилку обробника CommentList), набраний текст пропадав.
 *
 * Тест тримає: (1) коротше 2 символів (як рахує сервер — емодзі = 1) не надсилається, людина бачить
 * чому; (2) будь-яка відмова сервера — повідомлення біля форми, текст лишається, помилка НЕ
 * доходить до батьківського onErrorCaptured; (3) те саме для дій сторінки теми.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, onErrorCaptured } from 'vue'
import uk from '@/i18n/locales/uk.json'
import { commentErrorKey, commentLength } from '../feedbackErrors'

const api = vi.hoisted(() => ({
  getThread: vi.fn(),
  listComments: vi.fn(),
  createComment: vi.fn(),
  deleteComment: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  toggleVote: vi.fn(),
}))
vi.mock('../api/feedbackApi', () => ({ __esModule: true, default: api }))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: '1' } }) }))
vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => ({ user: { id: 242 } }) }))

import CommentList from '../components/CommentList.vue'
import ThreadDetail from '../views/ThreadDetail.vue'

const fb = uk.feedback

function i18n() {
  return createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk }, missingWarn: false })
}

/** Батько з onErrorCaptured — як AppErrorBoundary: якщо помилка дійде сюди, застосунок «впаде». */
function withBoundary(inner: () => ReturnType<typeof h>) {
  const captured: unknown[] = []
  const Root = defineComponent({
    setup() {
      onErrorCaptured((err) => { captured.push(err); return false })
      return () => inner()
    },
  })
  return { Root, captured }
}

/** Відповідь сервера на помилку — у формі axios. */
function httpError(status: number, data: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } })
}
const TOO_SHORT = httpError(400, {
  error: { code: 'VALIDATION_ERROR', detail: 'Validation failed', fields: { content: ['Переконайтесь, що в цьому полі мінімум 2 символів.'] } },
})

const OPEN_THREAD = { id: 1, is_locked: false, is_hidden: false, is_terminal: false }

function mountForm(send: (c: string) => Promise<void>) {
  const { Root, captured } = withBoundary(() => h(CommentList, { thread: OPEN_THREAD, comments: [], send }))
  const w = mount(Root, { global: { plugins: [i18n()] } })
  return { w, captured }
}

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(api).forEach((f) => f.mockReset())
})

describe('довжина коментаря — як рахує сервер', () => {
  it('пробіли з країв не рахуються, емодзі — один символ', () => {
    expect(commentLength('  a  ')).toBe(1)
    expect(commentLength('👍')).toBe(1)
    expect('👍'.length).toBe(2) // саме тому звичайний .length тут не годиться
    expect(commentLength('ок')).toBe(2)
  })
})

describe('форма коментаря', () => {
  it('один символ (або одне емодзі) не надсилається; підказка каже чому', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const { w } = mountForm(send)
    const input = w.find('[data-test="comment-input"]')
    for (const short of ['a', '  b ', '👍']) {
      await input.setValue(short)
      expect(w.find('[data-test="comment-send"]').attributes('disabled'), short).toBeDefined()
      expect(w.find('[data-test="comment-min-hint"]').text()).toContain(fb.comments.minLengthHint)
    }
    await w.find('form').trigger('submit')
    expect(send).not.toHaveBeenCalled()
    await input.setValue('ок')
    expect(w.find('[data-test="comment-send"]').attributes('disabled')).toBeUndefined()
    expect(w.find('[data-test="comment-min-hint"]').exists()).toBe(false)
  })

  it('порожнє поле не сварить підказкою', () => {
    const { w } = mountForm(vi.fn())
    expect(w.find('[data-test="comment-min-hint"]').exists()).toBe(false)
  })

  it('успіх — текст надіслано обрізаним, поле очищене, помилки немає', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const { w } = mountForm(send)
    await w.find('[data-test="comment-input"]').setValue('  Нотатку не можна збільшити  ')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(send).toHaveBeenCalledWith('Нотатку не можна збільшити')
    expect((w.find('[data-test="comment-input"]').element as HTMLTextAreaElement).value).toBe('')
    expect(w.find('[data-test="comment-error"]').exists()).toBe(false)
  })

  it.each([
    ['400 закороткий (прод, користувач 242)', TOO_SHORT, fb.comments.errors.tooShort],
    ['423 обговорення завершено', httpError(423, { error: 'thread_terminal', detail: 'x' }), fb.comments.terminal],
    ['423 закрито модератором', httpError(423, { error: 'thread_locked', detail: 'x' }), fb.comments.locked],
    ['429 ліміт на день', httpError(429, { detail: 'throttled' }), fb.comments.errors.rateLimit],
    ['мережа впала (відповіді нема)', new Error('Network Error'), fb.comments.errors.generic],
  ])('відмова: %s — повідомлення біля форми, текст лишився, застосунок не падає', async (_n, err, message) => {
    const send = vi.fn().mockRejectedValue(err)
    const { w, captured } = mountForm(send)
    await w.find('[data-test="comment-input"]').setValue('Мій коментар')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(captured).toEqual([])
    expect(w.find('[data-test="comment-error"]').text()).toBe(message)
    expect((w.find('[data-test="comment-input"]').element as HTMLTextAreaElement).value).toBe('Мій коментар')
    expect(w.find('[data-test="comment-send"]').attributes('disabled')).toBeUndefined()
  })

  it('почав правити текст — стара помилка зникає', async () => {
    const { w } = mountForm(vi.fn().mockRejectedValue(TOO_SHORT))
    await w.find('[data-test="comment-input"]').setValue('аб')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.find('[data-test="comment-error"]').exists()).toBe(true)
    await w.find('[data-test="comment-input"]').setValue('абв')
    expect(w.find('[data-test="comment-error"]').exists()).toBe(false)
  })
})

describe('сторінка теми', () => {
  async function mountPage() {
    api.getThread.mockResolvedValue({
      id: 1, title: 'Кнопка', description: 'Додай кнопку', status: 'open', type: 'feature_request', category: 'ux',
      is_locked: false, is_hidden: false, is_terminal: false, vote_count: 0, voted_by_me: false,
      subscribed_by_me: false, author: { id: 40, display_name: 'Автор' }, created_at: '2026-05-26T22:09:41Z',
    })
    api.listComments.mockResolvedValue([])
    const { Root, captured } = withBoundary(() => h(ThreadDetail))
    const w = mount(Root, { global: { plugins: [i18n()], stubs: { 'router-link': RouterLinkStub } } })
    await flushPromises()
    return { w, captured }
  }

  it('коментар через сторінку: відмова 400 — повідомлення у формі, без падіння', async () => {
    api.createComment.mockRejectedValue(TOO_SHORT)
    const { w, captured } = await mountPage()
    await w.find('[data-test="comment-input"]').setValue('аб')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(api.createComment).toHaveBeenCalledWith(1, 'аб')
    expect(captured).toEqual([])
    expect(w.find('[data-test="comment-error"]').text()).toBe(fb.comments.errors.tooShort)
  })

  it('коментар через сторінку: успіх — коментар у списку', async () => {
    api.createComment.mockResolvedValue({ id: 7, content: 'Працює', author: { id: 242, display_name: 'Учитель' }, created_at: '2026-10-11T15:20:00Z' })
    const { w, captured } = await mountPage()
    await w.find('[data-test="comment-input"]').setValue('Працює')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(captured).toEqual([])
    expect(w.text()).toContain('Працює')
  })

  it('«Підписатись» не вдалося — повідомлення на сторінці, а не «Щось пішло не так»', async () => {
    api.subscribe.mockRejectedValue(httpError(500, {}))
    const { w, captured } = await mountPage()
    const btn = w.findAll('button').find((b) => b.text() === fb.detail.subscribe)
    expect(btn).toBeTruthy()
    await btn!.trigger('click')
    await flushPromises()
    expect(captured).toEqual([])
    expect(w.find('[data-test="thread-action-error"]').text()).toBe(fb.detail.errors.generic)
  })

  it('тему не вдалося завантажити — сторінка показує причину, без необробленої відмови', async () => {
    api.getThread.mockRejectedValue(httpError(404, { detail: 'Not found' }))
    api.listComments.mockResolvedValue([])
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const { Root, captured } = withBoundary(() => h(ThreadDetail))
      const w = mount(Root, { global: { plugins: [i18n()], stubs: { 'router-link': RouterLinkStub } } })
      await flushPromises()
      await new Promise((r) => setTimeout(r, 0))
      expect(captured).toEqual([])
      expect(unhandled).not.toHaveBeenCalled()
      expect(w.text()).toContain('Not found')
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })
})

describe('ключ помилки коментаря', () => {
  it('400 без поля content — загальне повідомлення, а не «закороткий»', () => {
    expect(commentErrorKey(httpError(400, { error: { code: 'VALIDATION_ERROR', fields: {} } }))).toBe('feedback.comments.errors.generic')
  })
  it('404 — обговорення зникло', () => {
    expect(commentErrorKey(httpError(404, { error: 'not_found' }))).toBe('feedback.comments.errors.notFound')
  })
})
