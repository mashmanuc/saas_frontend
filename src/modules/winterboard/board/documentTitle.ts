/**
 * Шапка картки документа на дошці (власник 2026-09-28, «так»): назва файлу — та сама, що в
 * «Сценарії» на пульті (з 2026-09-28 документ зберігає назву матеріалу); без назви — вид
 * документа мовою інтерфейсу, а не вписане в код англійське «Presentation».
 */

export type DocumentKind = 'presentation' | 'document' | 'pdf'

/** Вид документа за `content_ref.content_type`; невідомий чи порожній — PDF (як було). */
export function documentKind(asset: { content_ref?: { content_type?: string } | null }): DocumentKind {
  const ct = asset.content_ref?.content_type
  return ct === 'presentation' ? 'presentation' : ct === 'document' ? 'document' : 'pdf'
}

/** Текст шапки: назва файлу, інакше `winterboard.documentViewer.<вид>`. */
export function documentHeaderText(
  asset: { title?: unknown; content_ref?: { content_type?: string } | null },
  t: (key: string) => string,
): string {
  const title = typeof asset.title === 'string' ? asset.title.trim() : ''
  return title || t(`winterboard.documentViewer.${documentKind(asset)}`)
}
