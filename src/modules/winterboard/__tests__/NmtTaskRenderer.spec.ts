/**
 * NmtTaskRenderer.vue — типи задач із сіткою варіантів.
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 *
 * 1. `multiple_select`. Бекенд віддавав такі задачі, а тип на фронті знав
 *    лише три види — тож 2 045 карток приїжджали на дошку БЕЗ ЖОДНОГО
 *    варіанта відповіді. Помилки не було: `v-if` просто не збігався, і
 *    блок не рендерився. Мовчазна вада, якої не видно ні в логах, ні в
 *    типах — лише очима на дошці.
 *
 * 2. `OPTION_IMAGE`. Картинка варіанта прив'язується до нього за `order`.
 *    Якщо BE зсуне нумерацію, картинка стане під чужою літерою — а виглядати
 *    це буде як цілком нормальна картка.
 *
 * ІНВАРІАНТИ
 *   INV-NMT-MS-1  multiple_select рендерить сітку варіантів
 *   INV-NMT-MS-2  видно, СКІЛЬКИ треба вибрати (інакше учень спиниться на першій)
 *   INV-NMT-MS-3  можна вибрати кілька варіантів одночасно
 *   INV-NMT-SC-1  у single_choice попередній вибір знімається (регресія)
 *   INV-NMT-IMG-1 OPTION_IMAGE лягає до варіанта зі своїм `order`
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import Renderer from '../components/board/objects/NmtTaskRenderer.vue'
import { resetNmtPresentationScales, setNmtPresentationScale } from '../composables/useNmtPresentationScale'

vi.mock('@/utils/media', () => ({
  resolveMediaUrl: (u: string) => u,
}))
vi.mock('../../../composables/useStudentTutor', () => ({
  useTutorRevealGate: () => ({ value: true }),
}))
vi.mock('@/modules/learning-content/utils/contentRenderer', () => ({
  renderTextWithLatex: (t: string) => t,
}))
// Контрол «✎ тема» бачить лише тьютор — у цих тестах роль не під перевіркою,
// тож ставимо учня, щоб контрол не заважав рахувати варіанти.
vi.mock('../composables/useTaskTopicFix', () => ({
  useTaskTopicFix: () => ({
    canFix: { value: false }, open: { value: false }, loading: { value: false },
    saving: { value: false }, error: { value: '' }, current: { value: null },
    suggestions: { value: [] }, allTopics: { value: [] },
    showAll: { value: false }, done: { value: '' },
    toggle: () => {}, apply: () => {}, reject: () => {}, load: () => {},
  }),
}))

const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key

function makeAsset(data: Record<string, unknown>) {
  return {
    id: 'a1', type: 'nmt_task', x: 0, y: 0, w: 600, h: 300,
    rotation: 0, locked: false,
    data: { version: 1, showAnswer: false, showSolution: false, ...data },
  }
}

function mountTask(data: Record<string, unknown>, isTutor = true, isSelected = false) {
  return mount(Renderer, {
    props: {
      asset: makeAsset(data) as never,
      isSelected,
      interactive: true,
      isTutor,
    },
    global: { mocks: { t }, stubs: { teleport: true } },
  })
}

const OPTIONS = [
  { id: 'o1', letter: 'А', text: 'перший', isCorrect: false },
  { id: 'o2', letter: 'Б', text: 'другий', isCorrect: true },
  { id: 'o3', letter: 'В', text: 'третій', isCorrect: true },
]

describe('NmtTaskRenderer — multiple_select', () => {
  beforeEach(() => resetNmtPresentationScales())

  it('A+ реактивно змінює лише типографіку картки на цьому екрані', async () => {
    const w = mountTask({
      taskType: 'single_choice', question: 'Знайдіть $x$', options: OPTIONS,
    })
    expect(w.find('.nmt-task').attributes('style')).toContain('--nmt-presentation-scale: 1')
    setNmtPresentationScale('a1', 1.25)
    await nextTick()
    expect(w.find('.nmt-task').attributes('style')).toContain('--nmt-presentation-scale: 1.25')
    expect(w.find('.nmt-task__question').text()).toContain('Знайдіть')
  })

  it('INV-NMT-MS-1: рендерить сітку варіантів', () => {
    const w = mountTask({
      taskType: 'multiple_select', question: 'Оберіть правильні твердження',
      options: OPTIONS, selectCount: 2,
    })
    expect(w.findAll('.nmt-task__option')).toHaveLength(3)
  })

  it('INV-NMT-MS-2: показує, скільки треба вибрати', () => {
    const w = mountTask({
      taskType: 'multiple_select', question: 'Оберіть', options: OPTIONS, selectCount: 2,
    })
    expect(w.find('.nmt-task__hint').exists()).toBe(true)
    expect(w.find('.nmt-task__hint').text()).toContain('2')
  })

  it('INV-NMT-MS-3: можна вибрати кілька варіантів', async () => {
    const w = mountTask({
      taskType: 'multiple_select', question: 'Оберіть', options: OPTIONS, selectCount: 2,
    })
    const btns = w.findAll('.nmt-task__option')
    await btns[1].trigger('click')
    await btns[2].trigger('click')
    expect(w.findAll('.nmt-task__option.is-selected')).toHaveLength(2)
  })

  it('single_choice підказки НЕ показує', () => {
    const w = mountTask({
      taskType: 'single_choice', question: 'Оберіть одну', options: OPTIONS,
    })
    expect(w.find('.nmt-task__hint').exists()).toBe(false)
  })

  it('INV-NMT-SC-1: у single_choice вибір лишається одиничним', async () => {
    const w = mountTask({
      taskType: 'single_choice', question: 'Оберіть одну', options: OPTIONS,
    })
    const btns = w.findAll('.nmt-task__option')
    await btns[0].trigger('click')
    await btns[1].trigger('click')
    expect(w.findAll('.nmt-task__option.is-selected')).toHaveLength(1)
  })
})

describe('NmtTaskRenderer — картинки варіантів', () => {
  it('INV-NMT-IMG-1: OPTION_IMAGE лягає до варіанта зі своїм order', () => {
    const w = mountTask({
      taskType: 'single_choice',
      question: 'На якому рисунку подібні трикутники?',
      options: OPTIONS,
      resourceRefs: [
        { resource_id: 'q', role: 'QUESTION_IMAGE', order: 0, url: '/q.png' },
        { resource_id: 'b', role: 'OPTION_IMAGE', order: 1, url: '/opt-b.png' },
      ],
    })
    // Ілюстрація умови — окремим блоком, НЕ серед варіантів.
    const figures = w.findAll('.nmt-task__figure')
    expect(figures).toHaveLength(1)
    expect(figures[0].attributes('src')).toBe('/q.png')

    // Картинка варіанта — рівно біля «Б» (order 1), і більше ніде.
    const optImgs = w.findAll('.nmt-task__option-img')
    expect(optImgs).toHaveLength(1)
    expect(optImgs[0].attributes('src')).toBe('/opt-b.png')
    expect(w.findAll('.nmt-task__option')[1].html()).toContain('/opt-b.png')
  })

  it('QUESTION_IMAGE не з\'являється біля варіантів', () => {
    const w = mountTask({
      taskType: 'single_choice', question: 'Питання', options: OPTIONS,
      resourceRefs: [
        { resource_id: 'q', role: 'QUESTION_IMAGE', order: 0, url: '/q.png' },
      ],
    })
    expect(w.findAll('.nmt-task__option-img')).toHaveLength(0)
  })
})

describe('NmtTaskRenderer — межа ролі для ключа відповіді', () => {
  // TLV2-03S: зворотний бік межі — учитель кнопок не втрачає і вони відкривають ключ.
  it('учитель бачить «Показати відповідь / розбір», і кнопки відкривають ключ', async () => {
    const w = mountTask({
      taskType: 'single_choice', question: 'Оберіть', options: OPTIONS,
      solution: 'Розбір із відповіддю',
    }, true, true)

    const buttons = w.findAll('.nmt-task__btn')
    const answer = buttons.find(b => b.text() === 'Показати відповідь')
    const solution = buttons.find(b => b.text() === 'Показати розбір')
    expect(answer).toBeDefined()
    expect(solution).toBeDefined()
    expect(w.find('.nmt-task__delete-btn').exists()).toBe(true)

    await answer!.trigger('click')
    await solution!.trigger('click')
    const updates = w.emitted('update:asset') as Array<[{ data: Record<string, unknown> }]>
    expect(updates).toHaveLength(2)
    expect(updates[0][0].data.showAnswer).toBe(true)
    expect(updates[1][0].data.showSolution).toBe(true)
  })

  it('учень не отримує кнопок, що змінюють showAnswer/showSolution', () => {
    const w = mountTask({
      taskType: 'single_choice', question: 'Оберіть', options: OPTIONS,
      solution: 'Розбір із відповіддю',
    }, false, true)

    expect(w.text()).not.toContain('Показати відповідь')
    expect(w.text()).not.toContain('Показати розбір')
    expect(w.find('.nmt-task__delete-btn').exists()).toBe(false)
    expect(w.emitted('update:asset')).toBeUndefined()
  })

  it('учень бачить розкриття, яке вже зробив учитель, але не керує ним', () => {
    const w = mountTask({
      taskType: 'single_choice', question: 'Оберіть', options: OPTIONS,
      solution: 'Розбір із відповіддю', showAnswer: true, showSolution: true,
    }, false)

    expect(w.find('.nmt-task__solution').text()).toContain('Розбір із відповіддю')
    expect(w.findAll('.nmt-task__option.is-correct')).toHaveLength(2)
    expect(w.text()).not.toContain('Сховати відповідь')
    expect(w.text()).not.toContain('Сховати розбір')
  })
})
