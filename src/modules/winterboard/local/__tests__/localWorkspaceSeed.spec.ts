// Local Workspace seed v2 — тести «подарунка» (6 сторінок-вітрина) і, головне,
// захисту роботи користувача при м'якому апгрейді вітрини.

import { describe, it, expect } from 'vitest'
import type { WBWorkspaceState } from '../../types/winterboard'
import {
  buildLocalWelcomeState,
  isUntouchedSeed,
  LOCAL_SEED_VERSION,
  type LocalSeedTexts,
} from '../localWorkspaceSeed'

const TEXTS: LocalSeedTexts = {
  title: 'Заголовок',
  hint: 'Підказка',
  pageTry: 'Спробуй',
  pageTrig: 'Тригонометрія',
  pageCalculus: 'Похідна та інтеграл',
  pageGeometry: 'Геометрія',
  captionTrig: 'Підпис тригонометрії',
  captionCalculus: 'Підпис аналізу',
  captionGeometry: 'Підпис геометрії',
  pageStereo: 'Стереометрія',
  page3d: '3D-функції',
  captionStereo: 'Підпис стереометрії',
  caption3d: 'Підпис 3D',
  descCubeSection: 'Опис перерізу',
  descSphereInCube: 'Опис кулі в кубі',
  descCylInCone: 'Опис циліндра',
  descSurface: 'Опис поверхні',
  descCurve: 'Опис кривої',
}

/** Відбиток НЕторканого seed v1 (одна сторінка: 2 тексти + парабола + піраміда). */
function seedV1State(): WBWorkspaceState {
  return {
    pages: [
      {
        id: 'p1',
        name: 'Page 1',
        background: 'white',
        backgroundColor: '#cdf9d0',
        strokes: [
          { id: 't1', tool: 'text', color: '#0f172a', size: 44, opacity: 1, points: [{ x: 140, y: 110 }], text: 'A' },
          { id: 't2', tool: 'text', color: '#475569', size: 24, opacity: 1, points: [{ x: 140, y: 185 }], text: 'B' },
        ],
        assets: [
          { id: 'a1', type: 'graph_calculator' },
          { id: 'a2', type: 'nmt3d' },
        ],
      },
    ],
    currentPageIndex: 0,
  } as unknown as WBWorkspaceState
}

describe('buildLocalWelcomeState — вітрина v2', () => {
  it('будує 6 тематичних сторінок з переданими назвами', () => {
    const state = buildLocalWelcomeState(TEXTS)
    expect(state.pages).toHaveLength(6)
    expect(state.pages.map((p) => p.name)).toEqual([
      'Спробуй', 'Тригонометрія', 'Похідна та інтеграл', 'Геометрія', 'Стереометрія', '3D-функції',
    ])
    expect(state.currentPageIndex).toBe(0)
  })

  it('кожна сторінка має об’єкти', () => {
    const state = buildLocalWelcomeState(TEXTS)
    for (const page of state.pages) {
      expect(page.assets.length).toBeGreaterThan(0)
    }
  })

  it('НЕ вживає застарілий geometry_solid (немає в панелі вставки)', () => {
    const solids = buildLocalWelcomeState(TEXTS)
      .pages.flatMap((p) => p.assets)
      .filter((a) => a.type === 'geometry_solid')
    expect(solids).toHaveLength(0)
  })

  it('WebGL-бюджет: не більше двох graphmash_3d (THREE.WebGLRenderer)', () => {
    const g3d = buildLocalWelcomeState(TEXTS)
      .pages.flatMap((p) => p.assets)
      .filter((a) => a.type === 'graphmash_3d')
    expect(g3d.length).toBeLessThanOrEqual(2)
    expect(g3d.length).toBeGreaterThan(0)
  })

  it('ідентифікатори унікальні (сторінки, штрихи, об’єкти)', () => {
    const state = buildLocalWelcomeState(TEXTS)
    const ids = [
      ...state.pages.map((p) => p.id),
      ...state.pages.flatMap((p) => p.strokes.map((s) => s.id)),
      ...state.pages.flatMap((p) => p.assets.map((a) => a.id)),
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('графіки задані у явній формі y=… (інакше парсер не будує криву)', () => {
    const exprs = buildLocalWelcomeState(TEXTS)
      .pages.flatMap((p) => p.assets)
      .filter((a) => a.type === 'graph_calculator')
      .flatMap((a) => ((a.data as { state?: { expressions?: { src: string }[] } })?.state?.expressions ?? []))
    expect(exprs.length).toBeGreaterThan(0)
    for (const e of exprs) expect(e.src).toMatch(/^y=/)
  })
})

describe('isUntouchedSeed — захист роботи користувача', () => {
  it('впізнає НЕторкану вітрину v1', () => {
    expect(isUntouchedSeed(seedV1State())).toBe(true)
  })

  it('НЕ чіпає дошку, де людина щось намалювала', () => {
    const s = seedV1State()
    s.pages[0].strokes.push({
      id: 'user', tool: 'pen', color: '#f00', size: 4, opacity: 1,
      points: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
    } as unknown as (typeof s.pages)[0]['strokes'][0])
    expect(isUntouchedSeed(s)).toBe(false)
  })

  it('НЕ чіпає дошку, де людина додала об’єкт', () => {
    const s = seedV1State()
    s.pages[0].assets.push({ id: 'extra', type: 'trig_circle' } as unknown as (typeof s.pages)[0]['assets'][0])
    expect(isUntouchedSeed(s)).toBe(false)
  })

  it('впізнає НЕторкану вітрину v2 (4 сторінки з застарілим конусом)', () => {
    // Саме цей випадок не оновлювався у власника — регресійний тест.
    const v2 = {
      pages: [
        { id:'p1', name:'', strokes:[], assets:[{type:'graph_calculator'},{type:'nmt3d'},{type:'quadratic_card'}] },
        { id:'p2', name:'', strokes:[], assets:[{type:'trig_circle'},{type:'trig_solver'},{type:'graph_calculator'}] },
        { id:'p3', name:'', strokes:[], assets:[{type:'calculus_card'},{type:'calculus_card'},{type:'graph_calculator'}] },
        { id:'p4', name:'', strokes:[], assets:[{type:'geometry_2d_v2'},{type:'geometry_2d_v2'},{type:'geometry_solid'}] },
      ],
      currentPageIndex: 0,
    } as unknown as WBWorkspaceState
    expect(isUntouchedSeed(v2)).toBe(true)
  })

  it('НЕ чіпає ПОТОЧНУ вітрину v3 (уже актуальна — апгрейд не потрібен)', () => {
    expect(isUntouchedSeed(buildLocalWelcomeState(TEXTS))).toBe(false)
  })

  it('стійка до порожнього / некоректного стану', () => {
    expect(isUntouchedSeed(null)).toBe(false)
    expect(isUntouchedSeed(undefined)).toBe(false)
    expect(isUntouchedSeed({ pages: [], currentPageIndex: 0 } as WBWorkspaceState)).toBe(false)
  })
})

describe('LOCAL_SEED_VERSION', () => {
  it('дорівнює 3 (вітрина з 6 сторінок)', () => {
    expect(LOCAL_SEED_VERSION).toBe(3)
  })
})
