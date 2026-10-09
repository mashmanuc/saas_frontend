/**
 * Найпростіший правильний MP4 (ISO BMFF) з однією відеодоріжкою H.264: ftyp + moov (повні таблиці кадрів) + mdat.
 *
 * Кадри приходять із WebCodecs `VideoEncoder` у форматі AVCC (`avc: { format: 'avc' }`), опис декодера
 * (`decoderConfig.description`) — це вміст коробки avcC. Тривалість пишеться в одиницях кожної коробки —
 * саме тут ламається MP4 від `MediaRecorder` Chromium (див. README прототипу), тому файл складаємо самі.
 */

export interface Mp4Sample {
  data: Uint8Array
  /** Тривалість у одиницях timescale */
  duration: number
  key: boolean
}

export interface Mp4Input {
  width: number
  height: number
  /** Одиниць на секунду (наприклад 30000 при 30 кадр/с і duration 1000) */
  timescale: number
  /** Вміст коробки avcC (decoderConfig.description) */
  avcC: Uint8Array
  samples: Mp4Sample[]
}

const enc = new TextEncoder()

function u32(v: number): Uint8Array {
  return new Uint8Array([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255])
}
function u16(v: number): Uint8Array {
  return new Uint8Array([(v >>> 8) & 255, v & 255])
}
function cat(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(len)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}
function box(type: string, ...parts: Uint8Array[]): Uint8Array {
  const body = cat(parts)
  return cat([u32(8 + body.length), enc.encode(type), body])
}
function full(type: string, version: number, flags: number, ...parts: Uint8Array[]): Uint8Array {
  return box(type, new Uint8Array([version, (flags >>> 16) & 255, (flags >>> 8) & 255, flags & 255]), ...parts)
}
const zeros = (n: number) => new Uint8Array(n)
const MATRIX = cat([u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000)])

export function buildMp4(input: Mp4Input): Uint8Array {
  const { width, height, timescale, avcC, samples } = input
  if (!samples.length) throw new Error('mp4: немає кадрів')
  const total = samples.reduce((s, x) => s + x.duration, 0)
  const movieTs = 1000
  const movieDur = Math.round((total * movieTs) / timescale)

  const ftyp = box('ftyp', enc.encode('isom'), u32(0x200), enc.encode('isom'), enc.encode('iso2'), enc.encode('avc1'), enc.encode('mp41'))
  const mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(movieTs), u32(movieDur), u32(0x00010000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(2))
  const tkhd = full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(movieDur), zeros(8), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(width << 16), u32(height << 16))
  const mdhd = full('mdhd', 0, 0, u32(0), u32(0), u32(timescale), u32(total), u16(0x55c4), u16(0))
  const hdlr = full('hdlr', 0, 0, u32(0), enc.encode('vide'), zeros(12), enc.encode('VideoHandler\0'))
  const vmhd = full('vmhd', 0, 1, zeros(8))
  const dinf = box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)))
  const avc1 = box('avc1',
    zeros(6), u16(1), u16(0), u16(0), zeros(12), u16(width), u16(height),
    u32(0x00480000), u32(0x00480000), u32(0), u16(1), zeros(32), u16(0x0018), u16(0xffff),
    box('avcC', avcC))
  const stsd = full('stsd', 0, 0, u32(1), avc1)
  const runs: [number, number][] = []
  for (const s of samples) {
    const last = runs[runs.length - 1]
    if (last && last[1] === s.duration) last[0]++
    else runs.push([1, s.duration])
  }
  const stts = full('stts', 0, 0, u32(runs.length), ...runs.flatMap(([c, d]) => [u32(c), u32(d)]))
  const keys = samples.map((s, i) => (s.key ? i + 1 : 0)).filter(Boolean)
  const stss = full('stss', 0, 0, u32(keys.length), ...keys.map(u32))
  const stsc = full('stsc', 0, 0, u32(1), u32(1), u32(samples.length), u32(1))
  const stsz = full('stsz', 0, 0, u32(0), u32(samples.length), ...samples.map((s) => u32(s.data.length)))

  const build = (chunkOffset: number) => {
    const stco = full('stco', 0, 0, u32(1), u32(chunkOffset))
    const stbl = box('stbl', stsd, stts, stss, stsc, stsz, stco)
    const minf = box('minf', vmhd, dinf, stbl)
    const mdia = box('mdia', mdhd, hdlr, minf)
    const trak = box('trak', tkhd, mdia)
    return box('moov', mvhd, trak)
  }
  const payloadLen = samples.reduce((s, x) => s + x.data.length, 0)
  const moovLen = build(0).length
  const dataStart = ftyp.length + moovLen + 8
  const moov = build(dataStart)
  const out = new Uint8Array(dataStart + payloadLen)
  out.set(ftyp, 0)
  out.set(moov, ftyp.length)
  out.set(cat([u32(8 + payloadLen), enc.encode('mdat')]), ftyp.length + moov.length)
  let o = dataStart
  for (const s of samples) { out.set(s.data, o); o += s.data.length }
  return out
}
