/**
 * «Операція Дзеркало» — логіка без камери: перспектива, пошук змін, «людина?», рішення.
 * Кадр — синтетична зелена дошка в перспективі на сірій стіні; написи — білі прямокутники
 * в координатах дошки.
 */
import { describe, it, expect } from 'vitest'
import {
  AN_W, AN_H, GX, GY, MIRROR_TUNING,
  analyzeFrame, applyH, blobs, boardAspect, changedCells, createMirrorDecider, defaultQuad, fitRect,
  homography, isConvexQuad, looksLikePerson, parseQuad, quadUsable, rectToQuad, warpBoard,
  type Pixels, type Quad,
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
function scene(opts: { marks?: Mark[]; gain?: number; offset?: number; noise?: number; seed?: number; person?: Mark } = {}): Pixels {
  const { marks = [], gain = 1, offset = 0, noise = 0 } = opts
  let seed = opts.seed ?? 1
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5 }
  const inv = homography(QUAD, [{ x: 0, y: 0 }, { x: BW, y: 0 }, { x: BW, y: BH }, { x: 0, y: BH }])!
  const data = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let c = [128, 128, 120]
      const p = applyH(inv, x + 0.5, y + 0.5)
      if (p.x >= 0 && p.x < BW && p.y >= 0 && p.y < BH) {
        c = [30, 72, 44]
        if (marks.some((m) => p.x >= m.x && p.x < m.x + m.w && p.y >= m.y && p.y < m.y + m.h)) c = [235, 235, 230]
      }
      const pr = opts.person
      if (pr && x >= pr.x && x < pr.x + pr.w && y >= pr.y && y < pr.y + pr.h) c = [70, 50, 90]
      const i = (y * W + x) * 4
      for (let k = 0; k < 3; k++) data[i + k] = c[k] * gain + offset + noise * rnd()
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

describe('пошук змін', () => {
  const frame = (o: Parameters<typeof scene>[0]) => analyzeFrame(scene(o), QUAD)!

  it('той самий кадр із шумом камери — змін немає', () => {
    const a = frame({ noise: 8, seed: 1 })
    const b = frame({ noise: 8, seed: 7 })
    expect(changedCells(a, b, MIRROR_TUNING.cellThr).count).toBe(0)
  })

  it('автоекспозиція «дихнула» (весь кадр світліший) — це не зміна', () => {
    const a = frame({ marks: [{ x: 20, y: 20, w: 60, h: 4 }] })
    const b = frame({ marks: [{ x: 20, y: 20, w: 60, h: 4 }], gain: 1.3, offset: 12 })
    expect(changedCells(a, b, MIRROR_TUNING.cellThr).count).toBe(0)
  })

  it('дописали слово — кілька клітинок, не людина', () => {
    const a = frame({ marks: [{ x: 20, y: 20, w: 60, h: 4 }] })
    const b = frame({ marks: [{ x: 20, y: 20, w: 60, h: 4 }, { x: 150, y: 60, w: 30, h: 3 }] })
    const { mask, count } = changedCells(a, b, MIRROR_TUNING.cellThr)
    expect(count).toBeGreaterThanOrEqual(MIRROR_TUNING.changeCells)
    expect(count).toBeLessThan(GX * GY * 0.05)
    expect(looksLikePerson(mask)).toBe(false)
  })

  it('людина зайшла знизу перед дошкою — «людина?»', () => {
    const a = frame({})
    const b = frame({ person: { x: 250, y: 120, w: 90, h: 240 } })
    const { mask, count } = changedCells(a, b, MIRROR_TUNING.cellThr)
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
  const base = () => new Float32Array(GX * GY)
  const withCells = (cells: number[]) => { const f = base(); cells.forEach((i) => { f[i] = 1 }); return f }
  const person = () => {
    const f = base()
    for (let y = 6; y < GY; y++) for (let x = 12; x < 20; x++) f[y * GX + x] = 1
    return f
  }

  it('перший знімок — щойно кадр простояв тихо stableMs', () => {
    const d = createMirrorDecider(T)
    expect(d.step(base(), 0).kind).toBe('settling')
    expect(d.step(base(), 500).kind).toBe('settling')
    const r = d.step(base(), 1000)
    expect(r).toMatchObject({ kind: 'send', why: 'first', stableSince: 0 })
  })

  it('рух — не відправляємо; дописали й завмерло — відправляємо зміну, але не частіше за інтервал', () => {
    const d = createMirrorDecider(T)
    d.step(base(), 0)
    d.sent(base(), 1000)
    d.settled()
    expect(d.step(base(), 1400).kind).toBe('same')
    expect(d.step(withCells([1, 2, 3, 40, 41]), 1800).kind).toBe('moving')
    const w = withCells([5, 6, 7])
    expect(d.step(w, 2200).kind).toBe('moving')
    expect(d.step(w, 2600).kind).toBe('settling')
    expect(d.step(w, 3600)).toMatchObject({ kind: 'wait', why: 'interval' })
    expect(d.step(w, 6000)).toMatchObject({ kind: 'send', why: 'change' })
  })

  it('поки попередній знімок у дорозі — чекаємо', () => {
    const d = createMirrorDecider(T)
    d.step(base(), 0)
    d.sent(base(), 1000)
    const w = withCells([5, 6, 7])
    d.step(w, 1100)
    d.step(w, 7000)
    expect(d.step(w, 8200)).toMatchObject({ kind: 'wait', why: 'busy' })
    d.settled()
    expect(d.step(w, 8600)).toMatchObject({ kind: 'send', why: 'change' })
  })

  it('«людина?» — у журнал один раз; простояла понад personAcceptMs — це стерта дошка, відправляємо', () => {
    const d = createMirrorDecider(T)
    d.step(base(), 0)
    d.sent(base(), 1000)
    d.settled()
    const p = person()
    expect(d.step(p, 20_000).kind).toBe('moving')       // зайшла — рух
    expect(d.step(p, 20_500).kind).toBe('settling')     // завмерла
    expect(d.step(p, 21_500)).toMatchObject({ kind: 'person', first: true })
    expect(d.step(p, 22_000)).toMatchObject({ kind: 'person', first: false })
    expect(d.step(p, 30_000)).toMatchObject({ kind: 'person', first: false })
    expect(d.step(p, 30_500)).toMatchObject({ kind: 'send', why: 'after_wait' })
  })

  it('та сама невдала спроба сама не повторюється: після sent точка відліку — цей кадр', () => {
    const d = createMirrorDecider(T)
    const w = withCells([5, 6, 7])
    d.step(w, 0)
    d.sent(w, 1000)
    d.settled()                                         // не вдалося — неважливо
    expect(d.step(w, 9000).kind).toBe('same')
  })

  it('стеля знімків', () => {
    const d = createMirrorDecider(T)
    for (let i = 0; i < 3; i++) { d.sent(base(), i); d.settled() }
    const w = withCells([5, 6, 7])
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
