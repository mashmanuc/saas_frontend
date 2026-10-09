/**
 * «Операція Дзеркало» — логіка без камери: перспектива, пошук змін (крейда, а не світло — ТЗ
 * 2026-10-09 §1), «людина?», рішення, пошук дошки (§2).
 * Кадр — синтетична зелена дошка в перспективі на сірій стіні; написи — білі прямокутники
 * в координатах дошки.
 */
import { describe, it, expect } from 'vitest'
import {
  AN_W, AN_H, GX, GY, MIRROR_TUNING,
  analyzeFrame, applyH, blobs, boardAspect, changedCells, createMirrorDecider, defaultQuad, detectBoardQuad,
  fitRect, homography, inkChangedCells, inkIsNew, isConvexQuad, looksLikePerson, parseQuad, quadUsable,
  rectToQuad, warpBoard,
  type MirrorFrame, type Pixels, type Quad,
} from '../remote/boardMirror'

const W = 640
const H = 360
/** Дошка на кадрі в перспективі (ліва сторона ближче) */
const QUAD: Quad = [{ x: 60, y: 50 }, { x: 590, y: 70 }, { x: 600, y: 300 }, { x: 50, y: 320 }]
/** Розмір дошки в її власних координатах */
const BW = 300
const BH = 100

interface Mark { x: number; y: number; w: number; h: number }

/** Кадр: стіна, дошка, написи (в координатах дошки); `gain/offset` — експозиція; `person` — тіло в пікселях кадру */
function scene(opts: {
  marks?: Mark[]; gain?: number; offset?: number; noise?: number; seed?: number; person?: Mark
  /** Плавна пляма відблиску (пікселі кадру): центр, радіус, сила */
  glare?: { x: number; y: number; r: number; amp: number }
  /** Дошка деінде на кадрі; `null` — дошки немає */
  quad?: Quad | null
} = {}): Pixels {
  const { marks = [], gain = 1, offset = 0, noise = 0 } = opts
  let seed = opts.seed ?? 1
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5 }
  const bq = opts.quad === undefined ? QUAD : opts.quad
  const inv = bq ? homography(bq, [{ x: 0, y: 0 }, { x: BW, y: 0 }, { x: BW, y: BH }, { x: 0, y: BH }])! : null
  const data = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let c = [128, 128, 120]
      const p = inv ? applyH(inv, x + 0.5, y + 0.5) : { x: -1, y: -1 }
      if (p.x >= 0 && p.x < BW && p.y >= 0 && p.y < BH) {
        c = [30, 72, 44]
        if (marks.some((m) => p.x >= m.x && p.x < m.x + m.w && p.y >= m.y && p.y < m.y + m.h)) c = [235, 235, 230]
      }
      const pr = opts.person
      if (pr && x >= pr.x && x < pr.x + pr.w && y >= pr.y && y < pr.y + pr.h) c = [70, 50, 90]
      const g = opts.glare
      const glare = g ? g.amp * Math.exp(-((x - g.x) ** 2 + (y - g.y) ** 2) / (g.r * g.r)) : 0
      const i = (y * W + x) * 4
      for (let k = 0; k < 3; k++) data[i + k] = c[k] * gain + offset + glare + noise * rnd()
      data[i + 3] = 255
    }
  }
  return { data, width: W, height: H }
}

describe('геометрія', () => {
  it('гомографія переводить кути прямокутника в кути дошки', () => {
    const h = rectToQuad(AN_W, AN_H, QUAD)!
    const corners = [[0, 0], [AN_W, 0], [AN_W, AN_H], [0, AN_H]].map(([x, y]) => applyH(h, x, y))
    corners.forEach((p, i) => {
      expect(p.x).toBeCloseTo(QUAD[i].x, 6)
      expect(p.y).toBeCloseTo(QUAD[i].y, 6)
    })
  })

  it('три кути на одній прямій — гомографії немає', () => {
    const bad: Quad = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 0, y: 5 }]
    expect(homography([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], bad)).toBeNull()
  })

  it('кути по колу — придатні; переплутані чи крихітна дошка — ні', () => {
    expect(isConvexQuad(QUAD)).toBe(true)
    expect(quadUsable(defaultQuad())).toBe(true)
    const crossed: Quad = [QUAD[0], QUAD[2], QUAD[1], QUAD[3]]
    expect(isConvexQuad(crossed)).toBe(false)
    const tiny: Quad = [{ x: 0.5, y: 0.5 }, { x: 0.55, y: 0.5 }, { x: 0.55, y: 0.55 }, { x: 0.5, y: 0.55 }]
    expect(quadUsable(tiny)).toBe(false)
  })

  it('широка дошка вписується в сторінку з полями, без розтягування', () => {
    expect(fitRect(3, 1600, 900)).toEqual({ x: 0, y: 184, w: 1600, h: 533 })
    expect(fitRect(1, 1600, 900)).toEqual({ x: 350, y: 0, w: 900, h: 900 })
    expect(boardAspect(QUAD)).toBeGreaterThan(1.8)
  })

  it('кути з пристрою: зіпсоване → null', () => {
    expect(parseQuad(null)).toBeNull()
    expect(parseQuad([{ x: 0, y: 0 }])).toBeNull()
    expect(parseQuad([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }])).toBeNull()
    expect(parseQuad(defaultQuad())).toEqual(defaultQuad())
  })
})

describe('знімок на дошку', () => {
  it('вирівнює дошку: напис у центрі дошки — у центрі знімка, поля білі, дошка зелена', () => {
    const src = scene({ marks: [{ x: 140, y: 40, w: 20, h: 20 }] })
    const OW = 320
    const OH = 180
    const out: Pixels = { data: new Uint8ClampedArray(OW * OH * 4), width: OW, height: OH }
    const rect = fitRect(BW / BH, OW, OH)
    expect(warpBoard(src, QUAD, out, rect)).toBe(true)
    const px = (x: number, y: number) => Array.from(out.data.slice((y * OW + x) * 4, (y * OW + x) * 4 + 3))
    const cx = rect.x + Math.round(rect.w / 2)
    const cy = rect.y + Math.round(rect.h / 2)
    expect(px(cx, cy)[0]).toBeGreaterThan(200)                       // напис
    expect(px(rect.x + 5, rect.y + 5)[1]).toBeGreaterThan(px(rect.x + 5, rect.y + 5)[0])   // зелена дошка
    expect(px(2, 2)).toEqual([255, 255, 255])                         // поле
  })
})



describe('пошук змін: крейда, а не світло (ТЗ 2026-10-09 §1)', () => {
  const frame = (o: Parameters<typeof scene>[0]) => analyzeFrame(scene(o), QUAD)!
  /** Кілька рядків тексту на всю ширину дошки */
  const LINES: Mark[] = [10, 30, 50, 70, 90].map((y) => ({ x: 10, y, w: 280, h: 3 }))

  it('той самий кадр із шумом камери — ні яскравість, ні крейда не змінились', () => {
    const a = frame({ marks: LINES, noise: 8, seed: 1 })
    const b = frame({ marks: LINES, noise: 8, seed: 7 })
    expect(changedCells(a.tone, b.tone, MIRROR_TUNING.cellThr).count).toBe(0)
    expect(inkIsNew(inkChangedCells(a.ink, b.ink))).toBe(false)
  })

  it('автоекспозиція «дихнула» (×0,7 і ×1,3) — нового на дошці немає', () => {
    const a = frame({ marks: LINES })
    expect(inkIsNew(inkChangedCells(a.ink, frame({ marks: LINES, gain: 0.7 }).ink))).toBe(false)
    expect(inkIsNew(inkChangedCells(a.ink, frame({ marks: LINES, gain: 1.3, offset: 12 }).ink))).toBe(false)
  })

  it('пляма відблиску від вікна — яскравість змінилась, крейда ні (урок 09.10: 12 з 20 знімків були повторами)', () => {
    const a = frame({ marks: LINES })
    const b = frame({ marks: LINES, glare: { x: 200, y: 110, r: 90, amp: 110 } })
    expect(changedCells(a.tone, b.tone, MIRROR_TUNING.cellThr).count).toBeGreaterThanOrEqual(MIRROR_TUNING.lightCells)
    expect(inkIsNew(inkChangedCells(a.ink, b.ink))).toBe(false)
  })

  it('дописали слово — крейда з\'явилась у кількох клітинках, не людина', () => {
    const a = frame({ marks: [{ x: 20, y: 20, w: 60, h: 4 }] })
    const b = frame({ marks: [{ x: 20, y: 20, w: 60, h: 4 }, { x: 150, y: 60, w: 30, h: 3 }] })
    const c = inkChangedCells(a.ink, b.ink)
    expect(c.added).toBeGreaterThanOrEqual(MIRROR_TUNING.changeCells)
    expect(c.added).toBeLessThan(GX * GY * 0.05)
    expect(inkIsNew(c)).toBe(true)
    expect(looksLikePerson(changedCells(a.tone, b.tone, MIRROR_TUNING.cellThr).mask)).toBe(false)
  })

  it('дописали слово під відблиском — усе одно нове', () => {
    const glare = { x: 200, y: 110, r: 90, amp: 80 }
    const a = frame({ marks: LINES, glare })
    const b = frame({ marks: [...LINES, { x: 120, y: 40, w: 40, h: 3 }], glare })
    expect(inkIsNew(inkChangedCells(a.ink, b.ink))).toBe(true)
  })

  it('фокус чи різкість: у всіх клітинках із крейдою частка разом зросла втричі — нового немає', () => {
    const a = new Float32Array(GX * GY)
    const b = new Float32Array(GX * GY)
    for (let i = 0; i < 40; i++) { a[i] = 0.1; b[i] = 0.3 }
    expect(inkIsNew(inkChangedCells(a, b))).toBe(false)
    // а втричі більше крейди лише в кількох клітинках — це нове
    const c = Float32Array.from(a)
    for (let i = 0; i < 3; i++) c[i] = 0.3
    expect(inkIsNew(inkChangedCells(a, c))).toBe(true)
  })

  it('стерли три рядки з п\'яти — це нове (стирання), навіть без нових написів', () => {
    const a = frame({ marks: LINES })
    const b = frame({ marks: LINES.slice(3) })
    const c = inkChangedCells(a.ink, b.ink)
    expect(c.removed).toBeGreaterThanOrEqual(MIRROR_TUNING.eraseCells)
    expect(inkIsNew(c)).toBe(true)
  })

  it('людина в темному стоїть перед порожньою частиною дошки — крейди не додалось, знімка немає', () => {
    const a = frame({ marks: [{ x: 10, y: 10, w: 80, h: 3 }] })
    const b = frame({ marks: [{ x: 10, y: 10, w: 80, h: 3 }], person: { x: 400, y: 120, w: 90, h: 240 } })
    expect(inkIsNew(inkChangedCells(a.ink, b.ink))).toBe(false)
  })

  it('людина зайшла знизу перед дошкою — за яскравістю «людина?»', () => {
    const a = frame({})
    const b = frame({ person: { x: 250, y: 120, w: 90, h: 240 } })
    const { mask, count } = changedCells(a.tone, b.tone, MIRROR_TUNING.cellThr)
    expect(count).toBeGreaterThan(GX * GY * MIRROR_TUNING.personArea)
    expect(looksLikePerson(mask)).toBe(true)
  })

  it('довгий рядок тексту знизу дошки — не людина (низький)', () => {
    const mask = new Uint8Array(GX * GY)
    for (let x = 0; x < GX; x++) mask[(GY - 1) * GX + x] = 1
    expect(looksLikePerson(mask)).toBe(false)
    const [b] = blobs(mask)
    expect(b.touchesEdge).toBe(true)
  })

  it('пляма посеред дошки, не з краю — не людина', () => {
    const mask = new Uint8Array(GX * GY)
    for (let y = 3; y < 12; y++) for (let x = 10; x < 20; x++) mask[y * GX + x] = 1
    expect(looksLikePerson(mask)).toBe(false)
  })
})

describe('рішення: відправити чи ні', () => {
  const T = { ...MIRROR_TUNING, stableMs: 1000, minIntervalMs: 5000, personAcceptMs: 10_000, maxSends: 3 }
  /** Кадр рішення: `tone` — клітинки зі зміненою яскравістю, `ink` — клітинки з крейдою (частка `inkLevel`) */
  const mk = (o: { tone?: number[]; ink?: number[]; inkLevel?: number } = {}): MirrorFrame => {
    const tone = new Float32Array(GX * GY)
    const ink = new Float32Array(GX * GY)
    o.tone?.forEach((i) => { tone[i] = 1 })
    o.ink?.forEach((i) => { ink[i] = o.inkLevel ?? 0.2 })
    return { tone, ink }
  }
  const base = () => mk()
  /** Дописали в клітинках 5–7: і яскравість, і крейда */
  const wrote = () => mk({ tone: [5, 6, 7], ink: [5, 6, 7] })
  const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i)
  const personCells = () => { const c: number[] = []; for (let y = 6; y < GY; y++) for (let x = 12; x < 20; x++) c.push(y * GX + x); return c }

  it('перший знімок — щойно кадр простояв тихо stableMs', () => {
    const d = createMirrorDecider(T)
    expect(d.step(base(), 0).kind).toBe('settling')
    expect(d.step(base(), 500).kind).toBe('settling')
    expect(d.step(base(), 1000)).toMatchObject({ kind: 'send', why: 'first', since: 1000 })
  })

  it('рух — не відправляємо; дописали й завмерло — відправляємо, не частіше за інтервал; затримка — від того, як нове помітили (Б-175)', () => {
    const d = createMirrorDecider(T)
    d.step(base(), 0)
    d.sent(base(), 1000)
    d.settled()
    expect(d.step(base(), 1400).kind).toBe('same')
    expect(d.step(mk({ tone: [1, 2, 3, 40, 41] }), 1800).kind).toBe('moving')
    const w = wrote()
    expect(d.step(w, 2200).kind).toBe('moving')
    expect(d.step(w, 2600).kind).toBe('settling')
    expect(d.step(w, 3600)).toMatchObject({ kind: 'wait', why: 'interval' })
    expect(d.step(w, 6000)).toMatchObject({ kind: 'send', why: 'change', since: 3600 })
  })

  it('змінилось лише світло (яскравість у багатьох клітинках, крейда та сама) — «те саме», з позначкою світла', () => {
    const d = createMirrorDecider(T)
    const board = mk({ ink: [5, 6, 7] })
    d.step(board, 0)
    d.sent(board, 1000)
    d.settled()
    const lit = mk({ ink: [5, 6, 7], tone: range(100, 100 + T.lightCells + 5) })
    expect(d.step(lit, 10_000).kind).toBe('moving')
    expect(d.step(lit, 10_400).kind).toBe('settling')
    expect(d.step(lit, 11_400)).toMatchObject({ kind: 'same', light: true })
  })

  it('поки попередній знімок у дорозі — чекаємо', () => {
    const d = createMirrorDecider(T)
    d.step(base(), 0)
    d.sent(base(), 1000)
    const w = wrote()
    d.step(w, 1100)
    d.step(w, 7000)
    expect(d.step(w, 8200)).toMatchObject({ kind: 'wait', why: 'busy' })
    d.settled()
    expect(d.step(w, 8600)).toMatchObject({ kind: 'send', why: 'change' })
  })

  it('«людина?» (закрила написане) — у журнал один раз; простояла понад personAcceptMs — відправляємо', () => {
    const d = createMirrorDecider(T)
    const board = mk({ ink: personCells() })
    d.step(board, 0)
    d.sent(board, 1000)
    d.settled()
    const p = mk({ tone: personCells() })                 // тіло: яскравість змінилась, крейду закрито
    expect(d.step(p, 20_000).kind).toBe('moving')
    expect(d.step(p, 20_500).kind).toBe('settling')
    expect(d.step(p, 21_500)).toMatchObject({ kind: 'person', first: true })
    expect(d.step(p, 22_000)).toMatchObject({ kind: 'person', first: false })
    expect(d.step(p, 30_000)).toMatchObject({ kind: 'person', first: false })
    expect(d.step(p, 30_500)).toMatchObject({ kind: 'send', why: 'after_wait' })
  })

  it('та сама невдала спроба сама не повторюється: після sent точка відліку — цей кадр', () => {
    const d = createMirrorDecider(T)
    const w = wrote()
    d.step(w, 0)
    d.sent(w, 1000)
    d.settled()
    expect(d.step(w, 9000).kind).toBe('same')
  })

  it('стеля знімків', () => {
    const d = createMirrorDecider(T)
    for (let i = 0; i < 3; i++) { d.sent(base(), i); d.settled() }
    const w = wrote()
    d.step(w, 100_000)
    expect(d.step(w, 102_000)).toMatchObject({ kind: 'wait', why: 'cap' })
  })

  it('нові кути — порівняння з нуля, перший знімок знову', () => {
    const d = createMirrorDecider(T)
    d.step(base(), 0)
    d.sent(base(), 1000)
    d.settled()
    d.reset()
    d.step(base(), 10_000)
    expect(d.step(base(), 11_000)).toMatchObject({ kind: 'send', why: 'first' })
  })
})

describe('сама знаходить дошку (ТЗ 2026-10-09 §2)', () => {
  const LINES: Mark[] = [10, 30, 50, 70].map((y) => ({ x: 10, y, w: 250, h: 3 }))
  /** Найбільша відстань від знайденого кута до справжнього — у частках діагоналі дошки */
  const err = (found: Quad, truth: Quad) => {
    const diag = Math.hypot(truth[0].x - truth[2].x, truth[0].y - truth[2].y)
    return Math.max(...found.map((p, i) => Math.hypot(p.x * W - truth[i].x, p.y * H - truth[i].y) / diag))
  }

  it('зелена дошка в перспективі з написами — кути в межах 2 %, уся в кадрі', () => {
    const f = detectBoardQuad(scene({ marks: LINES }))
    expect(f).not.toBeNull()
    expect(f!.clipped).toBe(false)
    expect(err(f!.quad, QUAD)).toBeLessThan(0.02)
  })

  it('пляма відблиску на дошці — кути на місці', () => {
    const f = detectBoardQuad(scene({ marks: LINES, glare: { x: 200, y: 100, r: 40, amp: 200 } }))
    expect(f).not.toBeNull()
    expect(err(f!.quad, QUAD)).toBeLessThan(0.02)
  })

  it('кути йдуть від лівого верхнього за годинниковою', () => {
    const f = detectBoardQuad(scene({ marks: LINES }))!
    const [tl, tr, br, bl] = f.quad
    expect(tl.x).toBeLessThan(tr.x)
    expect(tr.y).toBeLessThan(br.y)
    expect(br.x).toBeGreaterThan(bl.x)
    expect(bl.y).toBeGreaterThan(tl.y)
  })

  it('дошка виходить за край кадру — «не вся в кадрі»', () => {
    const off: Quad = [{ x: -40, y: 50 }, { x: 590, y: 70 }, { x: 600, y: 300 }, { x: -50, y: 320 }]
    const f = detectBoardQuad(scene({ quad: off }))
    expect(f).not.toBeNull()
    expect(f!.clipped).toBe(true)
  })

  it('аркуш паперу посеред дошки (біла пляма в чверть дошки) — дошку все одно знайдено', () => {
    const f = detectBoardQuad(scene({ marks: [{ x: 90, y: 15, w: 120, h: 70 }] }))
    expect(f).not.toBeNull()
    expect(err(f!.quad, QUAD)).toBeLessThan(0.02)
  })

  it('стіна без дошки — «не знайшла»', () => {
    expect(detectBoardQuad(scene({ quad: null }))).toBeNull()
  })

  it('крихітна дошка — «не знайшла»', () => {
    const tiny: Quad = [{ x: 300, y: 150 }, { x: 340, y: 150 }, { x: 340, y: 175 }, { x: 300, y: 175 }]
    expect(detectBoardQuad(scene({ quad: tiny }))).toBeNull()
  })
})
