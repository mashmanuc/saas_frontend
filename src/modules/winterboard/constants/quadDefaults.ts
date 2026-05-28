/**
 * Quadratic card — default state and presets.
 * Mirror pattern: constants/calculusDefaults.ts.
 */

import type { QuadraticData } from '../types/quad'

export { QUAD_DRAG_MIME } from '../types/quad'

/** Default card size (px) при drop. */
export const DEFAULT_QUAD_W = 480
export const DEFAULT_QUAD_H = 360

/** Preset examples — cover D>0 / D=0 / D<0. */
export const QUAD_PRESETS: ReadonlyArray<{
  label: string
  a: number
  b: number
  c: number
  hint: string
}> = Object.freeze([
  { label: 'D > 0',  a: 1, b: -1, c: -6,  hint: 'x²−x−6 = 0 → D=25' },
  { label: 'D = 0',  a: 1, b: -2, c: 1,   hint: 'x²−2x+1 = 0 → D=0'  },
  { label: 'D < 0',  a: 1, b: 1,  c: 1,   hint: 'x²+x+1 = 0 → D=−3'  },
  { label: '2 корені', a: 1, b: -5, c: 6, hint: 'x²−5x+6=0 → x=2,3'  },
])

/** Build fresh QuadraticData для нової картки. */
export function buildDefaultQuadraticData(): QuadraticData {
  return {
    version: 1,
    a: 1,
    b: -1,
    c: -6,
    sign: '=',
    showVertex: true,
    showAxis:   true,
    showRoots:  true,
    viewport: { cx: 0, cy: 0, scale: 50 },
  }
}
