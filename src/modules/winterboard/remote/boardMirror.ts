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
}

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
 * Вирівняна дошка в сірому AN_W×AN_H (найближчий піксель) і нормалізована: мінус середнє,
 * поділити на σ кадру. Так зміна експозиції чи балансу білого всього кадру не є «зміною».
 * Повертає середні значення клітинок GX×GY.
 */
export function analyzeFrame(src: Pixels, quadPx: Quad): Float32Array | null {
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
  return cells
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
  | { kind: 'same'; change: number }
  | { kind: 'person'; change: number; first: boolean }
  | { kind: 'wait'; why: 'interval' | 'busy' | 'cap'; change: number }
  | { kind: 'send'; why: 'first' | 'change' | 'after_wait'; change: number; stableSince: number }

/**
 * Стан дзеркала між кадрами. `step` — на кожен кадр аналізу; `sent` — коли пішла відправка
 * (знімок стає новою точкою відліку одразу: не вдалося — наступна спроба лише з наступною
 * зміною або рукою, той самий кадр сам не повторюється).
 */
export function createMirrorDecider(t: MirrorTuning = MIRROR_TUNING) {
  let prev: Float32Array | null = null
  let ref: Float32Array | null = null
  let stableSince: number | null = null
  let lastSendAt = -Infinity
  let sends = 0
  let busy = false
  let personNoted = false

  function step(frame: Float32Array, now: number): MirrorDecision {
    if (prev) {
      const { count } = changedCells(prev, frame, t.cellThr)
      prev = frame
      if (count >= t.motionCells) {
        stableSince = null
        personNoted = false
        return { kind: 'moving', cells: count }
      }
    } else {
      prev = frame
    }
    if (stableSince === null) stableSince = now
    if (now - stableSince < t.stableMs) return { kind: 'settling' }
    let why: 'first' | 'change' | 'after_wait' = 'first'
    let change = 1
    if (ref) {
      const { mask, count } = changedCells(ref, frame, t.cellThr)
      change = count / frame.length
      if (count < t.changeCells) return { kind: 'same', change }
      why = 'change'
      if (looksLikePerson(mask, t)) {
        if (now - stableSince < t.personAcceptMs) {
          const first = !personNoted
          personNoted = true
          return { kind: 'person', change, first }
        }
        why = 'after_wait'
      }
    }
    if (busy) return { kind: 'wait', why: 'busy', change }
    if (sends >= t.maxSends) return { kind: 'wait', why: 'cap', change }
    if (now - lastSendAt < t.minIntervalMs) return { kind: 'wait', why: 'interval', change }
    return { kind: 'send', why, change, stableSince }
  }

  return {
    step,
    /** Пішла відправка цього кадру (і автоматична, і «Зберегти зараз») */
    sent(frame: Float32Array, now: number): void {
      ref = frame
      lastSendAt = now
      sends++
      busy = true
      personNoted = false
    },
    /** Відправка закінчилась (успіх чи ні) — можна наступну */
    settled(): void { busy = false },
    /** Нові кути / телефон повернули — порівнювати з нуля */
    reset(): void { prev = null; ref = null; stableSince = null; personNoted = false },
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
