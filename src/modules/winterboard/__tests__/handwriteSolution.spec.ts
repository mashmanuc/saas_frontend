// LAW §9 v1.29 · розв'язок задачі рукою: місце біля задачі, письмо в темпі руки, один «Скасувати»,
// зупинка при зміні сторінки/дошки, чесні відмови. Мережі й стору немає — підставні залежності.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  HANDWRITE_INK, HANDWRITE_MIN_W, LAYOUT_MAX_H, LAYOUT_MAX_W, answerTextOf, freeAreaFrom, hasHandwritableSolution,
  isIntegralykSolvable, occupiedRects, wholePageArea, writingAreasNear,
} from '../board/handwriteSolution'
import { cardWindowActions } from '../board/windowActions'

vi.mock('@/utils/notify', () => ({ notifyError: vi.fn(), notifyInfo: vi.fn(), notifyWarning: vi.fn() }))
vi.mock('@/i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))
vi.mock('@/modules/intent/assistantLook', () => ({ tAssistantGlobal: (k: string) => `assistant:${k}` }))

const TASK = {
  id: 'task-1', type: 'nmt_task', x: 60, y: 60, w: 800, h: 500,
  data: {
    solution: 'Маємо $x + 2 = 5$, отже $x = 3$.',
    options: [{ letter: 'А', isCorrect: false }, { letter: 'Б', isCorrect: true }],
  },
}

// ─── чиста логіка ───────────────────────────────────────────────────────────

describe('board/handwriteSolution', () => {
  it('є що писати — лише задача з непорожнім розв\'язком', () => {
    expect(hasHandwritableSolution(TASK)).toBe(true)
    expect(hasHandwritableSolution({ ...TASK, data: { solution: '  ' } })).toBe(false)
    expect(hasHandwritableSolution({ ...TASK, type: 'theory_card' })).toBe(false)
    expect(hasHandwritableSolution(null)).toBe(false)
  })

  it('відповідь: букви правильних варіантів, інакше correctAnswer, інакше порожньо', () => {
    expect(answerTextOf(TASK.data)).toBe('Б')
    expect(answerTextOf({ options: [{ letter: 'А', isCorrect: true }, { letter: 'В', isCorrect: true }] })).toBe('А, В')
    expect(answerTextOf({ correctAnswer: 12 })).toBe('12')
    expect(answerTextOf({ pairs: [{ left: '$145$', right: 'на 5' }, { left: '$96$', right: 'на 2' }] }))
      .toBe('$145$ — на 5; $96$ — на 2')
    expect(answerTextOf({})).toBe('')
  })

  it('зайняте місце — і об\'єкти, і штрихи пера', () => {
    const rects = occupiedRects({
      assets: [{ x: 10, y: 20, w: 30, h: 40 }, { x: 0, y: 0, w: 0, h: 0 }],
      strokes: [{ size: 4, points: [{ x: 100, y: 100 }, { x: 150, y: 120 }] }],
    })
    expect(rects).toEqual([{ x: 10, y: 20, w: 30, h: 40 }, { x: 98, y: 98, w: 54, h: 24 }])
  })

  it('вільна область обрізається перешкодою, а не налазить на неї', () => {
    const area = freeAreaFrom(900, 60, [{ x: 1500, y: 0, w: 300, h: 1080 }], 1920, 1080)!
    expect(area.x).toBe(900)
    expect(area.x + area.w).toBeLessThanOrEqual(1500)
    expect(area.w).toBeGreaterThanOrEqual(HANDWRITE_MIN_W)
    expect(freeAreaFrom(900, 60, [{ x: 880, y: 40, w: 100, h: 100 }], 1920, 1080)).toBeNull()
  })

  it('біля задачі: спершу праворуч, тоді під нею; рукопис учителя теж перешкода', () => {
    const areas = writingAreasNear(TASK, occupiedRects({ assets: [TASK] }), 1920, 1080)
    expect(areas[0].x).toBe(TASK.x + TASK.w + 40)
    expect(areas[1].y).toBe(TASK.y + TASK.h + 40)
    const busy = occupiedRects({ assets: [TASK], strokes: [{ size: 2, points: [{ x: 900, y: 0 }, { x: 1900, y: 1080 }] }] })
    const only = writingAreasNear(TASK, busy, 1920, 1080)
    expect(only.every((a) => a.x + a.w <= 900 || a.y > 1080)).toBe(true)
  })

  it('сторінка вища за аркуш (добірка задач, 18.10) — область не більша, ніж розкладає сервер', () => {
    expect(freeAreaFrom(60, 480, [], 1920, 2120)).toEqual({ x: 60, y: 480, w: 1820, h: LAYOUT_MAX_H })
    expect(freeAreaFrom(40, 40, [], 4000, 1080)!.w).toBe(LAYOUT_MAX_W)
    expect(wholePageArea(1920, 2120)).toEqual({ x: 40, y: 40, w: 1840, h: LAYOUT_MAX_H })
    expect(wholePageArea(1920, 1080)).toEqual({ x: 40, y: 40, w: 1840, h: 1000 })
  })
})

// Письмо (✍ — кроки з позначками, темп за годинником, дописування обірваного) — у handwriteSteps.spec.ts
// (LAW §9 v1.34: старий шлях «увесь розв'язок одним блоком» прибрано).

// ─── хто бачить ✍ ───────────────────────────────────────────────────────────

describe('✍ у групі дій картки', () => {
  const TEACHER = { isTutor: true, mode: 'edit' }
  it('лише вчитель, режим редагування, задача з розв\'язком', () => {
    expect(cardWindowActions(TASK as any, TEACHER).handwrite).toBe(true)
    expect(cardWindowActions(TASK as any, { isTutor: false, mode: 'edit' }).handwrite).toBe(false)
    expect(cardWindowActions(TASK as any, { isTutor: true, mode: 'replay' }).handwrite).toBe(false)
    expect(cardWindowActions(TASK as any, { isTutor: true, mode: 'readonly' }).handwrite).toBe(false)
    expect(cardWindowActions({ ...TASK, data: {} } as any, TEACHER).handwrite).toBe(false)
  })
})

// ─── етап 1: розв'язує Інтегралик ───────────────────────────────────────────

const PDF_CUT = { id: 'pdffrag-1', type: 'image', src: 'https://cdn.m4sh.org/wb/cut.png', x: 60, y: 60, w: 700, h: 300 }
const OPEN_TASK = { id: 'task-2', type: 'nmt_task', x: 60, y: 60, w: 800, h: 500, data: { question: 'Знайдіть $x$' } }
const CARD = { id: 'card-1', type: 'theory_card', x: 60, y: 60, w: 600, h: 300, data: { title: 'Задача', body: '$3x = 12$' } }

describe('що може розв\'язати Інтегралик', () => {
  it('задача, картка, картинка з адресою; data:/blob: і решта — ні', () => {
    expect(isIntegralykSolvable(PDF_CUT)).toBe(true)
    expect(isIntegralykSolvable(OPEN_TASK)).toBe(true)
    expect(isIntegralykSolvable(CARD)).toBe(true)
    expect(isIntegralykSolvable({ ...PDF_CUT, src: 'data:image/png;base64,AAA' })).toBe(false)
    expect(isIntegralykSolvable({ ...PDF_CUT, src: 'blob:https://m4sh.org/x' })).toBe(false)
    expect(isIntegralykSolvable({ type: 'sticky' })).toBe(false)
    expect(isIntegralykSolvable(null)).toBe(false)
  })

  it('✍ у групі дій картки: картка без розв\'язку — лише з дозволом кімнати (Інтегралик)', () => {
    const teacher = { isTutor: true, mode: 'edit' }
    expect(cardWindowActions(CARD as any, teacher).handwrite).toBe(false)
    expect(cardWindowActions(CARD as any, { ...teacher, canSolve: true }).handwrite).toBe(true)
    expect(cardWindowActions(OPEN_TASK as any, { ...teacher, canSolve: true }).handwrite).toBe(true)
    expect(cardWindowActions(PDF_CUT as any, { ...teacher, canSolve: true }).handwrite).toBe(true)
    expect(cardWindowActions(PDF_CUT as any, teacher).handwrite).toBe(false)
    expect(cardWindowActions({ ...PDF_CUT, src: 'blob:x' } as any, { ...teacher, canSolve: true }).handwrite).toBe(false)
    expect(cardWindowActions(CARD as any, { isTutor: true, mode: 'replay', canSolve: true }).handwrite).toBe(false)
    expect(cardWindowActions(CARD as any, { isTutor: false, mode: 'edit', canSolve: true }).handwrite).toBe(false)
  })

  it("позначка Інтегралика на ✍ — лише коли розв'язуватиме він (власник 18.10)", () => {
    const solver = { isTutor: true, mode: 'edit', canSolve: true }
    expect(cardWindowActions(PDF_CUT as any, solver).handwriteSolves).toBe(true)
    expect(cardWindowActions(CARD as any, solver).handwriteSolves).toBe(true)
    expect(cardWindowActions(OPEN_TASK as any, solver).handwriteSolves).toBe(true)
    // Готовий розв'язок банку — без позначки, і з правом Інтегралика, і без нього.
    expect(cardWindowActions(TASK as any, solver)).toMatchObject({ handwrite: true, handwriteSolves: false })
    expect(cardWindowActions(TASK as any, { isTutor: true, mode: 'edit' }).handwriteSolves).toBe(false)
    expect(cardWindowActions(PDF_CUT as any, { isTutor: true, mode: 'edit' }).handwriteSolves).toBe(false)
    expect(cardWindowActions(PDF_CUT as any, { ...solver, mode: 'replay' }).handwriteSolves).toBe(false)
  })
})

describe('✍ лише там, де може бути задача (власник 19.10)', () => {
  const theory = (preset?: string) => ({ ...CARD, data: { ...CARD.data, ...(preset === undefined ? {} : { preset }) } })

  it('текстова картка: без позначки й «Приклад» — так; підказка, типова помилка й теорія — ні', () => {
    expect(isIntegralykSolvable(theory())).toBe(true)
    expect(isIntegralykSolvable(theory(''))).toBe(true)
    expect(isIntegralykSolvable(theory('example'))).toBe(true)
    for (const p of ['tip', 'common mistake', 'definition', 'rule', 'proof', 'remember', 'life example', 'algorithm', 'summary']) {
      expect(isIntegralykSolvable(theory(p)), p).toBe(false)
    }
  })

  it('невідома позначка — без руки, доки її не додали до переліку', () => {
    expect(isIntegralykSolvable(theory('quiz'))).toBe(false)
  })
})
