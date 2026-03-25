/**
 * Board Templates — pre-built layouts for new whiteboards.
 *
 * Each template defines a set of sticky notes / guide elements
 * that are placed on the canvas when selected.
 *
 * Templates are frontend-only (no backend model needed for MVP).
 * Future: BoardTemplate model for user-created templates.
 */

import type { WBAsset, WBStroke } from '../types/winterboard'
import { generateCoordinatePlane, generateNumberLine, generateTable } from '../templates/templatePresets'

export interface BoardTemplate {
  id: string
  nameKey: string        // i18n key
  descriptionKey: string // i18n key
  icon: string
  assets: Omit<WBAsset, 'id'>[]
  /** Phase 34: Generator function for stroke-based templates */
  generator?: () => WBStroke[]
}

const STICKY_BASE = {
  type: 'sticky' as const,
  rotation: 0,
  locked: false,
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'blank',
    nameKey: 'winterboard.templates.blank',
    descriptionKey: 'winterboard.templates.blankDesc',
    icon: '📋',
    assets: [],
  },
  {
    id: 'two-columns',
    nameKey: 'winterboard.templates.twoColumns',
    descriptionKey: 'winterboard.templates.twoColumnsDesc',
    icon: '📖',
    assets: [
      {
        ...STICKY_BASE,
        src: '',
        x: 40, y: 40, w: 350, h: 500,
        bgColor: '#dbeafe',
        text: '',
        fontSize: 16,
        textColor: '#1e293b',
      },
      {
        ...STICKY_BASE,
        src: '',
        x: 420, y: 40, w: 350, h: 500,
        bgColor: '#fef3c7',
        text: '',
        fontSize: 16,
        textColor: '#1e293b',
      },
    ],
  },
  {
    id: 'grid-2x2',
    nameKey: 'winterboard.templates.grid2x2',
    descriptionKey: 'winterboard.templates.grid2x2Desc',
    icon: '⊞',
    assets: [
      {
        ...STICKY_BASE,
        src: '',
        x: 40, y: 40, w: 350, h: 250,
        bgColor: '#dbeafe',
        text: '',
        fontSize: 14,
        textColor: '#1e293b',
      },
      {
        ...STICKY_BASE,
        src: '',
        x: 420, y: 40, w: 350, h: 250,
        bgColor: '#dcfce7',
        text: '',
        fontSize: 14,
        textColor: '#1e293b',
      },
      {
        ...STICKY_BASE,
        src: '',
        x: 40, y: 320, w: 350, h: 250,
        bgColor: '#fef3c7',
        text: '',
        fontSize: 14,
        textColor: '#1e293b',
      },
      {
        ...STICKY_BASE,
        src: '',
        x: 420, y: 320, w: 350, h: 250,
        bgColor: '#fce7f3',
        text: '',
        fontSize: 14,
        textColor: '#1e293b',
      },
    ],
  },
  {
    id: 'timeline',
    nameKey: 'winterboard.templates.timeline',
    descriptionKey: 'winterboard.templates.timelineDesc',
    icon: '📏',
    assets: [
      {
        ...STICKY_BASE,
        src: '',
        x: 40, y: 200, w: 160, h: 120,
        bgColor: '#dbeafe',
        text: '1',
        fontSize: 24,
        textColor: '#3b82f6',
      },
      {
        ...STICKY_BASE,
        src: '',
        x: 230, y: 200, w: 160, h: 120,
        bgColor: '#dcfce7',
        text: '2',
        fontSize: 24,
        textColor: '#16a34a',
      },
      {
        ...STICKY_BASE,
        src: '',
        x: 420, y: 200, w: 160, h: 120,
        bgColor: '#fef3c7',
        text: '3',
        fontSize: 24,
        textColor: '#ca8a04',
      },
      {
        ...STICKY_BASE,
        src: '',
        x: 610, y: 200, w: 160, h: 120,
        bgColor: '#fce7f3',
        text: '4',
        fontSize: 24,
        textColor: '#db2777',
      },
    ],
  },

  // Phase 34 A5: Generator-based math templates
  {
    id: 'coordinate_plane',
    nameKey: 'winterboard.templates.coordinatePlane',
    descriptionKey: 'winterboard.templates.coordinatePlaneDesc',
    icon: '📐',
    assets: [],
    generator: generateCoordinatePlane,
  },
  {
    id: 'number_line',
    nameKey: 'winterboard.templates.numberLine',
    descriptionKey: 'winterboard.templates.numberLineDesc',
    icon: '📏',
    assets: [],
    generator: generateNumberLine,
  },
  {
    id: 'table_3x3',
    nameKey: 'winterboard.templates.table',
    descriptionKey: 'winterboard.templates.tableDesc',
    icon: '📊',
    assets: [],
    generator: () => generateTable({ rows: 3, cols: 3 }),
  },
]
