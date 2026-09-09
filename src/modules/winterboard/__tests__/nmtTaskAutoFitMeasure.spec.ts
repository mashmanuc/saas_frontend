/**
 * Вимірювання висоти вмісту картки задачі.
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 *
 * Перша редакція автопідгонки міряла `body.scrollHeight`. Картка від того
 * вміла тільки рости: `scrollHeight` за визначенням не буває меншим за
 * `clientHeight`, тож у високій картці з дрібним текстом «потрібна» висота
 * завжди дорівнювала наявній, і стиснення не наставало НІКОЛИ. Правило
 * стиснення при цьому було написане й покрите тестом — падіння сталося на
 * рівень нижче, у вимірюванні.
 *
 * Тому тут перевіряється саме те, чого не видно в чистій функції: коли вміст
 * НИЖЧИЙ за картку, картка мусить попросити МЕНШУ висоту.
 *
 * ІНВАРІАНТИ
 *   INV-MEASURE-1  вміст нижчий за картку → запит на меншу висоту (стиснення)
 *   INV-MEASURE-2  вміст вищий за картку → запит на більшу висоту (ріст)
 *   INV-MEASURE-3  міряється вузол потоку, а не контейнер із прокруткою
 */
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import Renderer from '../components/board/objects/NmtTaskRenderer.vue'
import { useSolutionZoom } from '../composables/useSolutionZoom'

vi.mock('@/utils/media', () => ({ resolveMediaUrl: (u: string) => u }))
vi.mock('../../../composables/useStudentTutor', () => ({
  useTutorRevealGate: () => ({ value: true }),
}))
vi.mock('@/modules/learning-content/utils/contentRenderer', () => ({
  renderTextWithLatex: (t: string) => t,
}))
vi.mock('../composables/useTaskTopicFix', () => ({
  useTaskTopicFix: () => ({
    canFix: { value: false }, open: { value: false }, loading: { value: false },
    saving: { value: false }, error: { value: '' }, current: { value: null },
    suggestions: { value: [] }, allTopics: { value: [] },
    showAll: { value: false }, done: { value: '' },
    toggle: () => {}, apply: () => {}, reject: () => {}, load: () => {},
  }),
}))

const t = (key: string) => key

/** jsdom не рахує розкладку — задаємо геометрію руками. */
function stubLayout(wrapper: ReturnType<typeof mount>, opts: {
  cardH: number; bodyClientH: number; flowH: number
}) {
  const root = wrapper.find('.nmt-task').element as HTMLElement
  const body = wrapper.find('.nmt-task__body').element as HTMLElement
  const flow = wrapper.find('.nmt-task__flow').element as HTMLElement
  Object.defineProperty(root, 'offsetHeight', { value: opts.cardH, configurable: true })
  Object.defineProperty(body, 'clientHeight', { value: opts.bodyClientH, configurable: true })
  // Те, чим помилялась перша редакція: scrollHeight НЕ буває меншим за clientHeight.
  Object.defineProperty(body, 'scrollHeight', {
    value: Math.max(opts.flowH, opts.bodyClientH), configurable: true,
  })
  flow.getBoundingClientRect = () => ({ height: opts.flowH } as DOMRect)
}

function mountCard() {
  return mount(Renderer, {
    props: {
      asset: {
        id: 'a1', type: 'nmt_task', x: 0, y: 0, w: 600, h: 656,
        rotation: 0, locked: false,
        data: {
          version: 1, taskType: 'single_choice', showAnswer: false, showSolution: true,
          question: 'Питання', solution: 'Розбір',
          options: [{ id: 'o1', letter: 'А', text: 'раз', isCorrect: true }],
        },
      } as never,
      isSelected: false,
      interactive: true,
    },
    global: { mocks: { t }, stubs: { teleport: true } },
  })
}

describe('NmtTaskRenderer — вимірювання для автопідгонки', () => {
  it('INV-MEASURE-1: вміст нижчий за картку → просить МЕНШУ висоту', async () => {
    const w = mountCard()
    // Картка 656, тіло 618, а вмісту лише 531 — між ними порожнеча.
    stubLayout(w, { cardH: 656, bodyClientH: 618, flowH: 531 })
    const zoom = useSolutionZoom()
    zoom.zoomOut()
    await nextTick(); await nextTick()

    const events = w.emitted('request-height') as Array<[number]> | undefined
    expect(events, 'картка мусить попросити висоту').toBeTruthy()
    const asked = events![events!.length - 1][0]
    expect(asked).toBeLessThan(656)
    w.unmount()
  })

  it('INV-MEASURE-2: вміст вищий за картку → просить БІЛЬШУ висоту', async () => {
    const w = mountCard()
    stubLayout(w, { cardH: 300, bodyClientH: 262, flowH: 700 })
    const zoom = useSolutionZoom()
    zoom.zoomIn()
    await nextTick(); await nextTick()

    const events = w.emitted('request-height') as Array<[number]> | undefined
    const asked = events![events!.length - 1][0]
    expect(asked).toBeGreaterThan(300)
    w.unmount()
  })

  it('INV-MEASURE-3: у розмітці є окремий вузол потоку', () => {
    const w = mountCard()
    expect(w.find('.nmt-task__flow').exists()).toBe(true)
    w.unmount()
  })
})
