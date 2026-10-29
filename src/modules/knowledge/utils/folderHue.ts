/**
 * Колір папки уроків (макет Поли «Мої уроки», 29.10): у моделі папки кольору немає — стала палітра за id.
 * Той самий відтінок у списку папок (квадратик) і на обкладинці уроку з цієї папки.
 */
const PALETTE = [160, 28, 200, 265, 340, 45, 185, 10]

export function folderHue(id: string): number {
  let h = 7
  for (const ch of id) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/** «Урок: Неповні квадратні рівняння(3)» → назва без «Урок:» і без частини; частина — окремо («ч. 3»). */
const LESSON_PREFIX = /^\s*(?:урок|lesson)\s*[:.—-]\s*/i
const PART_SUFFIX = /\s*\((\d{1,2})\)\s*$/

export function lessonTitleParts(title: string | null | undefined): { title: string; part: string | null } {
  const raw = (title ?? '').trim()
  const part = raw.match(PART_SUFFIX)?.[1] ?? null
  const clean = raw.replace(LESSON_PREFIX, '').replace(PART_SUFFIX, '').trim()
  return { title: clean || raw, part }
}
