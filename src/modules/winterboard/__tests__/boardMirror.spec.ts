/**
 * «Операція Дзеркало» — логіка без камери: перспектива, пошук змін (крейда, а не світло — ТЗ
 * 2026-10-09 §1), «людина?», рішення, пошук дошки (§2).
 * Кадр — синтетична зелена дошка в перспективі на сірій стіні; написи — білі прямокутники
 * в координатах дошки.
 */
import { describe, it, expect } from 'vitest'
import {
  AN_W, AN_H, GX, GY, MIRROR_TUNING, SAMPLE_MS,
  SHIFT_TUNING, analyzeFrame, applyH, blobs, boardAspect, boardFill, changedCells, clippedSides, createMirrorDecider,
  createShiftWatch, defaultQuad, detectBoardQuad, fitRect, homography, inkChangedCells, inkIsNew, isConvexQuad,
  looksLikePerson, parseQuad, quadShift, quadUsable, rectToQuad, sideEdge, steadyInk, transferCorners, warpBoard,
  type MirrorDecision, type MirrorFrame, type Pixels, type Quad,
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
    expect(d.step(w, 3000).kind).toBe('settling')   // кадри — кожні SAMPLE_MS: крейда має втриматись inkSteadyFrames кадрів
    expect(d.step(w, 3400).kind).toBe('settling')
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
    for (const now of [7000, 7400, 7800]) d.step(w, now)
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
    expect(d.step(p, 20_900).kind).toBe('settling')
    expect(d.step(p, 21_300).kind).toBe('settling')
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
    for (const now of [100_000, 100_400, 100_800]) d.step(w, now)
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

describe('стійкість нової крейди: мерехтіння — не знімок (урок 2, 09.10)', () => {
  // На уроці 2 з 5 повторів три на парах знімків — «+0»: крейда «змінилась» у 2–4 клітинках одного
  // кадру (шум камери), а пляма світла з краю за яскравістю схожа на людину → «людина?» → 10 с → знімок.
  const T = MIRROR_TUNING
  const K = T.inkSteadyFrames
  const N = GX * GY
  /** Крейда, що вже на дошці (у знімку) */
  const BOARD = Array.from({ length: 20 }, (_, i) => 64 + i)
  /** Кадр: дошка BOARD (0,2) + `ink` — клітинки з крейдою (частка `level`); `tone` — плями яскравості */
  const mk = (o: { ink?: number[]; level?: number; tone?: number[] } = {}): MirrorFrame => {
    const tone = new Float32Array(N)
    const ink = new Float32Array(N)
    BOARD.forEach((i) => { ink[i] = 0.2 })
    o.ink?.forEach((i) => { ink[i] = o.level ?? 0.2 })
    o.tone?.forEach((i) => { tone[i] = 1 })
    return { tone, ink }
  }
  let seed = 1
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  /** 2–4 клітинки у випадкових місцях — щокадру нові */
  const flicker = () => Array.from({ length: 2 + Math.floor(rnd() * 3) }, () => Math.floor(rnd() * N))
  /** Пляма яскравості від нижнього краю — за `tone` схожа на людину */
  const blob = () => { const c: number[] = []; for (let y = 6; y < GY; y++) for (let x = 12; x < 20; x++) c.push(y * GX + x); return c }
  const WRITE = [200, 201, 202]
  /** Дзеркало, що вже поклало знімок дошки BOARD о 0 мс */
  const armed = (t: typeof T = T) => {
    seed = 1
    const d = createMirrorDecider(t)
    d.step(mk(), 0)
    d.sent(mk(), 0)
    d.settled()
    return d
  }
  /** Кадри кожні SAMPLE_MS з `from` до `to`; повертає рішення з часом */
  const run = (d: ReturnType<typeof createMirrorDecider>, from: number, to: number, frame: (now: number) => MirrorFrame) => {
    const out: (MirrorDecision & { at: number })[] = []
    for (let now = from; now <= to; now += SAMPLE_MS) out.push({ ...d.step(frame(now), now), at: now })
    return out
  }

  it('мерехтіння 2–4 клітинок у різних місцях кадр за кадром — хвилину жодного знімка', () => {
    const kinds = run(armed(), SAMPLE_MS, 60_000, () => mk({ ink: flicker() })).map((r) => r.kind)
    expect(kinds).not.toContain('send')
    expect(kinds).not.toContain('wait')
    expect(kinds).toContain('same')
  })

  it('мерехтіння + пляма світла з краю (за яскравістю «людина») — не «людина?» і не знімок «після очікування»', () => {
    const r = run(armed(), SAMPLE_MS, 60_000, () => mk({ ink: flicker(), tone: blob() }))
    expect(r.map((x) => x.kind)).not.toContain('person')
    expect(r.map((x) => x.kind)).not.toContain('send')
    expect(r[r.length - 1]).toMatchObject({ kind: 'same', light: true })
  })

  it('справжній напис, що тримається, — знімок, хоч довкола мерехтить; запізнення ≤ (K−1)·SAMPLE_MS', () => {
    const d = armed()
    run(d, SAMPLE_MS, 8000, () => mk({ ink: flicker() }))
    const appeared = 8000 + SAMPLE_MS
    const r = run(d, appeared, 20_000, () => mk({ ink: [...WRITE, ...flicker()] }))
    const send = r.find((x) => x.kind === 'send')
    expect(send).toMatchObject({ kind: 'send', why: 'change' })
    expect(send!.at - appeared).toBeLessThanOrEqual((K - 1) * SAMPLE_MS)
  })

  it('учитель писав (рух), відійшов — знімок тоді ж, що й без стійкості: лічба йде, поки дошка «завмирає»', () => {
    const d = armed()
    run(d, SAMPLE_MS, 8000, () => mk())
    // до 9600 мс учитель біля дошки й рухається (пляма то є, то немає), далі дошка завмерла з написом
    const r = run(d, 8400, 20_000, (now) => mk({ ink: WRITE, tone: now < 9600 && (now / SAMPLE_MS) % 2 ? blob() : [] }))
    const lastMove = Math.max(...r.filter((x) => x.kind === 'moving').map((x) => x.at))
    const firstStill = r.find((x) => x.at > lastMove)!.at
    expect(r.find((x) => x.kind === 'send')).toMatchObject({ why: 'change', at: firstStill + T.stableMs })
  })

  it('та сама клітинка то з\'являється, то зникає (знак міняється) — не стійка, знімка немає', () => {
    const r = run(armed(), SAMPLE_MS, 30_000, (now) => mk(now % (2 * SAMPLE_MS) ? { ink: BOARD.slice(0, 3), level: 0.6 } : {
      ink: BOARD.slice(0, 3), level: 0,
    }))
    expect(r.map((x) => x.kind)).not.toContain('send')
  })

  it('«поспіль» — лише кадри без руху: рух між ними обнуляє лічбу', () => {
    const d = armed({ ...T, stableMs: 0 })
    expect(d.step(mk({ ink: WRITE }), 6000).kind).toBe('same')
    expect(d.step(mk({ ink: WRITE }), 6400).kind).toBe('same')
    expect(d.step(mk({ ink: WRITE, tone: blob() }), 6800).kind).toBe('moving')
    expect(d.step(mk({ ink: WRITE }), 7200).kind).toBe('moving')
    expect(d.step(mk({ ink: WRITE }), 7600).kind).toBe('same')    // 1-й кадр без руху після руху
    expect(d.step(mk({ ink: WRITE }), 8000).kind).toBe('same')
    expect(d.step(mk({ ink: WRITE }), 8400)).toMatchObject({ kind: 'send', why: 'change' })
  })

  it('steadyInk: лічба по клітинці, знак і обнулення', () => {
    const runs = new Int16Array(4)
    const ch = (sign: number[]) => ({ mask: new Uint8Array(4), sign: Int8Array.from(sign), count: 0, added: 0, removed: 0 })
    expect(steadyInk(runs, ch([1, -1, 1, 0]), 2)).toEqual({ count: 0, added: 0, removed: 0 })
    expect(steadyInk(runs, ch([1, -1, -1, 0]), 2)).toEqual({ count: 2, added: 1, removed: 1 })
    expect(Array.from(runs)).toEqual([2, -2, -1, 0])
    expect(steadyInk(runs, ch([0, -1, -1, 0]), 2)).toEqual({ count: 2, added: 0, removed: 2 })
    expect(runs[0]).toBe(0)
  })
})

describe('дошка не вся в кадрі: який бік (урок 2, 09.10 — верх обрізано на всіх знімках)', () => {
  const q = (pts: [number, number][]): Quad => pts.map(([x, y]) => ({ x, y })) as Quad

  it('кути далі 2 % від країв кадру — усе в кадрі', () => {
    expect(clippedSides(defaultQuad())).toEqual([])
    expect(clippedSides(q([[0.03, 0.03], [0.97, 0.03], [0.97, 0.97], [0.03, 0.97]]))).toEqual([])
  })

  it('верхні кути при верхньому краї кадру — «верх»; бік — за краєм кадру, не за номером кута', () => {
    expect(clippedSides(q([[0.1, 0.01], [0.9, 0.02], [0.9, 0.8], [0.1, 0.8]]))).toEqual(['top'])
    // лише один кут торкається — бік той самий
    expect(clippedSides(q([[0.1, 0.2], [0.9, 0], [0.9, 0.8], [0.1, 0.8]]))).toEqual(['top'])
  })

  it('кілька боків одразу, порядок сталий: верх, низ, лівий, правий', () => {
    expect(clippedSides(q([[0, 0.5], [1, 0.01], [1, 0.99], [0.01, 0.99]]))).toEqual(['top', 'bottom', 'left', 'right'])
    expect(clippedSides(q([[0.1, 0.1], [0.99, 0.1], [0.99, 0.9], [0.1, 0.9]]))).toEqual(['right'])
    expect(clippedSides(q([[0.1, 0.1], [0.9, 0.1], [0.9, 0.985], [0.1, 0.9]]))).toEqual(['bottom'])
  })

  it('червона сторона рамки — та, що лежить при цьому краї кадру, хоч кружечки поставлено не з лівого верхнього', () => {
    const tl = q([[0.1, 0.01], [0.9, 0.01], [0.9, 0.8], [0.1, 0.8]])
    expect(sideEdge(tl, 'top')).toBe(0)
    expect(sideEdge(tl, 'right')).toBe(1)
    expect(sideEdge(tl, 'bottom')).toBe(2)
    expect(sideEdge(tl, 'left')).toBe(3)
    // ті самі кути, але перший кружечок — у правому нижньому
    const br = q([[0.9, 0.8], [0.1, 0.8], [0.1, 0.01], [0.9, 0.01]])
    expect(sideEdge(br, 'top')).toBe(2)
    expect(sideEdge(br, 'left')).toBe(1)
  })
})

describe('телефон зрушив: кути переїжджають разом із дошкою (урок 2, 09.10)', () => {
  const LINES: Mark[] = [10, 30, 50, 70].map((y) => ({ x: 10, y, w: 250, h: 3 }))
  const norm = (q: Quad): Quad => q.map((p) => ({ x: p.x / W, y: p.y / H })) as Quad
  const shifted = (q: Quad, dx: number, dy: number): Quad => q.map((p) => ({ x: p.x + dx, y: p.y + dy })) as Quad
  /** Точки дошки (u, v у частках її ширини й висоти) → на кадрі, через гомографію з одиничного квадрата */
  const onBoard = (board: Quad, pts: [number, number][]): Quad => {
    const h = homography([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], board)!
    return pts.map(([u, v]) => applyH(h, u, v)) as Quad
  }
  /** Середня третина дошки — так учитель міг підтягнути кути вручну */
  const MIDDLE: [number, number][] = [[1 / 3, 0], [2 / 3, 0], [2 / 3, 1], [1 / 3, 1]]
  const far = (a: Quad, b: Quad) => quadShift(a, b, W, H)
  const QUAD2 = shifted(QUAD, -30, 20)

  it('частка кольору дошки в кутах: на дошці — майже вся, на стіні — нуль', () => {
    expect(boardFill(scene({ marks: LINES }), norm(QUAD))).toBeGreaterThan(0.85)   // крейда — не колір дошки
    expect(boardFill(scene({ quad: null }), norm(QUAD))).toBe(0)
  })

  it('кути переносяться гомографією: ручна середня третина лишається середньою третиною на новому місці', () => {
    const from = norm(QUAD)
    const to = norm(QUAD2)
    const t = transferCorners(onBoard(from, MIDDLE), from, to)!
    expect(far(t, onBoard(to, MIDDLE))).toBeLessThan(0.001)
  })

  it('дошка зсунулась у кадрі → після другої перевірки кути переїхали; ручна середня третина — та сама частина дошки', () => {
    const px1 = scene({ marks: LINES })
    const found = detectBoardQuad(px1)!.quad
    const corners = onBoard(found, MIDDLE)
    const w = createShiftWatch({ base: boardFill(px1, corners), found })
    expect(w.check(px1, corners, 0).kind).toBe('ok')
    const px2 = scene({ marks: LINES, quad: QUAD2 })
    expect(w.check(px2, corners, 3000)).toMatchObject({ kind: 'pending', why: 'move' })
    expect(w.pending).toBe(true)
    const r = w.check(px2, corners, 3800)
    expect(r).toMatchObject({ kind: 'moved', byRef: true, clipped: false })
    if (r.kind !== 'moved') return
    expect(r.shift).toBeGreaterThan(SHIFT_TUNING.shiftFrac)
    expect(far(r.quad, onBoard(norm(QUAD2), MIDDLE))).toBeLessThan(0.03)
    // далі на новому місці спокійно
    expect(w.check(px2, r.quad, 7000).kind).toBe('ok')
  })

  it('тремтіння пошуку менше 3 % діагоналі — не зсув', () => {
    const px1 = scene({ marks: LINES })
    const found = detectBoardQuad(px1)!.quad
    const w = createShiftWatch({ base: boardFill(px1, found), found })
    const px2 = scene({ marks: LINES, quad: shifted(QUAD, 4, 3), noise: 6, seed: 3 })
    expect(w.check(px2, found, 0).kind).toBe('ok')
    expect(w.check(px2, found, 3000).kind).toBe('ok')
  })

  it('людина стоїть перед третиною дошки (нерухомо) — це не зсув телефона: кути на місці', () => {
    const px1 = scene({ marks: LINES })
    const found = detectBoardQuad(px1)!.quad
    const w = createShiftWatch({ base: boardFill(px1, found), found })
    const px2 = scene({ marks: LINES, person: { x: 40, y: 0, w: 170, h: H } })
    expect(w.check(px2, found, 0).kind).toBe('ok')
    expect(w.check(px2, found, 3000).kind).toBe('ok')
  })

  it('учитель стоїть біля дошки й закриває нижній кут (нерухомо) — це не зсув: решта кутів на місці', () => {
    const px1 = scene({ marks: LINES })
    const found = detectBoardQuad(px1)!.quad
    for (const person of [{ x: 20, y: 150, w: 110, h: 210 }, { x: 520, y: 140, w: 120, h: 220 }, { x: 30, y: 0, w: 60, h: H }]) {
      const w = createShiftWatch({ base: boardFill(px1, found), found })
      const px2 = scene({ marks: LINES, person })
      expect(w.check(px2, found, 0).kind).toBe('ok')
      expect(w.check(px2, found, 3000).kind).toBe('ok')
    }
  })

  it('верх дошки за кадром (як на уроці 2) — зсув телефона все одно помічено; учитель біля дошки — ні', () => {
    const TOPCUT: Quad = [{ x: 60, y: -30 }, { x: 590, y: -10 }, { x: 600, y: 300 }, { x: 50, y: 320 }]
    const px1 = scene({ quad: TOPCUT })
    const f1 = detectBoardQuad(px1)!
    expect(f1.clipped).toBe(true)
    for (const [dx, dy] of [[0, 20], [0, -20], [-25, 0]]) {
      const w = createShiftWatch({ base: boardFill(px1, f1.quad), found: f1.quad })
      const px2 = scene({ quad: shifted(TOPCUT, dx, dy) })
      expect(w.check(px2, f1.quad, 0).kind).toBe('pending')
      expect(w.check(px2, f1.quad, 1000)).toMatchObject({ kind: 'moved', clipped: true })
    }
    const w = createShiftWatch({ base: boardFill(px1, f1.quad), found: f1.quad })
    const px3 = scene({ quad: TOPCUT, person: { x: 20, y: 150, w: 110, h: 210 } })
    expect(w.check(px3, f1.quad, 0).kind).toBe('ok')
    expect(w.check(px3, f1.quad, 1000).kind).toBe('ok')
  })

  it('крила дошки-триптиха «злились» з серединою (світло на рамці) — пошук знайшов удвічі більшу дошку: це не зсув', () => {
    // Урок 30.09: рамка між крилами ~80°, межа кольору дошки — 95°; інше світло — і крила зливаються
    const MID: Quad = [{ x: 200, y: 80 }, { x: 440, y: 80 }, { x: 440, y: 280 }, { x: 200, y: 280 }]
    const ALL: Quad = [{ x: 100, y: 80 }, { x: 540, y: 80 }, { x: 540, y: 280 }, { x: 100, y: 280 }]
    const px1 = scene({ quad: MID })
    const f1 = detectBoardQuad(px1)!.quad
    const w = createShiftWatch({ base: boardFill(px1, f1), found: f1 })
    const px2 = scene({ quad: ALL })
    const f2 = detectBoardQuad(px2)!.quad
    expect(quadShift(f1, f2, W, H)).toBeGreaterThan(SHIFT_TUNING.shiftFrac)   // кожен кут «зсунувся»
    expect(w.check(px2, f1, 0).kind).toBe('ok')
    expect(w.check(px2, f1, 3000).kind).toBe('ok')
  })

  it('кути ставили вручну, пошук дошки не знайшов: дошка поїхала з-під кутів — беремо знайдені кути як є', () => {
    const B1: Quad = [{ x: 40, y: 60 }, { x: 300, y: 60 }, { x: 300, y: 300 }, { x: 40, y: 300 }]
    const B2 = shifted(B1, 300, 0)
    const corners = norm(B1)
    const w = createShiftWatch({ base: boardFill(scene({ quad: B1 }), corners), found: null })
    expect(w.check(scene({ quad: B1 }), corners, 0).kind).toBe('ok')
    const px2 = scene({ quad: B2 })
    expect(w.check(px2, corners, 3000).kind).toBe('pending')
    const r = w.check(px2, corners, 3800)
    expect(r).toMatchObject({ kind: 'moved', byRef: false })
    if (r.kind === 'moved') expect(far(r.quad, norm(B2))).toBeLessThan(0.03)
  })

  it('дошки немає (телефон упав, дивиться в стіну) → «не бачу», у журнал один раз; повернули на місце → продовжує', () => {
    const px1 = scene({ marks: LINES })
    const found = detectBoardQuad(px1)!.quad
    const w = createShiftWatch({ base: boardFill(px1, found), found })
    const wall = scene({ quad: null })
    expect(w.check(wall, found, 0)).toMatchObject({ kind: 'pending', why: 'lost' })
    expect(w.check(wall, found, 800)).toMatchObject({ kind: 'lost', first: true })
    expect(w.lost).toBe(true)
    expect(w.check(wall, found, 3800)).toMatchObject({ kind: 'lost', first: false })
    expect(w.check(px1, found, 6800).kind).toBe('back')
    expect(w.lost).toBe(false)
  })

  it('дошки не було — а знайшлась деінде: кути переїхали й «не бачу» знято', () => {
    const px1 = scene({ marks: LINES })
    const found = detectBoardQuad(px1)!.quad
    const w = createShiftWatch({ base: boardFill(px1, found), found })
    const wall = scene({ quad: null })
    w.check(wall, found, 0)
    w.check(wall, found, 800)
    const px2 = scene({ marks: LINES, quad: QUAD2 })
    expect(w.check(px2, found, 3800).kind).toBe('pending')
    expect(w.check(px2, found, 4600)).toMatchObject({ kind: 'moved' })
    expect(w.lost).toBe(false)
  })

  it('маркерна (не зелена) дошка — за кольором не судимо: «не бачу» не зʼявляється', () => {
    const w = createShiftWatch({ base: 0.1, found: null })
    const wall = scene({ quad: null })
    expect(w.check(wall, defaultQuad(), 0).kind).toBe('ok')
    expect(w.check(wall, defaultQuad(), 3000).kind).toBe('ok')
  })

  it('перевіряє рідко: раз на checkMs; підозра — швидше; дошки не видно — раз на lostCheckMs; перед відправкою — якщо давно', () => {
    const T = SHIFT_TUNING
    const px1 = scene({ marks: LINES })
    const found = detectBoardQuad(px1)!.quad
    const w = createShiftWatch({ base: boardFill(px1, found), found })
    expect(w.due(0)).toBe(true)
    w.check(px1, found, 0)
    expect(w.due(T.checkMs - 1)).toBe(false)
    expect(w.due(T.checkMs)).toBe(true)
    expect(w.due(T.sendFreshMs - 1, true)).toBe(false)
    expect(w.due(T.sendFreshMs, true)).toBe(true)
    const wall = scene({ quad: null })
    w.check(wall, found, 10_000)
    expect(w.due(10_000 + T.confirmMs)).toBe(true)
    w.check(wall, found, 10_000 + T.confirmMs)
    expect(w.lost).toBe(true)
    expect(w.due(10_000 + T.confirmMs + T.lostCheckMs - 1, true)).toBe(false)
    expect(w.due(10_000 + T.confirmMs + T.lostCheckMs)).toBe(true)
  })
})
