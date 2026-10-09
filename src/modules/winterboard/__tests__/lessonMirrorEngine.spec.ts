/**
 * «Дзеркало уроку» — рушій без браузера: растрові операції, порядок написів, класифікація пари на синтетичній
 * дошці, MP4. На справжніх знімках уроку 09.10 рушій звірено з прототипом окремо (стенд, 38/38 переходів).
 */
import { describe, it, expect } from 'vitest'
import { boxRadiiForGauss, dilate, gaussBlur, label8 } from '../engine/lessonMirror/raster'
import { readingOrder } from '../engine/lessonMirror/order'
import { analyzePair, coarseCorrelation } from '../engine/lessonMirror/analyze'
import { buildMp4 } from '../engine/lessonMirror/mp4'

const W = 800
const H = 450

type Rect = { x: number; y: number; w: number; h: number }

/** Зелена дошка з легким градієнтом; штрихи крейди — світлі прямокутники; gain — експозиція. */
function board(strokes: Rect[] = [], gain = 1, size: [number, number] = [W, H]): Uint8ClampedArray {
  const [w, h] = size
  const d = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = [30 + (x * 20) / w, 72 + (y * 10) / h, 44]
      if (strokes.some((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h)) c = [232, 232, 226]
      const i = (y * w + x) * 4
      d[i] = c[0] * gain
      d[i + 1] = c[1] * gain
      d[i + 2] = c[2] * gain
      d[i + 3] = 255
    }
  }
  return d
}

/** «Слово» з кількох літер-штрихів — горизонтальні й вертикальні риски висотою h. */
function word(x: number, y: number, letters: number, h = 30): Rect[] {
  const out: Rect[] = []
  for (let k = 0; k < letters; k++) {
    out.push({ x: x + k * 26, y, w: 3, h }, { x: x + k * 26, y: y + h / 2, w: 16, h: 3 })
  }
  return out
}

describe('растр', () => {
  it('розширення — ромб, як scipy binary_dilation(iterations=r)', () => {
    const m = new Uint8Array(15 * 15)
    m[7 * 15 + 7] = 1
    const d = dilate(m, 15, 15, 3)
    expect(d.reduce((s, v) => s + v, 0)).toBe(2 * 3 * 3 + 2 * 3 + 1)   // 25
    expect(d[7 * 15 + 10]).toBe(1)
    expect(d[10 * 15 + 10]).toBe(0)                                   // кут квадрата — поза ромбом
  })

  it('розмиття зберігає рівну яскравість, а радіуси наближають σ', () => {
    const g = new Float32Array(50 * 40).fill(100)
    const b = gaussBlur(g, 50, 40, 5)
    expect(Math.abs(b[20 * 50 + 25] - 100)).toBeLessThan(1e-3)
    const r = boxRadiiForGauss(10)
    const variance = r.reduce((s, x) => s + ((2 * x + 1) ** 2 - 1) / 12, 0)
    expect(Math.abs(Math.sqrt(variance) - 10)).toBeLessThan(0.6)
  })

  it('плями — 8 сусідів (діагональ з\'єднує)', () => {
    const m = new Uint8Array(4 * 4)
    m[0] = 1
    m[5] = 1
    m[15] = 1
    expect(label8(m, 4, 4).count).toBe(2)
  })
})

describe('порядок написів', () => {
  const box = (top: number, bottom: number, left: number, right: number) => ({ top, bottom, left, right })

  it('два рядки з проміжком — спершу весь перший, потім другий', () => {
    const order = readingOrder([
      { id: 1, box: box(100, 140, 10, 100) }, { id: 2, box: box(100, 140, 120, 200) },
      { id: 3, box: box(165, 205, 10, 90) }, { id: 4, box: box(165, 205, 110, 210) },
    ])
    expect(order).toEqual([1, 2, 3, 4])
  })

  it('дріб — чисельник, потім знаменник, і лише тоді те, що праворуч', () => {
    const order = readingOrder([
      { id: 10, box: box(100, 130, 300, 340) },      // «=» праворуч
      { id: 11, box: box(60, 95, 220, 260) },        // чисельник
      { id: 12, box: box(100, 140, 210, 270) },      // риска й знаменник (зазор 5 px)
    ])
    expect(order).toEqual([11, 12, 10])
  })
})

describe('пара знімків', () => {
  it('лише світло (експозиція +25 %) — light_only, без кроку', () => {
    const a = board(word(100, 100, 5))
    const b = board(word(100, 100, 5), 1.25)
    const r = analyzePair(a, W, H, b, W, H)
    expect(r.kind).toBe('light_only')
    expect(r.revealMs).toBeNull()
  })

  it('дописали слово — write, проявляється зліва направо, на межі — точний кадр', () => {
    const a = board(word(100, 100, 5))
    const b = board([...word(100, 100, 5), ...word(100, 220, 6)])
    const r = analyzePair(a, W, H, b, W, H)
    expect(r.kind).toBe('write')
    expect(r.newPx).toBeGreaterThan(300)
    const at = (x: number, y: number) => r.revealMs![y * W + x]
    expect(at(101, 235)).toBeLessThan(at(231, 235))                   // ліва літера раніше за праву
    expect(at(101, 115)).toBe(Infinity)                                // старий напис не «пишеться» знову
    expect(r.durationMs).toBeGreaterThan(200)
  })

  it('стерли — erase із губкою', () => {
    const a = board([...word(100, 100, 6), ...word(100, 220, 6)])
    const b = board()
    const r = analyzePair(a, W, H, b, W, H)
    expect(r.kind).toBe('erase')
    expect(r.eraseMs).toBe(800)
  })

  it('інший розмір кадру — snap', () => {
    const r = analyzePair(board(), W, H, board([], 1, [640, 360]), 640, 360)
    expect(r).toMatchObject({ kind: 'snap', reason: 'size_mismatch' })
  })

  it('інша сцена — snap', () => {
    const a = board()
    const b = new Uint8ClampedArray(a.length)
    for (let i = 0; i < b.length; i += 4) {
      const x = (i / 4) % W
      b[i] = b[i + 1] = b[i + 2] = 255 - (x * 255) / W                // дзеркальний градієнт
      b[i + 3] = 255
    }
    expect(analyzePair(a, W, H, b, W, H)).toMatchObject({ kind: 'snap', reason: 'scene_changed' })
  })

  it('рейка біля краю (висока вузька смуга) — не «пишеться», напис поруч — так', () => {
    const a = board()
    const rail = { x: W - 6, y: 20, w: 4, h: 300 }
    const b = board([rail, ...word(200, 150, 6)])
    const r = analyzePair(a, W, H, b, W, H)
    expect(r.kind).toBe('write')
    expect(r.revealMs![100 * W + (W - 5)]).toBe(Infinity)
    expect(r.revealMs![165 * W + 201]).toBeLessThan(Infinity)
  })

  it('кореляція сцени: той самий кадр — 1', () => {
    const a = board(word(100, 100, 3))
    const g = new Float32Array(W * H)
    for (let i = 0; i < g.length; i++) g[i] = a[i * 4]
    expect(coarseCorrelation(g, g, W, H)).toBeCloseTo(1, 6)
  })
})

describe('MP4', () => {
  function boxes(buf: Uint8Array, start = 0, end = buf.length): Record<string, [number, number][]> {
    const dv = new DataView(buf.buffer, buf.byteOffset)
    const out: Record<string, [number, number][]> = {}
    const walk = (s: number, e: number) => {
      let o = s
      while (o + 8 <= e) {
        const size = dv.getUint32(o)
        const type = String.fromCharCode(...buf.subarray(o + 4, o + 8))
        ;(out[type] ??= []).push([o, size])
        if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) walk(o + 8, o + size)
        if (type === 'stsd') walk(o + 16, o + size)
        if (type === 'avc1') walk(o + 8 + 78, o + size)
        o += size
      }
    }
    walk(start, end)
    return out
  }

  it('правильні тривалості, таблиці й зсув даних', () => {
    const samples = Array.from({ length: 90 }, (_, i) => ({
      data: new Uint8Array([i, 1, 2, 3, 4].concat(i % 30 === 0 ? [9, 9] : [])), duration: 1000, key: i % 30 === 0,
    }))
    const mp4 = buildMp4({ width: 1280, height: 720, timescale: 30000, avcC: new Uint8Array([1, 0x64, 0, 0x28]), samples })
    const b = boxes(mp4)
    const dv = new DataView(mp4.buffer)
    for (const t of ['ftyp', 'moov', 'mdat', 'mvhd', 'tkhd', 'mdhd', 'stsd', 'avc1', 'avcC', 'stts', 'stss', 'stsz', 'stco']) {
      expect(b[t], t).toBeTruthy()
    }
    const [mvhd] = b.mvhd[0]
    expect(dv.getUint32(mvhd + 20)).toBe(1000)                         // timescale ролика
    expect(dv.getUint32(mvhd + 24)).toBe(3000)                         // 90 кадрів / 30 = 3 с
    const [mdhd] = b.mdhd[0]
    expect(dv.getUint32(mdhd + 20)).toBe(30000)
    expect(dv.getUint32(mdhd + 24)).toBe(90000)                        // у одиницях доріжки, не мс
    const [stss] = b.stss[0]
    expect(dv.getUint32(stss + 12)).toBe(3)                            // ключові: 1, 31, 61
    const [stco] = b.stco[0]
    const off = dv.getUint32(stco + 16)
    expect(Array.from(mp4.subarray(off, off + 7))).toEqual([0, 1, 2, 3, 4, 9, 9])
    expect(b.mdat[0][0] + 8).toBe(off)
  })
})
