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

/**
 * Картка «Домашнє завдання» на дошці — текстова картка зі списком задач (`data.items`; списком більше жодна картка
 * не рендериться). Це аркуш для учня, а не задача на уроці: на ній лише «📋 Скопіювати картинку» — без ✍ 💡 ⚠ і
 * без «A− 100% A+ ×» (власник 2026-10-20: «кнопки на кучу позлипались… на домашку не ліпити, там тільки скопіювати»).
 */
export function isHomeworkCardData(data: unknown): boolean {
  const items = (data as { items?: unknown } | null | undefined)?.items
  return Array.isArray(items) && items.length > 0
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
/**
 * Вигляд останньої сторінки уроку — колір і візерунок (власник 20.10: «остання дошка мала би мати колір… такі саме, як
 * попередні»). Фото чи PDF у фоні не копіюються — це вміст, а не вигляд (як `addPageUndoable({ inheritLook })`).
 */
export function lastPageLook(pages: readonly { background?: unknown; backgroundColor?: string }[]): PageLook {
  const last = pages[pages.length - 1]
  return {
    background: typeof last?.background === 'string' ? last.background : 'white',
    backgroundColor: typeof last?.backgroundColor === 'string' && last.backgroundColor ? last.backgroundColor : '#ffffff',
  }
}

export interface PageLook { background: string; backgroundColor: string }

export function homeworkPage(proposal: HomeworkProposal, look?: PageLook): WBPage {
  const items = proposal.items.map(item => item.short || item.text)
  const instruction = (proposal.instruction || '').trim()
  const lesson = (proposal.lesson || '').trim()
  return {
    id: uid(),
    name: HOMEWORK_TITLE,
    ...(look ? { background: look.background, backgroundColor: look.backgroundColor } : {}),
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
