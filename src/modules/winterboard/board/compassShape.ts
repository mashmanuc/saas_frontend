/**
 * Циркуль (`compass`) — вигляд, частини, за які його беруть, і дуга, яку він креслить.
 *
 * Власник 22.10.2026: «циркуля треба зробити не похожого, як в них. А щоб був похожий на реальний». Тому не дві
 * точки з лінією, а справжній шкільний циркуль збоку: дві металеві ніжки на шарнірі, ручка над шарніром, на одній
 * ніжці голка, на другій — тримач і грифель (кольору поточного пера: видно, чим він креслитиме).
 *
 * ЛОКАЛЬНІ КООРДИНАТИ ВУЗЛА: голка — (0, h), грифель — (w, h), тобто `w` = радіус, вісь x — від голки до грифеля,
 * `rotation` — напрям від голки до грифеля. Шарнір — над серединою, ніжки сталої довжини (`compassHingeDrop`).
 *
 * ТРИ СПОСОБИ ВЗЯТИ (лише з «Вибором»):
 *   — за ручку вгорі — крутити навколо голки: грифель креслить дугу (штатний штрих пера, `stroke_add`);
 *   — за грифель — розвести чи звести ніжки (радіус з кроком 1 мм, підпис «r = … см»), голка на місці;
 *   — за будь-що інше — перенести весь циркуль.
 * Тут лише чисті функції без Konva й без стану.
 */
import type { WBAsset } from '../types/winterboard'
import type { RulerCanvas } from './rulerShape'
import type { DraftingCanvas } from './draftingShapes'
import { COMPASS_HEAD_CM, COMPASS_KNOB_CM, compassSize } from '../constants/draftingDefaults'

export type CompassPart = 'knob' | 'pencil' | 'body'

interface Pt { x: number; y: number }

const rad = (deg: number): number => (deg * Math.PI) / 180

/** Поворот вектора на `deg` (за годинниковою на екрані — як `rotation` у Konva). */
function rotate(v: Pt, deg: number): Pt {
  const a = rad(deg)
  return { x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) }
}

/** Голка на аркуші: центр рамки + повернутий вектор від центру до лівого нижнього кута. */
export function compassNeedle(a: Pick<WBAsset, 'x' | 'y' | 'w' | 'h' | 'rotation'>): Pt {
  const c = { x: a.x + a.w / 2, y: a.y + a.h / 2 }
  const v = rotate({ x: -a.w / 2, y: a.h / 2 }, a.rotation ?? 0)
  return { x: c.x + v.x, y: c.y + v.y }
}

/** Грифель на аркуші: голка + радіус у напрямку `rotation`. */
export function compassPencil(a: Pick<WBAsset, 'x' | 'y' | 'w' | 'h' | 'rotation'>): Pt {
  const n = compassNeedle(a)
  const v = rotate({ x: a.w, y: 0 }, a.rotation ?? 0)
  return { x: n.x + v.x, y: n.y + v.y }
}

/** Геометрія циркуля з голкою в `needle`, радіусом `r` і напрямом `angleDeg` (від голки до грифеля). */
export function compassGeometry(
  needle: Pt,
  r: number,
  angleDeg: number,
  gridSize: unknown,
): { x: number; y: number; w: number; h: number; rotation: number } {
  const { w, h } = compassSize(r, gridSize)
  const v = rotate({ x: w / 2, y: -h / 2 }, angleDeg)
  const cx = needle.x + v.x
  const cy = needle.y + v.y
  return { x: cx - w / 2, y: cy - h / 2, w, h, rotation: angleDeg }
}

/** Кут від голки до точки (градуси, як `rotation`: 0 — праворуч, 90 — униз). */
export function angleFromNeedle(needle: Pt, p: Pt): number {
  return (Math.atan2(p.y - needle.y, p.x - needle.x) * 180) / Math.PI
}

/** Найменша різниця кутів у (−180; 180] — щоб поворот через «±180°» не стрибав на цілий оберт. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % 360
  if (d <= -180) d += 360
  if (d > 180) d -= 360
  return d
}

/**
 * Точки дуги від кута `fromDeg` до `toDeg` (у будь-який бік, хоч більше оберту) радіуса `r` навколо голки.
 * Крок — щоб хорда не перевищувала ~3 px: дуга гладка й на великому радіусі. Обидва кінці входять.
 */
export function compassArcPoints(needle: Pt, r: number, fromDeg: number, toDeg: number): Pt[] {
  if (!(r > 0)) return []
  const span = toDeg - fromDeg
  const stepDeg = Math.max(0.25, ((3 / r) * 180) / Math.PI)
  const n = Math.max(1, Math.ceil(Math.abs(span) / stepDeg))
  const pts: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const a = rad(fromDeg + (span * i) / n)
    pts.push({ x: needle.x + r * Math.cos(a), y: needle.y + r * Math.sin(a) })
  }
  return pts
}

/** Частини в локальних координатах: шарнір, ручка, кінчики. */
export function compassParts(w: number, h: number, pxPerCm: number): {
  hinge: Pt
  headR: number
  knob: { x: number; y: number; w: number; h: number }
  needle: Pt
  pencil: Pt
} {
  const headR = COMPASS_HEAD_CM * pxPerCm
  const knobH = COMPASS_KNOB_CM * pxPerCm
  const knobW = 0.55 * pxPerCm
  return {
    hinge: { x: w / 2, y: knobH + headR },
    headR,
    knob: { x: w / 2 - knobW / 2, y: 0, w: knobW, h: knobH + headR * 0.4 },
    needle: { x: 0, y: h },
    pencil: { x: w, y: h },
  }
}

/** За що взяли циркуль у точці `p` (локальні координати): грифель, ручка чи решта. */
export function compassPartAt(p: Pt, w: number, h: number, pxPerCm: number): CompassPart {
  const parts = compassParts(w, h, pxPerCm)
  if (Math.hypot(p.x - parts.pencil.x, p.y - parts.pencil.y) <= 0.7 * pxPerCm) return 'pencil'
  const k = parts.knob
  const pad = 0.3 * pxPerCm
  if (p.x >= k.x - pad && p.x <= k.x + k.w + pad && p.y >= k.y - pad && p.y <= k.y + k.h) return 'knob'
  return 'body'
}

/** Підпис радіуса: «r = 4 см», «r = 3,5 см» (кома для «см», крапка для «cm»). */
export function compassRadiusLabel(r: number, pxPerCm: number, unit: string): string {
  const cm = Math.round((r / pxPerCm) * 10) / 10
  const text = Number.isInteger(cm) ? String(cm) : cm.toFixed(1)
  return `r = ${unit === 'cm' ? text : text.replace('.', ',')} ${unit}`
}

export const COMPASS_COLORS = Object.freeze({
  metal: '#c9d0da',
  metalEdge: '#5b6573',
  metalShine: 'rgba(255, 255, 255, 0.65)',
  knob: '#2f3640',
  knurl: 'rgba(255, 255, 255, 0.28)',
  needle: '#3a3f47',
  holder: '#8f99a6',
  wood: '#e9c98f',
  shadow: 'rgba(15, 23, 42, 0.25)',
  label: '#1e40af',
  labelBg: 'rgba(255, 255, 255, 0.9)',
})

/** Смужка ніжки від `a` до `b` з шириною `wa` біля шарніра й `wb` біля кінця. */
function legPath(ctx: RulerCanvas, a: Pt, b: Pt, wa: number, wb: number): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const nx = -(b.y - a.y) / len
  const ny = (b.x - a.x) / len
  ctx.beginPath()
  ctx.moveTo(a.x + (nx * wa) / 2, a.y + (ny * wa) / 2)
  ctx.lineTo(b.x + (nx * wb) / 2, b.y + (ny * wb) / 2)
  ctx.lineTo(b.x - (nx * wb) / 2, b.y - (ny * wb) / 2)
  ctx.lineTo(a.x - (nx * wa) / 2, a.y - (ny * wa) / 2)
  ctx.closePath()
}

function along(a: Pt, b: Pt, dist: number): Pt {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  return { x: b.x - ((b.x - a.x) / len) * dist, y: b.y - ((b.y - a.y) / len) * dist }
}

function fillStroke(ctx: RulerCanvas, fill: string, stroke: string, lineWidth: number): void {
  ctx.setAttr('fillStyle', fill)
  ctx.fill()
  ctx.setAttr('strokeStyle', stroke)
  ctx.setAttr('lineWidth', lineWidth)
  ctx.stroke()
}

export interface DrawCompassOptions {
  w: number
  h: number
  pxPerCm: number
  /** Колір грифеля — колір поточного пера. */
  ink: string
  /** Підпис радіуса під кінчиками (виділений або його саме розводять). */
  radiusLabel?: string | null
  /** Поворот вузла на екрані (градуси) — підпис повертаємо назад, щоб читався прямо. */
  uprightDeg?: number
  shadowUnit?: number
}

/** Малює циркуль у локальних координатах вузла (голка — (0, h), грифель — (w, h)). */
export function drawCompass(ctx: DraftingCanvas, opts: DrawCompassOptions): void {
  const { w, h, pxPerCm } = opts
  if (!(w >= 0) || !(h > 0) || !(pxPerCm > 0)) return
  const shadowUnit = opts.shadowUnit && opts.shadowUnit > 0 ? opts.shadowUnit : 1
  const p = compassParts(w, h, pxPerCm)
  const edge = Math.max(0.8, pxPerCm / 45)
  const legW = 0.34 * pxPerCm
  const tipW = 0.2 * pxPerCm
  const needleLen = 0.7 * pxPerCm
  const leadLen = 0.55 * pxPerCm
  const holderLen = 0.9 * pxPerCm

  // Пунктир радіуса між кінчиками — лише коли видно підпис
  if (opts.radiusLabel) {
    ctx.save()
    ctx.setAttr('strokeStyle', COMPASS_COLORS.label)
    ctx.setAttr('lineWidth', Math.max(1, pxPerCm / 35))
    ctx.beginPath()
    const dash = 0.2 * pxPerCm
    for (let x = 0; x < w; x += 2 * dash) {
      ctx.moveTo(x, h)
      ctx.lineTo(Math.min(w, x + dash), h)
    }
    ctx.stroke()
    ctx.restore()
  }

  const needleBase = along(p.hinge, p.needle, needleLen)
  const holderTop = along(p.hinge, p.pencil, leadLen + holderLen)
  const holderEnd = along(p.hinge, p.pencil, leadLen)

  // Ніжки з тінню
  ctx.save()
  ctx.setAttr('shadowColor', COMPASS_COLORS.shadow)
  ctx.setAttr('shadowBlur', 0.18 * pxPerCm * shadowUnit)
  ctx.setAttr('shadowOffsetY', 0.06 * pxPerCm * shadowUnit)
  legPath(ctx, p.hinge, needleBase, legW, tipW)
  ctx.setAttr('fillStyle', COMPASS_COLORS.metal)
  ctx.fill()
  legPath(ctx, p.hinge, holderTop, legW, tipW * 1.1)
  ctx.fill()
  ctx.restore()
  for (const end of [needleBase, holderTop]) {
    legPath(ctx, p.hinge, end, legW, end === needleBase ? tipW : tipW * 1.1)
    ctx.save()
    fillStroke(ctx, COMPASS_COLORS.metal, COMPASS_COLORS.metalEdge, edge)
    ctx.restore()
    // відблиск уздовж ніжки
    ctx.save()
    ctx.setAttr('strokeStyle', COMPASS_COLORS.metalShine)
    ctx.setAttr('lineWidth', Math.max(1, 0.07 * pxPerCm))
    ctx.beginPath()
    const s = along(end, p.hinge, 0.6 * pxPerCm)
    const e = along(p.hinge, end, 0.3 * pxPerCm)
    ctx.moveTo(s.x, s.y)
    ctx.lineTo(e.x, e.y)
    ctx.stroke()
    ctx.restore()
  }

  // Голка
  ctx.save()
  legPath(ctx, needleBase, p.needle, 0.09 * pxPerCm, 0.01 * pxPerCm)
  fillStroke(ctx, COMPASS_COLORS.needle, COMPASS_COLORS.needle, 0.5)
  ctx.restore()

  // Тримач грифеля з гвинтиком і грифель кольору пера
  ctx.save()
  legPath(ctx, holderTop, holderEnd, 0.42 * pxPerCm, 0.36 * pxPerCm)
  fillStroke(ctx, COMPASS_COLORS.holder, COMPASS_COLORS.metalEdge, edge)
  ctx.restore()
  const screw = along(holderEnd, holderTop, holderLen * 0.45)
  ctx.save()
  ctx.beginPath()
  ctx.arc(screw.x, screw.y, 0.11 * pxPerCm, 0, 2 * Math.PI)
  fillStroke(ctx, COMPASS_COLORS.metal, COMPASS_COLORS.metalEdge, edge)
  ctx.restore()
  ctx.save()
  legPath(ctx, holderEnd, p.pencil, 0.26 * pxPerCm, 0.02 * pxPerCm)
  fillStroke(ctx, COMPASS_COLORS.wood, COMPASS_COLORS.metalEdge, edge * 0.7)
  ctx.restore()
  ctx.save()
  legPath(ctx, along(holderEnd, p.pencil, leadLen * 0.45), p.pencil, 0.12 * pxPerCm, 0.01 * pxPerCm)
  fillStroke(ctx, opts.ink, opts.ink, 0.5)
  ctx.restore()

  // Ручка з насічкою
  const k = p.knob
  ctx.save()
  ctx.beginPath()
  const rr = k.w / 2
  ctx.moveTo(k.x, k.y + rr)
  ctx.quadraticCurveTo(k.x, k.y, k.x + rr, k.y)
  ctx.quadraticCurveTo(k.x + k.w, k.y, k.x + k.w, k.y + rr)
  ctx.lineTo(k.x + k.w, k.y + k.h)
  ctx.lineTo(k.x, k.y + k.h)
  ctx.closePath()
  fillStroke(ctx, COMPASS_COLORS.knob, COMPASS_COLORS.knob, edge)
  ctx.setAttr('strokeStyle', COMPASS_COLORS.knurl)
  ctx.setAttr('lineWidth', Math.max(0.6, pxPerCm / 60))
  ctx.beginPath()
  for (let y = k.y + rr; y < k.y + k.h - 0.1 * pxPerCm; y += 0.16 * pxPerCm) {
    ctx.moveTo(k.x + 0.08 * pxPerCm, y)
    ctx.lineTo(k.x + k.w - 0.08 * pxPerCm, y)
  }
  ctx.stroke()
  ctx.restore()

  // Шарнір із заклепкою
  ctx.save()
  ctx.beginPath()
  ctx.arc(p.hinge.x, p.hinge.y, p.headR, 0, 2 * Math.PI)
  fillStroke(ctx, COMPASS_COLORS.metal, COMPASS_COLORS.metalEdge, edge)
  ctx.beginPath()
  ctx.arc(p.hinge.x, p.hinge.y, p.headR * 0.38, 0, 2 * Math.PI)
  fillStroke(ctx, COMPASS_COLORS.holder, COMPASS_COLORS.metalEdge, edge * 0.8)
  ctx.restore()

  // Підпис радіуса під кінчиками — завжди прямо, хоч би як циркуль повернули
  if (opts.radiusLabel) {
    const size = 0.36 * pxPerCm
    ctx.save()
    ctx.translate(w / 2, h + 0.55 * pxPerCm)
    ctx.rotate((-(opts.uprightDeg ?? 0) * Math.PI) / 180)
    ctx.setAttr('font', `600 ${size}px Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif`)
    ctx.setAttr('textAlign', 'center')
    ctx.setAttr('textBaseline', 'middle')
    ctx.setAttr('fillStyle', COMPASS_COLORS.labelBg)
    ctx.beginPath()
    const bw = (opts.radiusLabel.length * 0.55 + 0.6) * size
    const bh = size * 1.5
    ctx.moveTo(-bw / 2 + bh / 2, -bh / 2)
    ctx.lineTo(bw / 2 - bh / 2, -bh / 2)
    ctx.quadraticCurveTo(bw / 2, -bh / 2, bw / 2, 0)
    ctx.quadraticCurveTo(bw / 2, bh / 2, bw / 2 - bh / 2, bh / 2)
    ctx.lineTo(-bw / 2 + bh / 2, bh / 2)
    ctx.quadraticCurveTo(-bw / 2, bh / 2, -bw / 2, 0)
    ctx.quadraticCurveTo(-bw / 2, -bh / 2, -bw / 2 + bh / 2, -bh / 2)
    ctx.closePath()
    ctx.fill()
    ctx.setAttr('fillStyle', COMPASS_COLORS.label)
    ctx.fillText(opts.radiusLabel, 0, 0)
    ctx.restore()
  }
}

/**
 * Влучання: ніжки (ширші, ніж видно, — щоб легко вхопити), ручка, шарнір і кола біля кінчиків. Кожна частина
 * заливається окремо (`fill`): частини накладаються біля шарніра, і в одному контурі з різним напрямком обходу
 * перетин «знулився» б — там циркуль не брався б.
 */
export function compassHitPath(ctx: DraftingCanvas, w: number, h: number, pxPerCm: number, fill: () => void): void {
  const p = compassParts(w, h, pxPerCm)
  const grab = 0.6 * pxPerCm
  for (const end of [p.needle, p.pencil]) {
    const len = Math.hypot(end.x - p.hinge.x, end.y - p.hinge.y) || 1
    const nx = (-(end.y - p.hinge.y) / len) * (grab / 2)
    const ny = ((end.x - p.hinge.x) / len) * (grab / 2)
    ctx.beginPath()
    ctx.moveTo(p.hinge.x + nx, p.hinge.y + ny)
    ctx.lineTo(end.x + nx, end.y + ny)
    ctx.lineTo(end.x - nx, end.y - ny)
    ctx.lineTo(p.hinge.x - nx, p.hinge.y - ny)
    ctx.closePath()
    fill()
  }
  const k = p.knob
  const pad = 0.3 * pxPerCm
  ctx.beginPath()
  ctx.moveTo(k.x - pad, k.y - pad)
  ctx.lineTo(k.x + k.w + pad, k.y - pad)
  ctx.lineTo(k.x + k.w + pad, k.y + k.h)
  ctx.lineTo(k.x - pad, k.y + k.h)
  ctx.closePath()
  fill()
  for (const [c, r] of [[p.hinge, p.headR * 1.3], [p.pencil, 0.7 * pxPerCm], [p.needle, 0.45 * pxPerCm]] as const) {
    ctx.beginPath()
    ctx.arc(c.x, c.y, r, 0, 2 * Math.PI)
    ctx.closePath()
    fill()
  }
}
