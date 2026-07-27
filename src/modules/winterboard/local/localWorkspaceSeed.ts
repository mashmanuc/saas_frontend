// Local Workspace — стартовий контент першого візиту («подарунок», ТЗ §3).
//
// v2 (2026-07-26, рішення власника): демо-дошка на корені = вітрина продукту,
// тому 4 сторінки замість однієї — відвідувач гортає їх як книжку й бачить
// ширину інструментів:
//   1. «Спробуй»          — вітання + парабола + 3D-піраміда + квадратична
//   2. «Тригонометрія»    — тригонометричне коло + розв'язник + графік sin
//   3. «Похідна/інтеграл» — картка похідної + картка інтеграла + кубічна
//   4. «Геометрія»        — Піфагор + Фалес (жива геометрія) + конус
//
// ⚠️ WebGL-бюджет: контекст реєструє ЛИШЕ `geometry_solid`
// (useSolidCardRenderer → webglContextRegistry, MAX_CONTEXTS=2). Тому тіло у
// seed рівно одне і на окремій сторінці. Рендериться лише поточна сторінка
// (`wbStore.currentPage`), тож при гортанні контекст вивільняється.
//
// Форми asset-ів дзеркалять UI-створення 1:1 (useContentDrop.ts drop-handlers),
// НЕ вигадуються з нуля — інакше розсинхрон із рендерерами/equality-фільтром.

import type { WBWorkspaceState, WBPage, WBAsset, WBStroke } from '../types/winterboard'
import {
  DEFAULT_GRAPH_WIDTH,
  DEFAULT_GRAPH_HEIGHT,
} from '../constants/graphCalculatorDefaults'
import {
  DEFAULT_NMT3D_W,
  DEFAULT_NMT3D_H,
  buildDefaultNmt3dData,
} from '../constants/nmt3dDefaults'
import {
  DEFAULT_TRIG_CIRCLE_W,
  DEFAULT_TRIG_CIRCLE_H,
  buildDefaultTrigCircleData,
} from '../constants/trigCircleDefaults'
import {
  DEFAULT_TRIG_SOLVER_W,
  DEFAULT_TRIG_SOLVER_H,
  buildDefaultTrigSolverData,
} from '../constants/trigSolverDefaults'
import {
  DEFAULT_CALCULUS_W,
  DEFAULT_CALCULUS_H,
  buildDefaultCalculusData,
} from '../constants/calculusDefaults'
import {
  DEFAULT_QUAD_W,
  DEFAULT_QUAD_H,
  buildDefaultQuadraticData,
} from '../constants/quadDefaults'
import {
  DEFAULT_GEOMETRY_2D_V2_W,
  DEFAULT_GEOMETRY_2D_V2_H,
  buildDefaultGeometry2DV2Data,
} from '../constants/geometry2dV2Defaults'
import {
  DEFAULT_SOLID_W,
  DEFAULT_SOLID_H,
  DEFAULT_SOLID_STATE,
} from '../constants/solidDefaults'

/** Поточна версія «подарунка». Bump → НЕторканий seed оновиться при візиті. */
export const LOCAL_SEED_VERSION = 2

/** Фон-референс власника (2026-07-15, знятий з BG-пікера) — світло-зелений стіл. */
const SEED_BG = '#cdf9d0'

export interface LocalSeedTexts {
  /** Заголовок-привітання (великий текст, стор. 1). */
  title: string
  /** Підказка-заклик спробувати інструменти (стор. 1). */
  hint: string
  /** Назви сторінок у панелі сторінок. */
  pageTry: string
  pageTrig: string
  pageCalculus: string
  pageGeometry: string
  /** Підписи-заголовки на сторінках 2-4. */
  captionTrig: string
  captionCalculus: string
  captionGeometry: string
}

function seedId(prefix: string): string {
  return `${prefix}-local-seed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function textStroke(
  idPrefix: string,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  fontWeight?: number,
): WBStroke {
  const stroke: WBStroke = {
    id: seedId(idPrefix),
    tool: 'text',
    color,
    size,
    opacity: 1,
    points: [{ x, y }],
    text,
  }
  if (fontWeight) stroke.fontWeight = fontWeight
  return stroke
}

/** Заголовок сторінки (однаковий стиль на стор. 2-4). */
function captionStroke(text: string): WBStroke {
  return textStroke('text-caption', text, 140, 110, 34, '#0f172a', 700)
}

function makeAsset(
  idPrefix: string,
  type: string,
  x: number,
  y: number,
  w: number,
  h: number,
  data: unknown,
  src = '',
): WBAsset {
  return {
    id: seedId(idPrefix),
    type,
    src,
    x,
    y,
    w,
    h,
    rotation: 0,
    locked: false,
    data: data as WBAsset['data'],
  } as WBAsset
}

/** Графічний калькулятор з однією явною кривою. */
function graphAsset(expr: string, color: string, x: number, y: number, cy = 0): WBAsset {
  return makeAsset('gc', 'graph_calculator', x, y, DEFAULT_GRAPH_WIDTH, DEFAULT_GRAPH_HEIGHT, {
    version: 1,
    state: {
      expressions: [
        // 'y=...' (НЕ голий вираз) — парсер калькулятора будує криву лише
        // з явною лівою частиною (фікс власника 2026-07-15).
        { id: seedId('expr'), src: expr, color, hidden: false },
      ],
      params: {},
      viewport: { cx: 0, cy, scale: 38 },
    },
    meta: { last_snapshot_seq: 0 },
  })
}

function page(idPrefix: string, name: string, strokes: WBStroke[], assets: WBAsset[]): WBPage {
  return {
    id: seedId(idPrefix),
    name,
    strokes,
    assets,
    background: 'white',
    backgroundColor: SEED_BG,
  }
}

/**
 * Побудувати стартовий стан локального робочого столу (4 сторінки).
 * Розкладка під дефолтну сторінку 1920×1080.
 */
export function buildLocalWelcomeState(texts: LocalSeedTexts): WBWorkspaceState {
  // ── Стор. 1 «Спробуй» — вітання + класика ─────────────────────────────────
  const pageTry = page(
    'page-try',
    texts.pageTry,
    [
      textStroke('text-title', texts.title, 140, 110, 44, '#0f172a', 700),
      textStroke('text-hint', texts.hint, 140, 185, 24, '#475569'),
    ],
    [
      graphAsset('y=x^2', '#2d70b3', 140, 300, 2),
      // 'ngonPyramid' («Правильна n-кутна піраміда») — вибір власника 2026-07-15:
      // піраміда з drag-вершинами виглядає живіше за куб.
      makeAsset('nmt3d', 'nmt3d', 1020, 240, DEFAULT_NMT3D_W, DEFAULT_NMT3D_H, {
        ...buildDefaultNmt3dData('ngonPyramid'),
        // Допоміжні побудови увімкнені (рішення власника 2026-07-15):
        // ключі — з aux-реєстру шаблону (vendor/nmt3d TEMPLATES.ngonPyramid.aux).
        opts: {
          height: true,    // висота SO
          apothem: true,   // апофема SM
          axSect: true,    // осьовий переріз
          baseInc: true,   // вписане коло основи
          baseCirc: true,  // описане коло основи
        },
      }),
      makeAsset('quad', 'quadratic_card', 140, 700, DEFAULT_QUAD_W, DEFAULT_QUAD_H,
        buildDefaultQuadraticData()),
    ],
  )

  // ── Стор. 2 «Тригонометрія» ───────────────────────────────────────────────
  const pageTrig = page(
    'page-trig',
    texts.pageTrig,
    [captionStroke(texts.captionTrig)],
    [
      makeAsset('trig', 'trig_circle', 140, 210, DEFAULT_TRIG_CIRCLE_W, DEFAULT_TRIG_CIRCLE_H,
        buildDefaultTrigCircleData()),
      makeAsset('tslv', 'trig_solver', 900, 210, DEFAULT_TRIG_SOLVER_W, DEFAULT_TRIG_SOLVER_H,
        buildDefaultTrigSolverData('sin')),
      graphAsset('y=sin(x)', '#c74440', 140, 640),
    ],
  )

  // ── Стор. 3 «Похідна та інтеграл» ─────────────────────────────────────────
  const pageCalculus = page(
    'page-calculus',
    texts.pageCalculus,
    [captionStroke(texts.captionCalculus)],
    [
      makeAsset('calc-d', 'calculus_card', 140, 210, DEFAULT_CALCULUS_W, DEFAULT_CALCULUS_H,
        buildDefaultCalculusData('derivative')),
      makeAsset('calc-i', 'calculus_card', 700, 210, DEFAULT_CALCULUS_W, DEFAULT_CALCULUS_H,
        buildDefaultCalculusData('integral')),
      graphAsset('y=x^3-3x', '#388c46', 1260, 210),
    ],
  )

  // ── Стор. 4 «Геометрія» ───────────────────────────────────────────────────
  // Єдиний geometry_solid у seed (WebGL-бюджет, див. шапку файлу).
  const pageGeometry = page(
    'page-geometry',
    texts.pageGeometry,
    [captionStroke(texts.captionGeometry)],
    [
      makeAsset('geo2d-p', 'geometry_2d_v2', 140, 210,
        DEFAULT_GEOMETRY_2D_V2_W, DEFAULT_GEOMETRY_2D_V2_H,
        buildDefaultGeometry2DV2Data('pythagoras')),
      makeAsset('geo2d-t', 'geometry_2d_v2', 580, 210,
        DEFAULT_GEOMETRY_2D_V2_W, DEFAULT_GEOMETRY_2D_V2_H,
        buildDefaultGeometry2DV2Data('thales')),
      makeAsset('solid', 'geometry_solid', 1060, 210, DEFAULT_SOLID_W, DEFAULT_SOLID_H,
        { version: 1, state: { ...DEFAULT_SOLID_STATE } }, 'cone'),
    ],
  )

  return {
    pages: [pageTry, pageTrig, pageCalculus, pageGeometry],
    currentPageIndex: 0,
  }
}

/**
 * Чи це НЕторканий «подарунок» v1 (одна сторінка: 2 текстові штрихи +
 * парабола + піраміда)?
 *
 * Використовується для м'якого апгрейду вітрини: людині, яка заходила на
 * демо-дошку й нічого свого не додала, показуємо новий контент. Щойно вона
 * намалювала/додала бодай щось — відбиток не збігається, і її роботу
 * НЕ чіпаємо.
 */
export function isUntouchedSeedV1(state: WBWorkspaceState | null | undefined): boolean {
  if (!state || !Array.isArray(state.pages) || state.pages.length !== 1) return false
  const p = state.pages[0]
  if (!p) return false

  const strokes = p.strokes ?? []
  const assets = p.assets ?? []
  if (strokes.length !== 2 || !strokes.every((s) => s.tool === 'text')) return false
  if (assets.length !== 2) return false

  const types = assets.map((a) => a.type).sort()
  return types[0] === 'graph_calculator' && types[1] === 'nmt3d'
}
