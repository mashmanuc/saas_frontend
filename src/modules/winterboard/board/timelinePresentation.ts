/**
 * Підписи й форматування для шкали та карти (H2–H3).
 *
 * ЧОМУ НЕ vue-i18n. Він дає локаль ІНТЕРФЕЙСУ, а тут потрібна мова
 * МАТЕРІАЛУ: англомовна шкала в українському інтерфейсі не має підписуватись
 * «Далі». Той самий принцип, що в підвалі джерел H0, і те саме дзеркало
 * `material_labels.py` на бекенді.
 *
 * Формат дати показує ЗАЯВЛЕНУ точність. «1917» і «17 березня 1917» — різні
 * твердження; добудувати перше до другого означає вигадати точність, якої в
 * джерелі немає.
 */
import type { WBTimelineDate } from '../types/winterboard'

export type MaterialLanguage = 'uk' | 'en'

export const TIMELINE_LABELS: Record<MaterialLanguage, {
  untitled: string; empty: string; prev: string; next: string
  learn: string; quiz: string; play: string; pause: string; participants: string; stage: string
  progress: string; question: string; right: string; answer: string; score: string
  more: string; less: string; articleLang: Record<'uk' | 'en', string>
}> = {
  uk: {
    untitled: 'Шкала подій', empty: 'Подій ще немає', prev: 'Попередня', next: 'Наступна',
    learn: 'Стрічка', quiz: 'Перевір себе', play: 'Розповідати по черзі', pause: 'Зупинити',
    participants: 'Учасники', stage: 'Етап', progress: 'Подія {n} з {m}',
    question: 'У якому році (або роках)?', right: 'Правильно!', answer: 'Правильна відповідь: {d}',
    score: '{ok} з {all}', more: 'далі', less: 'згорнути',
    articleLang: { en: 'Стаття лише англійською', uk: 'Стаття лише українською' },
  },
  en: {
    untitled: 'Timeline', empty: 'No events yet', prev: 'Previous', next: 'Next',
    learn: 'Timeline', quiz: 'Test yourself', play: 'Tell one by one', pause: 'Stop',
    participants: 'Participants', stage: 'Stage', progress: 'Event {n} of {m}',
    question: 'In what year (or years)?', right: 'Correct!', answer: 'Correct answer: {d}',
    score: '{ok} of {all}', more: 'more', less: 'less',
    articleLang: { en: 'Article in English only', uk: 'Article in Ukrainian only' },
  },
}

export const MAP_LABELS: Record<MaterialLanguage, {
  untitled: string; empty: string; modernBasemap: string; noCoordinates: string
  zoomIn: string; zoomOut: string
}> = {
  uk: {
    untitled: 'Карта подій',
    empty: 'Місць ще немає',
    // ТЗ §7.2: якщо події показані на сучасній основі, UI мусить це сказати
    // прямо. Мовчазна сучасна карта під історичними подіями — неправда.
    modernBasemap: 'Сучасна картографічна основа',
    noCoordinates: 'Координат немає',
    zoomIn: 'Збільшити карту',
    zoomOut: 'Зменшити карту',
  },
  en: {
    untitled: 'Event map',
    empty: 'No places yet',
    modernBasemap: 'Modern map base',
    noCoordinates: 'No coordinates',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
  },
}

export const SOURCE_LIST_LABELS: Record<MaterialLanguage, {
  sources: string; author: string; license: string; revision: string; retrieved: string
}> = {
  uk: { sources: 'Джерела', author: 'Автор', license: 'Ліцензія', revision: 'Версія', retrieved: 'Отримано' },
  en: { sources: 'Sources', author: 'Author', license: 'License', revision: 'Revision', retrieved: 'Retrieved' },
}

const MONTHS: Record<MaterialLanguage, string[]> = {
  uk: ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
       'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'],
  en: ['January', 'February', 'March', 'April', 'May', 'June',
       'July', 'August', 'September', 'October', 'November', 'December'],
}

/** Одна дата з заявленою точністю. Порожньо — показувати нічого. */
export function formatOneDate(date: WBTimelineDate | null | undefined,
                              language: MaterialLanguage = 'uk'): string {
  if (!date || typeof date.year !== 'number') return ''
  const year = String(date.year)
  if (date.precision === 'decade') return language === 'uk' ? `${year}-ті` : `${year}s`
  if (date.precision === 'day' && date.month && date.day) {
    const month = MONTHS[language][date.month - 1] ?? ''
    return language === 'uk' ? `${date.day} ${month} ${year}` : `${month} ${date.day}, ${year}`
  }
  if ((date.precision === 'month' || date.precision === 'day') && date.month) {
    const month = MONTHS[language][date.month - 1] ?? ''
    return language === 'uk' ? `${month} ${year}` : `${month} ${year}`
  }
  return year
}

/** Подія-точка або період. Кінець без початку не буває — це не період. */
export function formatTimelineDate(start: WBTimelineDate | null | undefined,
                                   end: WBTimelineDate | null | undefined,
                                   language: MaterialLanguage = 'uk'): string {
  const from = formatOneDate(start, language)
  if (!from) return ''
  const to = formatOneDate(end, language)
  return to ? `${from} — ${to}` : from
}

/** Дзеркало `WEB_URL_RE` (boardActions) і `is_web_url` (BE). Останній рубіж
 *  перед `href`: стара картка могла прийти з чим завгодно. */
const WEB_URL = /^https?:\/\/.+/i
export const isWebUrl = (url: unknown): boolean =>
  typeof url === 'string' && WEB_URL.test(url.trim())

/** Дата показується, лише якщо вона справді дата. Зіпсований `retrieved_at`
 *  не має ні ламати картку, ні малювати обрізане сміття. */
export function retrievedDay(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? '' : new Date(ts).toISOString().slice(0, 10)
}
