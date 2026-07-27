// Local Workspace seed v2 — тести «подарунка» (4 сторінки-вітрина) і, головне,
// захисту роботи користувача при м'якому апгрейді вітрини.

import { describe, it, expect } from 'vitest'
import type { WBWorkspaceState } from '../../types/winterboard'
import {
  buildLocalWelcomeState,
  isUntouchedSeedV1,
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
  it('будує 4 тематичні сторінки з переданими назвами', () => {
    const state = buildLocalWelcomeState(TEXTS)
    expect(state.pages).toHaveLength(4)
    expect(state.pages.map((p) => p.name)).toEqual([
      'Спробуй', 'Тригонометрія', 'Похідна та інтеграл', 'Геометрія',
    ])
    expect(state.currentPageIndex).toBe(0)
  })

  it('кожна сторінка має об’єкти', () => {
    const state = buildLocalWelcomeState(TEXTS)
    for (const page of state.pages) {
      expect(page.assets.length).toBeGreaterThan(0)
    }
  })

  it('WebGL-бюджет: рівно один geometry_solid у всьому seed', () => {
    // Контекст реєструє лише solid card (webglContextRegistry, MAX_CONTEXTS=2).
    const solids = buildLocalWelcomeState(TEXTS)
      .pages.flatMap((p) => p.assets)
      .filter((a) => a.type === 'geometry_solid')
    expect(solids).toHaveLength(1)
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

describe('isUntouchedSeedV1 — захист роботи користувача', () => {
  it('впізнає НЕторканий seed v1', () => {
    expect(isUntouchedSeedV1(seedV1State())).toBe(true)
  })

  it('НЕ чіпає дошку, де людина щось намалювала', () => {
    const s = seedV1State()
    s.pages[0].strokes.push({
      id: 'user', tool: 'pen', color: '#f00', size: 4, opacity: 1,
      points: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
    } as unknown as (typeof s.pages)[0]['strokes'][0])
    expect(isUntouchedSeedV1(s)).toBe(false)
  })

  it('НЕ чіпає дошку, де людина додала об’єкт', () => {
    const s = seedV1State()
    s.pages[0].assets.push({ id: 'extra', type: 'trig_circle' } as unknown as (typeof s.pages)[0]['assets'][0])
    expect(isUntouchedSeedV1(s)).toBe(false)
  })

  it('НЕ чіпає дошку з кількома сторінками (в т.ч. вже оновлену v2)', () => {
    expect(isUntouchedSeedV1(buildLocalWelcomeState(TEXTS))).toBe(false)
  })

  it('стійка до порожнього / некоректного стану', () => {
    expect(isUntouchedSeedV1(null)).toBe(false)
    expect(isUntouchedSeedV1(undefined)).toBe(false)
    expect(isUntouchedSeedV1({ pages: [], currentPageIndex: 0 } as WBWorkspaceState)).toBe(false)
  })
})

describe('LOCAL_SEED_VERSION', () => {
  it('дорівнює 2 (вітрина з 4 сторінок)', () => {
    expect(LOCAL_SEED_VERSION).toBe(2)
  })
})
