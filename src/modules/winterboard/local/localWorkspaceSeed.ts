// Local Workspace — стартовий контент першого візиту («подарунок», ТЗ §3).
//
// v2 (2026-07-26, рішення власника): демо-дошка на корені = вітрина продукту,
// тому 6 сторінок замість однієї — відвідувач гортає їх як книжку й бачить
// ширину інструментів:
//   1. «Спробуй»          — вітання + парабола + StereoMASH-піраміда + квадратична
//   2. «Тригонометрія»    — тригонометричне коло + розв'язник + графік sin
//   3. «Похідна/інтеграл» — картка похідної + картка інтеграла + кубічна
//   4. «Геометрія»        — Піфагор + Фалес + пряма Ейлера (живі побудови)
//   5. «Стереометрія»     — переріз куба + куля в кубі + циліндр у конусі
//   6. «3D-функції»       — поверхня z=f(x,y) + просторова крива
//
// ⚠️ Вживаємо ЛИШЕ типи, що є в панелі вставки (insertRegistry). Застарілий
// `geometry_solid` (конус зі старого solidCard) свідомо НЕ використовуємо —
// його немає в панелі; живі тіла = `nmt3d` (StereoMASH, 25 шаблонів).
//
// ⚠️ Вартість рендера (перевірено по vendor-коду):
//   - StereoMASH (`nmt3d`) — SVG, дешевий → кілька на сторінці безпечно;
//   - GraphMASH 3D (`graphmash_3d`) — THREE.WebGLRenderer → дорогий, тому на
//     сторінці 3D-функцій їх рівно два.
// Рендериться лише поточна сторінка (`wbStore.currentPage`), тож при гортанні
// контексти вивільняються.
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
import { buildDefaultGraphmash3dAsset } from '../constants/mashInsertDefaults'

/**
 * Поточна версія «подарунка». Bump → НЕторканий seed оновиться при візиті.
 *
 * ⚠️ ПІДНІМАТИ ЩОРАЗУ, коли змінюється склад вітрини, І додавати відбиток
 * попередньої версії у KNOWN_SEED_LAYOUTS — інакше ті, хто вже бачив стару
 * вітрину, не отримають нову (гейт `seenVersion < LOCAL_SEED_VERSION`).
 *   v1 — одна сторінка (парабола + піраміда)
 *   v2 — чотири сторінки (остання з застарілим конусом)
 *   v3 — шість сторінок (стереометрія + 3D-функції, без конуса)
 */
export const LOCAL_SEED_VERSION = 3

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
  pageStereo: string
  page3d: string
  /** Підписи-заголовки на сторінках 2-6. */
  captionTrig: string
  captionCalculus: string
  captionGeometry: string
  captionStereo: string
  caption3d: string
  /** Описи під об'єктами (стор. 5-6) — показують, що саме демонструє картка. */
  descCubeSection: string
  descSphereInCube: string
  descCylInCone: string
  descSurface: string
  descCurve: string
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

/** Заголовок сторінки (однаковий стиль на стор. 2-6). */
function captionStroke(text: string): WBStroke {
  return textStroke('text-caption', text, 140, 110, 34, '#0f172a', 700)
}

/** Опис під об'єктом — пояснює, що саме демонструє картка. */
function descStroke(text: string, x: number, y: number): WBStroke {
  return textStroke('text-desc', text, x, y, 20, '#475569')
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

  // ── Стор. 4 «Геометрія» — живі планіметричні побудови ─────────────────────
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
      makeAsset('geo2d-e', 'geometry_2d_v2', 1020, 210,
        DEFAULT_GEOMETRY_2D_V2_W, DEFAULT_GEOMETRY_2D_V2_H,
        buildDefaultGeometry2DV2Data('euler9')),
    ],
  )

  // ── Стор. 5 «Стереометрія» — StereoMASH (SVG, дешевий) ────────────────────
  // Шаблони з перерізами та вписаними тілами — те, що реально просять на НМТ.
  const STEREO_W = 540
  const STEREO_H = 400
  const stereoY = 220
  const descY = stereoY + STEREO_H + 24
  const pageStereo = page(
    'page-stereo',
    texts.pageStereo,
    [
      captionStroke(texts.captionStereo),
      descStroke(texts.descCubeSection, 140, descY),
      descStroke(texts.descSphereInCube, 740, descY),
      descStroke(texts.descCylInCone, 1340, descY),
    ],
    [
      makeAsset('nmt3d-sec', 'nmt3d', 140, stereoY, STEREO_W, STEREO_H,
        buildDefaultNmt3dData('cubeSection3')),
      makeAsset('nmt3d-sph', 'nmt3d', 740, stereoY, STEREO_W, STEREO_H,
        buildDefaultNmt3dData('cubeInscribedSphere')),
      makeAsset('nmt3d-cyl', 'nmt3d', 1340, stereoY, STEREO_W, STEREO_H,
        buildDefaultNmt3dData('coneInscribedCylinder')),
    ],
  )

  // ── Стор. 6 «3D-функції» — GraphMASH 3D (WebGL, тому рівно два) ───────────
  const g3dSurface = buildDefaultGraphmash3dAsset('surface')
  g3dSurface.x = 140; g3dSurface.y = 220; g3dSurface.w = 640; g3dSurface.h = 470
  const g3dCurve = buildDefaultGraphmash3dAsset('curve')
  g3dCurve.x = 900; g3dCurve.y = 220; g3dCurve.w = 640; g3dCurve.h = 470
  const page3d = page(
    'page-3d',
    texts.page3d,
    [
      captionStroke(texts.caption3d),
      descStroke(texts.descSurface, 140, 720),
      descStroke(texts.descCurve, 900, 720),
    ],
    [g3dSurface, g3dCurve],
  )

  return {
    pages: [pageTry, pageTrig, pageCalculus, pageGeometry, pageStereo, page3d],
    currentPageIndex: 0,
  }
}

/**
 * Відбитки ВСІХ раніше випущених вітрин — типи об'єктів посторінково
 * (відсортовані). Використовуються, щоб відрізнити «людина ще нічого не
 * робила» від «тут уже є її робота».
 *
 * ⚠️ Додавати сюди попередній макет ПЕРЕД тим, як міняти склад вітрини.
 */
const KNOWN_SEED_LAYOUTS: ReadonlyArray<ReadonlyArray<ReadonlyArray<string>>> = [
  // v1 — одна сторінка
  [['graph_calculator', 'nmt3d']],
  // v2 — чотири сторінки, остання з застарілим конусом
  [
    ['graph_calculator', 'nmt3d', 'quadratic_card'],
    ['graph_calculator', 'trig_circle', 'trig_solver'],
    ['calculus_card', 'calculus_card', 'graph_calculator'],
    ['geometry_2d_v2', 'geometry_2d_v2', 'geometry_solid'],
  ],
]

/**
 * Чи це НЕторкана вітрина (будь-якої раніше випущеної версії)?
 *
 * Використовується для м'якого апгрейду: людині, яка заходила на демо-дошку
 * й нічого свого не додала, показуємо новий контент. Щойно вона намалювала
 * бодай штрих або додала/видалила об'єкт — відбиток не збігається, і її
 * роботу НЕ чіпаємо.
 */
export function isUntouchedSeed(state: WBWorkspaceState | null | undefined): boolean {
  if (!state || !Array.isArray(state.pages) || state.pages.length === 0) return false

  // Будь-який намальований (не текстовий) штрих = робота людини.
  for (const page of state.pages) {
    if (!(page.strokes ?? []).every((s) => s.tool === 'text')) return false
  }

  const actual = state.pages.map((p) => (p.assets ?? []).map((a) => a.type).sort())
  return KNOWN_SEED_LAYOUTS.some(
    (layout) =>
      layout.length === actual.length &&
      layout.every((pageTypes, i) =>
        pageTypes.length === actual[i].length &&
        pageTypes.every((t, j) => t === actual[i][j]),
      ),
  )
}
