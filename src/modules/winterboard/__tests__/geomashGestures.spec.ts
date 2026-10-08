/**
 * GeoMASH після уроку «Вектори» (власник 2026-10-08: «так, роби всі три»).
 *
 *   Б-168: виділений об'єкт копіюється разом зі своїми точками (Ctrl+C / Ctrl+V, «Копіювати» в меню
 *          правої кнопки); вектор/відрізок з вільними кінцями тягнеться цілком.
 *   Б-169: вектор будується й протягуванням пером від точки; після першої точки — «Клікніть кінець».
 *   Б-170: з пером/маркером дошки картка прозора — чорнило під нею видно.
 *
 * Логіка — board/geomashGestures.ts, перевіряється зі СПРАВЖНІМ рушієм (чистий JS). Обв'язка в
 * картці (GeomashRenderer) — сторожем по джерелу: полотна з canvas у тестах не монтуються.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import type { GeoEngineApi, GeoObject, GeoToolSpecEntry } from '../vendor/geomash'
import {
  duplicateObjects, geomashHint, lineEndpoints, nextRoleTakesPoint, snapDelta, translateLine,
} from '../board/geomashGestures'

let eng: GeoEngineApi
const CS = { ox: 0, oy: 0, sc: 40 }
type Objs = Map<string, GeoObject>

function build(cmds: Array<Record<string, unknown>>): Objs {
  let m: Objs = new Map()
  for (const c of cmds) {
    const r = eng.construct(m, CS, c as never)
    if ('error' in r) throw new Error(`${c.op}: ${r.error}`)
    m = r.objects
  }
  return m
}
const xy = (m: Objs, id: string) => [m.get(id)?.wx, m.get(id)?.wy]
const entry = (op: string): GeoToolSpecEntry => eng.toolSpec().find((e) => e.op === op) as GeoToolSpecEntry

beforeAll(async () => {
  await import('../vendor/geomash')
  eng = window.GeoEngine as GeoEngineApi
})

describe('Б-168 · копія об\'єкта разом з його точками', () => {
  it('вектор AB → поруч A′B′ — рівний вектор (той самий зсув кінців), новий вектор виділяється', () => {
    const m = build([{ op: 'point', wx: 2, wy: 1 }, { op: 'point', wx: 4, wy: 2 }, { op: 'vector', a: 'A', b: 'B' }])
    const r = duplicateObjects(eng, m, ['a'], 1)!
    expect(r.firstId).toBe('a′')
    const copy = r.objects.get('a′')!
    expect(copy.type).toBe('vector')
    expect([copy.p1, copy.p2]).toEqual(['A′', 'B′'])
    expect(xy(r.objects, 'A′')).toEqual([3, 0])
    expect(xy(r.objects, 'B′')).toEqual([5, 1])
    expect(xy(r.objects, 'A')).toEqual([2, 1])            // оригінал не зачеплено
    expect(r.objects.size).toBe(m.size + 3)
  })

  it('друга копія лягає далі, а не на першу', () => {
    const m = build([{ op: 'point', wx: 2, wy: 1 }, { op: 'point', wx: 4, wy: 2 }, { op: 'vector', a: 'A', b: 'B' }])
    const first = duplicateObjects(eng, m, ['a'], 1)!
    const second = duplicateObjects(eng, first.objects, ['a'], 2)!
    const p1 = second.objects.get(second.firstId!)!.p1 as string
    expect(xy(second.objects, p1)).toEqual([4, -1])
  })

  it('нічого копіювати — null (нічого не пишемо)', () => {
    expect(duplicateObjects(eng, new Map(), ['a'], 1)).toBeNull()
  })
})

describe('Б-168 · лінія тягнеться цілком', () => {
  it('вектор з вільними кінцями: обидва кінці на той самий зсув — напрям і довжина ті самі', () => {
    const m = build([{ op: 'point', wx: 2, wy: 1 }, { op: 'point', wx: 4, wy: 2 }, { op: 'vector', a: 'A', b: 'B' }])
    const ends = lineEndpoints(m, 'a')!
    expect(ends).toEqual(['A', 'B'])
    const moved = translateLine(eng, m, CS, ends, { A: { wx: 2, wy: 1 }, B: { wx: 4, wy: 2 } }, 3, -2)!
    expect(xy(moved, 'A')).toEqual([5, -1])
    expect(xy(moved, 'B')).toEqual([7, 0])
    expect(moved.get('a')?.p1).toBe('A')
  })

  it('кінець — похідна точка (середина) — цілком не тягнемо', () => {
    const m = build([
      { op: 'point', wx: 0, wy: 0 }, { op: 'point', wx: 4, wy: 0 }, { op: 'midpoint', a: 'A', b: 'B' },
      { op: 'point', wx: 2, wy: 3 },
    ])
    const mid = [...m.values()].find((o) => o.midOf)!.id
    const free = [...m.values()].filter((o) => o.type === 'point' && !o.midOf).pop()!.id
    const r = eng.construct(m, CS, { op: 'vector', a: mid, b: free } as never)
    if ('error' in r) throw new Error(r.error)
    expect(lineEndpoints(r.objects, r.created[0])).toBeNull()
    expect(lineEndpoints(r.objects, mid)).toBeNull()      // точка — не лінія
  })

  it('зсув прив\'язано до кроку сітки', () => {
    expect(snapDelta(0.6, 1)).toBe(1)
    expect(snapDelta(1.4, 1)).toBe(1)
    expect(snapDelta(0.3, 0.5)).toBe(0.5)
    expect(snapDelta(0.37, 0)).toBe(0.37)
  })
})

describe('Б-169 · підказка й протягування', () => {
  const base = { activeEntry: null, selectMode: false, selectedGeoId: null, picks: {}, poly: [] as string[] }

  it('«Вектор»: спершу «Клікніть точку…», після першої точки — «Клікніть кінець»', () => {
    const vec = entry('vector')
    expect(geomashHint({ ...base, activeEntry: vec })).toBe('Клікніть точку (або порожнє місце)')
    expect(geomashHint({ ...base, activeEntry: vec, picks: { a: 'A' } })).toBe('Клікніть кінець')
  })

  it('коло: після центру — «Клікніть наступну точку»; перпендикуляр після точки — як і було', () => {
    expect(geomashHint({ ...base, activeEntry: entry('circle'), picks: { center: 'A' } })).toBe('Клікніть наступну точку')
    expect(geomashHint({ ...base, activeEntry: entry('perp'), picks: { through: 'A' } })).toBe('Клікніть наступну пряму/відрізок')
  })

  it('протягування добудовує, лише коли наступна роль — точка', () => {
    expect(nextRoleTakesPoint(entry('vector'), { a: 'A' })).toBe(true)
    expect(nextRoleTakesPoint(entry('angle'), { a: 'A' })).toBe(true)
    expect(nextRoleTakesPoint(entry('perp'), { through: 'A' })).toBe(false)
    expect(nextRoleTakesPoint(entry('vector'), { a: 'A', b: 'B' })).toBe(false)
  })

  it('у виборі: про перетяг лінії й копію', () => {
    expect(geomashHint({ ...base, selectMode: true })).toBe('Клікніть об\'єкт щоб виділити')
    expect(geomashHint({ ...base, selectMode: true, selectedGeoId: 'a' }, true)).toContain('тягніть лінію')
    expect(geomashHint({ ...base, selectMode: true, selectedGeoId: 'A' })).toContain('Ctrl+C, Ctrl+V')
  })
})

describe('сторож обв\'язки в GeomashRenderer', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../components/board/objects/GeomashRenderer.vue'), 'utf-8')
  const fn = (name: string) => {
    const i = src.indexOf(`function ${name}(`)
    return src.slice(i, src.indexOf('\n}\n', i))
  }

  it('Б-168: Ctrl+C/Ctrl+V — у фазі захоплення; без виділеного всередині — не перехоплюємо (копіює дошка)', () => {
    expect(src).toContain("window.addEventListener('keydown', onGeoCopyPaste, true)")
    expect(src).toContain("window.removeEventListener('keydown', onGeoCopyPaste, true)")
    const body = fn('onGeoCopyPaste')
    const guard = body.indexOf('if (!id || !objects.has(id)) return')
    expect(guard).toBeGreaterThan(-1)
    expect(body.indexOf('e.preventDefault()')).toBeGreaterThan(guard)
    expect(body).toContain('e.stopPropagation()')
    expect(body).toContain('duplicateGeo(_geoClipboard)')
  })

  it('Б-168: «Копіювати» в меню правої кнопки; лінія у виборі тягнеться цілком, один запис на mouseup', () => {
    expect(src).toMatch(/data-testid="geomash-ctx-copy"\s+@click="ctxCopy"/)
    expect(fn('ctxCopy')).toContain('duplicateGeo([id])')
    expect(src).toContain('const ends = lineEndpoints(objects, hit)')
    expect(src).toContain('if (ends && ev.button === 0) startLineDrag(ends, p)')
    expect(src).toContain('watch(() => props.isSelected, (sel) => { if (!sel) _geoClipboard = null })')
    expect(fn('onLineDragUp')).toContain('if (_lineDragMap) emitObjects(_lineDragMap)')
    expect(fn('onLineDragMove')).not.toContain('emitObjects')
  })

  it('Б-169: після точки протягування добудовує тим самим шляхом, що другий дотик', () => {
    const down = fn('onStagePointerDown')
    expect(down).toContain('const filledPoint = fillNextRole(entry, sx, sy, wx, wy)')
    expect(down).toMatch(/nextRoleTakesPoint\(entry, geomashToolState\.picks\)\) \{\s*armDragFinish\(ev\)/)
    const up = fn('onFinishUp')
    const notMoved = up.indexOf('if (!f.moved || !entry || !insideStage(ev.clientX, ev.clientY)) return')
    expect(notMoved).toBeGreaterThan(-1)
    expect(up.indexOf('fillNextRole(entry, sx, sy, wx, wy)')).toBeGreaterThan(notMoved)
    expect(fn('previewNextRoleAt')).not.toContain('emitObjects')
  })

  it('Б-170: не стрілка → картка прозора, фон рушія прозорий, полотно чиститься перед кадром', () => {
    expect(src).toContain('const inkThrough = computed(() => props.interactive === false)')
    expect(src).toContain("'is-ink-through': inkThrough")
    expect(src).toMatch(/\.geomash-card\.is-ink-through \{ background: transparent; \}/)
    expect(fn('applyInkThrough')).toContain("rr.setTheme({ bg: inkThrough.value ? 'rgba(0,0,0,0)' : OPAQUE_BG })")
    const draw = fn('redraw')
    expect(draw.indexOf('clearRect')).toBeGreaterThan(-1)
    expect(draw.indexOf('clearRect')).toBeLessThan(draw.indexOf('rr.draw('))
  })
})
