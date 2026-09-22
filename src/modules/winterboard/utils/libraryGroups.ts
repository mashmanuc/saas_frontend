// Групування файлів «Матеріалів» за датою (візуальний розбір сторінки,
// 2026-09-22, п. 9): «Двадцять файлів в одній купі: N22_* за датами,
// НМТ-збірники і плани лежать поряд без жодного порядку».
//
// Дата береться з імені (у вчителів імена вже датовані: N22__17_06_26.png),
// інакше — дата створення файлу. Документи й збірники без дати в імені —
// окрема група в кінці: це довідковий матеріал, а не матеріал до уроку.

import type { LibraryAsset } from '../types/library'

export interface AssetGroup {
  key: string
  label: string
  items: LibraryAsset[]
}

export interface GroupLabels {
  thisWeek: string
  documents: string
}

const DAY = 24 * 60 * 60 * 1000

function validDate(y: number, m: number, d: number): Date | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(y, m - 1, d)
  return dt.getMonth() === m - 1 ? dt : null
}

/** Дата з імені: 17_06_26, 17.06.2026, 17-06-26, 2026-06-17. Немає — null. */
export function dateFromName(name: string): Date | null {
  const iso = /(?:^|\D)(20\d{2})[-_.](\d{1,2})[-_.](\d{1,2})(?!\d)/.exec(name)
  if (iso) return validDate(+iso[1], +iso[2], +iso[3])
  const dmy = /(?:^|\D)(\d{1,2})[-_.](\d{1,2})[-_.](\d{2}|\d{4})(?!\d)/.exec(name)
  if (dmy) {
    const y = dmy[3].length === 2 ? 2000 + +dmy[3] : +dmy[3]
    return validDate(y, +dmy[2], +dmy[1])
  }
  return null
}

const DOC_RE = /\.(pdf|docx?|pptx?|xlsx?|odt|txt)$/i

function isDocument(a: LibraryAsset): boolean {
  const ct = a.content_type || ''
  return DOC_RE.test(a.name) || ct === 'application/pdf' || ct.includes('word') || ct.includes('presentation')
}

function monthLabel(d: Date, locale: string): string {
  const m = new Intl.DateTimeFormat(locale, { month: 'long' }).format(d)
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${d.getFullYear()}`
}

/**
 * Групи в порядку показу: «Цього тижня», місяці від нових до старих,
 * «Документи й збірники». Усередині групи — від нових до старих.
 */
export function groupAssets(
  assets: LibraryAsset[],
  opts: { locale: string; labels: GroupLabels; now?: Date },
): AssetGroup[] {
  const now = (opts.now ?? new Date()).getTime()
  const dated: Array<{ a: LibraryAsset; d: Date }> = []
  const docs: LibraryAsset[] = []

  for (const a of assets) {
    const fromName = dateFromName(a.name)
    if (fromName) { dated.push({ a, d: fromName }); continue }
    if (isDocument(a)) { docs.push(a); continue }
    const created = new Date(a.created_at)
    if (Number.isFinite(created.getTime())) dated.push({ a, d: created })
    else docs.push(a)
  }

  dated.sort((x, y) => y.d.getTime() - x.d.getTime())
  const groups = new Map<string, AssetGroup>()
  for (const { a, d } of dated) {
    const age = now - d.getTime()
    const recent = age >= -DAY && age < 7 * DAY
    const key = recent ? 'week' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = recent ? opts.labels.thisWeek : monthLabel(d, opts.locale)
    if (!groups.has(key)) groups.set(key, { key, label, items: [] })
    groups.get(key)!.items.push(a)
  }
  const out = [...groups.values()]
  if (docs.length) out.push({ key: 'documents', label: opts.labels.documents, items: docs })
  return out
}
