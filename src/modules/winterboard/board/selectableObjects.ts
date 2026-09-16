/**
 * TLV2-05B.1 · які об'єкти сторінки доступні для виділення й групових дій.
 *
 * ЧОМУ ЦЕЙ ФАЙЛ ІСНУЄ
 *
 * Згорнута в трей картка не малюється на полотні, але лишається в `page.assets[]`.
 * Якщо вона потрапить у виділення, групове переміщення зсуне її невидимо — і після
 * відновлення картка з'явиться не там, де її згорнули. У 05B фільтр був вписаний
 * вручну лише в solo-Ctrl+A і рамку; класна кімната мала власний Ctrl+A без фільтра.
 *
 * Тепер правило одне, і його кличуть усі входи: Ctrl+A обох кімнат, рамка,
 * групове переміщення й запис позицій.
 *
 * Штрихи виділяються як і раніше: згортання стосується лише карток.
 */
import type { WBAsset, WBStroke, WBToolType } from '../types/winterboard'
import { isMinimizedOnBoard } from './objectStandard'

/** Чи можна виділити картку й рухати її груповими діями. */
export function isAssetSelectable(asset: WBAsset | null | undefined): boolean {
  return !!asset && !isMinimizedOnBoard(asset)
}

/** Id об'єктів сторінки, доступних для виділення: усі штрихи й незгорнуті картки. */
export function selectableIdsOnPage(page: {
  strokes: readonly WBStroke[]
  assets: readonly WBAsset[]
}): string[] {
  return [
    ...page.strokes.map(s => s.id),
    ...page.assets.filter(isAssetSelectable).map(a => a.id),
  ]
}

interface SelectAllStore {
  currentPage: { strokes: WBStroke[]; assets: WBAsset[] } | null | undefined
  selectedIds: string[]
  setTool(tool: WBToolType): void
}

/** Ctrl+A — спільний для solo й класної кімнати. */
export function selectAllOnCurrentPage(store: SelectAllStore): void {
  const page = store.currentPage
  if (!page) return
  store.selectedIds = selectableIdsOnPage(page)
  store.setTool('select' as WBToolType)
}
