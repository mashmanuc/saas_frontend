/**
 * «Дзеркало дошки» — проба на пульті (власник 2026-10-08: «Ти зможеш це робити за ніч? Бо завтра
 * п'ятниця я маю можливість писати на дошці. І протестувати це»).
 *
 * Телефон стоїть і дивиться на шкільну дошку. Учитель один раз ставить 4 кути дошки на кадрі;
 * коли перед дошкою ~1 с ніхто не рухається і написане змінилось, вирівняний знімок лягає
 * фоном сторінки M4SH наявною командою `photo.background` (LAW §9 v1.19). Без ШІ й без
 * розпізнавання, без бібліотек: перспектива за 4 кутами — гомографія 3×3 у JS.
 *
 * Чисті функції (кадр — масив пікселів), щоб їх ловили тести: камери в тестах немає.
 *
 *   - пошук змін — на зменшеному сірому кадрі (2–3 рази на секунду), яскравість кадру
 *     нормалізується (автоекспозиція телефона «дихає»), рішення — за ЧАСТКОЮ змінених клітинок;
 *   - велика суцільна зміна, що заходить з краю дошки (тіло збоку чи знизу), — «людина?»:
 *     не відправляємо, поки вона не простоїть нерухомо довше за PERSON_ACCEPT_MS (тоді це
 *     найпевніше стерта дошка, а не людина);
 *   - повна роздільність і перспектива — лише в момент відправки.
 */

export interface Pt { x: number; y: number }
/** Кути дошки: лівий верхній, правий верхній, правий нижній, лівий нижній. */
export type Quad = [Pt, Pt, Pt, Pt]
/** Мінімум від ImageData, щоб тести не залежали від DOM. */
export interface Pixels { data: Uint8ClampedArray | Uint8Array; width: number; height: number }
export interface Rect { x: number; y: number; w: number; h: number }

/** Кадр аналізу: ширина й висота вирівняної дошки в пікселях і розмір клітинки. */
export const AN_W = 384
export const AN_H = 192
export const CELL = 12
export const GX = AN_W / CELL   // 32
export const GY = AN_H / CELL   // 16

/** Розмір знімка, що їде на дошку: пропорції сторінки M4SH (1920×1080), дошка вписана з полями. */
export const OUT_W = 1600
export const OUT_H = 900
export const OUT_JPEG_QUALITY = 0.85

export interface MirrorTuning {
  /** Різниця середнього клітинки (у σ кадру), з якої клітинка «змінилась» */
  cellThr: number
  /** Скільки клітинок між сусідніми кадрами — це вже рух */
  motionCells: number
  /** Скільки клітинок проти останнього знімка — це нове на дошці */
  changeCells: number
  /** Скільки має бути тихо, щоб кадр вважати стабільним */
  stableMs: number
  /** Найменший проміжок між відправками */
  minIntervalMs: number
  /** Стеля відправок за одне ввімкнення */
  maxSends: number
  /** Скільки «людина?» має простояти нерухомо, щоб усе ж відправити (стерли дошку) */
  personAcceptMs: number
  /** Межі «людини»: частка площі, частка висоти, заповнення рамки */
  personArea: number
  personHeight: number
  personFill: number
  /** Крейда (ТЗ 2026-10-09 §1): піксель світліший за місцеве тло на `inkRel` частку і на `inkAbs` рівнів */
  inkRel: number
  inkAbs: number
  /** Клітинка «змінилась за крейдою»: різниця частки крейди більша за max(inkCellAbs, inkCellRel × більшої) */
  inkCellAbs: number
  inkCellRel: number
  /** Скільки клітинок мають ВТРАТИТИ крейду, щоб це було стирання (а не відблиск, що «з'їв» штрихи) */
  eraseCells: number
  /** Скільки клітинок `tone` проти останнього знімка — це «змінилось світло» (лише для журналу) */
  lightCells: number
  /**
   * Стійкість нової крейди (урок 2, 09.10): клітинка рахується зміненою, лише якщо вона змінена
   * з тим самим знаком стільки кадрів аналізу поспіль без руху (мерехтіння 2–4 клітинок — ні).
   */
  inkSteadyFrames: number
}

export const MIRROR_TUNING: MirrorTuning = {
  cellThr: 0.2,
  motionCells: 3,
  changeCells: 2,
  stableMs: 1200,
  minIntervalMs: 5000,
  maxSends: 150,
  personAcceptMs: 10_000,
  personArea: 0.06,
  personHeight: 0.35,
  personFill: 0.4,
  // Замір на 21 знімку уроку 2026-10-09 (ТЗ §1): нове на дошці — ≥ 2 клітинки з'явилась крейда
  // (найменший справжній напис «12» — 3 клітинки; фокус і світло — не більше 1). Підібрано на
  // тому самому корпусі — справжня перевірка наступний урок.
  inkRel: 0.1,
  inkAbs: 8,
  inkCellAbs: 0.04,
  inkCellRel: 0.5,
  eraseCells: 20,
  lightCells: 10,
  // Урок 2 (09.10): 5 повторів «людина? → 10 с → надіслано» — крейда «змінилась» у 2–4 клітинках
  // одного кадру (шум камери), а на парах знімків три з них — +0. 3 кадри × SAMPLE_MS ≈ 1,2 с —
  // стільки ж, скільки дошка й так «завмирає» (stableMs), тож звичайний знімок не запізнюється.
  inkSteadyFrames: 3,
}

/** Півсторона вікна місцевого тла для «карти крейди» (пікселі кадру аналізу): штрих ≪ вікна ≪ пляма світла. */
export const INK_RADIUS = 6

/** Скільки разів на секунду дивимось на кадр (≈2,5 — менше нагріву й батареї). */
export const SAMPLE_MS = 400

// ── Геометрія ─────────────────────────────────────────────────────────────────────

/**
 * Гомографія, що переводить точки `from` у точки `to` (8 невідомих, h8 = 1).
 * Вироджені точки (три на одній прямій тощо) → null.
 */
export function homography(from: Quad, to: Quad): number[] | null {
  const A: number[][] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]
    const { x: u, y: v } = to[i]
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u])
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v, v])
  }
  // Гаусс із вибором головного елемента
  for (let c = 0; c < 8; c++) {
    let piv = c
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r
    if (Math.abs(A[piv][c]) < 1e-10) return null
    if (piv !== c) [A[c], A[piv]] = [A[piv], A[c]]
    for (let r = 0; r < 8; r++) {
      if (r === c) continue
      const f = A[r][c] / A[c][c]
      if (f === 0) continue
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k]
    }
  }
  const h = A.map((row, i) => row[8] / row[i])
  h.push(1)
  if (!h.every(Number.isFinite)) return null
  // Вироджене перетворення (кути на одній прямій): система розв'язалась, але площину стягує в лінію
  const det = h[0] * (h[4] * h[8] - h[5] * h[7]) - h[1] * (h[3] * h[8] - h[5] * h[6]) + h[2] * (h[3] * h[7] - h[4] * h[6])
  return Math.abs(det) > 1e-9 ? h : null
}

export function applyH(h: number[], x: number, y: number): Pt {
  const w = h[6] * x + h[7] * y + h[8]
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w }
}

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

/** Опуклий чотирикутник з кутами по колу (без перехрещених сторін). */
export function isConvexQuad(q: Quad): boolean {
  const s = [0, 1, 2, 3].map((i) => cross(q[i], q[(i + 1) % 4], q[(i + 2) % 4]))
  return s.every((v) => v > 0) || s.every((v) => v < 0)
}

/** Площа чотирикутника (формула шнурка). */
export function quadArea(q: Quad): number {
  let a = 0
  for (let i = 0; i < 4; i++) a += q[i].x * q[(i + 1) % 4].y - q[(i + 1) % 4].x * q[i].y
  return Math.abs(a) / 2
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/** Приблизні пропорції дошки (ширина / висота) за середніми протилежними сторонами. */
export function boardAspect(q: Quad): number {
  const w = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2
  const h = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2
  return h > 0 ? w / h : 1
}

/** Вписати дошку з пропорціями `aspect` у W×H з полями (без розтягування), по центру. */
export function fitRect(aspect: number, W: number, H: number): Rect {
  let w = W
  let h = Math.round(W / aspect)
  if (h > H) { h = H; w = Math.round(H * aspect) }
  return { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h }
}

/** Гомографія з прямокутника w×h (0..w, 0..h) у кути дошки на кадрі. */
export function rectToQuad(w: number, h: number, quad: Quad): number[] | null {
  return homography([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], quad)
}

/** Кути в частках кадру (0..1) → у пікселі кадру розміром w×h. */
export function quadToPixels(q: Quad, w: number, h: number): Quad {
  return q.map((p) => ({ x: p.x * w, y: p.y * h })) as Quad
}

// ── Кадр аналізу ──────────────────────────────────────────────────────────────────

/**
 * Кадр аналізу — дві карти клітинок GX×GY:
 *   - `tone` — середня яскравість клітинки, нормалізована на кадр (для «руху» й «людини»);
 *   - `ink`  — частка пікселів-крейди в клітинці (для «нового на дошці»). Урок 2026-10-09 показав,
 *     що за середньою яскравістю дрейф світла біля вікна дає знімки без нового напису (Б-176):
 *     12 з 20 переходів уроку були повторами. Плавна пляма світла піднімає і піксель, і його тло —
 *     частка крейди не змінюється.
 */
export interface MirrorFrame { tone: Float32Array; ink: Float32Array }

/**
 * Вирівняна дошка в сірому AN_W×AN_H (найближчий піксель). `tone` нормалізована: мінус середнє,
 * поділити на σ кадру — зміна експозиції чи балансу білого всього кадру не є «зміною».
 * `ink` — піксель світліший за середнє вікна (2·INK_RADIUS+1)² навколо на частку `inkRel` і на `inkAbs`.
 */
export function analyzeFrame(src: Pixels, quadPx: Quad, t: MirrorTuning = MIRROR_TUNING): MirrorFrame | null {
  const h = rectToQuad(AN_W, AN_H, quadPx)
  if (!h) return null
  const gray = new Float32Array(AN_W * AN_H)
  const { data, width, height } = src
  let sum = 0
  let sum2 = 0
  for (let y = 0; y < AN_H; y++) {
    const yy = y + 0.5
    for (let x = 0; x < AN_W; x++) {
      const xx = x + 0.5
      const w = h[6] * xx + h[7] * yy + h[8]
      let sx = Math.floor((h[0] * xx + h[1] * yy + h[2]) / w)
      let sy = Math.floor((h[3] * xx + h[4] * yy + h[5]) / w)
      if (sx < 0) sx = 0; else if (sx >= width) sx = width - 1
      if (sy < 0) sy = 0; else if (sy >= height) sy = height - 1
      const i = (sy * width + sx) * 4
      const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      gray[y * AN_W + x] = g
      sum += g
      sum2 += g * g
    }
  }
  const n = AN_W * AN_H
  const mean = sum / n
  // Масштаб — σ кадру, але не менше 10 % середньої яскравості: на чистій дошці σ — це шум
  // камери, і ділити на нього — роздувати шум у «зміни». Частка від середнього так само
  // множиться разом з експозицією, тож зміна яскравості всього кадру й далі не є зміною.
  const std = Math.max(Math.sqrt(Math.max(sum2 / n - mean * mean, 0)), 0.1 * mean, 1)
  const cells = new Float32Array(GX * GY)
  for (let y = 0; y < AN_H; y++) {
    const cy = Math.floor(y / CELL)
    for (let x = 0; x < AN_W; x++) cells[cy * GX + Math.floor(x / CELL)] += gray[y * AN_W + x]
  }
  const per = CELL * CELL
  for (let i = 0; i < cells.length; i++) cells[i] = (cells[i] / per - mean) / std
  return { tone: cells, ink: inkCells(gray, t) }
}

/** Частка пікселів-крейди в кожній клітинці; тло — середнє вікна за інтегральним зображенням. */
function inkCells(gray: Float32Array, t: MirrorTuning): Float32Array {
  const W1 = AN_W + 1
  const integ = new Float64Array(W1 * (AN_H + 1))
  for (let y = 0; y < AN_H; y++) {
    let row = 0
    for (let x = 0; x < AN_W; x++) {
      row += gray[y * AN_W + x]
      integ[(y + 1) * W1 + x + 1] = integ[y * W1 + x + 1] + row
    }
  }
  const ink = new Float32Array(GX * GY)
  const r = INK_RADIUS
  for (let y = 0; y < AN_H; y++) {
    const y0 = Math.max(0, y - r)
    const y1 = Math.min(AN_H, y + r + 1)
    const cy = Math.floor(y / CELL)
    for (let x = 0; x < AN_W; x++) {
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(AN_W, x + r + 1)
      const s = integ[y1 * W1 + x1] - integ[y0 * W1 + x1] - integ[y1 * W1 + x0] + integ[y0 * W1 + x0]
      const bg = s / ((x1 - x0) * (y1 - y0))
      const g = gray[y * AN_W + x]
      if (g - bg >= t.inkAbs && g >= bg * (1 + t.inkRel)) ink[cy * GX + Math.floor(x / CELL)] += 1
    }
  }
  const per = CELL * CELL
  for (let i = 0; i < ink.length; i++) ink[i] /= per
  return ink
}

/**
 * Клітинки, де змінилась крейда, проти кадру `a`. Спершу знімається спільний для всього кадру
 * множник (фокус, різкість, експозиція роблять усі штрихи товщими чи тоншими разом) — медіана
 * відношень у клітинках, де крейда є в обох; лише потім клітинка «змінилась», якщо різниця
 * більша за max(inkCellAbs, inkCellRel × більшої з двох часток). `added` — крейди стало більше
 * (новий напис), `removed` — менше (стерли, або відблиск «з'їв» штрихи). `sign` — знак зміни
 * кожної клітинки: +1 з'явилась крейда, −1 зникла, 0 без змін.
 */
export interface InkChange { mask: Uint8Array; sign: Int8Array; count: number; added: number; removed: number }

export function inkChangedCells(a: Float32Array, b: Float32Array, t: MirrorTuning = MIRROR_TUNING): InkChange {
  const ratios: number[] = []
  for (let i = 0; i < a.length; i++) if (a[i] >= 0.04 && b[i] >= 0.04) ratios.push(b[i] / a[i])
  let m = 1
  if (ratios.length >= 5) {
    ratios.sort((p, q) => p - q)
    m = Math.min(2, Math.max(0.5, ratios[Math.floor(ratios.length / 2)]))
  }
  const mask = new Uint8Array(a.length)
  const sign = new Int8Array(a.length)
  let added = 0
  let removed = 0
  for (let i = 0; i < a.length; i++) {
    const bs = b[i] / m
    if (Math.abs(bs - a[i]) > Math.max(t.inkCellAbs, t.inkCellRel * Math.max(a[i], bs))) {
      mask[i] = 1
      if (bs > a[i]) { added++; sign[i] = 1 } else { removed++; sign[i] = -1 }
    }
  }
  return { mask, sign, count: added + removed, added, removed }
}

/** Стеля лічильника стійкості: далі рахувати немає сенсу, а Int16 не переповнюється за урок. */
const RUN_CAP = 1000

/**
 * Стійка зміна крейди (урок 2, 09.10: повтори від мерехтіння 2–4 клітинок у випадкових місцях).
 * `runs` — для кожної клітинки, скільки кадрів без руху поспіль вона змінена з ТИМ САМИМ знаком
 * (+n — n кадрів з'являється крейда, −n — n кадрів зникає); оновлюється на місці цим кадром `c`.
 * Повертає лише клітинки, змінені вже `k` кадрів поспіль: шум, що стрибає з місця на місце чи
 * міняє знак, сюди не потрапляє, а справжній напис тримається.
 */
export function steadyInk(runs: Int16Array, c: InkChange, k: number): { count: number; added: number; removed: number } {
  let added = 0
  let removed = 0
  for (let i = 0; i < runs.length; i++) {
    const s = c.sign[i]
    const r = runs[i]
    runs[i] = s > 0 ? (r > 0 ? Math.min(r + 1, RUN_CAP) : 1) : s < 0 ? (r < 0 ? Math.max(r - 1, -RUN_CAP) : -1) : 0
    if (runs[i] >= k) added++
    else if (runs[i] <= -k) removed++
  }
  return { count: added + removed, added, removed }
}

/** Чи є на дошці нове проти останнього знімка: з'явилась крейда — або стерли багато. */
export function inkIsNew(c: { added: number; removed: number }, t: MirrorTuning = MIRROR_TUNING): boolean {
  return c.added >= t.changeCells || c.removed >= t.eraseCells
}

/** Маска змінених клітинок і їх кількість. */
export function changedCells(a: Float32Array, b: Float32Array, thr: number): { mask: Uint8Array; count: number } {
  const mask = new Uint8Array(a.length)
  let count = 0
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > thr) { mask[i] = 1; count++ }
  }
  return { mask, count }
}

export interface Blob { area: number; touchesEdge: boolean; heightFrac: number; fill: number }

/** Зв'язні плями змінених клітинок (4-сусідство). Край — лівий, правий або нижній. */
export function blobs(mask: Uint8Array, gx = GX, gy = GY): Blob[] {
  const seen = new Uint8Array(mask.length)
  const out: Blob[] = []
  const stack: number[] = []
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue
    let area = 0
    let x0 = gx, x1 = -1, y0 = gy, y1 = -1
    seen[start] = 1
    stack.push(start)
    while (stack.length) {
      const i = stack.pop()!
      const x = i % gx
      const y = (i - x) / gx
      area++
      if (x < x0) x0 = x; if (x > x1) x1 = x
      if (y < y0) y0 = y; if (y > y1) y1 = y
      const nb = [x > 0 ? i - 1 : -1, x < gx - 1 ? i + 1 : -1, y > 0 ? i - gx : -1, y < gy - 1 ? i + gx : -1]
      for (const j of nb) if (j >= 0 && mask[j] && !seen[j]) { seen[j] = 1; stack.push(j) }
    }
    const bw = x1 - x0 + 1
    const bh = y1 - y0 + 1
    out.push({
      area,
      touchesEdge: x0 === 0 || x1 === gx - 1 || y1 === gy - 1,
      heightFrac: bh / gy,
      fill: area / (bw * bh),
    })
  }
  return out
}

/** Чи схожа зміна на людину перед дошкою: велика суцільна пляма, що заходить з краю. */
export function looksLikePerson(mask: Uint8Array, t: MirrorTuning = MIRROR_TUNING, gx = GX, gy = GY): boolean {
  const total = gx * gy
  return blobs(mask, gx, gy).some((b) => b.touchesEdge && b.area / total >= t.personArea
    && b.heightFrac >= t.personHeight && b.fill >= t.personFill)
}

// ── Рішення: відправити чи ні ─────────────────────────────────────────────────────

export type MirrorDecision =
  | { kind: 'moving'; cells: number }
  | { kind: 'settling' }
  | { kind: 'same'; change: number; light: boolean }
  | { kind: 'person'; change: number; first: boolean }
  | { kind: 'wait'; why: 'interval' | 'busy' | 'cap'; change: number }
  | { kind: 'send'; why: 'first' | 'change' | 'after_wait'; change: number; since: number }

/**
 * Стан дзеркала між кадрами. `step` — на кожен кадр аналізу; `sent` — коли пішла відправка
 * (знімок стає новою точкою відліку одразу: не вдалося — наступна спроба лише з наступною
 * зміною або рукою, той самий кадр сам не повторюється).
 *
 * «Рух» і «людина» — за `tone` (яскравість клітинок), «нове на дошці» — за крейдою (`ink`,
 * ТЗ 2026-10-09 §1): зміна лише світла — «те саме». `since` у рішенні «send» — коли нове вперше
 * помітили після останнього знімка (Б-175: раніше бралось начало тиші, і затримка в журналі
 * росла на інтервал між знімками).
 *
 * Крейда проти знімка рахується лише СТІЙКА (`steadyInk`, `inkSteadyFrames` кадрів без руху
 * поспіль) — і для «нового», і для «людини?». Лічба йде з першого кадру без руху, тобто ще поки
 * дошка «завмирає»: звичайний знімок не запізнюється, а напис, що з'явився без руху в кадрі, —
 * щонайбільше на (inkSteadyFrames − 1) кадрів.
 */
export function createMirrorDecider(t: MirrorTuning = MIRROR_TUNING) {
  let prev: MirrorFrame | null = null
  let ref: MirrorFrame | null = null
  let stableSince: number | null = null
  let newSince: number | null = null
  let lastSendAt = -Infinity
  let sends = 0
  let busy = false
  let personNoted = false
  /** Скільки кадрів без руху поспіль кожна клітинка змінена проти знімка (знак — бік зміни) */
  const runs = new Int16Array(GX * GY)

  function step(frame: MirrorFrame, now: number): MirrorDecision {
    if (prev) {
      const { count } = changedCells(prev.tone, frame.tone, t.cellThr)
      prev = frame
      if (count >= t.motionCells) {
        stableSince = null
        personNoted = false
        runs.fill(0)   // «поспіль» — лише кадри без руху: рух перериває лічбу
        return { kind: 'moving', cells: count }
      }
    } else {
      prev = frame
    }
    if (stableSince === null) stableSince = now
    const ink = ref ? steadyInk(runs, inkChangedCells(ref.ink, frame.ink, t), t.inkSteadyFrames) : null
    if (now - stableSince < t.stableMs) return { kind: 'settling' }
    let why: 'first' | 'change' | 'after_wait' = 'first'
    let change = 1
    if (ref && ink) {
      change = ink.count / frame.ink.length
      if (!inkIsNew(ink, t)) {
        newSince = null
        return { kind: 'same', change, light: changedCells(ref.tone, frame.tone, t.cellThr).count >= t.lightCells }
      }
      if (newSince === null) newSince = now
      why = 'change'
      if (looksLikePerson(changedCells(ref.tone, frame.tone, t.cellThr).mask, t)) {
        if (now - stableSince < t.personAcceptMs) {
          const first = !personNoted
          personNoted = true
          return { kind: 'person', change, first }
        }
        why = 'after_wait'
      }
    }
    if (newSince === null) newSince = now
    if (busy) return { kind: 'wait', why: 'busy', change }
    if (sends >= t.maxSends) return { kind: 'wait', why: 'cap', change }
    if (now - lastSendAt < t.minIntervalMs) return { kind: 'wait', why: 'interval', change }
    return { kind: 'send', why, change, since: newSince }
  }

  return {
    step,
    /** Пішла відправка цього кадру (і автоматична, і «Зберегти зараз») */
    sent(frame: MirrorFrame, now: number): void {
      ref = frame
      lastSendAt = now
      sends++
      busy = true
      personNoted = false
      newSince = null
      runs.fill(0)
    },
    /** Відправка закінчилась (успіх чи ні) — можна наступну */
    settled(): void { busy = false },
    /** Нові кути / телефон повернули — порівнювати з нуля */
    reset(): void { prev = null; ref = null; stableSince = null; newSince = null; personNoted = false; runs.fill(0) },
    get sends() { return sends },
    get busy() { return busy },
  }
}

export type MirrorDecider = ReturnType<typeof createMirrorDecider>

// ── Знімок на дошку ───────────────────────────────────────────────────────────────

/**
 * Вирівняти дошку з кадру `src` у `out` (OUT_W×OUT_H): поля білі, дошка вписана в `rect`
 * без розтягування, білінійна вибірка. Лише в момент відправки — повна роздільність.
 */
export function warpBoard(src: Pixels, quadPx: Quad, out: Pixels, rect: Rect): boolean {
  const h = rectToQuad(rect.w, rect.h, quadPx)
  if (!h) return false
  const { data: s, width: sw, height: sh } = src
  const d = out.data
  d.fill(255)
  const maxX = sw - 1
  const maxY = sh - 1
  for (let y = 0; y < rect.h; y++) {
    const yy = y + 0.5
    const bx = h[1] * yy + h[2]
    const by = h[4] * yy + h[5]
    const bw = h[7] * yy + h[8]
    let o = ((rect.y + y) * out.width + rect.x) * 4
    for (let x = 0; x < rect.w; x++, o += 4) {
      const xx = x + 0.5
      const w = h[6] * xx + bw
      let fx = (h[0] * xx + bx) / w - 0.5
      let fy = (h[3] * xx + by) / w - 0.5
      if (fx < 0) fx = 0; else if (fx > maxX) fx = maxX
      if (fy < 0) fy = 0; else if (fy > maxY) fy = maxY
      const x0 = Math.floor(fx)
      const y0 = Math.floor(fy)
      const x1 = x0 < maxX ? x0 + 1 : x0
      const y1 = y0 < maxY ? y0 + 1 : y0
      const ax = fx - x0
      const ay = fy - y0
      const i00 = (y0 * sw + x0) * 4
      const i10 = (y0 * sw + x1) * 4
      const i01 = (y1 * sw + x0) * 4
      const i11 = (y1 * sw + x1) * 4
      for (let c = 0; c < 3; c++) {
        const top = s[i00 + c] + (s[i10 + c] - s[i00 + c]) * ax
        const bot = s[i01 + c] + (s[i11 + c] - s[i01 + c]) * ax
        d[o + c] = top + (bot - top) * ay
      }
      d[o + 3] = 255
    }
  }
  return true
}

// ── Сама знаходить дошку (ТЗ 2026-10-09 §2, ідея власника) ────────────────────────────

/** Ширина кадру для пошуку дошки: досить для кутів, швидко на телефоні. */
export const DETECT_W = 512

/**
 * Колір шкільної крейдяної дошки: зелений → бірюзовий (відтінок 95–210°), насичений, не світлий.
 * Нижня межа 95° — не жовто-зелена стіна й не алюмінієва рамка між частинами дошки, освітлена
 * жовтою стіною (фото власника 30.09: рамка ~80°, дошка 130–185°). Відблиск і крейда — не дошка
 * (дірки в плямі заповнюються пізніше).
 */
export function isBoardColor(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max < 15 || max > 190) return false
  const d = max - min
  if (d / max < 0.2) return false
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  if (h < 0) h += 360
  return h >= 95 && h <= 210
}

/** Сума маски у вікні (2r+1)² навколо кожного пікселя — за інтегральним зображенням. */
function windowSums(m: Uint8Array, w: number, h: number, r: number): { sums: Int32Array; areas: Int32Array } {
  const W1 = w + 1
  const I = new Int32Array(W1 * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      row += m[y * w + x]
      I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + row
    }
  }
  const sums = new Int32Array(w * h)
  const areas = new Int32Array(w * h)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r)
    const y1 = Math.min(h, y + r + 1)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(w, x + r + 1)
      sums[y * w + x] = I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0]
      areas[y * w + x] = (x1 - x0) * (y1 - y0)
    }
  }
  return { sums, areas }
}

/** Закриття (розширити, потім звузити) квадратом (2r+1)² — заповнює крейду й дрібні відблиски. */
function closeMask(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const dil = windowSums(m, w, h, r).sums
  const d = new Uint8Array(w * h)
  for (let i = 0; i < d.length; i++) d[i] = dil[i] > 0 ? 1 : 0
  const { sums, areas } = windowSums(d, w, h, r)
  const out = new Uint8Array(w * h)
  for (let i = 0; i < out.length; i++) out[i] = sums[i] === areas[i] ? 1 : 0
  return out
}

/** Найбільша зв'язна пляма (4-сусідство) з заповненими дірками: маска і площа. */
function largestComponent(m: Uint8Array, w: number, h: number): { mask: Uint8Array; area: number } {
  const label = new Int32Array(w * h)
  let best = 0
  let bestArea = 0
  let next = 0
  const stack: number[] = []
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || label[s]) continue
    next++
    let area = 0
    label[s] = next
    stack.push(s)
    while (stack.length) {
      const i = stack.pop()!
      area++
      const x = i % w
      if (x > 0 && m[i - 1] && !label[i - 1]) { label[i - 1] = next; stack.push(i - 1) }
      if (x < w - 1 && m[i + 1] && !label[i + 1]) { label[i + 1] = next; stack.push(i + 1) }
      if (i >= w && m[i - w] && !label[i - w]) { label[i - w] = next; stack.push(i - w) }
      if (i + w < m.length && m[i + w] && !label[i + w]) { label[i + w] = next; stack.push(i + w) }
    }
    if (area > bestArea) { bestArea = area; best = next }
  }
  const mask = new Uint8Array(w * h)
  if (!best) return { mask, area: 0 }
  for (let i = 0; i < mask.length; i++) if (label[i] === best) mask[i] = 1
  // Дірки (крейда, відблиск усередині дошки) — усе, куди не дістатись від краю кадру поза плямою
  const outside = new Uint8Array(w * h)
  for (let i = 0; i < mask.length; i++) {
    const x = i % w
    const y = (i - x) / w
    if ((x === 0 || y === 0 || x === w - 1 || y === h - 1) && !mask[i]) { outside[i] = 1; stack.push(i) }
  }
  while (stack.length) {
    const i = stack.pop()!
    const x = i % w
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j >= 0 && j < mask.length && !mask[j] && !outside[j]) { outside[j] = 1; stack.push(j) }
    }
  }
  let area = 0
  for (let i = 0; i < mask.length; i++) if (!outside[i]) { mask[i] = 1; area++ }
  return { mask, area }
}

/** Опукла оболонка (монотонний ланцюг), за годинниковою стрілкою на екрані. */
function convexHull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y)
  if (p.length < 3) return p
  const lower: Pt[] = []
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop()
    lower.push(q)
  }
  const upper: Pt[] = []
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop()
    upper.push(q)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

/** Спростити опуклий многокутник до 4 вершин: щоразу прибрати ту, без якої площа зменшується найменше. */
function reduceToQuad(poly: Pt[]): Pt[] {
  const p = [...poly]
  while (p.length > 4) {
    let bi = 0
    let ba = Infinity
    for (let i = 0; i < p.length; i++) {
      const a = Math.abs(cross(p[(i - 1 + p.length) % p.length], p[i], p[(i + 1) % p.length]))
      if (a < ba) { ba = a; bi = i }
    }
    p.splice(bi, 1)
  }
  return p
}

/** Кути по колу від лівого верхнього: ЛВ, ПВ, ПН, ЛН (y донизу — зростання кута йде за годинниковою). */
function orderCorners(q: Pt[]): Quad {
  const cx = q.reduce((s, p) => s + p.x, 0) / q.length
  const cy = q.reduce((s, p) => s + p.y, 0) / q.length
  const byAngle = [...q].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx))
  let start = 0
  for (let i = 1; i < 4; i++) if (byAngle[i].x + byAngle[i].y < byAngle[start].x + byAngle[start].y) start = i
  return [0, 1, 2, 3].map((k) => byAngle[(start + k) % 4]) as Quad
}

export interface FoundBoard {
  /** Кути в частках кадру (0..1), ЛВ, ПВ, ПН, ЛН */
  quad: Quad
  /** Хоч один кут на краю кадру — дошка, найпевніше, не вся в кадрі */
  clipped: boolean
}

/**
 * Знайти зелену/бірюзову крейдяну дошку на зменшеному кадрі: маска кольору → закриття (крейда й
 * відблиск усередині) → найбільша пляма з заповненими дірками → опукла оболонка → 4 кути.
 * Не знайшла (мала пляма, не схоже на чотирикутник, дивні пропорції) → null: учитель ставить сам.
 * Біла маркерна дошка — поза цим (ТЗ §2): там «не знайшла».
 */
export function detectBoardQuad(px: Pixels): FoundBoard | null {
  const { data, width: w, height: h } = px
  if (w < 16 || h < 16) return null
  const m = new Uint8Array(w * h)
  for (let i = 0; i < m.length; i++) m[i] = isBoardColor(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) ? 1 : 0
  const closed = closeMask(m, w, h, 1)
  const { mask, area } = largestComponent(closed, w, h)
  if (area < 0.08 * w * h) return null
  // Межа плями: крайні пікселі кожного рядка
  const edge: Pt[] = []
  for (let y = 0; y < h; y++) {
    let x0 = -1
    let x1 = -1
    for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (x0 < 0) x0 = x; x1 = x }
    if (x0 >= 0) { edge.push({ x: x0, y }, { x: x1 + 1, y }, { x: x0, y: y + 1 }, { x: x1 + 1, y: y + 1 }) }
  }
  const hull = convexHull(edge)
  if (hull.length < 4) return null
  const q = orderCorners(reduceToQuad(hull))
  if (!isConvexQuad(q)) return null
  const qa = quadArea(q)
  const aspect = boardAspect(q)
  if (qa <= 0 || area / qa < 0.75 || aspect < 0.8 || aspect > 6) return null
  const mx = w * 0.02
  const my = h * 0.02
  const clipped = q.some((p) => p.x <= mx || p.y <= my || p.x >= w - mx || p.y >= h - my)
  return { quad: q.map((p) => ({ x: p.x / w, y: p.y / h })) as Quad, clipped }
}

// ── Дошка не вся в кадрі (урок 2, 09.10: верх обрізано на всіх знімках, а рамка «виглядала добре») ──

export type BoardSide = 'top' | 'bottom' | 'left' | 'right'
/** Кут ближче за цю частку кадру до його краю — той бік дошки, найпевніше, за кадром */
export const EDGE_MARGIN = 0.02

/**
 * Які боки дошки поза кадром — за поточними кутами (частки кадру 0..1), хоч знайденими, хоч
 * поставленими рукою. Орієнтир — краї КАДРУ: телефон стоїть горизонтально з автоповоротом, тож
 * верх кадру = верх дошки. Порядок сталий: верх, низ, лівий, правий.
 */
export function clippedSides(q: Quad, margin = EDGE_MARGIN): BoardSide[] {
  const out: BoardSide[] = []
  if (q.some((p) => p.y <= margin)) out.push('top')
  if (q.some((p) => p.y >= 1 - margin)) out.push('bottom')
  if (q.some((p) => p.x <= margin)) out.push('left')
  if (q.some((p) => p.x >= 1 - margin)) out.push('right')
  return out
}

/**
 * Сторона чотирикутника (від кута i до кута i+1), що лежить при цьому краї кадру: її середина
 * найближча до нього. Не залежить від того, в якому порядку поставили кружечки.
 */
export function sideEdge(q: Quad, side: BoardSide): number {
  let best = 0
  let bestV = Infinity
  for (let i = 0; i < 4; i++) {
    const a = q[i]
    const b = q[(i + 1) % 4]
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    const v = side === 'top' ? my : side === 'bottom' ? -my : side === 'left' ? mx : -mx
    if (v < bestV) { bestV = v; best = i }
  }
  return best
}

// ── Телефон зрушив: кути переїжджають разом із дошкою (урок 2, 09.10; власник погодив без підтвердження) ──
//
// Учитель поставив телефон і пішов працювати — на екран не дивиться, біду побачить лише з проектора.
// Тож телефон сам помічає, що дошка «поїхала» з-під кутів, і переносить кути; дошки не видно взагалі —
// не надсилає нічого, доки її не знайде знову.

export interface ShiftTuning {
  /** Як часто перевіряти, чи телефон не зрушив (лише на тихому кадрі) */
  checkMs: number
  /** Підозра — друга перевірка на іншому кадрі через стільки, перш ніж щось робити */
  confirmMs: number
  /** Дошки не видно — шукати знову не частіше за це */
  lostCheckMs: number
  /** Перед відправкою перевірити ще раз, якщо остання перевірка старша за це */
  sendFreshMs: number
  /** Частка кольору дошки в кутах упала нижче цієї частки від початкової — дошка «поїхала» */
  fillDrop: number
  /** Початкова частка менша — дошка не зелена (маркерна, кути на чомусь іншому): за кольором не судимо */
  minBaseFill: number
  /** Знайдена дошка зсунулась більше ніж на цю частку діагоналі — телефон зрушив */
  shiftFrac: number
  /** Дві перевірки поспіль бачать ту саму нову дошку — в межах цієї частки діагоналі */
  confirmFrac: number
  /** Площа знайденої дошки проти запам'ятованої — у цих межах (інакше це не зсув, а хтось заступив частину) */
  areaMin: number
  areaMax: number
  /**
   * Телефон зрушив — зсунулась уся картинка: КОЖЕН кут дошки не на краю кадру зсунувся хоч на цю частку
   * діагоналі. Учитель, що стоїть біля дошки й закриває нижній кут, «зсуває» лише один-два кути.
   */
  cornerMoveFrac: number
}

/**
 * Чому так рідко: пошук дошки на кадрі 512 px на телефоні — 130–200 мс (телеметрія `find` 09.10:
 * 129, 156, 200 мс). Раз на 2,5 с — це 5–8 % часу одного ядра, і лише на тихому кадрі (коли перед
 * дошкою рух, перевірки немає зовсім). Щокадру (2,5 рази на секунду) було б 35–50 % — батарея й
 * нагрів телефона на підставці за урок. Перед кожною відправкою — ще одна перевірка, якщо остання
 * старша за 1 с: зсунутий знімок не має піти на проектор, поки чекаємо планової.
 */
export const SHIFT_TUNING: ShiftTuning = {
  checkMs: 2500,
  confirmMs: 800,
  lostCheckMs: 3000,
  sendFreshMs: 1000,
  fillDrop: 0.6,
  minBaseFill: 0.5,
  shiftFrac: 0.03,
  confirmFrac: 0.015,
  areaMin: 0.75,
  areaMax: 1.33,
  cornerMoveFrac: 0.015,
}

/** Частка пікселів кольору дошки (`isBoardColor`) усередині опуклого чотирикутника `q` (частки кадру). */
export function boardFill(px: Pixels, q: Quad): number {
  const { data, width: w, height: h } = px
  const p = quadToPixels(q, w, h)
  const orient = cross(p[0], p[1], p[2]) < 0 ? -1 : 1
  const x0 = Math.max(0, Math.floor(Math.min(p[0].x, p[1].x, p[2].x, p[3].x)))
  const x1 = Math.min(w - 1, Math.ceil(Math.max(p[0].x, p[1].x, p[2].x, p[3].x)))
  const y0 = Math.max(0, Math.floor(Math.min(p[0].y, p[1].y, p[2].y, p[3].y)))
  const y1 = Math.min(h - 1, Math.ceil(Math.max(p[0].y, p[1].y, p[2].y, p[3].y)))
  let inside = 0
  let board = 0
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5
    for (let x = x0; x <= x1; x++) {
      const cx = x + 0.5
      let ok = true
      for (let i = 0; i < 4 && ok; i++) {
        const a = p[i]
        const b = p[(i + 1) % 4]
        if (((b.x - a.x) * (cy - a.y) - (b.y - a.y) * (cx - a.x)) * orient < 0) ok = false
      }
      if (!ok) continue
      inside++
      const k = (y * w + x) * 4
      if (isBoardColor(data[k], data[k + 1], data[k + 2])) board++
    }
  }
  return inside ? board / inside : 0
}

/** Найбільший зсув кута `b` проти `a` — у частках діагоналі `a` (у пікселях кадру w×h). */
export function quadShift(a: Quad, b: Quad, w: number, h: number): number {
  const pa = quadToPixels(a, w, h)
  const pb = quadToPixels(b, w, h)
  const diag = Math.max(dist(pa[0], pa[2]), dist(pa[1], pa[3]), 1)
  return Math.max(...pa.map((p, i) => dist(p, pb[i]))) / diag
}

/**
 * Чи зсунулась уся дошка, а не її частина: кожен кут, що не лежить на краю кадру (ні в `a`, ні в `b`),
 * зсунувся щонайменше на `minFrac` діагоналі `a`. Кути на краю кадру — це межа обрізаної дошки, а не
 * її справжній кут (урок 2: верх обрізано) — за ними не судимо. Таких «вільних» кутів менше двох — не
 * судимо зовсім (false).
 */
export function wholeBoardMoved(a: Quad, b: Quad, w: number, h: number, minFrac: number, margin = EDGE_MARGIN): boolean {
  const onEdge = (p: Pt) => p.x <= margin || p.y <= margin || p.x >= 1 - margin || p.y >= 1 - margin
  const pa = quadToPixels(a, w, h)
  const pb = quadToPixels(b, w, h)
  const diag = Math.max(dist(pa[0], pa[2]), dist(pa[1], pa[3]), 1)
  let free = 0
  for (let i = 0; i < 4; i++) {
    if (onEdge(a[i]) || onEdge(b[i])) continue
    free++
    if (dist(pa[i], pb[i]) / diag < minFrac) return false
  }
  return free >= 2
}

/**
 * Перенести кути вчителя разом із дошкою: гомографія «стара знайдена дошка → нова знайдена»,
 * застосована до ПОТОЧНИХ кутів (ручні правки — напр. лише середня частина дошки — зберігаються).
 * Кути поза кадром притискаються до краю (тоді видно обрізаний бік). Не вийшло — null.
 */
export function transferCorners(corners: Quad, from: Quad, to: Quad): Quad | null {
  const h = homography(from, to)
  if (!h) return null
  const q = corners.map((p) => {
    const r = applyH(h, p.x, p.y)
    return { x: Math.min(1, Math.max(0, r.x)), y: Math.min(1, Math.max(0, r.y)) }
  }) as Quad
  return q.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) && quadUsable(q) ? q : null
}

export type ShiftResult =
  | { kind: 'ok'; fill: number }
  /** Щось не так — дія лише після другої перевірки на іншому кадрі; поки що не знімаємо */
  | { kind: 'pending'; fill: number; why: 'move' | 'lost' }
  /** Телефон зрушив: нові кути; `byRef` — перенесено гомографією від запам'ятованої дошки */
  | { kind: 'moved'; quad: Quad; shift: number; clipped: boolean; fill: number; byRef: boolean }
  /** Дошки не видно; `first` — перша перевірка цього проміжку (для журналу — один раз) */
  | { kind: 'lost'; first: boolean; fill: number }
  /** Дошку знову видно на тому самому місці */
  | { kind: 'back'; fill: number }

/**
 * Сторож зсуву телефона. `base` — частка кольору дошки в кутах при «Почати»; `found` — дошка, знайдена
 * пошуком при «Почати» (null — пошук її не знайшов, кути вчителя самі по собі).
 *
 * Ознаки (будь-яка): у кутах кольору дошки стало < fillDrop від початкового — АБО пошук знаходить
 * дошку, зсунуту від запам'ятованої більше ніж на shiftFrac діагоналі, і зсунулась уся дошка (площа
 * схожа, кожен кут не на краю кадру зсунувся — `wholeBoardMoved`). Без цього учитель, що нерухомо
 * стоїть біля дошки й закриває нижній кут, «зсував» знайдений чотирикутник: на синтетиці 5 з 6 таких
 * поз давали хибне «телефон зрушив». Дія — лише коли друга перевірка на іншому кадрі підтвердила те саме.
 */
export function createShiftWatch(init: { base: number; found: Quad | null }, t: ShiftTuning = SHIFT_TUNING) {
  let base = init.base
  let ref = init.found
  let lost = false
  let cand: { why: 'move' | 'lost'; found: Quad | null } | null = null
  let lastAt = -Infinity

  function check(px: Pixels, corners: Quad, now: number): ShiftResult {
    lastAt = now
    const fill = boardFill(px, corners)
    const dropped = base >= t.minBaseFill && fill < t.fillDrop * base
    const found = detectBoardQuad(px)
    let to: Quad | null = null
    let shift = 0
    let byRef = false
    if (found && ref) {
      shift = quadShift(ref, found.quad, px.width, px.height)
      const area = quadArea(found.quad) / Math.max(quadArea(ref), 1e-9)
      const whole = area >= t.areaMin && area <= t.areaMax
        && wholeBoardMoved(ref, found.quad, px.width, px.height, t.cornerMoveFrac)
      if (shift > t.shiftFrac && (dropped || whole)) {
        to = transferCorners(corners, ref, found.quad) ?? found.quad
        byRef = true
      }
    } else if (found && dropped) {
      to = found.quad
    }
    const why: 'move' | 'lost' | null = to ? 'move' : !found && dropped ? 'lost' : null
    if (!why) {
      cand = null
      if (lost) { lost = false; return { kind: 'back', fill } }
      return { kind: 'ok', fill }
    }
    if (why === 'lost' && lost) return { kind: 'lost', first: false, fill }
    const same = !!cand && cand.why === why
      && (why === 'lost' || (!!cand.found && !!found && quadShift(cand.found, found.quad, px.width, px.height) <= t.confirmFrac))
    if (!same) {
      cand = { why, found: found?.quad ?? null }
      return { kind: 'pending', fill, why }
    }
    cand = null
    if (why === 'lost') { lost = true; return { kind: 'lost', first: true, fill } }
    const q = to as Quad
    ref = found!.quad
    lost = false
    base = boardFill(px, q)
    return { kind: 'moved', quad: q, shift, clipped: found!.clipped || clippedSides(q).length > 0, fill, byRef }
  }

  return {
    check,
    /**
     * Чи час перевіряти (кадр уже тихий): рідко; підозра — швидше підтвердити; дошки не видно —
     * раз на lostCheckMs; перед відправкою — якщо остання перевірка старша за sendFreshMs.
     */
    due(now: number, beforeSend = false): boolean {
      const gap = cand ? t.confirmMs : lost ? t.lostCheckMs : beforeSend ? Math.min(t.sendFreshMs, t.checkMs) : t.checkMs
      return now - lastAt >= gap
    },
    /** Дошки не видно — нічого не надсилати */
    get lost() { return lost },
    /** Підозра чекає другої перевірки — поки не знімати */
    get pending() { return cand !== null },
  }
}

export type ShiftWatch = ReturnType<typeof createShiftWatch>

/** Кути за замовчуванням — відступ 12 % від країв кадру. */
export function defaultQuad(): Quad {
  return [{ x: 0.12, y: 0.15 }, { x: 0.88, y: 0.15 }, { x: 0.88, y: 0.85 }, { x: 0.12, y: 0.85 }]
}

/** Кути з localStorage (частки кадру), зіпсоване → null. */
export function parseQuad(raw: unknown): Quad | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null
  const q = raw.map((p) => (p && typeof p === 'object' ? { x: Number((p as Pt).x), y: Number((p as Pt).y) } : null))
  if (q.some((p) => !p || !(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1))) return null
  return q as Quad
}

/** Чи придатні кути: опуклі й дошка не крихітна (≥ 5 % кадру). */
export function quadUsable(q: Quad): boolean {
  return isConvexQuad(q) && quadArea(q) >= 0.05
}
