/**
 * «Запропонувати домашку» (власник 2026-10-19). Домашка — НЕ робота на дошці: список задач, який учитель
 * скидає учневі. На дошку вона потрапляє лише за бажанням («Додати в урок») — ОДНІЄЮ карткою-списком на новій
 * останній сторінці, щоб її було видно в записі уроку й у «Моїх уроках» учня.
 * План: `saas_docs/domains/intent/HOMEWORK_FROM_LESSON_2026-10-19.md`.
 */
import type { WBPage } from '../types/winterboard'

export const HOMEWORK_TITLE = 'Домашнє завдання'

export interface HomeworkItem { id: string; text: string; short?: string; answer: string }

export interface HomeworkProposal {
  title: string
  lesson: string
  /** Спільна вказівка один раз угорі («Обчисліть. Скоротіть дріб…»); порожньо — рядки повні. */
  instruction?: string
  date?: string
  items: HomeworkItem[]
  copy_text: string
  task_count: number
  requested: number
  message: string
}

/** Задачі банку на уроці — без них домашку нема з чого складати (кнопки немає). */
export function lessonHasBankTasks(pages: readonly { assets?: readonly { type?: string; data?: unknown }[] }[]): boolean {
  return pages.some(page => (page.assets || []).some(asset => asset.type === 'nmt_task'
    && typeof (asset.data as { externalId?: unknown } | undefined)?.externalId === 'string'
    && Boolean((asset.data as { externalId: string }).externalId)))
}

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `hw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/**
 * Сторінка «Домашнє завдання» з однією карткою-списком. `items` — рядки списку (картка показує їх нумерованим
 * списком); `body` — той самий список текстом для тих, хто списку не вміє (PDF, старі клієнти). Відповідей на
 * картці немає: їх бачить лише вчитель у вікні пропозиції.
 */
export function homeworkPage(proposal: HomeworkProposal): WBPage {
  const items = proposal.items.map(item => item.short || item.text)
  const instruction = (proposal.instruction || '').trim()
  const lesson = (proposal.lesson || '').trim()
  return {
    id: uid(),
    name: HOMEWORK_TITLE,
    width: 1920,
    height: 1080,
    strokes: [],
    assets: [{
      id: uid(),
      type: 'theory_card',
      src: '',
      x: 60,
      y: 60,
      w: 1200,
      // Початкова висота; далі картка сама підганяє висоту під список (штатна авто-висота).
      h: Math.min(960, 140 + 56 * items.length),
      rotation: 0,
      locked: false,
      data: {
        version: 1,
        badge: HOMEWORK_TITLE,
        title: lesson || HOMEWORK_TITLE,
        body: [instruction, ...items.map((text, i) => `${i + 1}. ${text}`)].filter(Boolean).join('\n'),
        instruction,
        ...(proposal.date ? { date: proposal.date } : {}),
        items,
        // Які задачі банку вже дали домашкою — наступна пропозиція їх не повторить (сервер читає це поле).
        taskIds: proposal.items.map(item => item.id),
        formulas: [],
      },
    }],
  } as unknown as WBPage
}
