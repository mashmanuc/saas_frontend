/**
 * Б-179 (власник 2026-10-11: «бери пакетом» — переклад): картки дошки писали службові підписи
 * українською за будь-якої мови інтерфейсу. Картка задачі НМТ — тип («Відкрита відповідь»),
 * «Показати/Сховати відповідь», «Показати/Сховати розбір», «Побудувати», меню теми для вчителя;
 * картка теорії без власного підпису — «Теорія». Учитель з en/ru-інтерфейсом бачив це на проєкторі.
 *
 * Тепер підписи — мовою інтерфейсу. Текст задачі, варіанти й літери А/Б/В/Г — матеріал НМТ, лишаються.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'

vi.mock('@/utils/media', () => ({ resolveMediaUrl: (u: string) => u }))
vi.mock('../../../composables/useStudentTutor', () => ({ useTutorRevealGate: () => ({ value: true }) }))
vi.mock('@/modules/learning-content/utils/contentRenderer', () => ({ renderTextWithLatex: (t: string) => t }))


import NmtTaskRenderer from '../components/board/objects/NmtTaskRenderer.vue'
import TheoryCardRenderer from '../components/board/objects/TheoryCardRenderer.vue'

function i18n(locale: string) {
  return createI18n({ legacy: false, locale, fallbackLocale: 'uk', messages: { uk, en, ru }, missingWarn: false })
}

const QUESTION = 'Знайдіть радіус кола, описаного навколо прямокутного трикутника.'

function mountTask(locale: string, data: Record<string, unknown> = {}) {
  return mount(NmtTaskRenderer, {
    props: {
      asset: {
        id: 'a1', type: 'nmt_task', x: 0, y: 0, w: 600, h: 300, rotation: 0, locked: false,
        data: { version: 1, taskType: 'open_answer', question: QUESTION, correctAnswer: '6\\sqrt{3}',
          solution: 'R = c/2', showAnswer: false, showSolution: false, ...data },
      } as never,
      isSelected: false, interactive: true, isTutor: true,
    },
    global: { plugins: [i18n(locale)], stubs: { teleport: true } },
  })
}

const N = { uk: uk.winterboard.widget.nmtTask, en: en.winterboard.widget.nmtTask, ru: ru.winterboard.widget.nmtTask }

describe('Б-179: картка задачі НМТ — підписи мовою інтерфейсу', () => {
  it.each(['en', 'ru'] as const)('%s: тип і кнопки — перекладені, жодного українського підпису картки', (loc) => {
    const w = mountTask(loc)
    const text = w.text()
    expect(text).toContain(N[loc].type.openAnswer)
    expect(text).toContain(N[loc].showAnswer)
    expect(text).toContain(N[loc].showSolution)
    for (const ukLabel of [N.uk.type.openAnswer, N.uk.showAnswer, N.uk.showSolution]) {
      expect(text, ukLabel).not.toContain(ukLabel)
    }
    // Текст задачі — матеріал, не перекладається
    expect(text).toContain(QUESTION)
  })

  it('en: відкриті відповідь і розбір — «Hide …»', () => {
    const text = mountTask('en', { showAnswer: true, showSolution: true }).text()
    expect(text).toContain(N.en.hideAnswer)
    expect(text).toContain(N.en.hideSolution)
  })

  it('uk: як і було', () => {
    const text = mountTask('uk').text()
    expect(text).toContain('Відкрита відповідь')
    expect(text).toContain('Показати відповідь')
    expect(text).toContain('Показати розбір')
  })

  it('en: інші типи задач теж перекладені', () => {
    const w = mountTask('en', { taskType: 'single_choice', options: [{ id: 'o1', letter: 'А', text: '1', isCorrect: true }] })
    expect(w.text()).toContain(N.en.type.singleChoice)
    expect(w.text()).toContain('А') // літера варіанта — правило НМТ
  })
})

describe('Б-179: картка теорії без власного підпису', () => {
  function mountTheory(locale: string, badge?: string) {
    return mount(TheoryCardRenderer, {
      props: {
        asset: { id: 't1', type: 'theory_card', src: '', x: 0, y: 0, w: 420, h: 260, rotation: 0,
          data: { version: 1, title: 'Описане коло', body: 'R = c/2', ...(badge ? { badge } : {}) } } as never,
        canFit: false,
      },
      global: { plugins: [i18n(locale)] },
    })
  }

  it.each([['en', 'Theory'], ['ru', 'Теория'], ['uk', 'Теорія']])('%s: запасний підпис — «%s»', (loc, label) => {
    expect(mountTheory(loc).find('.theory-card__badge').text()).toBe(label)
  })

  it('свій підпис картки (матеріал) — як є, без перекладу', () => {
    expect(mountTheory('en', 'Означення').find('.theory-card__badge').text()).toBe('Означення')
  })
})
