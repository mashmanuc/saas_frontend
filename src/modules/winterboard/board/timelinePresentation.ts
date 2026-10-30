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
  kind: string; earlier: string; later: string; after: string; same: string
  first: string; last: string; start: string; end: string
}> = {
  uk: {
    untitled: 'Шкала подій', empty: 'Подій ще немає', prev: 'Попередня', next: 'Наступна',
    learn: 'Стрічка', quiz: 'Перевір себе', play: 'Розповідати по черзі', pause: 'Зупинити',
    participants: 'Учасники', stage: 'Етап', progress: 'Подія {n} з {m}',
    question: 'У якому році (або роках)?', right: 'Правильно!', answer: 'Правильна відповідь: {d}',
    score: '{ok} з {all}', more: 'Читати далі', less: 'Згорнути',
    articleLang: { en: 'Стаття лише англійською', uk: 'Стаття лише українською' },
    kind: 'Вид події', earlier: '{n} тому', later: 'через {n}', after: 'через {n} після «{e}»', same: 'одночасно',
    first: 'Це перша подія', last: 'Це остання подія', start: 'Початок шкали', end: 'Кінець шкали',
  },
  en: {
    untitled: 'Timeline', empty: 'No events yet', prev: 'Previous', next: 'Next',
    learn: 'Timeline', quiz: 'Test yourself', play: 'Tell one by one', pause: 'Stop',
    participants: 'Participants', stage: 'Stage', progress: 'Event {n} of {m}',
    question: 'In what year (or years)?', right: 'Correct!', answer: 'Correct answer: {d}',
    score: '{ok} of {all}', more: 'Read more', less: 'Show less',
    articleLang: { en: 'Article in English only', uk: 'Article in Ukrainian only' },
    kind: 'Kind of event', earlier: '{n} earlier', later: '{n} later', after: '{n} after «{e}»', same: 'at the same time',
    first: 'This is the first event', last: 'This is the last event', start: 'Start of the timeline',
    end: 'End of the timeline',
  },
}

/** «43 роки», «1 рік», «12 років» / «43 years» — проміжок між датами джерела, нічого не вигадано. */
export function yearsText(n: number, language: MaterialLanguage): string {
  if (language === 'en') return `${n} ${n === 1 ? 'year' : 'years'}`
  const word = n % 10 === 1 && n % 100 !== 11 ? 'рік'
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'роки' : 'років'
  return `${n} ${word}`
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

/** Історична карта (кордони в часі) — тексти за макетом дизайнера 30.10 («Картка на дошці», «На весь екран»). */
export const HISTORICAL_MAP_LABELS: Record<MaterialLanguage, {
  bordersAt: string; bordersAtFull: string; onMap: string; changed: string; added: string
  noData: string; disputed: string; noDataTip: string; noDataTip2: string
  tipChanged: string; tipAdded: string; tipAt: string
  first: string; since: string; changedList: string; addedList: string; goneList: string; none: string
  prev: string; next: string; play: string; pause: string; unavailable: string; attribution: string
  /** v1.78 — об'ємна карта: камера цього екрана */
  tilt: string; flat: string; overview: string; zoomIn: string; zoomOut: string
  /** v1.80 — персонажі й пояснення події */
  people: string; participant: string; participantEvent: string; commander: string; eventN: string; hideInfo: string; showInfo: string
}> = {
  uk: {
    bordersAt: 'Межі на', bordersAtFull: 'Межі держав на', onMap: 'На карті у {y} році',
    changed: 'межі змінилися', added: 'зʼявилася',
    noData: 'Немає даних', disputed: 'Спірні / приблизні межі',
    noDataTip: 'Немає даних про кордони', noDataTip2: 'Карта тут нічого не домальовує',
    tipChanged: 'межі змінилися з {y}', tipAdded: 'зʼявилася в даних у {y}', tipAt: 'межі на {y} р.',
    first: 'Перший знімок. Натисніть → або «По черзі», щоб побачити, як змінювалися межі.',
    since: 'Від {y} р. ', changedList: 'межі змінилися: ', addedList: 'зʼявилися: ', goneList: 'зникли: ',
    none: 'межі в даних не змінилися',
    prev: 'Попередня зміна меж', next: 'Наступна зміна меж', play: 'По черзі', pause: 'Пауза',
    unavailable: 'Набір меж цієї версії недоступний — кордонів не показано',
    attribution: 'Кордони: {source}, {license}; геометрію спрощено. Суша, річки, міста: Natural Earth',
    tilt: 'Обʼємно', flat: 'Згори', overview: 'Увесь регіон', zoomIn: 'Наблизити', zoomOut: 'Віддалити',
    people: 'Персонажі', participant: 'учасник', participantEvent: 'учасник події', commander: 'командувач', eventN: 'подія {n}',
    hideInfo: 'Згорнути пояснення', showInfo: 'Розгорнути пояснення',
  },
  en: {
    bordersAt: 'Borders in', bordersAtFull: 'State borders in', onMap: 'On the map in {y}',
    changed: 'borders changed', added: 'appeared',
    noData: 'No data', disputed: 'Disputed / approximate borders',
    noDataTip: 'No border data', noDataTip2: 'The map draws nothing here',
    tipChanged: 'borders changed since {y}', tipAdded: 'appears in the data in {y}', tipAt: 'borders in {y}',
    first: 'First snapshot. Press → or “Step through” to see how the borders changed.',
    since: 'Since {y}: ', changedList: 'borders changed: ', addedList: 'appeared: ', goneList: 'disappeared: ',
    none: 'no border changes in the data',
    prev: 'Previous border change', next: 'Next border change', play: 'Step through', pause: 'Pause',
    unavailable: 'This version of the border dataset is unavailable — borders are not shown',
    attribution: 'Borders: {source}, {license}; geometry simplified. Land, rivers, cities: Natural Earth',
    tilt: '3D', flat: 'Top', overview: 'Whole region', zoomIn: 'Zoom in', zoomOut: 'Zoom out',
    people: 'People', participant: 'took part in', participantEvent: 'took part in the event', commander: 'commander', eventN: 'event {n}',
    hideInfo: 'Collapse the explanation', showInfo: 'Expand the explanation',
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
