// «⚡ Швидка вирізка фрагмента» (власник 2026-10-13): обвели на вікні документа → фрагмент одразу на дошці,
// без вікна й підтверджень. Сервер, місце на дошці й охорона «та сама сторінка» — ті самі, що в «Вирізці фрагмента».
import type { PdfFragmentResult } from '../../api/library'
import type { FragRect, FragmentContext } from './pdfFragmentRect'
import { fragmentErrorKey } from './pdfFragmentRect'

export interface QuickCutDeps {
  cut: (args: {
    contentItem: number; page: number; rect: FragRect; board: string; viewer: string
  }) => Promise<PdfFragmentResult>
  /** Дошка й сторінка ЗАРАЗ — викликається один раз, у момент відпускання рамки */
  snapshot: () => FragmentContext
  place: (ctx: FragmentContext, res: PdfFragmentResult, rect: FragRect) => 'placed' | 'not_placed'
  /** Сказати словами (без вікон): вирізати не вдалося / файл є, але не поставлено */
  notify: (kind: 'cut_failed' | 'not_placed', detail: { reasonKey?: string; name?: string }) => void
}

export type QuickCutOutcome = 'placed' | 'not_placed' | 'failed'

/** Один запит, без автоповторів; місце — запамʼятоване ДО запиту. */
export async function runQuickCut(
  deps: QuickCutDeps,
  args: { contentItem: number; page: number; rect: FragRect; viewer: string },
): Promise<QuickCutOutcome> {
  const ctx = deps.snapshot()
  let res: PdfFragmentResult
  try {
    res = await deps.cut({ contentItem: args.contentItem, page: args.page, rect: args.rect, board: ctx.boardId, viewer: args.viewer })
  } catch (err) {
    deps.notify('cut_failed', { reasonKey: fragmentErrorKey(err) })
    return 'failed'
  }
  if (deps.place(ctx, res, args.rect) === 'placed') return 'placed'
  deps.notify('not_placed', { name: res.name })
  return 'not_placed'
}
