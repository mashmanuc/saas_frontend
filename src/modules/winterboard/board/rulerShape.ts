/**
 * Екранна лінійка (`ruler`) — що й де малювати на полотні та як утримати її на аркуші.
 *
 * Лінійка — нативний Konva-вузол у шарі асетів (під шаром штрихів): лінія пером уздовж неї лягає поверх.
 * Тут лише чисті функції без Konva й без стану, щоб їх можна було перевірити тестами; `WBCanvas` кличе
 * `drawRuler` зі `sceneFunc` вузла.
 *
 * Під час розтягування Transformer'ом вузол має `scaleX ≠ 1`. `sceneFunc` ділить на нього (`ctx.scale(1/sx, 1)`)
 * і малює в справжньому масштабі: сантиметр лишається сантиметром, а нові поділки з'являються просто під
 * рукою. Після відпускання асет отримує нову `w` штатним `asset_update`.
 */
import { RULER_MARGIN_CM, rulerMmCountAt } from '../constants/rulerDefaults'

export type RulerMarkKind = 'mm' | 'half' | 'cm'

export interface RulerMark {
  /** Відстань від лівого краю лінійки (px аркуша). */
  x: number
  kind: RulerMarkKind
  /** Число під сантиметровою поділкою: «0», «1», «2»… */
  label?: string
}

/** Поділки від «0» до останнього цілого міліметра між полями. */
export function rulerMarks(w: number, pxPerCm: number): RulerMark[] {
  const count = rulerMmCountAt(w, pxPerCm)
  const left = RULER_MARGIN_CM * pxPerCm
  const mmPx = pxPerCm / 10
  const marks: RulerMark[] = []
  for (let i = 0; i <= count; i++) {
    const x = left + i * mmPx
    if (i % 10 === 0) marks.push({ x, kind: 'cm', label: String(i / 10) })
    else if (i % 5 === 0) marks.push({ x, kind: 'half' })
    else marks.push({ x, kind: 'mm' })
  }
  return marks
}

/** Довжина поділки від верхнього краю — частка сантиметра (мм коротка, 5 мм середня, см довга). */
export const RULER_TICK_CM: Readonly<Record<RulerMarkKind, number>> = Object.freeze({ mm: 0.18, half: 0.3, cm: 0.45 })

/** Шрифт сайту, а як його немає — системний (зовнішніх шрифтів не тягнемо). */
const RULER_FONT = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"

/** Кольори: напівпрозорий світлий пластик (лінії під лінійкою трохи видно), темні поділки. */
export const RULER_COLORS = Object.freeze({
  body: 'rgba(255, 249, 222, 0.78)',
  border: 'rgba(120, 98, 40, 0.55)',
  shadow: 'rgba(15, 23, 42, 0.22)',
  tick: '#3d382c',
  text: '#2b271d',
})

/** Мінімум методів полотна, які потрібні лінійці (`Konva.Context` їх має). */
export interface RulerCanvas {
  save(): void
  restore(): void
  beginPath(): void
  closePath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void
  fill(): void
  stroke(): void
  fillText(text: string, x: number, y: number): void
  setAttr(attr: string, value: unknown): void
}

export interface DrawRulerOptions {
  /** Справжня довжина й висота (px аркуша), уже з урахуванням розтягування. */
  w: number
  h: number
  pxPerCm: number
  /** Підпис одиниці в куті: «см» / «cm». */
  unit: string
  /** Пікселів пристрою на 1 px аркуша по вертикалі — тінь полотна масштабу не знає. */
  shadowUnit?: number
}

function roundedRectPath(ctx: RulerCanvas, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(w - r, 0)
  ctx.quadraticCurveTo(w, 0, w, r)
  ctx.lineTo(w, h - r)
  ctx.quadraticCurveTo(w, h, w - r, h)
  ctx.lineTo(r, h)
  ctx.quadraticCurveTo(0, h, 0, h - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()
}

/** Малює лінійку в локальних координатах вузла (0,0 — верхній лівий кут тіла). */
export function drawRuler(ctx: RulerCanvas, opts: DrawRulerOptions): void {
  const { w, h, pxPerCm, unit } = opts
  if (!(w > 0) || !(h > 0) || !(pxPerCm > 0)) return
  const shadowUnit = opts.shadowUnit && opts.shadowUnit > 0 ? opts.shadowUnit : 1
  const radius = Math.min(0.12 * pxPerCm, h / 4)

  // Тіло з легкою тінню
  ctx.save()
  roundedRectPath(ctx, w, h, radius)
  ctx.setAttr('shadowColor', RULER_COLORS.shadow)
  ctx.setAttr('shadowBlur', 0.15 * pxPerCm * shadowUnit)
  ctx.setAttr('shadowOffsetX', 0)
  ctx.setAttr('shadowOffsetY', 0.05 * pxPerCm * shadowUnit)
  ctx.setAttr('fillStyle', RULER_COLORS.body)
  ctx.fill()
  ctx.restore()

  // Тонка рамка (без тіні)
  ctx.save()
  roundedRectPath(ctx, w, h, radius)
  ctx.setAttr('strokeStyle', RULER_COLORS.border)
  ctx.setAttr('lineWidth', Math.max(1, pxPerCm / 40))
  ctx.stroke()
  ctx.restore()

  // Поділки вздовж верхнього краю
  const marks = rulerMarks(w, pxPerCm)
  ctx.save()
  ctx.setAttr('strokeStyle', RULER_COLORS.tick)
  ctx.setAttr('lineCap', 'butt')
  for (const kind of ['mm', 'half', 'cm'] as const) {
    ctx.beginPath()
    for (const m of marks) {
      if (m.kind !== kind) continue
      ctx.moveTo(m.x, 0)
      ctx.lineTo(m.x, RULER_TICK_CM[kind] * pxPerCm)
    }
    ctx.setAttr('lineWidth', (kind === 'cm' ? 1.4 : 1) * Math.max(0.5, pxPerCm / 40))
    ctx.stroke()
  }
  ctx.restore()

  // Числа під сантиметровими поділками й «см» у правому нижньому куті
  const numberSize = 0.36 * pxPerCm
  ctx.save()
  ctx.setAttr('fillStyle', RULER_COLORS.text)
  ctx.setAttr('font', `500 ${numberSize}px ${RULER_FONT}`)
  ctx.setAttr('textAlign', 'center')
  ctx.setAttr('textBaseline', 'top')
  const labelY = RULER_TICK_CM.cm * pxPerCm + 0.08 * pxPerCm
  for (const m of marks) {
    if (m.label !== undefined) ctx.fillText(m.label, m.x, labelY)
  }
  ctx.setAttr('font', `500 ${0.3 * pxPerCm}px ${RULER_FONT}`)
  ctx.setAttr('textAlign', 'right')
  ctx.setAttr('textBaseline', 'bottom')
  ctx.fillText(unit, w - 0.25 * pxPerCm, h - 0.15 * pxPerCm)
  ctx.restore()
}

/** Рамка Konva Transformer'а: верхній лівий кут у повернутій системі, поворот — у радіанах. */
export interface RulerBox {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

/**
 * Рамка розтягування лінійки: довжина в межах [minW, maxW] (px рамки), край навпроти ручки лишається на місці
 * (тягнуть ліву ручку — нерухомий правий край). Нульова чи від'ємна довжина — рамка не змінюється.
 */
export function clampRulerBox<B extends RulerBox>(oldBox: B, newBox: B, minW: number, maxW: number, movingLeft: boolean): B {
  if (!(newBox.width > 0)) return oldBox
  const w = Math.min(maxW, Math.max(minW, newBox.width))
  if (w === newBox.width) return newBox
  if (!movingLeft) return { ...newBox, width: w }
  const shift = newBox.width - w
  return {
    ...newBox,
    x: newBox.x + shift * Math.cos(newBox.rotation),
    y: newBox.y + shift * Math.sin(newBox.rotation),
    width: w,
  }
}

/**
 * Центр повернутої лінійки так, щоб її видима рамка не виходила за верх і лівий край аркуша, а праворуч і
 * знизу на аркуші лишалось хоча б `reach` px (за що вхопити). Той самий намір, що `clampAssetToPage` для
 * карток, але за повернутою рамкою: вертикальна лінійка біля лівого краю не стрибає вбік.
 */
export function clampRulerCenter(
  center: { x: number; y: number },
  w: number,
  h: number,
  rotationDeg: number,
  page: { w: number; h: number },
  reach: number,
): { x: number; y: number } {
  const rad = ((Number.isFinite(rotationDeg) ? rotationDeg : 0) * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const ex = (w / 2) * cos + (h / 2) * sin
  const ey = (w / 2) * sin + (h / 2) * cos
  return {
    x: Math.min(Math.max(center.x, ex), Math.max(ex, page.w - reach + ex)),
    y: Math.min(Math.max(center.y, ey), Math.max(ey, page.h - reach + ey)),
  }
}
