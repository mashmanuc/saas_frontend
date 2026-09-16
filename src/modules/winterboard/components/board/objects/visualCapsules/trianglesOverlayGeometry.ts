/**
 * V-D3 · геометрія капсули `visual.triangles.congruence.overlay` — чиста, без Vue і DOM.
 *
 * ТЗ: saas_docs/plans/two_apps/lesson_content/17_TZ_FEYA_VD3_TRIANGLE_OVERLAY_SPIKE_2026-09-14.md
 * Зміст: 07_K-C01_TRIANGLES_DOSSIER.md §8.1 (DE = 5, DF = 7, EF = 6 см; пастка — вершина E).
 *
 * ГОЛОВНЕ: ΔEDF — це ΔABC, повернутий і зсунутий як ТВЕРДЕ тіло (без віддзеркалення).
 * Тому будь-яка проміжна поза — одна ротація навколо центроїда ABC плюс одна трансляція,
 * спільні для всіх трьох вершин. Незалежна інтерполяція вершин змінила б форму і «довела»
 * б протилежне тому, що сцена пояснює.
 *
 * ПАСТКА (§8.1 «Умова пастки»): кут повороту підібрано так, щоб основа ED лежала
 * горизонтально, а E стояла в лівому нижньому куті рисунка — там, де в ΔABC стоїть B.
 * E виглядає місцем B і водночас є парою B за абеткою (A-D, B-E, C-F). Насправді B лягає на D.
 */

export type Pt = { x: number; y: number }
export type SourceId = 'A' | 'B' | 'C'
export type TargetId = 'D' | 'E' | 'F'

/** Сторони ΔABC: AB = 5, BC = 7, CA = 6 (ті самі, що ED, DF, FE). */
const AX = 38 / 14

export const SOURCE: Readonly<Record<SourceId, Pt>> = Object.freeze({
  A: { x: AX, y: Math.sqrt(25 - AX * AX) },
  B: { x: 0, y: 0 },
  C: { x: 7, y: 0 },
})

/** Кут, що кладе образ AB (тобто ED) горизонтально, з D праворуч від E. */
export const ROTATION = -Math.atan2(SOURCE.B.y - SOURCE.A.y, SOURCE.B.x - SOURCE.A.x)

/** Де стоїть E: на тій самій базовій лінії, праворуч від ΔABC. */
export const TARGET_E: Pt = Object.freeze({ x: 10, y: 0 })

export const CENTROID: Pt = Object.freeze({
  x: (SOURCE.A.x + SOURCE.B.x + SOURCE.C.x) / 3,
  y: (SOURCE.A.y + SOURCE.B.y + SOURCE.C.y) / 3,
})

function rotateAbout(p: Pt, c: Pt, angle: number): Pt {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = p.x - c.x
  const dy = p.y - c.y
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos }
}

const rotatedA = rotateAbout(SOURCE.A, CENTROID, ROTATION)

/** Трансляція повного руху. */
export const TRANSLATION: Pt = Object.freeze({
  x: TARGET_E.x - rotatedA.x,
  y: TARGET_E.y - rotatedA.y,
})

/**
 * Поза рухомого ΔABC у частці руху `s ∈ [0, 1]`: одна ротація + одна трансляція для всіх
 * вершин. `s` поза межами — помилка програміста, а не «підрізання».
 */
export function pose(s: number): Record<SourceId, Pt> {
  if (!Number.isFinite(s) || s < 0 || s > 1) {
    throw new RangeError(`частка руху має бути в [0, 1], отримано ${s}`)
  }
  const angle = ROTATION * s
  const out = {} as Record<SourceId, Pt>
  for (const id of ['A', 'B', 'C'] as const) {
    const r = rotateAbout(SOURCE[id], CENTROID, angle)
    out[id] = { x: r.x + TRANSLATION.x * s, y: r.y + TRANSLATION.y * s }
  }
  return out
}

/** Нерухомий ΔEDF — образ ΔABC у кінці руху. E ← A, D ← B, F ← C за побудовою. */
const END = pose(1)
export const TARGET: Readonly<Record<TargetId, Pt>> = Object.freeze({
  E: END.A,
  D: END.B,
  F: END.C,
})

export function sideLengths(p: Record<SourceId, Pt>): { AB: number; BC: number; CA: number } {
  const d = (u: Pt, v: Pt) => Math.hypot(u.x - v.x, u.y - v.y)
  return { AB: d(p.A, p.B), BC: d(p.B, p.C), CA: d(p.C, p.A) }
}

export const TARGET_SIDE_LENGTHS = Object.freeze({ DE: 5, DF: 7, EF: 6 })

/**
 * На яку вершину ΔEDF лягла вершина після руху — ОБЧИСЛЕНО з координат, а не взято з
 * таблиці. Саме цим тест відповідності ловить підміну `B → E`.
 */
export function landingVertex(source: SourceId, eps = 1e-6): TargetId {
  const p = END[source]
  const hit = (Object.keys(TARGET) as TargetId[]).filter(
    (t) => Math.hypot(TARGET[t].x - p.x, TARGET[t].y - p.y) < eps,
  )
  if (hit.length !== 1) {
    throw new Error(`вершина ${source} після руху не лягла рівно на одну вершину ΔEDF`)
  }
  return hit[0]
}

/** Невидимі якорі видимої області: межі всього руху плюс поле на підписи. */
const SWEEP_RADIUS = Math.max(
  ...(['A', 'B', 'C'] as const).map((id) =>
    Math.hypot(SOURCE[id].x - CENTROID.x, SOURCE[id].y - CENTROID.y)),
)
const LABEL_MARGIN = 1.2
export const VIEW_ANCHORS: Readonly<Record<'VIEW_SW' | 'VIEW_NE', Pt>> = Object.freeze({
  VIEW_SW: {
    x: Math.min(CENTROID.x, CENTROID.x + TRANSLATION.x) - SWEEP_RADIUS - LABEL_MARGIN,
    y: Math.min(CENTROID.y, CENTROID.y + TRANSLATION.y) - SWEEP_RADIUS - LABEL_MARGIN,
  },
  VIEW_NE: {
    x: Math.max(CENTROID.x, CENTROID.x + TRANSLATION.x) + SWEEP_RADIUS + LABEL_MARGIN,
    y: Math.max(CENTROID.y, CENTROID.y + TRANSLATION.y) + SWEEP_RADIUS + LABEL_MARGIN,
  },
})

/** Повний знімок точок пресета `triangles_overlay` для частки руху `s`. */
export function pointsSnapshot(s: number): Record<string, Pt> {
  return { ...pose(s), ...TARGET, ...VIEW_ANCHORS }
}
