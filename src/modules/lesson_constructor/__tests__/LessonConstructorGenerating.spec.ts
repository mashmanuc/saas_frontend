/**
 * Поки генерується урок (власник 2026-10-19: «не колесо, а Інтегралик»): посередині екрана Інтегралик,
 * що думає, а загальне вікно «Завантаження…» для цього запиту не вмикається (воно розмивало сторінку
 * й закривало Інтегралика на кнопці).
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { post, push } = vi.hoisted(() => ({ post: vi.fn(), push: vi.fn() }))
vi.mock('@/utils/apiClient', () => ({ default: { post, get: vi.fn() } }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

import LessonConstructorPage from '../views/LessonConstructorPage.vue'
import { lessonConstructorApi } from '../api/lessonConstructorApi'

afterEach(() => { document.body.innerHTML = ''; post.mockReset(); push.mockReset() })

const chip = (w: any, text: string) => w.findAll('.lc-topic-chip').find((b: any) => b.text().trim() === text)
const overlay = () => document.body.querySelector('[data-testid="lc-generating"]')

// Дерево тем — вигляд «НМТ»: з 2026-10-21 сторінка спершу пропонує клас учня (TopicGradePicker).
beforeEach(() => { localStorage.setItem('lc.topicView', 'nmt') })
describe('генерація уроку в конструкторі', () => {
  it('запит генерації — без загального «Завантаження…»', async () => {
    post.mockResolvedValue({ session_id: 's-1' })
    await lessonConstructorApi.generate({ topics: ['derivative'] } as never)
    expect(post).toHaveBeenCalledWith('/v1/lesson-constructor/generate/', { topics: ['derivative'] }, { meta: { skipLoader: true } })
  })

  it('поки йде — посередині Інтегралик «складає урок»; готово — віконце зникає', async () => {
    let finish!: (v: unknown) => void
    post.mockReturnValue(new Promise((r) => { finish = r }))
    const w = mount(LessonConstructorPage, { attachTo: document.body })
    for (const head of w.findAll('.lc-topic-block__head')) await head.trigger('click')
    await chip(w, 'Похідна')!.trigger('click')
    await w.find('.lc-btn-generate').trigger('submit')
    await flushPromises()

    const shown = overlay()
    expect(shown).not.toBeNull()
    expect(shown!.textContent).toContain('Інтегралик складає урок…')
    expect(shown!.querySelector('[data-testid="integralyk-loader"]')).not.toBeNull()
    expect(document.body.textContent).not.toContain('Завантаження')

    finish({ session_id: 's-1' })
    await flushPromises()
    expect(overlay()).toBeNull()
    w.unmount()
  })
})
