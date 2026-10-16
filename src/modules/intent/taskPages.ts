import type { WBPage } from '@/modules/winterboard/types/winterboard'

/** Перевірка ВСЬОГО набору до першої зміни дошки. */
export function validateTaskPages(raw: unknown): WBPage[] {
  if (!Array.isArray(raw) || !raw.length || raw.length > 50) throw new Error('Не отримав сторінок із задачами.')
  const ids = new Set<string>()
  for (const page of raw) {
    if (!page || typeof page.id !== 'string' || !page.id || ids.has(page.id)
      || !Array.isArray(page.assets) || !page.assets.length || page.assets.length > 600
      || !Array.isArray(page.strokes) || page.strokes.length) throw new Error('Некоректна добірка задач.')
    ids.add(page.id)
    for (const dimension of [page.width ?? 1920, page.height ?? 1080]) {
      if (!Number.isFinite(dimension) || dimension < 100 || dimension > 20000) throw new Error('Некоректний розмір сторінки.')
    }
    for (const asset of page.assets) {
      if (!asset || typeof asset.id !== 'string' || !asset.id || ids.has(asset.id)
        || !['nmt_task', 'theory_card'].includes(asset.type) || !asset.data
        || ![asset.x, asset.y, asset.w, asset.h].every(Number.isFinite)
        || asset.x < 0 || asset.y < 0 || asset.w <= 0 || asset.h <= 0
        || asset.x + asset.w > (page.width ?? 1920) || asset.y + asset.h > (page.height ?? 1080)) {
        throw new Error('Некоректна картка задачі.')
      }
      if (new TextEncoder().encode(JSON.stringify(asset)).length > 60000) {
        throw new Error('Картка завелика для збереження. Добірку не додано.')
      }
      ids.add(asset.id)
    }
  }
  return raw as WBPage[]
}
