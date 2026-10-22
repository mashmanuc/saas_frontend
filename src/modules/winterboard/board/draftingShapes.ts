/**
 * Транспортир (`protractor`) і косинець 45° (`set_square`) — що й де малювати на полотні.
 *
 * Власник 22.10.2026: «А всі інші подібно до лінійки». Тому той самий матеріал і ті самі поділки, що в лінійки
 * (`rulerShape.ts`: світлий напівпрозорий пластик, темні поділки, тінь), і той самий масштаб — 1 клітинка = 5 мм.
 * Тут лише чисті функції без Konva й без стану; `WBCanvas` кличе їх зі `sceneFunc` вузла. Під час зміни розміру
 * Transformer'ом вузол має однаковий `scale` — `sceneFunc` ділить на нього й малює в справжньому масштабі.
 */
import { RULER_COLORS, RULER_TICK_CM, type RulerCanvas, type RulerMarkKind } from './rulerShape'
import { PROTRACTOR_BASE_CM } from '../constants/draftingDefaults'

/** Те, чого лінійці не треба, а дузі транспортира й повернутим числам — треба (`Konva.Context` це має). */
export interface DraftingCanvas extends RulerCanvas {
  arc(x: number, y: number, r: number, startAngle: number, endAngle: number, counterClockwise?: boolean): void
  translate(x: number, y: number): void
  rotate(angle: number): void
}

const FONT = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"

function tickWidth(kind: RulerMarkKind, pxPerCm: number): number {
  return (kind === 'cm' ? 1.4 : 1) * Math.max(0.5, pxPerCm / 40)
}

/** Тіло з тінню, потім рамка без тіні — як у лінійки. `path` будує контур. */
function bodyWithShadow(ctx: DraftingCanvas, pxPerCm: number, shadowUnit: number, path: () => void): void {
  ctx.save()
  path()
  ctx.setAttr('shadowColor', RULER_COLORS.shadow)
  ctx.setAttr('shadowBlur', 0.15 * pxPerCm * shadowUnit)
  ctx.setAttr('shadowOffsetX', 0)
  ctx.setAttr('shadowOffsetY', 0.05 * pxPerCm * shadowUnit)
  ctx.setAttr('fillStyle', RULER_COLORS.body)
  ctx.fill()
  ctx.restore()
  ctx.save()
  path()
  ctx.setAttr('strokeStyle', RULER_COLORS.border)
  ctx.setAttr('lineWidth', Math.max(1, pxPerCm / 40))
  ctx.stroke()
  ctx.restore()
}

// ─── Транспортир ─────────────────────────────────────────────────────────────

export type DegreeKind = 'deg' | 'five' | 'ten'

export interface ProtractorMark {
  /** Градус від правого кінця основи (0°) проти годинникової стрілки до лівого (180°). */
  deg: number
  kind: DegreeKind
}

/** Поділки 0…180°: кожен градус коротка, кожні 5° середня, кожні 10° довга з числами. */
export function protractorMarks(): ProtractorMark[] {
  const marks: ProtractorMark[] = []
  for (let d = 0; d <= 180; d++) marks.push({ deg: d, kind: d % 10 === 0 ? 'ten' : d % 5 === 0 ? 'five' : 'deg' })
  return marks
}

/** Довжина поділки від краю дуги всередину — частка сантиметра. */
export const PROTRACTOR_TICK_CM: Readonly<Record<DegreeKind, number>> = Object.freeze({ deg: 0.22, five: 0.38, ten: 0.55 })

/** Точка на колі з центром (cx, cy) радіуса r під кутом `deg` (0° праворуч, проти годинникової — вгору). */
export function pointAtDegree(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) }
}

export interface DrawProtractorOptions {
  /** Справжня ширина й висота (px аркуша), уже з урахуванням зміни розміру. */
  w: number
  h: number
  pxPerCm: number
  shadowUnit?: number
}

/**
 * Малює транспортир у локальних координатах вузла: центр шкали — посередині основи (w/2, w/2), дуга — радіуса w/2.
 * Дві шкали, як на шкільному: зовнішня 0° праворуч → 180° ліворуч, внутрішня навпаки.
 */
export function drawProtractor(ctx: DraftingCanvas, opts: DrawProtractorOptions): void {
  const { w, pxPerCm } = opts
  if (!(w > 0) || !(pxPerCm > 0)) return
  const shadowUnit = opts.shadowUnit && opts.shadowUnit > 0 ? opts.shadowUnit : 1
  const r = w / 2
  const cx = r
  const cy = r
  const base = PROTRACTOR_BASE_CM * pxPerCm
  const bottom = cy + base

  bodyWithShadow(ctx, pxPerCm, shadowUnit, () => {
    ctx.beginPath()
    ctx.moveTo(0, bottom)
    ctx.lineTo(0, cy)
    ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI, false)
    ctx.lineTo(w, bottom)
    ctx.closePath()
  })

  // Віконце в середині (як у пластикового транспортира) — тонка дуга, і основа-діаметр
  const inner = Math.max(r * 0.42, r - 2.6 * pxPerCm)
  ctx.save()
  ctx.setAttr('strokeStyle', RULER_COLORS.border)
  ctx.setAttr('lineWidth', Math.max(1, pxPerCm / 40))
  ctx.beginPath()
  ctx.arc(cx, cy, inner, Math.PI, 2 * Math.PI, false)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.setAttr('strokeStyle', RULER_COLORS.tick)
  ctx.setAttr('lineWidth', 1.4 * Math.max(0.5, pxPerCm / 40))
  ctx.beginPath()
  ctx.moveTo(0.15 * pxPerCm, cy)
  ctx.lineTo(w - 0.15 * pxPerCm, cy)
  // центр: коротка риска вгору й униз від основи
  ctx.moveTo(cx, cy - 0.35 * pxPerCm)
  ctx.lineTo(cx, cy + 0.35 * pxPerCm)
  ctx.stroke()
  ctx.restore()

  // Градусні поділки від краю дуги
  const marks = protractorMarks()
  ctx.save()
  ctx.setAttr('strokeStyle', RULER_COLORS.tick)
  ctx.setAttr('lineCap', 'butt')
  for (const kind of ['deg', 'five', 'ten'] as const) {
    ctx.beginPath()
    for (const m of marks) {
      if (m.kind !== kind) continue
      const a = pointAtDegree(cx, cy, r, m.deg)
      const b = pointAtDegree(cx, cy, r - PROTRACTOR_TICK_CM[kind] * pxPerCm, m.deg)
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
    }
    ctx.setAttr('lineWidth', tickWidth(kind === 'ten' ? 'cm' : 'mm', pxPerCm))
    ctx.stroke()
  }
  ctx.restore()

  // Числа кожні 10°: зовнішня шкала більша, внутрішня — менша й світліша; повернуті вздовж дуги
  const outerR = r - (PROTRACTOR_TICK_CM.ten + 0.38) * pxPerCm
  const innerR = outerR - 0.48 * pxPerCm
  for (const [row, radius, size, color] of [
    ['outer', outerR, 0.32, RULER_COLORS.text],
    ['inner', innerR, 0.24, 'rgba(43, 39, 29, 0.7)'],
  ] as const) {
    ctx.save()
    ctx.setAttr('fillStyle', color)
    ctx.setAttr('font', `500 ${size * pxPerCm}px ${FONT}`)
    ctx.setAttr('textAlign', 'center')
    ctx.setAttr('textBaseline', 'middle')
    for (let d = 0; d <= 180; d += 10) {
      const p = pointAtDegree(cx, cy, radius, d)
      // 0° і 180° лежали б просто на лінії основи — трохи вище неї
      const lift = d === 0 || d === 180 ? 0.7 * size * pxPerCm : 0
      ctx.save()
      ctx.translate(p.x, p.y - lift)
      ctx.rotate(((90 - d) * Math.PI) / 180)
      ctx.fillText(String(row === 'outer' ? d : 180 - d), 0, 0)
      ctx.restore()
    }
    ctx.restore()
  }
}

// ─── Косинець 45° ────────────────────────────────────────────────────────────

/** Відступ від прямого кута до «0» на обох катетах — як поле лінійки. */
export const SET_SQUARE_MARGIN_CM = 0.5

/** Ширина пластмаси між краєм і віконцем: 2,2 см, а на малому косинці — менше, щоб віконце лишилось. */
export function setSquareBand(leg: number, pxPerCm: number): number {
  return Math.min(2.2 * pxPerCm, leg * 0.22)
}

/** Скільки міліметрових поділок на катеті (від «0» до 1 см перед гострим кутом). */
export function setSquareMmCount(leg: number, pxPerCm: number): number {
  if (!(pxPerCm > 0)) return 0
  const usable = leg - (SET_SQUARE_MARGIN_CM + 1) * pxPerCm
  if (!Number.isFinite(usable) || usable <= 0) return 0
  return Math.floor(usable / (pxPerCm / 10) + 1e-6)
}

export interface DrawSetSquareOptions {
  /** Справжня довжина катета (px аркуша), уже з урахуванням зміни розміру. */
  leg: number
  pxPerCm: number
  shadowUnit?: number
}

/**
 * Малює косинець у локальних координатах вузла: прямий кут — у лівому нижньому куті (0, leg), гострі — угорі
 * ліворуч (0, 0) і внизу праворуч (leg, leg). Шкали в сантиметрах — уздовж обох катетів від прямого кута,
 * посередині — віконце (тіло малюється з дірою: внутрішній контур іде в інший бік).
 */
export function drawSetSquare(ctx: DraftingCanvas, opts: DrawSetSquareOptions): void {
  const { leg, pxPerCm } = opts
  if (!(leg > 0) || !(pxPerCm > 0)) return
  const shadowUnit = opts.shadowUnit && opts.shadowUnit > 0 ? opts.shadowUnit : 1
  const d = setSquareBand(leg, pxPerCm)
  const k = d * (1 + Math.SQRT2)
  const hasWindow = leg - k > d * 1.2

  const outline = (): void => {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(leg, leg)
    ctx.lineTo(0, leg)
    ctx.closePath()
    if (hasWindow) {
      // віконце — у протилежному напрямку обходу, тож заливка його не зачіпає
      ctx.moveTo(d, k)
      ctx.lineTo(d, leg - d)
      ctx.lineTo(leg - k, leg - d)
      ctx.closePath()
    }
  }
  bodyWithShadow(ctx, pxPerCm, shadowUnit, outline)

  const count = setSquareMmCount(leg, pxPerCm)
  const m = SET_SQUARE_MARGIN_CM * pxPerCm
  const mm = pxPerCm / 10
  ctx.save()
  ctx.setAttr('strokeStyle', RULER_COLORS.tick)
  ctx.setAttr('lineCap', 'butt')
  for (const kind of ['mm', 'half', 'cm'] as const) {
    ctx.beginPath()
    for (let i = 0; i <= count; i++) {
      const k2: RulerMarkKind = i % 10 === 0 ? 'cm' : i % 5 === 0 ? 'half' : 'mm'
      if (k2 !== kind) continue
      const len = RULER_TICK_CM[kind] * pxPerCm
      // нижній катет: поділки від нижнього краю вгору
      ctx.moveTo(m + i * mm, leg)
      ctx.lineTo(m + i * mm, leg - len)
      // лівий катет: від лівого краю праворуч, знизу вгору
      ctx.moveTo(0, leg - m - i * mm)
      ctx.lineTo(len, leg - m - i * mm)
    }
    ctx.setAttr('lineWidth', tickWidth(kind, pxPerCm))
    ctx.stroke()
  }
  ctx.restore()

  const numberSize = 0.32 * pxPerCm
  const tick = RULER_TICK_CM.cm * pxPerCm
  ctx.save()
  ctx.setAttr('fillStyle', RULER_COLORS.text)
  ctx.setAttr('font', `500 ${numberSize}px ${FONT}`)
  ctx.setAttr('textAlign', 'center')
  ctx.setAttr('textBaseline', 'bottom')
  for (let i = 0; i <= count; i += 10) ctx.fillText(String(i / 10), m + i * mm, leg - tick - 0.06 * pxPerCm)
  // лівий катет — без «0»: він стояв би впритул до нижнього
  ctx.setAttr('textAlign', 'left')
  ctx.setAttr('textBaseline', 'middle')
  for (let i = 10; i <= count; i += 10) ctx.fillText(String(i / 10), tick + 0.08 * pxPerCm, leg - m - i * mm)
  // кути гострих вершин — на пластмасі між шкалами й віконцем
  ctx.setAttr('fillStyle', 'rgba(43, 39, 29, 0.75)')
  ctx.setAttr('font', `500 ${0.3 * pxPerCm}px ${FONT}`)
  ctx.setAttr('textAlign', 'center')
  ctx.fillText('45°', Math.min(d * 0.72, leg * 0.16), Math.max(k * 0.62, leg * 0.36))
  ctx.fillText('45°', leg - k - 0.35 * d, leg - d * 0.72)
  ctx.restore()
}
