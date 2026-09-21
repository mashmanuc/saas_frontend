// ⚠️ Phase 2.5 — Board Action Registry: Інтегралик діє НА відкритій дошці.
//
// SYSTEM_LAW: НУЛЬ нових write-шляхів. Кожен виконавець кличе ті САМІ санкціоновані
// store-actions, що перо/тулбар/сайдбар (addStroke/addAsset = Command-pattern →
// ops emit через useReplayRecorder → /replay/batch/ single-writer). Undo/replay — з коробки.
//
// IPC-5: форми об'єктів — ДЗЕРКАЛО продуктових будівельників:
//   add_text    → WBCanvas.createTextAtPosition / templatePresets (WBStroke tool:'text')
//   add_formula → WBSoloRoom.handleFormulaSubmit (asset type:'formula_card')
//   add_graph   → useContentDrop GRAPH_CALCULATOR_MIME-гілка (asset type:'graph_calculator')
//
// Розширення: нова дія на дошці = +1 tool у BE tooling.py + 1 запис у HANDLERS тут.

import { recordCompanionScene } from '@/modules/ship/sceneRecorder'
// Людські назви 3D-шаблонів для підписів у контексті (етап 0 MCL, 0.1/0.3).
// Статичний імпорт свідомо: це маленька таблиця констант, не вендор-бандл.
import { NMT3D_TEMPLATE_LABELS } from '@/modules/winterboard/constants/nmt3dDefaults'
import { renderPoly } from '@/modules/winterboard/utils/polyText'
import { BASEMAP_VERSION } from '@/modules/winterboard/board/basemaps'

function _uuid() {
  return (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// Розкладка вставок — за ТИМ, ЩО ВЖЕ ЛЕЖИТЬ на сторінці.
//
// Історія двох помилок:
// 1) каскад на 28 px (до 2026-09-06): картка 520 px накривала попередню на 95%;
// 2) сітка слотів 560×420 з лічильником у пам'яті модуля (до 2026-09-21).
//    Браузерне приймання Next Actions (Полтавська битва) дало 11 перекриттів на
//    7 об'єктах: лічильник після перезавантаження сторінки починав знову з
//    нуля й клав довідку ТОЧНО на картку події, а карта (680×520) і картки, що
//    доросли під вміст, не вміщались у слот 560×420 і лізли на сусідів.
//
// Тепер місце шукається серед реальних прямокутників сторінки й реального
// розміру того, що кладемо: перша вільна позиція в порядку читання (зверху
// вниз, зліва направо) з проміжком GAP. `reserveH` — висота, яку об'єкт займе
// ПІСЛЯ підгонки під вміст (картки ростуть донизу), щоб сусід знизу не
// опинився під ним.
//
// Вільного місця немає — найменше перекриття в межах сторінки (не «в ту саму
// точку»). Для набору з кількох об'єктів (Next Actions) це вирішує виклик:
// `planFitsCurrentPage` каже, чи набір вміститься, і якщо ні — набір іде на нову
// сторінку (див. `nextActions.js`).
const PLACE_MARGIN = 40
const PLACE_GAP = 40

// ⚠️ Вміст карток має ЕКРАННИЙ розмір, а auto-fit (INV-25) переводить його в
// одиниці дошки через поточний зум: на зумі 0.37 та сама картка виростає до
// ~1000 одиниць, на зумі 1 — до ~440. Тому резерв висоти ділимо на той самий
// зум (живе приймання 2026-09-21: без цього четверта «сторона» лягла під третю,
// що виросла вже після розкладки). Зум — лише читання стану перегляду.
let _viewZoom = 1

function _reserveFor(h, reserveH, ph) {
  const zoom = _viewZoom > 0 ? Math.min(_viewZoom, 1) : 1
  return Math.min(Math.max(h, Math.ceil(reserveH / zoom)), ph - 2 * PLACE_MARGIN)
}

function _pageSize(page) {
  return { pw: page?.width ?? 1920, ph: page?.height ?? 1080 }
}

function _occupied(page) {
  return (page?.assets ?? [])
    .filter((a) => Number.isFinite(a?.x) && Number.isFinite(a?.y) && a.w > 0 && a.h > 0)
    .map((a) => ({ x: a.x, y: a.y, w: a.w, h: a.h }))
}

function _overlapArea(a, b) {
  const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return ix > 0 && iy > 0 ? ix * iy : 0
}

/** Перша вільна позиція (лівий верхній кут) або `null`, якщо місця немає. */
export function findFreeSpot(rects, w, h, pw = 1920, ph = 1080) {
  const xs = [PLACE_MARGIN, ...rects.map((r) => r.x + r.w + PLACE_GAP)]
  const ys = [PLACE_MARGIN, ...rects.map((r) => r.y + r.h + PLACE_GAP)]
  const uniq = (list) => [...new Set(list.map((v) => Math.round(v)))].sort((a, b) => a - b)
  for (const y of uniq(ys)) {
    if (y + h > ph) continue
    for (const x of uniq(xs)) {
      if (x + w > pw) continue
      const box = { x: x - PLACE_GAP / 2, y: y - PLACE_GAP / 2, w: w + PLACE_GAP, h: h + PLACE_GAP }
      if (rects.every((r) => _overlapArea(box, r) === 0)) return { x, y }
    }
  }
  return null
}

function _leastOverlapSpot(rects, w, h, pw, ph) {
  const maxX = Math.max(0, pw - w)
  const maxY = Math.max(0, ph - h)
  let best = { x: Math.min(PLACE_MARGIN, maxX), y: Math.min(PLACE_MARGIN, maxY) }
  let bestArea = Infinity
  for (let y = 0; y <= maxY; y += 40) {
    for (let x = 0; x <= maxX; x += 40) {
      const box = { x, y, w, h }
      const area = rects.reduce((sum, r) => sum + _overlapArea(box, r), 0)
      if (area < bestArea) { best = { x, y }; bestArea = area }
      if (area === 0) return best
    }
  }
  return best
}

/**
 * Центр для нового об'єкта `w`×`h` (усі обробники рахують x/y від центру).
 * `reserveH` — скільки він займе після підгонки під вміст.
 */
function _center(page, w = 520, h = 380, reserveH = h) {
  const { pw, ph } = _pageSize(page)
  const rects = _occupied(page)
  const need = _reserveFor(h, reserveH, ph)
  const spot = findFreeSpot(rects, w, need, pw, ph) ?? _leastOverlapSpot(rects, w, need, pw, ph)
  return { cx: Math.round(spot.x + w / 2), cy: Math.round(spot.y + h / 2) }
}

// Слід, який об'єкт займе на сторінці: [ширина, висота після підгонки].
// Має збігатися з розмірами в обробниках нижче (guard — `boardLayout.spec`).
//
// Висоти після підгонки — з живого приймання 2026-09-21: картка держави чи
// особи виростає до ~420–540, довідка — до ~480. Резерв 440 + проміжок 40
// дає дві смуги карток на сторінці 1080; вища картка залазить хіба в проміжок.
const FOOTPRINT = {
  add_history_card: [520, 440],
  add_card: [520, 440],
  add_map: [680, 520],
  add_timeline: [760, 440],
  add_formula: [380, 110],
  add_graph: [480, 360],
  add_image: [480, 400],
  add_text: [320, 40],
}

/**
 * Чи вміститься весь набір дій на поточній сторінці без перекриттів.
 * Нічого не пише: розкладка лише симулюється на копії прямокутників.
 */
export async function planFitsCurrentPage(actions) {
  const { page } = await _store()
  const { pw, ph } = _pageSize(page)
  const rects = _occupied(page)
  for (const action of actions || []) {
    const size = FOOTPRINT[action?.kind]
    if (!size) continue
    const [w, reserveH] = size
    const h = _reserveFor(0, reserveH, ph)
    const spot = findFreeSpot(rects, w, h, pw, ph)
    if (!spot) return false
    rects.push({ x: spot.x, y: spot.y, w, h })
  }
  return true
}

/**
 * Нова сторінка для набору, що не вміщується на поточній, — тим самим шляхом,
 * що й кнопка «+ Додати сторінку» (`addPageUndoable` → штатний `page_add`).
 * Дошка переходить на неї: учитель бачить результат, а не купу.
 */
export async function openPageForPlan(name) {
  const { store } = await _store()
  const id = store.addPageUndoable({ name: name ? String(name).slice(0, 80) : undefined })
  if (!id) throw new Error('Дошка вже має максимум сторінок (50) — більше додати не можу.')
  return id
}

async function _store() {
  const { useWBStore } = await import('@/modules/winterboard/board/state/boardStore')
  const store = useWBStore()
  const page = store.currentPage
  if (!page) throw new Error('Дошка ще не завантажилась — спробуйте за мить.')
  _viewZoom = Number(store.zoom) || 1
  return { store, page }
}

/**
 * E2: остання картка, яку створив САМЕ Інтегралик (не тьютор руками).
 *
 * Живий випадок власника: «прибери з умови своєї задачі саму відповідь».
 * Це прохання ВИПРАВИТИ наявний об'єкт, а таких дій у Інтегралика не було
 * взагалі — лише `add_*`. Він зробив найближче можливе: дописав на дошку
 * новий текст, лишивши стару картку. Відповідь «✓ Пишу на дошці…» була
 * буквально правдива й читалась як виконання прохання.
 *
 * Адресу тримаємо ТУТ, а не в моделі: id картки народжується в цьому ж
 * обробнику, і гнати його через промпт означало б просити модель не
 * помилитись у 36-символьному рядку. Пам'ять живе стільки, скільки вкладка;
 * після перезавантаження ціль чесно зникає — і про це кажемо, а не мовчимо.
 */
let _lastAiCard = null

// Коридори Інтегралика (ТЗ 2026-09-17 §3.7, §6.3): мова матеріалу й походження
// джерела — у ДАНИХ об'єкта, тож переживають reload, replay, clone і export.
// Лише коли сервер прислав `corridor` (rollout-гейт); без нього дані об'єкта
// байт-у-байт такі, як були. Список ключів закритий: сторонні поля не пишемо.
// Норматив: SYSTEM_LAW §9.D, OPS_SYNC_SSOT INV-26 (там той самий перелік).
const CORRIDOR_PROVENANCE_KEYS = [
  'subject', 'content_language_source', 'requested_content_language', 'source_language',
  'source_provider', 'source_title', 'source_url', 'license', 'license_url', 'author',
  'share_alike', 'retrieved_at', 'translation_used',
]
export function corridorData(corridor) {
  if (!corridor || typeof corridor !== 'object') return {}
  const lang = corridor.content_language
  if (lang !== 'uk' && lang !== 'en') return {}
  const provenance = {}
  for (const key of CORRIDOR_PROVENANCE_KEYS) {
    const value = corridor[key]
    if (typeof value === 'boolean') provenance[key] = value
    else if (typeof value === 'string' && value) provenance[key] = value.slice(0, 300)
  }
  return { content_language: lang, provenance }
}

// Доказові джерела ЗМІСТУ картки (ТЗ H0 §4.1). Свідомо ОКРЕМЕ поле від
// `provenance`: той — незмінний конверт походження матеріалу (LAW §9.D,
// INV-26), а це список джерел, на яких стоїть зміст. Одне не підміняє інше.
const SOURCE_REF_KEYS = [
  'provider', 'source_id', 'title', 'url', 'language', 'author',
  'license', 'license_url', 'revision_id', 'retrieved_at', 'evidence',
  'evidence_key', 'modified',
]
// Обов'язкові — дзеркало REQUIRED_KEYS у `apps/intent/corridors/source_ref.py`.
// Джерело без них нікуди не веде, тому на дошку не лягає.
const SOURCE_REF_REQUIRED = ['provider', 'title', 'url', 'retrieved_at', 'evidence']
// Дзеркало `is_web_url` на BE. Не косметика: без цієї перевірки `javascript:`
// з чужого метаданого поля став би клікабельним посиланням у картці вчителя.
export const WEB_URL_RE = /^https?:\/\/.+/i
const SOURCE_STATUSES = ['verified', 'mixed', 'teacher_provided']

export function sourcesData(sources, status) {
  if (!Array.isArray(sources)) return {}
  const out = []
  for (const raw of sources.slice(0, 12)) {
    if (!raw || typeof raw !== 'object') continue
    const ref = {}
    for (const key of SOURCE_REF_KEYS) {
      const value = raw[key]
      if (key === 'modified') ref[key] = value === true
      else if (typeof value === 'string' && value) ref[key] = value.slice(0, key === 'evidence' ? 500 : 300)
      else ref[key] = key === 'modified' ? false : ''
    }
    if (SOURCE_REF_REQUIRED.every(key => ref[key]) && WEB_URL_RE.test(ref.url)) out.push(ref)
  }
  if (!out.length) return {}
  return {
    sources: out,
    // Fail closed. `verified` означає «джерела підтверджені» — це твердження
    // про зміст, а не формальність. Підставляти його на невідоме чи відсутнє
    // значення означало б сказати вчителю більше, ніж ми знаємо, тому
    // невідоме падає в `mixed`.
    source_status: SOURCE_STATUSES.includes(status) ? status : 'mixed',
  }
}

// Санітизація вмісту шкали й карти. Та сама логіка, що для джерел: на дошку
// лягає лише те, що має сенс. Подія без дати — не подія на шкалі часу, місце
// без придатних координат — не marker; домальовувати їх не можна.
const PRECISIONS = ['day', 'month', 'year', 'decade', 'range', 'unknown']
const MAX_EVENTS = 12   // ТЗ §6.2: 1–12 подій у v1

function sanitizeDate(raw) {
  if (!raw || typeof raw !== 'object') return null
  const year = Number(raw.year)
  if (!Number.isFinite(year)) return null
  const out = { year, precision: PRECISIONS.includes(raw.precision) ? raw.precision : 'year' }
  const month = Number(raw.month)
  if (Number.isInteger(month) && month >= 1 && month <= 12) out.month = month
  const day = Number(raw.day)
  if (Number.isInteger(day) && day >= 1 && day <= 31) out.day = day
  return out
}

export function sanitizeSourceList(raw) {
  const out = sourcesData(raw, 'verified')
  return out.sources || []
}

// Кожен вид тут МУСИТЬ мати стиль у `HistoryCardRenderer` (тест
// `historyCard.spec.ts`): невідомий вид падає в 'person', і держава показалась
// би як «Особа».
export const HISTORY_VARIANTS = ['person', 'event', 'monument', 'polity']
const HISTORY_STATUSES = ['verified', 'mixed']

/**
 * Дії «що далі» (Next Actions V1). Лише форма: `id` у просторі імен предмета
 * (`history.map`), людський `label`. Що саме робить дія — знає бекенд.
 */
export function sanitizeTeachingActions(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const item of raw) {
    const id = typeof item?.id === 'string' ? item.id.trim() : ''
    const label = typeof item?.label === 'string' ? item.label.trim().slice(0, 48) : ''
    if (!/^[a-z]+\.[a-z_]+$/.test(id) || !label || out.some((x) => x.id === id)) continue
    out.push({ id, label })
    if (out.length >= 6) break
  }
  return out
}

/** Непрозоре посилання `{provider, id}`: лише форма й довжина, без розбору `id`. */
function sanitizeEntityRef(raw) {
  if (!raw || typeof raw !== 'object') return null
  const provider = typeof raw.provider === 'string' ? raw.provider.trim() : ''
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  if (!/^[a-z][a-z0-9_]{0,31}$/.test(provider) || !id || id.length > 128) return null
  return { provider, id }
}

/** Значення рядка картки. Закритий набір ключів — як у sourcesData. */
function sanitizeHistoryValue(raw) {
  if (!raw || typeof raw !== 'object') return null
  const label = typeof raw.label === 'string' ? raw.label.trim().slice(0, 200) : ''
  const display = typeof raw.display === 'string' ? raw.display.trim().slice(0, 200) : ''
  if (!label && !display) return null
  const out = { label: label || display }
  if (display) out.display = display
  // `entity_ref` НЕ показується на картці — лише адреса переходу. Це непрозоре
  // посилання: перевіряємо ФОРМУ нашої структури, а не формат `id` джерела.
  // До 2026-09-21 тут стояло `/^Q\d+$/` — фронт розбирав ідентифікатор Wikidata,
  // що суперечить інваріанту `CLAUDE_RULES.md` про адаптери.
  const ref = sanitizeEntityRef(raw.entity_ref)
  if (ref) out.entity_ref = ref
  if (typeof raw.old_style === 'string' && raw.old_style.trim()) {
    out.old_style = raw.old_style.trim().slice(0, 80)
  }
  if (typeof raw.note === 'string' && raw.note.trim()) out.note = raw.note.trim().slice(0, 120)
  // Координата приймається лише парою й лише в межах глобуса: половина пари
  // або широта 500 дали б шпильку невідомо де.
  const lat = Number(raw.lat)
  const lon = Number(raw.lon)
  if (Number.isFinite(lat) && Number.isFinite(lon)
      && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
    out.lat = lat
    out.lon = lon
  }
  return out
}

/** Рядок картки. Без значень рядка не існує — порожніх «—» на картці немає. */
function sanitizeHistoryField(raw) {
  if (!raw || typeof raw !== 'object') return null
  const label = typeof raw.label === 'string' ? raw.label.trim().slice(0, 80) : ''
  const values = Array.isArray(raw.values)
    ? raw.values.map(sanitizeHistoryValue).filter(Boolean).slice(0, 24)
    : []
  if (!label || !values.length) return null
  const total = Number.isInteger(raw.total) && raw.total >= values.length ? raw.total : values.length
  return {
    label,
    status: HISTORY_STATUSES.includes(raw.status) ? raw.status : 'verified',
    values,
    total,
  }
}

export function sanitizeHistoryFields(raw) {
  return Array.isArray(raw) ? raw.map(sanitizeHistoryField).filter(Boolean).slice(0, 16) : []
}

/**
 * Зображення картки. Показуємо ЛИШЕ з автором і ліцензією — той самий гейт,
 * що для add_image: без атрибуції картинка на дошку не йде.
 */
export function sanitizeHistoryImage(raw) {
  if (!raw || typeof raw !== 'object') return null
  const url = typeof raw.url === 'string' ? raw.url.trim() : ''
  const author = typeof raw.author === 'string' ? raw.author.trim() : ''
  const license = typeof raw.license === 'string' ? raw.license.trim() : ''
  if (!WEB_URL_RE.test(url) || !author || !license) return null
  const out = {
    url,
    author: author.slice(0, 200),
    license: license.slice(0, 80),
    attribution: typeof raw.attribution === 'string' ? raw.attribution.trim().slice(0, 300) : '',
  }
  if (Number.isFinite(Number(raw.width))) out.width = Number(raw.width)
  if (Number.isFinite(Number(raw.height))) out.height = Number(raw.height)
  if (typeof raw.file_page === 'string' && WEB_URL_RE.test(raw.file_page.trim())) {
    out.file_page = raw.file_page.trim()
  }
  return out
}

export function sanitizeEvents(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const ev of raw.slice(0, MAX_EVENTS)) {
    if (!ev || typeof ev !== 'object') continue
    const start = sanitizeDate(ev.date_start)
    if (!start) continue
    out.push({
      id: String(ev.id || _uuid()),
      date_start: start,
      date_end: sanitizeDate(ev.date_end),
      label: String(ev.label || '').slice(0, 120),
      description: String(ev.description || '').slice(0, 600),
      place_ids: Array.isArray(ev.place_ids) ? ev.place_ids.map(String).slice(0, 12) : [],
      image: typeof ev.image === 'string' && ev.image ? ev.image : null,
      sources: sanitizeSourceList(ev.sources),
    })
  }
  return out
}

export function sanitizeMarkers(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const m of (Array.isArray(raw) ? raw : []).slice(0, 24)) {
    if (!m || typeof m !== 'object') continue
    const lat = Number(m.lat)
    const lon = Number(m.lon)
    // Поза діапазоном — координати немає (дзеркало `facts.normalize_coordinate`).
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) continue
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) continue
    out.push({
      id: String(m.id || _uuid()),
      label: String(m.label || '').slice(0, 120),
      lat, lon,
      date_label: String(m.date_label || '').slice(0, 40),
      description: String(m.description || '').slice(0, 600),
      event_ids: Array.isArray(m.event_ids) ? m.event_ids.map(String).slice(0, 12) : [],
      sources: sanitizeSourceList(m.sources),
    })
  }
  return out
}

export function sanitizeRoutes(raw) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 12).flatMap((r) => {
    if (!r || typeof r !== 'object') return []
    const ids = Array.isArray(r.marker_ids) ? r.marker_ids.map(String) : []
    // Маршрут із однієї точки — не маршрут.
    return ids.length >= 2
      ? [{ id: String(r.id || _uuid()), label: String(r.label || '').slice(0, 120), marker_ids: ids }]
      : []
  })
}

export function sanitizeRegions(raw) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 12).flatMap((region) => {
    if (!region || typeof region !== 'object') return []
    const points = (Array.isArray(region.points) ? region.points : []).flatMap((point) => {
      const lat = Number(point?.lat)
      const lon = Number(point?.lon)
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) return []
      if (!Number.isFinite(lon) || lon < -180 || lon > 180) return []
      return [{ lat, lon }]
    })
    return points.length >= 3
      ? [{ id: String(region.id || _uuid()), label: String(region.label || '').slice(0, 120), points }]
      : []
  })
}

// Мова вже створеного матеріалу для підсумку дошки (серверний резолвер мови, §3.7 п. 4).
// Лише зчитування; порожньо для об'єктів без коридору — summary як був.
function materialLang(data) {
  const lang = data && data.content_language
  if (lang !== 'uk' && lang !== 'en') return {}
  const source = data.provenance && data.provenance.content_language_source
  return typeof source === 'string' && source ? { lang, lang_source: source } : { lang }
}

const HANDLERS = {
  // Дзеркало createTextAtPosition/templatePresets: текст = WBStroke tool:'text' → addStroke.
  // Коридор (LAW §9.D): мова й провенанс — у `stroke.data`, як у картки в `asset.data`.
  async add_text({ text, corridor }) {
    const { store, page } = await _store()
    const { cx, cy } = _center(page, 320, 40)
    const material = corridorData(corridor)
    store.addStroke({
      id: _uuid(),
      tool: 'text',
      color: '#1e293b',
      size: 22,
      opacity: 1,
      text,
      points: [{ x: cx - 160, y: cy - 16 }],
      width: 320,
      fontWeight: 400,
      fontStyle: 'normal',
      textAlign: 'left',
      ...(material.content_language ? { data: material } : {}),
    })
  },

  // 2026-09-06 (Вікіпедія, слово власника): картинка за URL з провенансом.
  // Дзеркало useContentDrop.ts (той самий WBAsset type:'image' + src/x/y/w/h),
  // плюс `data` з джерелом і ліцензією — це йде в реплей, який живе роками, і
  // на дошку школи; без рядка джерела картинку не кладемо (ТЗ, тиждень 2).
  // Розмір: вписати в 480 по ширині, зберігши пропорції; якщо BE не дав w/h —
  // квадрат 360, канва сама підтягне після завантаження.
  async add_image({ src, w, h, caption, source, source_url, license, author, retrieved_at, attribution_text, corridor }) {
    if (!src || typeof src !== 'string') throw new Error('Немає адреси картинки.')
    if (!source_url) throw new Error('Картинка без джерела на дошку не йде.')
    const { store, page } = await _store()
    const MAX_W = 480
    let width = Number(w) || 0
    let height = Number(h) || 0
    if (width > 0 && height > 0) {
      const k = Math.min(1, MAX_W / width)
      width = Math.round(width * k); height = Math.round(height * k)
    } else {
      width = 360; height = 360
    }
    // + рядок підпису джерела під картинкою
    const { cx, cy } = _center(page, width, height, height + 40)
    const assetId = _uuid()
    store.addAsset({
      id: assetId,
      type: 'image',
      src,
      // Власний слот сітки (див. _center) — центруємо в ньому, як картку.
      // Було `cx + 40` від часів, коли всі об'єкти лягали в одну точку.
      x: cx - Math.round(width / 2),
      y: cy - Math.round(height / 2),
      w: width,
      h: height,
      rotation: 0,
      locked: false,
      data: {
        version: 1,
        caption: caption || '',
        source: source || 'external',
        source_url,
        license: license || '',
        author: author || '',
        retrieved_at: retrieved_at || '',
        ...corridorData(corridor),
      },
    }, page.id ?? '')
    // Підпис джерела під картинкою — окремий текстовий штрих (нуль нових
    // рендерерів): «Джерело: Вікіпедія · Public domain».
    // Коридор: рядок атрибуції (автор, ліцензія) формує сервер мовою матеріалу —
    // англійська картинка не отримує українського підпису; штрих несе ту саму мову.
    const srcLabel = source === 'wikimedia_commons' ? 'Вікіпедія' : 'зовнішнє джерело'
    const lic = license ? ` · ${license}` : ''
    const material = corridorData(corridor)
    const captionText = material.content_language && typeof attribution_text === 'string' && attribution_text
      ? attribution_text.slice(0, 300)
      : `Джерело: ${srcLabel}${lic}`
    store.addStroke({
      id: _uuid(),
      tool: 'text',
      color: '#64748b',
      size: 13,
      opacity: 1,
      text: captionText,
      points: [{ x: cx + 40, y: cy + Math.round(height / 2) + 6 }],
      width: Math.max(220, width),
      fontWeight: 400,
      fontStyle: 'normal',
      textAlign: 'left',
      ...(material.content_language ? { data: material } : {}),
    })
    return assetId
  },

  // Дзеркало WBSoloRoom.handleFormulaSubmit (нова formula_card по центру)
  async add_formula({ latex }) {
    const { store, page } = await _store()
    const { cx, cy } = _center(page, 380, 110)
    const assetId = _uuid()
    store.addAsset({
      id: assetId,
      type: 'formula_card',
      src: '',
      x: cx - 190,
      y: cy - 55,
      w: 380,
      h: 110,
      rotation: 0,
      locked: false,
      data: { version: 1, formula: latex, fontSize: 22, color: '#1e293b', bg: '#f8fafc' },
    }, page.id ?? '')
    // N1 Фаза 2: запис companion-сцени для AST-експорту (2026-08-07).
    // ⚠️ Раніше тут стояло `assetId: id` — `id` ніколи не оголошувалась у
    // цій області видимості (лише всередині літерала `store.addAsset`),
    // тож рядок кидав ReferenceError і асинхронна функція завершувалась
    // відмовою: картка на дошці з'являлась, а користувач бачив помилку.
    // ⚠️ recordCompanionScene повертає void (сама fire-and-forget, сама
    // ловить помилки всередині) — `.catch()` тут кидав TypeError на undefined.
    recordCompanionScene({
      sessionId: store.workspaceId,
      kind: 'formula_card',
      assetId,
      data: { formula: latex },
    })
  },

  // theory_card (TheoryCardRenderer): текст із $LaTeX$ рендериться KaTeX —
  // для розв'язків/пояснень (гарна картка замість голого текстового поля).
  // H2: шкала подій. Один запис штатним `addAsset` — власного write-path,
  // окремого REST чи мутації стану повз операцію немає (ТЗ §9.3).
  async add_timeline({ title, layout, orientation, events, knowledge_set_id, corridor, sources, source_status }) {
    const { store, page } = await _store()
    const { cx, cy } = _center(page, 760, 440)
    const assetId = _uuid()
    store.addAsset({
      id: assetId, type: 'timeline_card', src: '',
      x: cx - 380, y: cy - 220, w: 760, h: 440, rotation: 0, locked: false,
      data: {
        version: 1,
        title: title || '',
        layout: layout === 'linear' ? 'linear' : 'ordinal',
        orientation: orientation === 'vertical' ? 'vertical' : 'horizontal',
        events: sanitizeEvents(events),
        active_event_id: null,
        ...(knowledge_set_id ? { knowledge_set_id: String(knowledge_set_id).slice(0, 120) } : {}),
        ...corridorData(corridor),
        ...sourcesData(sources, source_status),
        sources: sanitizeSourceList(sources),
      },
    }, page.id ?? '')
    return { ok: true, assetId }
  },

  // H3: карта подій. Та сама механіка, що у шкали.
  async add_map({ title, basemap, markers, routes, regions, knowledge_set_id, corridor, sources, source_status }) {
    const { store, page } = await _store()
    const { cx, cy } = _center(page, 680, 520)
    const assetId = _uuid()
    store.addAsset({
      id: assetId, type: 'map_card', src: '',
      x: cx - 340, y: cy - 260, w: 680, h: 520, rotation: 0, locked: false,
      data: {
        version: 1,
        title: title || '',
        basemap: ['world', 'europe', 'ukraine'].includes(basemap) ? basemap : 'europe',
        basemap_version: BASEMAP_VERSION,
        projection: 'mercator',
        historical_boundary_mode: 'none',
        markers: sanitizeMarkers(markers),
        routes: sanitizeRoutes(routes),
        regions: sanitizeRegions(regions),
        active_marker_id: null,
        ...(knowledge_set_id ? { knowledge_set_id: String(knowledge_set_id).slice(0, 120) } : {}),
        ...corridorData(corridor),
        ...sourcesData(sources, source_status),
        sources: sanitizeSourceList(sources),
      },
    }, page.id ?? '')
    return { ok: true, assetId }
  },

  /**
   * Довідкова картка історичної сутності (ТЗ дизайнера 2026-09-20).
   *
   * ⚠️ ТЕХНІЧНИХ НАЗВ У ПАЙЛОАДІ НЕМАЄ. Сервер кладе людські підписи мовою
   * матеріалу; коди властивостей і ідентифікатори на картку не малюються —
   * `entity_ref` лишається в даних лише як непрозора адреса переходу.
   *
   * Порожній рядок сюди не доходить: `sanitizeHistoryField` відкидає поле без
   * значень, тож «—» на картці не з'являється за побудовою.
   */
  async add_history_card({ variant, title, subtitle, image, primary, secondary,
                           corridor, sources, source_status, entity_ref }) {
    const { store, page } = await _store()
    const { cx, cy } = _center(page, 520, 380, 440)
    const titleValue = typeof title === 'string' ? title.trim().slice(0, 200) : ''
    if (!titleValue) return
    const primaryFields = sanitizeHistoryFields(primary)
    const secondaryFields = sanitizeHistoryFields(secondary)
    const imageValue = sanitizeHistoryImage(image)
    const assetId = _uuid()
    store.addAsset({
      id: assetId,
      type: 'history_card',
      src: '',
      x: cx - 260,
      y: cy - 190,
      // Ширина — 520, як у чинної theory_card: картка тієї самої сім'ї, а не
      // сусідньої (THEORY_CARD_BASELINE.md, знято з коду).
      w: 520,
      h: 380,
      rotation: 0,
      locked: false,
      data: {
        version: 1,
        variant: HISTORY_VARIANTS.includes(variant) ? variant : 'person',
        title: titleValue,
        ...(typeof subtitle === 'string' && subtitle.trim()
          ? { subtitle: subtitle.trim().slice(0, 300) } : {}),
        ...(imageValue ? { image: imageValue } : {}),
        primary: primaryFields,
        ...(secondaryFields.length ? { secondary: secondaryFields } : {}),
        expanded: false,
        ...corridorData(corridor),
        ...sourcesData(sources, source_status),
        // Власне посилання картки. Дій «що далі» тут НЕМАЄ: список кнопок — не
        // стан дошки (слово власника 2026-09-21); його питає жива картка.
        ...(sanitizeEntityRef(entity_ref) ? { entity_ref: sanitizeEntityRef(entity_ref) } : {}),
      },
    }, page.id ?? '')
  },

  async add_card({ title, body, badge, preset, corridor, sources, source_status }) {
    const { store, page } = await _store()
    const { cx, cy } = _center(page, 520, 380, 440)
    const assetId = _uuid()
    const badgeValue = badge || ''
    const titleValue = title || ''
    const bodyValue = body || ''
    store.addAsset({
      id: assetId,
      type: 'theory_card',
      src: '',
      x: cx - 260,
      y: cy - 190,
      w: 520,
      h: 380,
      rotation: 0,
      locked: false,
      // badge — підпис у шапці. BE дає «Розв'язок» за замовчуванням для цього
      // шляху: модель кладе сюди переважно розв'язки, а не теорію.
      data: { version: 1, badge: badgeValue, title: titleValue, body: bodyValue, formulas: [], ...(preset ? { preset } : {}), ...corridorData(corridor), ...sourcesData(sources, source_status) },
    }, page.id ?? '')
    // E2: запам'ятовуємо ВЛАСНУ картку — саме її дозволено виправляти.
    _lastAiCard = { assetId, pageId: page.id ?? '' }
    // N1 Фаза 2 (2026-08-07): запис companion-сцени для AST-експорту.
    // ⚠️ Був відсутній повністю — картка потрапляла на дошку, але НІКОЛИ
    // в AST, тому й у PPTX. Це і була вся суть Фази 2.
    // ⚠️ recordCompanionScene повертає void — `.catch()` тут кидав TypeError.
    recordCompanionScene({
      sessionId: store.workspaceId,
      kind: 'theory_card',
      assetId,
      data: { badge: badgeValue, title: titleValue, body: bodyValue, ...(preset ? { preset } : {}) },
    })
  },

  /**
   * E2: виправити ВЛАСНУ останню картку. Свідомо вузько.
   *
   * Ops уміли це завжди (`object_update` у boardStore) — бракувало лише
   * доступу. Тут не новий тип операції, а звичайний updateAsset.
   *
   * ⚠️ Наявність цілі перевіряємо САМІ, до виклику: store.updateAsset при
   * ненайденому id просто виходить (`if (idx === -1) return`), тобто тихо
   * нічого не робить. Тиха невдача тут була б гіршою за початковий дефект:
   * тьютор почув би «виправив» і побачив стару картку.
   */
  async update_card({ title, body, badge }) {
    const { store, page } = await _store()
    if (!_lastAiCard) {
      throw new Error('Я ще не створював тут картки — виправляти нема чого. Скажіть, що додати.')
    }
    const asset = (page.assets || []).find((a) => a.id === _lastAiCard.assetId)
    if (!asset) {
      throw new Error(
        'Своєї останньої картки на цій сторінці не бачу — можливо, її видалили або ви '
        + 'на іншій сторінці. Чужі й старі картки я виправляти не вмію.'
      )
    }
    const data = { ...(asset.data || {}) }
    if (typeof title === 'string' && title) data.title = title
    if (typeof body === 'string' && body) data.body = body
    if (typeof badge === 'string' && badge) data.badge = badge
    store.updateAsset({ ...asset, data })
  },

  // Дзеркало usePageManagement.addPage() → store.addPageUndoable() — та сама дія,
  // що й кнопка «+ Додати сторінку» в сайдбарі. Стелю (50) пильнує сам стор:
  // повертає '' при досягненні — тут просто чесно кажемо про це, а не мовчимо.
  async add_page({ name, card, corridor }) {
    const { store } = await _store()
    const newId = store.addPageUndoable({ name: name || undefined })
    if (!newId) throw new Error('Дошка вже має максимум сторінок (50) — більше додати не можу.')
    if (card && (card.title || card.body)) {
      const page = store.currentPage
      const { cx, cy } = _center(page, 520, 380, 440)
      store.addAsset({
        id: _uuid(),
        type: 'theory_card',
        src: '',
        x: cx - 260,
        y: cy - 190,
        w: 520,
        h: 380,
        rotation: 0,
        locked: false,
        data: { version: 1, title: card.title || '', body: card.body || '', formulas: [], ...corridorData(corridor) },
      }, page.id ?? '')
    }
  },

  // Дзеркало useContentDrop (graph_calculator) + вираз одразу в expressions
  // Крок 4 (2026-07-31): БУЛО — один вираз, `params:{}` хардкодом. Рушій
  // (GraphCalculatorState) від початку вміє масив кривих і слайдери; BE тепер
  // їх присилає (`expressions[]` + `params{}`), тож просто передаємо наскрізь.
  // Зворотна сумісність зі старим payload `{expression}` лишається — на випадок
  // старої вкладки FE проти нового BE (і навпаки: BE теж приймає обидва).

  async add_graph({ expressions, expression, params }) {
    const { store, page } = await _store()
    const { cx, cy } = _center(page, 480, 360)
    const W = 480; const H = 360
    // «y=sin(x)» → src «sin(x)» (голий вираз рендериться як y=f(x))
    const strip = (s) => String(s ?? '').replace(/^\s*y\s*=\s*/i, '').trim()

    const list = Array.isArray(expressions) && expressions.length
      ? expressions
      : (expression ? [{ src: expression }] : [])
    // Кольори по колу — щоб криві на одному полі візуально розрізнялись.
    const COLORS = ['#dc2626', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2']
    const built = list
      .map((e, i) => ({
        id: `e-${_uuid().slice(0, 8)}`,
        src: strip(typeof e === 'string' ? e : e?.src),
        color: COLORS[i % COLORS.length],
        hidden: false,
      }))
      .filter((e) => e.src)
    if (!built.length) throw new Error('Не зрозумів вираз функції.')

    const assetId = `gc-${_uuid()}`
    // ОДНА структура на дошку і на урок. Була дубльована копія — і
    // будь-яка правка viewport/params в одному місці мовчки розводила
    // те, що бачить учень, із тим, що поїде в колоду.
    const assetData = {
      version: 1,
      state: {
        expressions: built,
        // BE вже провалідував діапазони (min<max, step>0, ім'я по регексу).
        params: (params && typeof params === 'object') ? params : {},
        viewport: { cx: 0, cy: 0, scale: 38 },
      },
      meta: { last_snapshot_seq: 0 },
    }
    store.addAsset({
      id: assetId,
      type: 'graph_calculator',
      src: '',
      x: cx - W / 2,
      y: cy - H / 2,
      w: W,
      h: H,
      rotation: 0,
      locked: false,
      data: assetData,
    }, page.id ?? '')

    // ТЗ-G (D-22): графік Інтегралика пише в AST уроку — інакше на дошці
    // він є, а в експортованій колоді зникає.
    // `recordCompanionScene` сам fire-and-forget і сам відсіює порожній
    // sessionId (workspaceId у сторі — `string | null`).
    recordCompanionScene({
      sessionId: store.workspaceId,
      assetId,
      kind: 'graph_calculator',
      data: assetData,
    })

    // Підсвітка: об'єкт з'явився не від кліку юзера, а від фрази — око його не
    // «веде», тож виділяємо, щоб було видно, ЩО саме додалось.
    // `selectItems` — офіційний selection-action стора (boardStore.ts:3644).
    // try/catch — підсвітка не варта того, щоб через неї впала сама вставка.
    try { store.selectItems?.([assetId]) } catch { /* підсвітка не критична */ }
  },
}

// ── Phase 2.7: вставка мат-інструментів за смислом (planimetry/trig/3d/…) ──
// Каталог = ЖИВИЙ insertRegistry (той самий, що сайдбар); Інтегралик обирає id,
// вставка йде через САНКЦІОНОВАНИЙ addAtPosition (міст-подія m4sh:wb-insert →
// WBSoloRoom) — нуль нових write-шляхів. Нова плитка в продукті = авто в каталозі.
// family → людський «вид» (щоб модель не плутала 2D-трикутник з 3D-тетраедром)
const FAMILY_KIND = {
  planimetry: 'планіметрія 2D',
  stereo: 'стереометрія 3D',
  '3d': 'стереометрія 3D',
  trig: 'тригонометрія',
  analysis: 'графік/аналіз',
  quadratic: 'квадратична',
  geomash: 'жива геометрія',
}

async function _allInserts() {
  // Примусово вантажимо geo2d-вендор → window.GEO_PRESETS (планіметрія), інакше на
  // свіжій дошці каталог без 2D-фігур і модель бере найближче 3D/триго (owner-баг).
  try { await import('@/modules/winterboard/vendor/geo2d') } catch { /* без планіметрії — не блокуємо */ }
  const mod = await import('@/modules/winterboard/components/sidebar/insertRegistry')
  return typeof mod.allInserts === 'function' ? mod.allInserts() : []
}

/** Ліміт каталогу в parse-контексті — дзеркало BE `MAX_TOOLS` (apps/intent/ai/parser.py). */
const MAX_TOOL_CATALOG = 80

/**
 * Компактний каталог доступних інструментів дошки для parse-контексту (id+label+desc).
 *
 * TLV2-06R.1: + прихований AI-каталог supported готових рецептів (`preparedRecipesForAI`).
 * Видимий UI їх не показує (sidebar читає лише insertRegistry); `gap` моделі не передається.
 * Місце під рецепти зарезервоване в ліміті: BE ріже каталог до MAX_TOOLS і валідує
 * insert_id проти надісланого списку, тож обрізаний рецепт став би недосяжним.
 */
export async function buildToolCatalog() {
  const items = await _allInserts()
  const { preparedRecipesForAI } = await import('@/modules/winterboard/board/preparedBoardRecipes')
  const recipes = preparedRecipesForAI()
  const tools = items.map((e) => {
    const kind = FAMILY_KIND[e.family] || ''
    const tail = [e.sublabel, ...(e.keywords || [])].filter(Boolean).join(' · ')
    return {
      id: e.id,
      label: e.labelFallback || e.id,
      desc: (kind ? `[${kind}] ` : '') + tail.slice(0, 90),
    }
  })
  return [...tools.slice(0, MAX_TOOL_CATALOG - recipes.length), ...recipes]
}

// ── Phase 2.8: редагування параметра ІСНУЮЧОГО об'єкта (через updateAsset) ──
// BE резолвить object_id (Закон C), сюди приходить готовий id + що змінити.
HANDLERS.set_param = async function set_param({ object_id, type, value, name }) {
  const { store } = await _store()
  const page = store.currentPage
  const asset = (page.assets || []).find((a) => a.id === object_id)
  if (!asset) throw new Error('Не знайшов цей об’єкт на дошці.')
  const data = JSON.parse(JSON.stringify(asset.data || {}))
  if (type === 'graph_expression') {
    // Міняємо вираз ПЕРШОГО графіка (data.state.expressions[0].src)
    if (!data.state) data.state = { expressions: [], params: {}, viewport: { cx: 0, cy: 0, scale: 38 } }
    const src = String(value).replace(/^\s*y\s*=\s*/i, '').trim()
    if (data.state.expressions?.length) {
      data.state.expressions[0] = { ...data.state.expressions[0], src }
    } else {
      data.state.expressions = [{ id: `e-${_uuid().slice(0, 8)}`, src, color: '#dc2626', hidden: false }]
    }
  } else if (type === 'graph_param') {
    // Phase 1 Block B1 (2026-08-01): «зроби a=3» — точкова зміна ОДНОГО параметра.
    // Clamp у [min,max] — той самий інваріант, що в _clean_graph_params на BE.
    if (!data.state) data.state = { expressions: [], params: {}, viewport: { cx: 0, cy: 0, scale: 38 } }
    const paramKey = String(name)
    const cfg = data.state.params?.[paramKey]
    if (!cfg) throw new Error(`Параметра «${paramKey}» немає на цьому графіку — скажіть «побудуй ... з a», і я додам повзунок.`)
    const num = Number(value)
    if (!Number.isFinite(num)) throw new Error('Не зрозумів нове значення параметра.')
    // Живий прогін власника 2026-08-15: «зроби коефіцієнт a п'ятіркою» при
    // діапазоні повзунка [-3; 3] тихо клемпилось до 3, а Інтегралик звітував
    // «Тепер на дошці a = 5». Класична тиха брехня: рядок «Виконано: …» бере
    // текст, складений ДО виконання (CommandPalette: aiPush kind 'done'), тож
    // жодна відповідь обробника до тьютора не доходить — виправляти треба не
    // повідомлення, а факт.
    //
    // Межі повзунка — зручність інтерфейсу, а не математичний закон: коли
    // тьютор називає значення поза ними, він просить ЗНАЧЕННЯ, а не «стільки,
    // скільки влізе». Тому розсуваємо порушену межу до самого значення
    // (округлено назовні) і ставимо, що просили — після цього «a = 5» стає
    // правдою, і повідомлення брехати перестає само.
    const LIMIT = 1e6
    if (Math.abs(num) > LIMIT) {
      throw new Error(`Значення ${num} завелике для повзунка — постав щось у межах ±${LIMIT}.`)
    }
    let { min, max } = cfg
    if (num > max) max = Math.ceil(num)
    if (num < min) min = Math.floor(num)
    data.state.params = {
      ...(data.state.params || {}),
      [paramKey]: { ...cfg, min, max, value: num },
    }
  } else if (type === 'formula') {
    data.formula = String(value)
  } else {
    throw new Error('Цей тип зміни поки не підтримується.')  // fail-closed
  }
  store.updateAsset({ ...asset, data })
}

// Phase 2.9: маніпуляції об'єктами (move/resize/delete) — усе через санкц. store-actions.
async function _assetById(object_id) {
  const { store } = await _store()
  const page = store.currentPage
  const asset = (page.assets || []).find((a) => a.id === object_id)
  if (!asset) throw new Error('Не знайшов цей об’єкт на дошці.')
  return { store, asset }
}

HANDLERS.move_object = async function move_object({ object_id, dx, dy }) {
  const { store, asset } = await _assetById(object_id)
  store.updateAsset({ ...asset, x: (asset.x || 0) + (dx || 0), y: (asset.y || 0) + (dy || 0) })
}

HANDLERS.resize_object = async function resize_object({ object_id, factor }) {
  const { store, asset } = await _assetById(object_id)
  const k = Number(factor) || 1
  const w = Math.max(40, Math.round((asset.w || 200) * k))   // clamp min 40px (store min=20)
  const h = Math.max(40, Math.round((asset.h || 150) * k))
  store.updateAsset({ ...asset, w, h })
}

HANDLERS.delete_object = async function delete_object({ object_id }) {
  const { store } = await _assetById(object_id)   // валідує існування
  store.deleteAsset(object_id)                    // Command-pattern → undo працює
}

// ── Phase 1 Block B2 (2026-08-01): «домалюй дотичну» — ДОДАТИ криву в існуючий графік.
// Не замінити (це set_graph_expression): push у data.state.expressions. Стелю
// MAX_GRAPH_EXPRESSIONS=6 пильнуємо ТУТ (BE не бачить кількість кривих — рев'ю 2026-08-01).
const MAX_GRAPH_EXPRESSIONS = 6
const GRAPH_COLORS = ['#dc2626', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2']
HANDLERS.graph_add_expression = async function graph_add_expression({ object_id, src, label }) {
  const { store, asset } = await _assetById(object_id)
  if (asset.type !== 'graph_calculator') throw new Error('Це не графік — додати криву можна лише в графічний калькулятор.')
  const data = JSON.parse(JSON.stringify(asset.data || {}))
  if (!data.state) data.state = { expressions: [], params: {}, viewport: { cx: 0, cy: 0, scale: 38 } }
  const srcClean = String(src).replace(/^\s*y\s*=\s*/i, '').trim()
  if (!srcClean) throw new Error('Не зрозумів вираз нової кривої.')
  const exprs = data.state.expressions || []
  if (exprs.length >= MAX_GRAPH_EXPRESSIONS) {
    throw new Error(`Графік уже має ${MAX_GRAPH_EXPRESSIONS} кривих — більше на одному полі нечитабельно. Скажіть «заміни ... на ${srcClean}», і я оновлю одну з них.`)
  }
  data.state.expressions = [
    ...exprs,
    { id: `e-${_uuid().slice(0, 8)}`, src: srcClean, color: GRAPH_COLORS[exprs.length % GRAPH_COLORS.length], hidden: false, label: label || undefined },
  ]
  store.updateAsset({ ...asset, data })
}

// Phase 1 Block B3 (2026-08-01): перенос об'єкта на іншу сторінку.
// ОДИН compound WBCommand (вимога рев'ю №002, зразок reorderPages):
// apply() = delete з джерела + add на ціль, revert() = навпаки.
// Ctrl+Z вертає ЦІЛИЙ перенос — не два кроки, не частковий стан.
HANDLERS.move_object_to_page = async function move_object_to_page({ object_id, page }) {
  const { store } = await _store()
  const pageIndex = Number(page) - 1   // 1-based «друга сторінка» → індекс 1
  if (pageIndex < 0 || pageIndex >= (store.pages || []).length) {
    throw new Error('Сторінки з таким номером на дошці немає.')
  }
  // Знайти об'єкт по ВСІХ сторінках (джерело може бути не поточна).
  let sourcePage = null
  let asset = null
  for (const p of store.pages || []) {
    const a = (p.assets || []).find(x => x.id === object_id)
    if (a) { sourcePage = p; asset = a; break }
  }
  if (!sourcePage) throw new Error('Об\'єкта не знайдено на дошці.')
  const targetPage = store.pages[pageIndex]
  if (sourcePage.id === targetPage.id) return   // no-op (BE вже відсіяв)

  // compound WBCommand — ОДИН запис в undoStack.
  const cmd = {
    apply: () => {
      store.deleteAssetFromPage(sourcePage.id, object_id, { skipHistory: true })
      store.addAsset({ ...asset }, targetPage.id, { skipHistory: true })
    },
    revert: () => {
      store.deleteAssetFromPage(targetPage.id, object_id, { skipHistory: true })
      store.addAsset({ ...asset }, sourcePage.id, { skipHistory: true })
    },
  }
  cmd.apply()
  // trimStack за зразком інших store-дій (deleteAsset/addAsset).
  const MAX = 100
  const trim = (s) => s.length > MAX ? s.slice(s.length - MAX) : s
  store.undoStack = trim([...store.undoStack, cmd])
  store.redoStack = []
}


// Phase 2.11: геометричні побудови = toggles планіметрії (описане/вписане коло, медіани…)
HANDLERS.set_geometry = async function set_geometry({ object_id, feature, on }) {
  const { store, asset } = await _assetById(object_id)
  if (asset.type !== 'geometry_2d_v2') throw new Error('Це не геометрична фігура.')
  // Етап 0 MCL (аудит §3.2, 2026-08-13): toggles визначені ПЕР-ПРЕСЕТ у
  // geo2d-presets.js, а handler писав будь-який ключ без перевірки.
  // «Покажи медіани на трапеції» → запис у стан проходив, Інтегралик
  // звітував успіх, на екрані не змінювалось нічого, помилки не було ніде.
  // Це той самий клас збою, що лікувався в чаті: правдоподібна відповідь
  // без дії. Тепер — чесна відмова зі списком того, що фігура СПРАВДІ вміє.
  try { await import('@/modules/winterboard/vendor/geo2d') } catch { /* гілка нижче fail-open */ }
  const spec = (typeof window !== 'undefined')
    ? window.Geo2D?.PRESETS?.[asset.data?.preset] : null
  if (spec) {
    const known = Array.isArray(spec.toggles) ? spec.toggles : []
    if (!known.some((t) => t?.key === feature)) {
      const avail = known.map((t) => t?.label || t?.key).filter(Boolean).slice(0, 8)
      throw new Error(avail.length
        ? `У цієї фігури немає такої побудови. Вона вміє: ${avail.join(', ')}.`
        : 'Ця фігура не має перемикачів побудов.')
    }
  }
  // spec === undefined (бандл не завантажився) → fail-open: фігура вже на
  // дошці, тож бандл майже напевно є; блокувати легітимний виклик через
  // збій завантаження каталогу було б новою тихою відмовою.
  const toggles = { ...(asset.data?.toggles || {}), [feature]: on !== false }
  store.updateAsset({ ...asset, data: { ...asset.data, toggles } })
}

HANDLERS.delete_page = async function delete_page({ pageIndex }) {
    // N1 Фаза 1: видалення сторінки (2026-08-07). Дзеркало add_page.
    // Стор сам охороняє від видалення останньої сторінки (return false).
    const { store } = await _store()
    const ok = store.deletePageUndoable(pageIndex)
    if (!ok) {
      throw new Error('Не можна видалити останню сторінку')
    }
  }

HANDLERS.add_tool = async function add_tool({ insert_id }) {
  const items = await _allInserts()
  const e = items.find((x) => x.id === insert_id)
  if (e) {
    // WBSoloRoom слухає й вставляє через addAtPosition (той самий шлях, що click-insert)
    window.dispatchEvent(new CustomEvent('m4sh:wb-insert', {
      detail: { mime: e.dragMime, payload: e.payload },
    }))
    return
  }
  // TLV2-06R: готовий рецепт уроку (`tpl.*`) — не інструмент і не окремий список Інтегралика.
  // Резолвиться спільним реєстром рецептів і йде тим самим m4sh:wb-insert → addAtPosition.
  const { findBoardRecipe, BOARD_RECIPE_MIME } = await import('@/modules/winterboard/board/preparedBoardRecipes')
  const recipe = findBoardRecipe(insert_id)
  if (!recipe) throw new Error('Такого інструмента поки немає на дошці.')  // fail-closed
  if (recipe.status === 'gap') throw new Error(`Цей готовий об'єкт поки не підтримується: ${recipe.gapReason}`)
  window.dispatchEvent(new CustomEvent('m4sh:wb-insert', {
    detail: { mime: BOARD_RECIPE_MIME, payload: JSON.stringify({ recipeId: recipe.id }) },
  }))
}

/** Виконати дію Інтегралика на дошці. Кидає Error з людським повідомленням. */
export async function runBoardAction(action) {
  const handler = HANDLERS[action?.kind]
  if (!handler) throw new Error('Ця дія на дошці ще не підтримується.')  // fail-closed
  await handler(action.payload || {})
}

// ── Phase 2.6 «зір»: read-only стан дошки → компактний summary для parse-контексту ──
// Тільки читання store (жодних мутацій); лише власна відкрита дошка тьютора.
//
// Етап 0 MCL (аудит §3.1/§3.3, 2026-08-13): раніше тут було 7 ключів на
// 15 overlay-типів, і один із них — `nmt_3d` — НЕ збігався з реальним
// `asset.type === 'nmt3d'` (types/nmt3d.ts:49). Наслідок: 3D-фігура їхала
// в контекст без назви, «пересунь піраміду» не працювало й НЕ МОГЛО —
// резолвер шукає об'єкт за токенами підпису. Без підпису об'єкт для
// Інтегралика не існує. Повноту мапи стереже guard-тест
// (`assetKinds.spec.js`): новий overlay-тип без підпису = падіння тесту.
export const KIND_LABELS = {
  graph_calculator: 'графік',
  formula_card: 'формула',
  image: 'зображення',
  youtube: 'відео',
  geometry_solid: 'стереометрія',
  geometry_2d_v2: 'планіметрія',
  nmt3d: 'стереометрія',
  theory_card: 'картка',
  history_card: 'довідка',
  timeline_card: 'шкала часу',
  map_card: 'карта',
  nmt_task: 'NMT-задача',
  calculus_card: 'аналіз функції',
  quadratic_card: 'парабола',
  trig_circle: 'тригонометричне коло',
  helix: 'гелікс',
  trig_solver: 'тригонометричне рівняння',
  geomash_scene: 'геометрична сцена',
  graphmash_3d: '3D-графік',
  mash_scene: 'MASH-сцена',
  visual_capsule: 'анімація',   // TLV2-03 — капсула V-D3.1 як об'єкт дошки
}

/**
 * asset → {kind, label} для контексту Інтегралика. ЕКСПОРТОВАНА, щоб
 * guard-тест міг довести покриття всіх overlay-типів без монтування дошки.
 *
 * label — те, за чим тьютор упізнає СВІЙ об'єкт словами («пересунь
 * піраміду», «покажи медіани на трикутнику»): для фігур це назва фігури,
 * для графіка — вирази, для картки — заголовок. kind без label — об'єкт
 * видно, але не можна адресувати, коли їх кілька.
 */
/**
 * Поточні ЗНАЧЕННЯ параметрів об'єкта — половина «State» з ТЗ MCL (INV-MCL-2).
 *
 * Етап 2 (READ). Без цього фраза «зменш коефіцієнт a на одиницю» не має
 * розв'язку: моделі нема від чого віднімати. Схема без значень так само
 * марна, як значення без схеми.
 *
 * Три правила, які тут дотримані:
 *   • лише те, що тьютор може НАЗВАТИ словами (коефіцієнт, кут, масштаб) —
 *     службові id, кольори й прапорці рендера сюди не йдуть;
 *   • жодних відповідей задач (той самий закон, що `_ANSWER_KEYS` в enrich);
 *   • компактно: це їде в КОЖЕН запит, тож числа округлені, списки обрізані.
 */
export function assetParams(a) {
  const d = a?.data || {}
  const num = (v) => (typeof v === 'number' && Number.isFinite(v)
    ? Math.round(v * 1000) / 1000 : undefined)
  const clean = (o) => Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''))

  switch (a?.type) {
    case 'graph_calculator': {
      const st = d.state || {}
      const params = {}
      for (const [k, cfg] of Object.entries(st.params || {})) {
        if (cfg && typeof cfg === 'object') params[k] = num(cfg.value)
      }
      const pts = Object.entries(st.points || {}).slice(0, 8)
        .map(([id, p]) => `${id}(${num(p?.x)}; ${num(p?.y)})`)
      return clean({
        expressions: (st.expressions || []).map((e) => e.src).filter(Boolean).slice(0, 6),
        params: Object.keys(params).length ? params : undefined,
        // Масштаб і центр — те, чим тьютор просить «покажи від −10 до 10».
        viewport: st.viewport ? clean({
          cx: num(st.viewport.cx), cy: num(st.viewport.cy), scale: num(st.viewport.scale),
        }) : undefined,
        points: pts.length ? pts : undefined,
      })
    }
    case 'quadratic_card':
      return clean({ a: num(d.a), b: num(d.b), c: num(d.c), sign: d.sign })
    case 'calculus_card':
      return clean({
        mode: d.mode, expr: d.expr, x0: num(d.x0), h: num(d.h),
        a: num(d.a), b: num(d.b), riemann: d.riemann, N: num(d.N),
      })
    case 'trig_circle':
      return clean({ theta: num(d.theta), speed: num(d.speed) })
    case 'helix':
      return clean({ theta: num(d.theta), phi: num(d.phi), pitch: num(d.pitch) })
    case 'trig_solver':
      return clean({ type: d.type, rel: d.rel, a: num(d.a) })
    case 'nmt3d':
      return clean({ template: d.templateKey, mode: d.mode, ...(d.params || {}) })
    case 'geometry_2d_v2': {
      // Увімкнені побудови — саме те, про що питають «а медіани показані?»
      const on = Object.entries(d.toggles || {}).filter(([, v]) => v).map(([k]) => k)
      return clean({ preset: d.preset, shown: on.length ? on.slice(0, 10) : undefined })
    }
    case 'geomash_scene': {
      // Імена об'єктів сцени = те, чим тьютор їх називає (A, B, α, f).
      const ids = (d.scene?.objects || []).map((o) => o?.id).filter(Boolean).slice(0, 20)
      if (!ids.length) return {}
      // ЗНАЧЕННЯ беремо з рушія, а не рахуємо тут: GeoEngine.getValue() уже
      // друкує рівно те, що тьютор промовляє вголос («α = 47.3°», «D = (-5.00,
      // -5.00)», «c: r = 3.5»), і те саме показує сайдбар сцени. Власна
      // арифметика тут означала б другу реалізацію градусної міри — і першу ж
      // ніч, коли вони розійдуться, ми не помітимо.
      //
      // Живий прогін 2026-08-15: на питання «яка градусна міра кута»
      // Інтегралик чесно відповів «координати й кути у стані не вказані» —
      // чесно, але марно: значення були на екрані, у контекст їхали лише імена.
      const eng = typeof window !== 'undefined' ? window.GeoEngine : null
      if (eng?.deserialize && eng?.getValue) {
        try {
          const { objects } = eng.deserialize(d.scene)
          const vals = ids.slice(0, 12).map((id) => eng.getValue(objects, id)).filter(Boolean)
          if (vals.length) return { objects: vals }
        } catch { /* сцена з чужого формату — краще імена, ніж нічого */ }
      }
      return { objects: ids }
    }
    case 'formula_card':
      return clean({ formula: d.formula })
    default:
      return {}
  }
}

export function summarizeAsset(a) {
  let label = ''
  let kind = KIND_LABELS[a.type] || a.type
  const d = a.data || {}
  if (a.type === 'graph_calculator') {
    label = (d.state?.expressions || []).map((e) => e.src).filter(Boolean).join(' ; ')
  } else if (a.type === 'formula_card') {
    label = d.formula || ''
  } else if (a.type === 'theory_card') {
    label = d.title || String(d.body || '').slice(0, 80)
  } else if (a.type === 'timeline_card') {
    // Підсумок має дати Інтегралику адресу: назву, активну подію і короткий
    // список решти. Без активної події він не знав би, про що зараз мова.
    const evs = Array.isArray(d.events) ? d.events : []
    const active = evs.find((e) => e && e.id === d.active_event_id)
    const names = evs.map((e) => (e && e.label) || '').filter(Boolean).slice(0, 6)
    label = [d.title || '', active ? `активна: ${active.label}` : '', names.join(' · ')]
      .filter(Boolean).join(' — ')
  } else if (a.type === 'map_card') {
    const ms = Array.isArray(d.markers) ? d.markers : []
    const active = ms.find((m) => m && m.id === d.active_marker_id)
    const names = ms.map((m) => (m && m.label) || '').filter(Boolean).slice(0, 6)
    label = [d.title || '', active ? `активне: ${active.label}` : '', names.join(' · ')]
      .filter(Boolean).join(' — ')
  } else if (a.type === 'geometry_2d_v2') {
    // Назва пресета (Трикутник/Коло…) — щоб Інтегралик міг адресувати планіметрію
    const preset = d.preset
    const meta = (typeof window !== 'undefined' ? window.GEO_PRESETS : null) || []
    label = (meta.find((m) => m.type === preset)?.full) || preset || 'фігура'
  } else if (a.type === 'nmt3d') {
    // Людська назва шаблону («Піраміда (4)», «Куб») — саме за нею тьютор
    // називає фігуру. templateKey як фолбек: гірше, ніж назва, краще, ніж ніщо.
    label = NMT3D_TEMPLATE_LABELS[d.templateKey] || d.templateKey || ''
  } else if (a.type === 'calculus_card') {
    label = `${d.mode === 'integral' ? 'первісна' : 'похідна'}: ${d.expr || ''}`
  } else if (a.type === 'quadratic_card') {
    // ⚠️ Назвою картки Інтегралик не лише адресує об'єкт — він її ВИМОВЛЯЄ.
    // Було `y = ${d.a}x² + ${d.b}x + ${d.c}` з типовими 1/0/0, тобто вголос
    // звучало «ігрек дорівнює один ікс квадрат плюс нуль ікс плюс нуль», а
    // при від'ємних — «плюс мінус три ікс». Спільний `renderPoly` пише так,
    // як пишуть у математиці. Той самий клас дефекту 09-05 виправлено у
    // самому віджеті (`QuadraticRenderer.vue` + `vendor/quad`).
    label = `y = ${renderPoly([
      [Number(d.a ?? 1), 'x²'],
      [Number(d.b ?? 0), 'x'],
      [Number(d.c ?? 0), ''],
    ])}`
  } else if (a.type === 'trig_solver') {
    label = `${d.type || 'sin'}(x) ${d.rel || '='} ${d.a ?? ''}`
  } else if (a.type === 'geomash_scene') {
    const n = (d.scene?.objects || []).length
    label = n ? `${n} об'єктів` : 'порожня'
  } else if (a.type === 'graphmash_3d') {
    label = d.starterKind || ''
  } else if (a.type === 'mash_scene') {
    label = d.title || ''
  } else if (a.type === 'nmt_task') {
    // Умова задачі (data.question, LaTeX/HTML → плоский текст):
    // Інтегралик може РОЗВ'ЯЗУВАТИ задачі з дошки. Контент тьютора, не PII учнів.
    // Відповідь і розбір ідуть окремими полями (nmtTaskExtras) — вони мають
    // власний бюджет на бекенді, а `label` обрізається на 240 символах і
    // витіснив би саму умову.
    label = String(d.question || '').replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, 200)
  }
  return { kind, label: String(label).slice(0, 240) }
}

/** LaTeX/HTML → плоский текст для контексту моделі. */
function flatten(v, cap) {
  return String(v ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, cap)
}

/**
 * Відповідь і розбір картки задачі — окремо від `label`.
 *
 * ⚠️ Живий випадок власника 2026-08-27. Він спитав Інтегралика «а що в
 * розв'язках цього завдання не так», і той чесно відповів, що бачить лише
 * умову. Так і було: у контекст ішли тільки `question` і `correctAnswer`,
 * причому `correctAnswer` заповнений ЛИШЕ для відкритої відповіді. Для
 * «відповідності» (той самий скріншот) і для вибору варіанта модель не
 * отримувала ані відповіді, ані розбору — і не могла нічого перевірити.
 *
 * 🔴 Розбір — тільки за ВІДКРИТИМ. Рішення власника: модель бачить розбір
 * лише коли тьютор сам натиснув «Показати розбір» на картці. Причина не
 * технічна: розбір — готова відповідь, і коли доступ до Інтегралика матиме
 * учень, «завжди видно» стало б каналом для списування. Прапорець `showSolution`
 * уже є в даних картки й уже керує показом на екрані — беремо його, а не
 * заводимо новий.
 */
export function nmtTaskExtras(d) {
  const out = {}

  // Відповідь — для ВСІХ типів. Досі була лише в open_answer, тому на
  // «відповідності» модель мовчала.
  let answer = ''
  if (Array.isArray(d.pairs) && d.pairs.length) {
    answer = d.pairs
      .map((p) => `${flatten(p.left, 60)} — ${flatten(p.right, 60)}`)
      .join('; ')
  } else if (Array.isArray(d.options) && d.options.some((o) => o?.isCorrect)) {
    answer = d.options
      .filter((o) => o?.isCorrect)
      .map((o) => `${o.letter ?? ''}) ${flatten(o.text, 60)}`.trim())
      .join(', ')
  } else if (d.correctAnswer != null && String(d.correctAnswer).trim()) {
    answer = flatten(d.correctAnswer, 80)
  }
  if (answer) out.answer = answer.slice(0, 240)

  // Розбір — лише коли тьютор його відкрив.
  // 400 символів: за виміром 13 000 розборів банку медіана 114, 90-й
  // перцентиль 317 — тобто межа ріже хвіст, а не типовий випадок.
  if (d.showSolution && d.solution) {
    const s = flatten(d.solution, 400)
    if (s) out.solution = s
  }
  return out
}

export async function buildBoardSummary() {
  const { useWBStore } = await import('@/modules/winterboard/board/state/boardStore')
  const store = useWBStore()
  const pages = store.pages || []
  const currentPage = (store.currentPageIndex ?? 0) + 1   // 1-based: сторінка, яку бачить юзер
  // Стабільний id тієї ж сторінки. Номер зсувається, щойно вчитель вставить
  // сторінку посеред уроку, тому прив'язка «сторінка → етап» тримається на id.
  // ⚠️ Read-only спостереження: сервер за ним лише ЧИТАЄ свою мапу прив'язок.
  // Невідомий або порожній id → сторінка нейтральна. Нічого не пишемо.
  const currentPageId = pages[store.currentPageIndex ?? 0]?.id ?? null
  const items = []
  pages.forEach((page, idx) => {
    const p = idx + 1
    let penStrokes = 0
    for (const s of page.strokes || []) {
      if (s.tool === 'text' && (s.text || '').trim()) {
        items.push({ page: p, kind: 'текст', label: s.text.trim().slice(0, 120), ...materialLang(s.data) })
      } else if (s.tool !== 'text') penStrokes++
    }
    if (penStrokes > 0) items.push({ page: p, kind: 'малюнок', label: `${penStrokes} штрихів` })
    for (const a of page.assets || []) {
      const { kind, label } = summarizeAsset(a)
      // id — для Resolution об'єкта на BE (Phase 2.8 set_param). LLM його НЕ бачить
      // (у промпт іде лише kind+label; Закон C: навігацію робить Runtime, не модель).
      // params — етап 2 READ (INV-MCL-2): поточні ЗНАЧЕННЯ, без яких «зменш a
      // на одиницю» не має розв'язку. Бюджет контексту стереже BE.
      const params = assetParams(a)
      // Відповідь і розбір картки задачі — окремими полями, з власним
      // бюджетом на BE (див. nmtTaskExtras).
      // 2026-09-06, живий тест власника (Вікіпедія): на «в якому році був
      // написаний» модель відповіла «поточних значень на дошці я не бачу» —
      // хоча картка з відповіддю лежала перед нею. Причина: у стан дошки
      // йшов лише ЗАГОЛОВОК картки (`label = d.title`), а текст — ні.
      // Наслідок був подвійний: модель не могла відповісти з дошки Й на
      // кожне уточнення ходила у Вікіпедію по ту саму статтю, кладучи
      // другу картку з тим самим текстом.
      // ⚠️ Окремим полем, а НЕ довшим `label`: за label модель АДРЕСУЄ
      // об'єкти (_resolve_any_object на BE), і роздути його означало б
      // мовчки змінити пошук об'єкта. Той самий взірець, що `answer`/
      // `solution` у nmt_task — BE ріже їх власним бюджетом.
      const cardText = a.type === 'theory_card'
        ? { text: String((a.data || {}).body || '').replace(/\s+/g, ' ').trim().slice(0, 400) }
        : {}
      const extras = a.type === 'nmt_task' ? nmtTaskExtras(a.data || {}) : cardText
      items.push({ page: p, kind, label, id: a.id,
                   ...(Object.keys(params).length ? { params } : {}),
                   ...extras, ...materialLang(a.data) })
    }
    for (const t of page.testObjects || []) {
      // Умова задачі (label, LaTeX/HTML → плоский текст) + відповідь: Інтегралик
      // може РОЗВ'ЯЗУВАТИ задачі з дошки. Це контент тьютора (не дані учнів).
      const cond = String(t.label || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
      const ans = String(t.correctAnswer || '').trim().slice(0, 40)
      items.push({ page: p, kind: 'NMT-задача', label: (cond + (ans ? ` [відповідь: ${ans}]` : '')).slice(0, 240) })
    }
  })
  return { pages: pages.length, currentPage, currentPageId, items: items.slice(0, 60) }
}
