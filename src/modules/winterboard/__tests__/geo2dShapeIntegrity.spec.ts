/**
 * ТЗ-F: фігура мусить лишатись собою ПІД ДРАГОМ, а не лише на старті.
 *
 * Перша редакція пресета `rectangle` мала три вільні вершини: початкові
 * координати давали 90°, але перетяг D убік перетворював фігуру на
 * паралелограм — під назвою «Прямокутник» і з підписом «∠A = 90°».
 * Тобто та сама брехня про умову задачі, яку ТЗ-F виправляло, лише
 * відкладена на один рух миші.
 *
 * Тест перевіряє ІНВАРІАНТ ФОРМИ, а не координати: скільки не тягни —
 * прямокутник прямокутний, квадрат рівносторонній.
 */
import { describe, expect, it } from 'vitest'

type P = { x: number; y: number }

const sub = (u: P, v: P): P => ({ x: u.x - v.x, y: u.y - v.y })
const dot = (u: P, v: P) => u.x * v.x + u.y * v.y
const len = (u: P) => Math.hypot(u.x, u.y)

/** Кут між векторами в градусах. */
function angle(u: P, v: P): number {
  const c = dot(u, v) / (len(u) * len(v))
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI
}

/** N = A + rot90°(B − A) — прихований якір напрямку (як у пресеті). */
const anchorN = (A: P, B: P): P => ({ x: A.x - (B.y - A.y), y: A.y + (B.x - A.x) })

/** G.onLine.setTo: проєкція курсора на пряму A→N. t НЕ клемпиться. */
function onLine(A: P, N: P, mouse: P): P {
  const d = sub(N, A)
  const t = dot(sub(mouse, A), d) / dot(d, d)
  return { x: A.x + d.x * t, y: A.y + d.y * t }
}

describe('geo2d rectangle — прямий кут переживає драг', () => {
  const A: P = { x: -3, y: -1.5 }
  const B: P = { x: 3, y: -1.5 }

  it.each([
    ['убік — саме цей драг ламав фігуру', { x: -1, y: 1.5 }],
    ['вгору — висока фігура', { x: -3, y: 4.5 }],
    ['вниз крізь основу', { x: -3, y: -4 }],
    ['по діагоналі', { x: 2, y: 3 }],
  ])('%s', (_label, mouse) => {
    const D = onLine(A, anchorN(A, B), mouse as P)
    expect(angle(sub(B, A), sub(D, A))).toBeCloseTo(90, 6)
  })

  it('висота лишається вільною — пропорція 9×12 будується', () => {
    // t > 1 доступний, бо onLine не обмежує параметр відрізком.
    const D = onLine(A, anchorN(A, B), { x: -3, y: 10.5 })
    const ratio = len(sub(D, A)) / len(sub(B, A))
    expect(ratio).toBeGreaterThan(1.3)
  })
})

describe('geo2d square — рівні сторони переживають драг', () => {
  /** D = A + rot90°(B − A) — повністю derived, як у пресеті. */
  const vertexD = (A: P, B: P): P => ({ x: A.x - (B.y - A.y), y: A.y + (B.x - A.x) })

  it.each([
    ['горизонтальна сторона', { x: -2.4, y: -1.6 }, { x: 1.6, y: -1.6 }],
    ['нахилена сторона', { x: 0, y: 0 }, { x: 2, y: 3 }],
    ['коротка сторона', { x: 1, y: 1 }, { x: 1.4, y: 1.2 }],
  ])('%s: |AD| = |AB| і кут прямий', (_label, A, B) => {
    const D = vertexD(A as P, B as P)
    expect(len(sub(D, A as P))).toBeCloseTo(len(sub(B as P, A as P)), 6)
    expect(angle(sub(B as P, A as P), sub(D, A as P))).toBeCloseTo(90, 6)
  })
})
