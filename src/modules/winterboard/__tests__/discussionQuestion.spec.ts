/**
 * Питання до обговорення (2026-10-06). Власник: «так, показувати відповідь після обговорення»:
 * питання бачать усі одразу; відповідь — коли вчитель її відкрив (кнопка під питанням або
 * «Відповідь» на пульті). Механіка — як «Відповідь» у задачах НМТ: `showAnswer` у даних
 * картки, звичайний `update:asset` → `asset_update`.
 *
 * Що стережемо:
 *   • закрито: питання з «❓», відповіді немає ні в DOM, ні в тексті;
 *   • кнопку бачить лише той, кому реєстр дав `canReveal` (учитель у живому редагуванні);
 *   • натискання змінює лише `showAnswer`, решта даних картки — без змін;
 *   • відкрито: «Відповідь: …» + цитата-опора; учень бачить відповідь, але кнопки не має;
 *   • підпис «Відповідь» — мовою матеріалу; кнопка не потрапляє в експорт;
 *   • висота: відкриття відповіді — привід переміряти картку (INV-25).
 */
import { describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import en from '../../../i18n/locales/en.json'
import ru from '../../../i18n/locales/ru.json'
import DiscussionQuestionRenderer from '../components/board/objects/DiscussionQuestionRenderer.vue'
import { OVERLAY_RENDERERS } from '../components/canvas/overlayRegistry'
import { assetCapabilities } from '../board/objectStandard'
import type { WBAsset } from '../types/winterboard'

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

const QUESTION = 'Що з легенди можна побачити й сьогодні, а що перевірити не можна?'
const ANSWER = 'Гори над Дніпром є й сьогодні; чи жили брати — перевірити не можна.'
const SUPPORT = 'Вони жили на дніпровських горах … Ця легенда дійшла до нас у літописі XII століття'

function questionAsset(data: Record<string, unknown> = {}): WBAsset {
  return {
    id: 'dq1', type: 'discussion_question', src: '', x: 80, y: 860, w: 1760, h: 90, rotation: 0, locked: false,
    data: { version: 1, question: QUESTION, answer: ANSWER, support: SUPPORT, showAnswer: false, ...data },
  } as unknown as WBAsset
}

function mountQuestion(props: Record<string, unknown> = {}, data: Record<string, unknown> = {}): VueWrapper {
  return mount(DiscussionQuestionRenderer, {
    props: { asset: questionAsset(data), isSelected: false, interactive: true, canReveal: false, ...props },
    global: { plugins: [i18n()] },
  })
}

const reveal = (w: VueWrapper) => w.find('[data-testid="discussion-question-reveal"]')

describe('discussion_question · закрито', () => {
  it('питання з «❓» видно всім; відповіді немає ні в DOM, ні в тексті', () => {
    const w = mountQuestion()
    expect(w.find('[data-testid="discussion-question-text"]').text()).toBe(`❓${QUESTION}`)
    expect(w.find('[data-testid="discussion-question-answer"]').exists()).toBe(false)
    expect(w.text()).not.toContain(ANSWER)
    expect(w.text()).not.toContain('Вони жили')
  })

  it('учень (canReveal=false) кнопки не бачить', () => {
    expect(reveal(mountQuestion({ canReveal: false })).exists()).toBe(false)
  })

  it('учитель бачить «Показати відповідь»; натискання змінює лише showAnswer', async () => {
    const w = mountQuestion({ canReveal: true })
    expect(reveal(w).text()).toBe(uk.winterboard.discussionQuestion.show)
    await reveal(w).trigger('pointerdown', { button: 0 })
    const [[updated]] = w.emitted('update:asset') as WBAsset[][]
    expect(updated.id).toBe('dq1')
    expect(updated.data).toEqual({ version: 1, question: QUESTION, answer: ANSWER, support: SUPPORT, showAnswer: true })
    expect({ ...updated, data: undefined }).toEqual({ ...questionAsset(), data: undefined })
  })

  it('з олівцем до кнопки доходить лише натискання — перемикаємо на ньому; клік мишею не подвоює', async () => {
    // Стенд 2026-10-06: з олівцем на кнопці лише pointerdown і mousedown — click не приходить.
    const w = mountQuestion({ canReveal: true })
    await reveal(w).trigger('pointerdown', { button: 0 })
    expect(w.emitted('update:asset')).toHaveLength(1)
    // той самий клік мишею (detail ≥ 1), якщо він таки дійде, — не друге перемикання
    await reveal(w).trigger('click', { detail: 1 })
    expect(w.emitted('update:asset')).toHaveLength(1)
    // права кнопка — не дія
    await reveal(w).trigger('pointerdown', { button: 2 })
    expect(w.emitted('update:asset')).toHaveLength(1)
  })

  it('клавіатура: Enter/Пробіл дають click без натискання (detail 0) — перемикає', async () => {
    const w = mountQuestion({ canReveal: true })
    await reveal(w).trigger('click', { detail: 0 })
    expect(w.emitted('update:asset')).toHaveLength(1)
  })

  it('без відповіді кнопки немає — відкривати нічого', () => {
    expect(reveal(mountQuestion({ canReveal: true }, { answer: '' })).exists()).toBe(false)
  })
})

describe('discussion_question · відкрито', () => {
  it('«Відповідь: …» і цитата-опора; учитель бачить «Сховати відповідь» і закриває', async () => {
    const w = mountQuestion({ canReveal: true }, { showAnswer: true })
    const answer = w.find('[data-testid="discussion-question-answer"]')
    expect(answer.text()).toContain(`Відповідь: ${ANSWER}`)
    expect(w.find('[data-testid="discussion-question-support"]').text()).toBe(SUPPORT)
    expect(reveal(w).text()).toBe(uk.winterboard.discussionQuestion.hide)
    await reveal(w).trigger('pointerdown', { button: 0 })
    const [[updated]] = w.emitted('update:asset') as WBAsset[][]
    expect((updated.data as { showAnswer: boolean }).showAnswer).toBe(false)
  })

  it('учень бачить відкриту відповідь, але кнопки не має', () => {
    const w = mountQuestion({ canReveal: false }, { showAnswer: true })
    expect(w.text()).toContain(ANSWER)
    expect(reveal(w).exists()).toBe(false)
  })

  it('без цитати — лише відповідь', () => {
    const w = mountQuestion({}, { showAnswer: true, support: '' })
    expect(w.find('[data-testid="discussion-question-support"]').exists()).toBe(false)
    expect(w.text()).toContain(ANSWER)
  })

  it('підпис — мовою матеріалу: англійське питання → «Answer»', () => {
    const w = mountQuestion({}, { showAnswer: true, content_language: 'en' })
    expect(w.find('[data-testid="discussion-question-answer"]').text()).toContain(`Answer: ${ANSWER}`)
  })
})

describe('discussion_question · експорт, висота, реєстр', () => {
  it('правий верхній кут — панелі вікна (INV-WIN-6): кнопка в потоці тексту, місце під панель у всіх', () => {
    // Стенд 2026-10-06: кнопка в куті опинялась під панеллю «A− A+ — ×» і не натискалась.
    for (const canReveal of [true, false]) {
      const p = mountQuestion({ canReveal }).find('[data-testid="discussion-question-text"]')
      expect(p.find('.discussion-question__controls-space').exists()).toBe(true)
      expect(p.find('[data-testid="discussion-question-reveal"]').exists()).toBe(canReveal)
    }
  })

  it('кнопки не потрапляють в експорт PNG/PDF', () => {
    const w = mountQuestion({ canReveal: true, isSelected: true })
    expect(reveal(w).attributes()).toHaveProperty('data-export-hide')
  })

  it('відкриття відповіді — привід переміряти висоту (INV-25)', async () => {
    const w = mountQuestion({ canReveal: true })
    const root = w.find('.discussion-question').element as HTMLElement
    const body = w.find('.discussion-question__body').element as HTMLElement
    const flow = w.find('.discussion-question__flow').element as HTMLElement
    let flowH = 40
    Object.defineProperty(root, 'offsetHeight', { get: () => 60, configurable: true })
    Object.defineProperty(body, 'clientHeight', { get: () => 60, configurable: true })
    flow.getBoundingClientRect = () => ({ height: flowH }) as DOMRect
    await w.setProps({ asset: questionAsset({ question: `${QUESTION} ` }) })
    await flushPromises()
    const before = (w.emitted('request-height') ?? []).length
    flowH = 160
    await w.setProps({ asset: questionAsset({ question: `${QUESTION} `, showAnswer: true }) })
    await flushPromises()
    const all = (w.emitted('request-height') ?? []) as number[][]
    expect(all.length).toBeGreaterThan(before)
    expect(all[all.length - 1][0]).toBe(160)
  })

  it('стандарт: картка-оверлей з авто-висотою, як картка теорії', () => {
    expect(assetCapabilities('discussion_question')).toEqual(assetCapabilities('theory_card'))
  })

  it('реєстр: кнопка лише вчителю в живому редагуванні; не в Replay і не в учня', () => {
    const entry = OVERLAY_RENDERERS.discussion_question
    const ctx = (over: Record<string, unknown>) => ({
      isSelected: () => false, interactive: true, canFit: true, isTutor: true, boardMode: 'edit', ...over,
    }) as never
    const asset = questionAsset()
    expect(entry.buildProps(asset, ctx({})).canReveal).toBe(true)
    expect(entry.buildProps(asset, ctx({ isTutor: false })).canReveal).toBe(false)
    expect(entry.buildProps(asset, ctx({ boardMode: 'replay' })).canReveal).toBe(false)
    // з олівцем (interactive=false) кнопка лишається — як кнопки шкали
    expect(entry.buildProps(asset, ctx({ interactive: false })).canReveal).toBe(true)
  })
})

describe('discussion_question · переклади', () => {
  it.each([['uk', uk], ['en', en], ['ru', ru]] as const)('%s: кнопка є; підпис у треї — uk/en', (l, dict) => {
    const dq = (dict as { winterboard: { discussionQuestion?: { show?: string; hide?: string } } }).winterboard.discussionQuestion
    expect(dq?.show && dq.show.length > 3).toBe(true)
    expect(dq?.hide && dq.hide.length > 3).toBe(true)
    if (l === 'ru') expect(`${dq?.show}${dq?.hide}`).not.toMatch(/[іїєґІЇЄҐ]/)
  })

  it('у треї згорнуте питання підписане «Питання», а не «Картка» (клас Б-119)', () => {
    expect(uk.winterboard.tray.kind.discussion_question).toBe('Питання')
    expect(en.winterboard.tray.kind.discussion_question).toBe('Question')
  })
})
