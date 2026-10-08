/**
 * «Інтегралик прочитав» — коректор розпізнаного (ТЗ TZ_IMAGE_READING_CORRECTOR_2026-10-08 §0 К1, §5, §7).
 *
 * Мокаємо лише транспорт (apiClient), тост, маршрут і стори користувача. Справжні:
 * KaTeX, наявне вікно WBFormulaInputModal (його DOM у body — Teleport), модуль API
 * (тіло запитів перевіряється на рівні apiClient), uk-локаль.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { i18n } from '@/i18n'
import ImageReadingBlock from '../properties/ImageReadingBlock.vue'
import WBFormulaInputModal from '../../toolbar/WBFormulaInputModal.vue'
import {
  firstInvalidFormulaIndex,
  replaceSegment,
} from '@/modules/intent/imageReadingSegments'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }))
vi.mock('@/utils/apiClient', () => ({ default: api }))

const notify = vi.hoisted(() => ({ notifySuccess: vi.fn() }))
vi.mock('@/utils/notify', () => notify)

const route = vi.hoisted(() => ({
  name: 'winterboard-solo',
  path: '/winterboard/b-1',
  params: { id: 'b-1' },
  meta: {},
}))
vi.mock('vue-router', () => ({ useRoute: () => route }))

const authState = vi.hoisted(() => ({ user: null as null | { id: number; role: string; is_staff?: boolean } }))
vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => authState }))

const profileState = vi.hoisted(() => ({ settings: null as null | Record<string, unknown> }))
vi.mock('@/modules/profile/store/profileStore', () => ({ useProfileStore: () => profileState }))

const TUTOR = { id: 7, role: 'tutor' }
const STUDENT = { id: 9, role: 'student' }

const SEGS = [
  { type: 'text', text: 'Обчисліть ' },
  { type: 'formula', latex: '5^{x}:2' },
  { type: 'text', text: ' і порівняйте з ' },
  { type: 'formula', latex: '\\frac{1}{2}' },
] as const

function reading(over: Record<string, unknown> = {}) {
  return {
    status: 'model',
    segments: SEGS.map((s) => ({ ...s })),
    model: 'vision-model',
    read_at: '2026-10-08T10:00:00Z',
    can_edit: true,
    ...over,
  }
}

function httpError(status: number, data: unknown = {}) {
  return Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data, config: { url: '/v1/intents/image-reading/' } },
  })
}

let wrapper: VueWrapper | null = null

async function mountBlock(props: Record<string, unknown> = {}) {
  wrapper = mount(ImageReadingBlock, {
    props: {
      boardId: 'b-1',
      boardOwnerId: 7,
      objectId: 'img-1',
      imageSrc: 'https://cdn.example/img-1.png',
      ...props,
    },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const q = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`)
const modalTextarea = () => document.body.querySelector<HTMLTextAreaElement>('#wb-formula-input')
const modalSubmitBtn = () => document.body.querySelector<HTMLButtonElement>('.wb-formula-modal__btn--primary')

async function submitModal(value: string) {
  const ta = modalTextarea()!
  ta.value = value
  ta.dispatchEvent(new Event('input'))
  await flushPromises()
  modalSubmitBtn()!.click()
  await flushPromises()
}

beforeEach(() => {
  i18n.global.locale.value = 'uk'
  authState.user = { ...TUTOR }
  profileState.settings = null
  route.name = 'winterboard-solo'
  route.path = '/winterboard/b-1'
  route.meta = {}
  api.get.mockReset()
  api.post.mockReset()
  api.put.mockReset()
  api.delete.mockReset()
  notify.notifySuccess.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('ImageReadingBlock — стани', () => {
  it('none + право → «Прочитати»; натиск шле POST read/ без force і показує прочитане', async () => {
    api.get.mockResolvedValue({ status: 'none', segments: [], model: null, read_at: null, can_edit: true })
    api.post.mockResolvedValue(reading())
    const w = await mountBlock()

    expect(api.get).toHaveBeenCalledWith('/v1/intents/image-reading/', expect.objectContaining({
      params: { board_id: 'b-1', object_id: 'img-1' },
    }))
    expect(q(w, 'image-reading-none').text()).toBe('Картинку ще не прочитано.')
    expect(q(w, 'image-reading-reread').exists()).toBe(false)

    await q(w, 'image-reading-read').trigger('click')
    await flushPromises()

    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith('/v1/intents/image-reading/read/', { board_id: 'b-1', object_id: 'img-1' })
    expect(q(w, 'image-reading-status').text()).toBe('прочитано Інтеграликом')
  })

  it('model → текст текстом, формули KaTeX; «Підтвердити» і «Прочитати заново», без «Прибрати»', async () => {
    api.get.mockResolvedValue(reading())
    const w = await mountBlock()

    expect(w.find('[data-testid="image-reading"]').text()).toContain('Інтегралик прочитав')
    expect(q(w, 'image-reading-status').text()).toBe('прочитано Інтеграликом')
    const texts = w.findAll('[data-testid="image-reading-segment-text"]').map((s) => s.text())
    expect(texts).toEqual(['Обчисліть', 'і порівняйте з'])
    const formulas = w.findAll('[data-testid="image-reading-formula"]')
    expect(formulas).toHaveLength(2)
    for (const f of formulas) expect(f.find('.katex').exists()).toBe(true)
    // Сирого LaTeX у тексті немає — лише відмальоване.
    expect(q(w, 'image-reading-text').find('code').exists()).toBe(false)

    expect(q(w, 'image-reading-confirm').exists()).toBe(true)
    expect(q(w, 'image-reading-reread').exists()).toBe(true)
    expect(q(w, 'image-reading-revert').exists()).toBe(false)
  })

  it('corrected → «виправлено вами», є «Прибрати виправлення», немає «Підтвердити»', async () => {
    api.get.mockResolvedValue(reading({ status: 'corrected' }))
    const w = await mountBlock()
    expect(q(w, 'image-reading-status').text()).toBe('виправлено вами')
    expect(q(w, 'image-reading-revert').exists()).toBe(true)
    expect(q(w, 'image-reading-confirm').exists()).toBe(false)
  })

  it('confirmed → «підтверджено вами», є «Прибрати виправлення»', async () => {
    api.get.mockResolvedValue(reading({ status: 'confirmed' }))
    const w = await mountBlock()
    expect(q(w, 'image-reading-status').text()).toBe('підтверджено вами')
    expect(q(w, 'image-reading-revert').exists()).toBe(true)
    expect(q(w, 'image-reading-confirm').exists()).toBe(false)
  })

  it('stale → «картинку змінено — прочитайте заново»; лише «Прочитати заново», формула не клікається', async () => {
    api.get.mockResolvedValue(reading({ status: 'stale' }))
    const w = await mountBlock()
    expect(q(w, 'image-reading-status').text()).toBe('картинку змінено — прочитайте заново')
    expect(q(w, 'image-reading-reread').exists()).toBe(true)
    expect(q(w, 'image-reading-confirm').exists()).toBe(false)
    expect(q(w, 'image-reading-revert').exists()).toBe(false)

    await w.findAll('[data-testid="image-reading-formula"]')[0].trigger('click')
    await flushPromises()
    expect(w.findComponent(WBFormulaInputModal).props('visible')).toBe(false)
  })
})

describe('ImageReadingBlock — право (can_edit)', () => {
  it('без can_edit — лише перегляд: жодної кнопки, формула й текст не відкривають виправлення', async () => {
    api.get.mockResolvedValue(reading({ status: 'corrected', can_edit: false }))
    const w = await mountBlock()

    expect(w.findAll('button')).toHaveLength(0)
    expect(w.find('[role="button"]').exists()).toBe(false)

    await w.findAll('[data-testid="image-reading-formula"]')[0].trigger('click')
    await w.findAll('[data-testid="image-reading-segment-text"]')[0].trigger('click')
    await flushPromises()
    expect(w.findComponent(WBFormulaInputModal).props('visible')).toBe(false)
    expect(q(w, 'image-reading-text-input').exists()).toBe(false)
    expect(api.put).not.toHaveBeenCalled()
  })

  it('none без can_edit — немає «Прочитати»', async () => {
    api.get.mockResolvedValue({ status: 'none', segments: [], model: null, read_at: null, can_edit: false })
    const w = await mountBlock()
    expect(q(w, 'image-reading-none').exists()).toBe(true)
    expect(q(w, 'image-reading-read').exists()).toBe(false)
  })
})

describe('ImageReadingBlock — виправлення формули через наявне вікно', () => {
  it('клік по формулі відкриває WBFormulaInputModal з initialFormula = ця формула', async () => {
    api.get.mockResolvedValue(reading())
    const w = await mountBlock()

    await w.findAll('[data-testid="image-reading-formula"]')[0].trigger('click')
    await flushPromises()

    const modal = w.findComponent(WBFormulaInputModal)
    expect(modal.props('visible')).toBe(true)
    expect(modal.props('initialFormula')).toBe('5^{x}:2')
    expect(modalTextarea()!.value).toBe('5^{x}:2')
  })

  it('submit замінює ЛИШЕ цей сегмент і шле PUT з усіма сегментами; тост', async () => {
    api.get.mockResolvedValue(reading())
    api.put.mockResolvedValue(reading({ status: 'corrected', segments: [] }))
    const w = await mountBlock()

    await w.findAll('[data-testid="image-reading-formula"]')[0].trigger('click')
    await flushPromises()
    await submitModal('5^{x}\\cdot 2')

    expect(api.put).toHaveBeenCalledTimes(1)
    const [url, body] = api.put.mock.calls[0]
    expect(url).toBe('/v1/intents/image-reading/')
    expect(body).toEqual({
      board_id: 'b-1',
      object_id: 'img-1',
      segments: [
        { type: 'text', text: 'Обчисліть ' },
        { type: 'formula', latex: '5^{x}\\cdot 2' },
        { type: 'text', text: ' і порівняйте з ' },
        { type: 'formula', latex: '\\frac{1}{2}' },
      ],
    })
    expect(notify.notifySuccess).toHaveBeenCalledWith('Збережено — Інтегралик бачить виправлене')
    expect(w.findComponent(WBFormulaInputModal).props('visible')).toBe(false)
    expect(q(w, 'image-reading-status').text()).toBe('виправлено вами')
  })

  it('невалідна формула (KaTeX не бере) не зберігається; сказано, яка; повторне відкриття — з введеним', async () => {
    api.get.mockResolvedValue(reading())
    const w = await mountBlock()

    await w.findAll('[data-testid="image-reading-formula"]')[1].trigger('click')
    await flushPromises()
    await submitModal('\\frac{1}{')

    expect(api.put).not.toHaveBeenCalled()
    expect(notify.notifySuccess).not.toHaveBeenCalled()
    const err = q(w, 'image-reading-error')
    expect(err.text()).toContain('Формула не відмальовується — не збережено:')
    expect(err.find('code').text()).toBe('\\frac{1}{')

    await w.findAll('[data-testid="image-reading-formula"]')[1].trigger('click')
    await flushPromises()
    expect(w.findComponent(WBFormulaInputModal).props('initialFormula')).toBe('\\frac{1}{')
  })

  it('400 invalid_formula від сервера показано так само — з формулою за index', async () => {
    api.get.mockResolvedValue(reading())
    api.put.mockRejectedValue(httpError(400, { error: 'invalid_formula', index: 3, detail: 'KaTeX parse error' }))
    const w = await mountBlock()

    await w.findAll('[data-testid="image-reading-formula"]')[0].trigger('click')
    await flushPromises()
    await submitModal('5^{x}\\cdot 2')

    expect(api.put).toHaveBeenCalledTimes(1)
    const err = q(w, 'image-reading-error')
    expect(err.text()).toContain('Формула не відмальовується — не збережено:')
    expect(err.find('code').text()).toBe('\\frac{1}{2}')
    expect(notify.notifySuccess).not.toHaveBeenCalled()
    // Прочитане на екрані — те, що було (сервер не прийняв).
    expect(q(w, 'image-reading-status').text()).toBe('прочитано Інтеграликом')
  })

  it('та сама формула без змін — запиту немає', async () => {
    api.get.mockResolvedValue(reading())
    const w = await mountBlock()
    await w.findAll('[data-testid="image-reading-formula"]')[0].trigger('click')
    await flushPromises()
    await submitModal('5^{x}:2')
    expect(api.put).not.toHaveBeenCalled()
  })
})

describe('ImageReadingBlock — виправлення тексту (запасне)', () => {
  it('клік по тексту → просте поле; збереження замінює лише цей сегмент', async () => {
    api.get.mockResolvedValue(reading())
    api.put.mockResolvedValue(reading({ status: 'corrected' }))
    const w = await mountBlock()

    await w.findAll('[data-testid="image-reading-segment-text"]')[1].trigger('click')
    await flushPromises()
    const input = q(w, 'image-reading-text-input')
    expect(input.element.tagName).toBe('TEXTAREA')
    expect((input.element as HTMLTextAreaElement).value).toBe(' і порівняйте з ')
    await input.setValue(' і порівняйте із ')
    await q(w, 'image-reading-text-save').trigger('click')
    await flushPromises()

    expect(api.put).toHaveBeenCalledTimes(1)
    expect(api.put.mock.calls[0][1].segments).toEqual([
      { type: 'text', text: 'Обчисліть ' },
      { type: 'formula', latex: '5^{x}:2' },
      { type: 'text', text: ' і порівняйте із ' },
      { type: 'formula', latex: '\\frac{1}{2}' },
    ])
    expect(notify.notifySuccess).toHaveBeenCalledWith('Збережено — Інтегралик бачить виправлене')
    expect(q(w, 'image-reading-text-input').exists()).toBe(false)
  })
})

describe('ImageReadingBlock — дії', () => {
  it('«Прочитати заново» шле force: true', async () => {
    api.get.mockResolvedValue(reading({ status: 'corrected' }))
    api.post.mockResolvedValue(reading())
    const w = await mountBlock()
    await q(w, 'image-reading-reread').trigger('click')
    await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/v1/intents/image-reading/read/', {
      board_id: 'b-1',
      object_id: 'img-1',
      force: true,
    })
  })

  it('читання відхилено 400 (адреса не з дозволених джерел) — чесно, без «спробуйте ще раз»', async () => {
    api.get.mockResolvedValue({ status: 'none', segments: [], model: null, read_at: null, can_edit: true })
    api.post.mockRejectedValue(httpError(400, { error: 'image_host_not_allowed' }))
    const w = await mountBlock()
    await q(w, 'image-reading-read').trigger('click')
    await flushPromises()
    expect(q(w, 'image-reading-error').text()).toBe('Цю картинку Інтегралик прочитати не може.')
    expect(q(w, 'image-reading-none').exists()).toBe(true)
  })

  it('«Підтвердити» → POST confirm/; «Прибрати виправлення» → DELETE з board_id/object_id', async () => {
    api.get.mockResolvedValue(reading())
    api.post.mockResolvedValue(reading({ status: 'confirmed' }))
    api.delete.mockResolvedValue(reading())
    const w = await mountBlock()

    await q(w, 'image-reading-confirm').trigger('click')
    await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/v1/intents/image-reading/confirm/', { board_id: 'b-1', object_id: 'img-1' })
    expect(q(w, 'image-reading-status').text()).toBe('підтверджено вами')

    await q(w, 'image-reading-revert').trigger('click')
    await flushPromises()
    expect(api.delete).toHaveBeenCalledWith('/v1/intents/image-reading/', {
      params: { board_id: 'b-1', object_id: 'img-1' },
    })
    expect(q(w, 'image-reading-status').text()).toBe('прочитано Інтеграликом')
  })
})

describe('ImageReadingBlock — хто бачить', () => {
  it('учню блок не показується навіть на власній дошці — і запиту немає', async () => {
    authState.user = { ...STUDENT }
    api.get.mockResolvedValue(reading())
    const w = await mountBlock({ boardOwnerId: STUDENT.id })
    expect(w.find('[data-testid="image-reading"]').exists()).toBe(false)
    expect(api.get).not.toHaveBeenCalled()
  })

  it('учню на дошці вчителя — теж ні', async () => {
    authState.user = { ...STUDENT }
    const w = await mountBlock()
    expect(w.find('[data-testid="image-reading"]').exists()).toBe(false)
    expect(api.get).not.toHaveBeenCalled()
  })

  it('вчитель із вимкненим Інтеграликом у налаштуваннях — ні', async () => {
    profileState.settings = { integralyk_enabled: false }
    const w = await mountBlock()
    expect(w.find('[data-testid="image-reading"]').exists()).toBe(false)
    expect(api.get).not.toHaveBeenCalled()
  })

  it('вчитель не власник дошки — ні (інакше 403 і глобальний тост на кожне виділення)', async () => {
    const w = await mountBlock({ boardOwnerId: 99 })
    expect(w.find('[data-testid="image-reading"]').exists()).toBe(false)
    expect(api.get).not.toHaveBeenCalled()
  })

  it('403 від сервера ховає блок', async () => {
    api.get.mockRejectedValue(httpError(403, { error: { code: 'AUTH_FORBIDDEN' } }))
    const w = await mountBlock()
    expect(w.find('[data-testid="image-reading"]').exists()).toBe(false)
  })

  it('404 з кодом (картинки ще немає на дошці сервера) — спокійне пояснення, без кнопок', async () => {
    api.get.mockRejectedValue(httpError(404, { error: 'not_found' }))
    const w = await mountBlock()
    expect(q(w, 'image-reading-not-on-board').exists()).toBe(true)
    expect(w.findAll('button')).toHaveLength(0)
  })
})

describe('imageReadingSegments — чисті функції', () => {
  it('replaceSegment змінює лише один сегмент і не чіпає решту', () => {
    const segs = SEGS.map((s) => ({ ...s }))
    const next = replaceSegment(segs, 3, '\\frac{2}{3}')
    expect(next).toHaveLength(4)
    expect(next[3]).toEqual({ type: 'formula', latex: '\\frac{2}{3}' })
    for (const i of [0, 1, 2]) expect(next[i]).toBe(segs[i])
    expect(segs[3]).toEqual({ type: 'formula', latex: '\\frac{1}{2}' })
  })

  it('firstInvalidFormulaIndex знаходить першу формулу, яку KaTeX не відмальовує', () => {
    expect(firstInvalidFormulaIndex(SEGS.map((s) => ({ ...s })))).toBe(-1)
    expect(firstInvalidFormulaIndex([
      { type: 'text', text: '\\frac{' },
      { type: 'formula', latex: 'x^2' },
      { type: 'formula', latex: '\\frac{1}{' },
    ])).toBe(2)
  })
})
