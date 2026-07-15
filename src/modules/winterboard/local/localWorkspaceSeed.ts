// Local Workspace v1 — стартовий контент першого візиту («подарунок», ТЗ §3).
//
// Генерується РІВНО один раз (гейт — seeded-флаг у localWorkspaceStorage):
//   1. просте 3D-тіло (nmt3d, куб) — покрутити;
//   2. парабола у графічному калькуляторі (graph_calculator, x^2);
//   3. вітальний текст-підказка.
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

export interface LocalSeedTexts {
  /** Заголовок-привітання (великий текст). */
  title: string
  /** Підказка-заклик спробувати інструменти. */
  hint: string
}

function seedId(prefix: string): string {
  return `${prefix}-local-seed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Побудувати стартовий стан локального робочого столу.
 * Розкладка під дефолтну сторінку 1920×1080: текст зверху зліва,
 * графік під ним, 3D-куб праворуч.
 */
export function buildLocalWelcomeState(texts: LocalSeedTexts): WBWorkspaceState {
  const titleStroke: WBStroke = {
    id: seedId('text-title'),
    tool: 'text',
    color: '#0f172a',
    size: 44,
    opacity: 1,
    points: [{ x: 140, y: 110 }],
    text: texts.title,
    fontWeight: 700,
  }

  const hintStroke: WBStroke = {
    id: seedId('text-hint'),
    tool: 'text',
    color: '#475569',
    size: 24,
    opacity: 1,
    points: [{ x: 140, y: 185 }],
    text: texts.hint,
  }

  // Дзеркало useContentDrop.ts GRAPH_CALCULATOR_MIME handler + одна парабола.
  const graphAsset: WBAsset = {
    id: seedId('gc'),
    type: 'graph_calculator',
    src: '',
    x: 140,
    y: 300,
    w: DEFAULT_GRAPH_WIDTH,
    h: DEFAULT_GRAPH_HEIGHT,
    rotation: 0,
    locked: false,
    data: {
      version: 1,
      state: {
        expressions: [
          // 'y=x^2' (НЕ голе 'x^2') — парсер калькулятора будує криву лише
          // з явною лівою частиною (фікс власника 2026-07-15).
          { id: seedId('expr'), src: 'y=x^2', color: '#2d70b3', hidden: false },
        ],
        params: {},
        viewport: { cx: 0, cy: 2, scale: 38 },
      },
      meta: { last_snapshot_seq: 0 },
    } as unknown as WBAsset['data'],
  } as WBAsset

  // Дзеркало useContentDrop.ts NMT3D_DRAG_MIME handler.
  // 'ngonPyramid' («Правильна n-кутна піраміда») — вибір власника 2026-07-15:
  // піраміда з drag-вершинами виглядає живіше за куб.
  const pyramidAsset: WBAsset = {
    id: seedId('nmt3d'),
    type: 'nmt3d',
    src: '',
    x: 1020,
    y: 240,
    w: DEFAULT_NMT3D_W,
    h: DEFAULT_NMT3D_H,
    rotation: 0,
    locked: false,
    data: {
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
    } as unknown as WBAsset['data'],
  } as WBAsset

  const page: WBPage = {
    id: seedId('page'),
    name: 'Page 1',
    strokes: [titleStroke, hintStroke],
    assets: [graphAsset, pyramidAsset],
    background: 'white',
    // #cdf9d0 = rgb(205, 249, 208) — точний фон з референсу власника
    // (2026-07-15, знятий з BG-пікера): світло-зелений «робочий стіл»
    // без білого прямокутника.
    backgroundColor: '#cdf9d0',
  }

  return { pages: [page], currentPageIndex: 0 }
}
