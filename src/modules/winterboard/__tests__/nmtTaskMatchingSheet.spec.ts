/**
 * Задача на відповідність — бланк НМТ (LAW §9 v1.48; власник 23.10 через Полу: «у старій базі задачі на
 * відповідність… неправильно працюють: коли показати результат — все зеленим… або все червоним… щоб на уроці
 * вони себе нормально почували»).
 *
 * Було: картка малювала готові пари «пункт — відповідь» (зайві варіанти губились, учень одразу бачив
 * відповідь), а «Показати відповідь» фарбувала всі рядки однаково.
 *
 *   INV-NMT-MT-1  колонки 1–3 і А–Д (із зайвими варіантами), відповідь у колонках не підказана
 *   INV-NMT-MT-2  у рядку бланка обирається одна літера; повторний натиск знімає вибір
 *   INV-NMT-MT-3  «Показати відповідь» фарбує кожен рядок окремо + «Правильно: N з M»
 *   INV-NMT-MT-4  вибір не пише в дошку (локальний, як у single_choice)
 *   INV-NMT-MT-5  стара картка лише з `pairs` малюється як раніше
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'
import Renderer from '../components/board/objects/NmtTaskRenderer.vue'

vi.mock('@/utils/media', () => ({ resolveMediaUrl: (u: string) => u }))
vi.mock('../../../composables/useStudentTutor', () => ({ useTutorRevealGate: () => ({ value: true }) }))
vi.mock('@/modules/learning-content/utils/contentRenderer', () => ({ renderTextWithLatex: (t: string) => t }))

const MATCHING = {
  left: [
    { id: '1', label: '1', text: 'y = log_3 x' },
    { id: '2', label: '2', text: 'y = x^2' },
    { id: '3', label: '3', text: 'y = 2^x' },
  ],
  right: ['парна', 'зростає', 'непарна', 'спадає', 'обмежена'].map((text, i) => ({
    id: 'АБВГД'[i], label: 'АБВГД'[i], text,
  })),
  answer: { 1: 'Б', 2: 'А', 3: 'Д' },
}
const PAIRS = [
  { id: 'p1', left: 'y = log_3 x', right: 'зростає' },
  { id: 'p2', left: 'y = x^2', right: 'парна' },
  { id: 'p3', left: 'y = 2^x', right: 'обмежена' },
]

function mountTask(data: Record<string, unknown>) {
  return mount(Renderer, {
    props: {
      asset: {
        id: 'a1', type: 'nmt_task', x: 0, y: 0, w: 900, h: 600, rotation: 0, locked: false,
        data: { version: 1, taskType: 'matching', question: 'Установіть відповідність.', showAnswer: false,
          showSolution: false, ...data },
      } as never,
      isSelected: false,
      interactive: true,
      isTutor: true,
    },
    global: {
      stubs: { teleport: true },
      plugins: [createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk }, missingWarn: false })],
    },
  })
}

const row = (w: ReturnType<typeof mountTask>, label: string) => w.get(`[data-testid="nmt-match-row-${label}"]`)
const cell = (w: ReturnType<typeof mountTask>, label: string, letter: string) =>
  row(w, label).findAll('.nmt-task__match-cell').find((b) => b.text() === letter)!

describe('Задача на відповідність — бланк НМТ', () => {
  it('INV-NMT-MT-1: колонки 1–3 і всі п’ять варіантів, відповідь не підказана', () => {
    const w = mountTask({ matching: MATCHING, pairs: PAIRS })
    const cols = w.findAll('.nmt-task__match-col')
    expect(cols[0].findAll('.nmt-task__match-label').map((x) => x.text())).toEqual(['1', '2', '3'])
    expect(cols[1].findAll('.nmt-task__match-label').map((x) => x.text())).toEqual(['А', 'Б', 'В', 'Г', 'Д'])
    expect(cols[1].text()).toContain('непарна')                   // зайвий варіант на місці
    expect(w.find('.nmt-task__pairs').exists()).toBe(false)        // готових пар «пункт — відповідь» немає
    expect(row(w, '1').findAll('.nmt-task__match-cell')).toHaveLength(5)
    expect(w.findAll('.is-correct, .is-wrong')).toHaveLength(0)
  })

  it('INV-NMT-MT-2: одна літера в рядку, повторний натиск знімає', async () => {
    const w = mountTask({ matching: MATCHING })
    await cell(w, '1', 'А').trigger('click')
    await cell(w, '1', 'Б').trigger('click')
    expect(row(w, '1').findAll('.is-selected').map((b) => b.text())).toEqual(['Б'])
    await cell(w, '1', 'Б').trigger('click')
    expect(row(w, '1').findAll('.is-selected')).toHaveLength(0)
  })

  it('INV-NMT-MT-3: «Показати відповідь» фарбує кожен рядок окремо і рахує бал', async () => {
    const w = mountTask({ matching: MATCHING })
    await cell(w, '1', 'Б').trigger('click')     // правильно
    await cell(w, '2', 'В').trigger('click')     // хибно (правильна А)
    // рядок 3 без вибору
    await w.setProps({ asset: { ...(w.props('asset') as object), data: { ...(w.props('asset') as any).data, showAnswer: true } } as never })

    expect(row(w, '1').classes()).toContain('is-correct')
    expect(row(w, '2').classes()).toContain('is-wrong')
    expect(row(w, '3').classes()).not.toContain('is-correct')
    expect(row(w, '3').classes()).not.toContain('is-wrong')

    expect(cell(w, '2', 'В').classes()).toContain('is-wrong')
    expect(cell(w, '2', 'А').classes()).toContain('is-correct')   // правильна в хибному рядку — зеленим
    expect(cell(w, '3', 'Д').classes()).toContain('is-correct')   // невибраний рядок — показано правильну
    expect(row(w, '3').findAll('.is-wrong')).toHaveLength(0)

    expect(w.get('[data-testid="nmt-match-score"]').text()).toBe('Правильно: 1 з 3')
  })

  it('INV-NMT-MT-3: без жодного вибору підсумку немає, лише правильні літери', async () => {
    const w = mountTask({ matching: MATCHING, showAnswer: true })
    expect(w.find('[data-testid="nmt-match-score"]').exists()).toBe(false)
    expect(w.findAll('.nmt-task__match-cell.is-correct').map((b) => b.text())).toEqual(['Б', 'А', 'Д'])
  })

  it('INV-NMT-MT-4: вибір літери нічого не пише в дошку', async () => {
    const w = mountTask({ matching: MATCHING })
    await cell(w, '1', 'Б').trigger('click')
    expect(w.emitted('update:asset')).toBeUndefined()
  })

  it('INV-NMT-MT-5: стара картка лише з pairs — як раніше', () => {
    const w = mountTask({ pairs: PAIRS })
    expect(w.find('[data-testid="nmt-match"]').exists()).toBe(false)
    expect(w.findAll('.nmt-task__pair')).toHaveLength(3)
    expect(w.text()).toContain('зростає')
  })
})

describe('видно відповідь з парти', () => {
  // Власник 2026-10-29: «відповіді майже не видно… треба, щоб повністю зеленим заливало». Пунктир — заборонено.
  it('правильна клітинка, варіант і коротка відповідь після «Показати відповідь» — суцільна зелена заливка', () => {
    const src = readFileSync('src/modules/winterboard/components/board/objects/NmtTaskRenderer.vue', 'utf8')
    const rule = (sel: string) => src.match(new RegExp(sel.replace(/[.]/g, '\\.') + '\\s*\\{([^}]+)\\}'))?.[1] ?? ''
    for (const sel of ['.nmt-task__match-cell.is-correct', '.nmt-task__option.is-correct', '.nmt-task__correct-hint']) {
      expect(rule(sel), sel).toMatch(/background:\s*var\(--m4-primary\)/)
      expect(rule(sel), sel).not.toMatch(/dashed/)
    }
  })
})
