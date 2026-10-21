/**
 * Вибір теми «За класом» (власник 2026-10-21: «зовсім незручно для користувача шукати тему від конкретного учня.
 * Йому треба по класах, або по темах, або пошук»; макет дизайнера «Вибір теми», варіант D).
 *
 * Дані — розділи шкільної програми з реєстру на бекенді (`curriculum.ts`, згенеровано), а не список дизайнера:
 * той вів «Десяткові дроби» у широкі «Дійсні числа». Урок будується про ОДНУ тему конструктора, тож розділ,
 * що охоплює кілька тем, просить уточнити «про що саме» (28 з 56 розділів на 2026-10-21).
 */
import { CURRICULUM, GRADES, TRACK_LABELS } from './curriculum'

export type Grade = (typeof GRADES)[number]
export type Track = keyof typeof TRACK_LABELS
/** Що показано під рядком класів: клас або всі теми НМТ (нинішнє дерево з пошуком). */
export type TopicView = Grade | 'nmt'

export interface GradeUnit {
  /** Номер розділу в курсі — як у календарному плані. */
  no: number
  title: string
  /** Теми конструктора, на які розділ веде, без повторів назв. Одна — вибір одразу, кілька — уточнення. */
  topics: string[]
}

export interface GradeTrack {
  track: Track
  label: string
  units: GradeUnit[]
}

/** Порядок курсів у класі: 5–6 — одна «Математика», 7–11 — алгебра, потім геометрія. */
const TRACK_ORDER: readonly Track[] = ['math', 'algebra', 'geometry']

/**
 * Розділи класу за курсами, у порядку програми. Теми, яких конструктор не знає (`labels`), відкидаються, а розділ
 * без жодної — не показується: кнопка, що нікуди не веде, гірша за її відсутність.
 */
export function gradeTracks(grade: Grade, labels: Readonly<Record<string, string>>): GradeTrack[] {
  return TRACK_ORDER.flatMap((track) => {
    const units = CURRICULUM.filter((u) => u.grade === grade && u.track === track)
      .map((u, i) => ({ no: i + 1, title: u.title, topics: distinctByLabel(u.topics, labels) }))
      .filter((u) => u.topics.length > 0)
    return units.length ? [{ track, label: TRACK_LABELS[track], units }] : []
  })
}

function distinctByLabel(ids: readonly string[], labels: Readonly<Record<string, string>>): string[] {
  const seen = new Set<string>()
  return ids.filter((id) => {
    const label = labels[id]
    if (!label || seen.has(label)) return false
    seen.add(label)
    return true
  })
}

/** Пошук у класі: за назвою розділу або за назвою будь-якої з його тем, без огляду на регістр. */
export function filterUnits(units: GradeUnit[], query: string, labels: Readonly<Record<string, string>>): GradeUnit[] {
  const q = query.trim().toLowerCase()
  if (!q) return units
  return units.filter((u) => u.title.toLowerCase().includes(q)
    || u.topics.some((id) => (labels[id] ?? '').toLowerCase().includes(q)))
}

/** Пошук серед усіх тем НМТ: збіги за назвою, у порядку дерева. */
export function searchTopics<T extends { value: string; label: string }>(topics: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  return q ? topics.filter((t) => t.label.toLowerCase().includes(q)) : []
}

const VIEW_KEY = 'lc.topicView'

/** Останній вибір учителя (клас чи НМТ) — зручність одного браузера; немає чи зламано — нічого не обрано. */
export function loadTopicView(): TopicView | null {
  try {
    const raw = localStorage.getItem(VIEW_KEY)
    if (raw === 'nmt') return 'nmt'
    const n = Number(raw)
    return (GRADES as readonly number[]).includes(n) ? (n as Grade) : null
  } catch {
    return null   // приватне вікно чи заборонене сховище — просто без пам'яті
  }
}

export function saveTopicView(view: TopicView): void {
  try {
    localStorage.setItem(VIEW_KEY, String(view))
  } catch {
    // без сховища вибір просто не запам'ятається — показ від цього не залежить
  }
}
