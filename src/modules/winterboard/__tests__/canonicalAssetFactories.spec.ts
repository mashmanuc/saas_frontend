/**
 * TLV2-06R.1 · одна канонічна factory на цільовий тип (рев'ю Codex §3, тести §4.3–4.5).
 *
 *   • drag і `+` інструмента та готовий рецепт викликають ТУ САМУ factory:
 *       graph_calculator → `buildGraphCalculatorAsset`,
 *       geometry_2d_v2   → `buildGeometry2DV2Asset`,
 *       visual_capsule   → `buildVisualCapsuleAsset`;
 *   • без початкових даних factory дає рівно той конверт, що інструмент створював до 06R.1;
 *   • рецепт не повторює конверт WBAsset (guard нижче).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@/modules/learning-content', () => ({
  learningContentApi: { getBySlug: vi.fn() },
  renderContentToSvgDataUrl: vi.fn(),
}))
vi.mock('../constants/graphCalculatorDefaults', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../constants/graphCalculatorDefaults')>()
  return { ...actual, buildGraphCalculatorAsset: vi.fn(actual.buildGraphCalculatorAsset) }
})
vi.mock('../constants/geometry2dV2Defaults', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../constants/geometry2dV2Defaults')>()
  return { ...actual, buildGeometry2DV2Asset: vi.fn(actual.buildGeometry2DV2Asset) }
})
vi.mock('../components/board/objects/visualCapsules/capsuleRegistry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/board/objects/visualCapsules/capsuleRegistry')>()
  return { ...actual, buildVisualCapsuleAsset: vi.fn(actual.buildVisualCapsuleAsset) }
})

import { useContentDrop } from '../composables/useContentDrop'
import { buildGraphCalculatorAsset, GRAPH_CALCULATOR_MIME } from '../constants/graphCalculatorDefaults'
import { buildGeometry2DV2Asset, GEOMETRY_2D_V2_DRAG_MIME } from '../constants/geometry2dV2Defaults'
import { buildVisualCapsuleAsset } from '../components/board/objects/visualCapsules/capsuleRegistry'
import { BOARD_RECIPE_MIME, findBoardRecipe, type SupportedBoardRecipe } from '../board/preparedBoardRecipes'
import type { WBAsset } from '../types/winterboard'

const graphFactory = vi.mocked(buildGraphCalculatorAsset)
const geoFactory = vi.mocked(buildGeometry2DV2Asset)
const capsuleFactory = vi.mocked(buildVisualCapsuleAsset)
const SRC = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf-8').replace(/\r\n/g, '\n')

function makeDrop() {
  const onAssetAdd = vi.fn()
  const drop = useContentDrop({
    sessionId: ref('s-1'),
    canDraw: ref(true),
    onAssetAdd,
    screenToCanvas: (x, y) => ({ x: x / 2, y: y / 2 }),
  })
  return { ...drop, onAssetAdd }
}

function dropEvent(mime: string, payload: string): DragEvent {
  return {
    preventDefault: () => {},
    clientX: 800,
    clientY: 600,
    dataTransfer: { getData: (m: string) => (m === mime ? payload : ''), files: [] },
  } as unknown as DragEvent
}

const recipe = (id: string) => findBoardRecipe(id) as SupportedBoardRecipe
const recipePayload = (id: string) => JSON.stringify({ recipeId: id })

beforeEach(() => {
  graphFactory.mockClear()
  geoFactory.mockClear()
  capsuleFactory.mockClear()
})

describe('TLV2-06R.1 · інструмент і рецепт — одна factory типу', () => {
  it('graph_calculator: drag, `+` і рецепт кола → buildGraphCalculatorAsset', async () => {
    const tool = makeDrop()
    tool.addAtPosition(GRAPH_CALCULATOR_MIME, '{}', { x: 300, y: 200 })
    await tool.handleCanvasDrop(dropEvent(GRAPH_CALCULATOR_MIME, '{}'))
    const circle = recipe('tpl.g9-l27-c3-m2-r4')
    tool.addAtPosition(BOARD_RECIPE_MIME, recipePayload(circle.id), { x: 900, y: 700 })

    expect(graphFactory.mock.calls.map((c) => c[0])).toEqual([{ x: 300, y: 200 }, { x: 400, y: 300 }, { x: 900, y: 700 }])
    expect(graphFactory.mock.calls[0][1]).toBeUndefined()
    expect(graphFactory.mock.calls[2][1]).toEqual(circle.targetData)
    expect(tool.onAssetAdd.mock.calls.map((c) => c[0])).toEqual(graphFactory.mock.results.map((r) => r.value))
  })

  it('geometry_2d_v2: drag і `+` preset-а parallelogram та рецепт ABCD → buildGeometry2DV2Asset', async () => {
    const tool = makeDrop()
    const payload = JSON.stringify({ preset: 'parallelogram' })
    tool.addAtPosition(GEOMETRY_2D_V2_DRAG_MIME, payload, { x: 300, y: 200 })
    await tool.handleCanvasDrop(dropEvent(GEOMETRY_2D_V2_DRAG_MIME, payload))
    const abcd = recipe('tpl.g8-l04-abcd')
    tool.addAtPosition(BOARD_RECIPE_MIME, recipePayload(abcd.id), { x: 900, y: 700 })

    expect(geoFactory.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      [{ x: 300, y: 200 }, 'parallelogram'],
      [{ x: 400, y: 300 }, 'parallelogram'],
      [{ x: 900, y: 700 }, 'parallelogram'],
    ])
    expect(geoFactory.mock.calls[0][2]).toBeUndefined()
    const target = abcd.targetData as { pointsSnapshot: unknown; toggles: unknown }
    expect(geoFactory.mock.calls[2][2]).toEqual({ pointsSnapshot: target.pointsSnapshot, toggles: target.toggles })
    expect(tool.onAssetAdd.mock.calls.map((c) => c[0])).toEqual(geoFactory.mock.results.map((r) => r.value))
  })

  it('visual_capsule: рецепт ABC/EDF → buildVisualCapsuleAsset', () => {
    const drop = makeDrop()
    const abc = recipe('tpl.g7-l16-abc-edf')
    drop.addAtPosition(BOARD_RECIPE_MIME, recipePayload(abc.id), { x: 900, y: 700 })
    expect(capsuleFactory).toHaveBeenCalledTimes(1)
    expect(capsuleFactory).toHaveBeenCalledWith({ x: 900, y: 700 }, abc.targetData)
    expect(drop.onAssetAdd).toHaveBeenCalledWith(capsuleFactory.mock.results[0].value)
  })
})

describe('TLV2-06R.1 · factory: той самий конверт, що й до винесення', () => {
  it('graph_calculator без init — конверт інструмента 1:1 (UX-RULE-1)', () => {
    const a = buildGraphCalculatorAsset({ x: 500, y: 400 }) as unknown as Record<string, unknown>
    expect(a.id).toMatch(/^gc-/)
    expect({ ...a, id: '' }).toEqual({
      id: '', type: 'graph_calculator', src: '', x: 260, y: 220, w: 480, h: 360, rotation: 0, locked: false,
      data: { version: 1, state: { expressions: [], params: {}, viewport: { cx: 0, cy: 0, scale: 38 } }, meta: { last_snapshot_seq: 0 } },
    })
  })

  it('graph_calculator з init — id виразів видає factory, унікальні; вікно з init', () => {
    const a = buildGraphCalculatorAsset({ x: 0, y: 0 }, {
      expressions: [{ src: 'y = x', color: '#c4622a' }, { src: 'y = 2*x', color: '#3b7b9b' }],
      viewport: { cx: 1, cy: 2, scale: 30 },
    }) as unknown as { data: { state: { expressions: Array<Record<string, unknown>>; viewport: unknown } } }
    const [e1, e2] = a.data.state.expressions
    expect([e1.src, e1.color, e1.hidden, e2.src]).toEqual(['y = x', '#c4622a', false, 'y = 2*x'])
    expect(typeof e1.id).toBe('string')
    expect(e1.id).not.toBe(e2.id)
    expect(a.data.state.viewport).toEqual({ cx: 1, cy: 2, scale: 30 })
  })

  it('geometry_2d_v2 без init — рівно {version, preset}; з init — копії, не спільні посилання', () => {
    const plain = buildGeometry2DV2Asset({ x: 360, y: 420 }, 'triangle')
    expect(plain.id).toMatch(/^geo2dv2-/)
    expect({ ...plain, id: '' }).toEqual({
      id: '', type: 'geometry_2d_v2', src: '', x: 180, y: 200, w: 360, h: 440, rotation: 0, locked: false,
      data: { version: 1, preset: 'triangle' },
    })
    const points = Object.freeze({ A: Object.freeze({ x: 1, y: 2 }) })
    const toggles = Object.freeze({ angles: true })
    const rich = buildGeometry2DV2Asset({ x: 0, y: 0 }, 'parallelogram', { pointsSnapshot: points, toggles })
    expect(rich.data).toEqual({ version: 1, preset: 'parallelogram', pointsSnapshot: { A: { x: 1, y: 2 } }, toggles: { angles: true } })
    expect(rich.data.pointsSnapshot).not.toBe(points)
    expect(Object.isFrozen(rich.data.pointsSnapshot)).toBe(false)
    expect(Object.isFrozen(rich.data.toggles)).toBe(false)
  })

  it('visual_capsule — адреса валідується реєстром капсул; невідома капсула чи режим — помилка', () => {
    const a = buildVisualCapsuleAsset({ x: 400, y: 350 }, { visual_id: 'visual.triangles.congruence.overlay', capsule_version: 1, mode: 'recall' })
    expect({ ...a, id: '' }).toEqual({
      id: '', type: 'visual_capsule', src: '', x: 0, y: 0, w: 800, h: 700, rotation: 0, locked: false,
      data: { version: 1, visual_id: 'visual.triangles.congruence.overlay', capsule_version: 1, mode: 'recall' },
    })
    expect(() => buildVisualCapsuleAsset({ x: 0, y: 0 }, { visual_id: 'visual.nope', capsule_version: 1, mode: 'full' })).toThrow(/невідома візуальна капсула/)
    expect(() => buildVisualCapsuleAsset({ x: 0, y: 0 }, { visual_id: 'visual.triangles.congruence.overlay', capsule_version: 1, mode: 'assess' as never })).toThrow(/не має режиму/)
  })
})

describe('TLV2-06R.1 · конверт WBAsset має одного власника на тип', () => {
  it('рецепти й useContentDrop не будують graph_calculator / geometry_2d_v2 / visual_capsule вручну', () => {
    const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const recipes = code(read('modules/winterboard/board/preparedBoardRecipes.ts'))
    for (const f of ["type: '", 'randomUUID', 'rotation:', 'locked:', 'last_snapshot_seq', 'x: pos.x', 'DEFAULT_GRAPH', 'DEFAULT_GEOMETRY']) {
      expect(recipes.includes(f), `preparedBoardRecipes → ${f}`).toBe(false)
    }
    const drop = code(read('modules/winterboard/composables/useContentDrop.ts'))
    for (const t of ['graph_calculator', 'geometry_2d_v2', 'visual_capsule']) {
      expect(drop.includes(`type: '${t}'`), `useContentDrop → ${t}`).toBe(false)
    }
    expect(drop.match(/buildGraphCalculatorAsset\(/g)).toHaveLength(2)
    expect(drop.match(/buildGeometry2DV2Asset\(/g)).toHaveLength(2)
  })

  it('AI-каталог Інтегралика не має власного списку id', () => {
    const actions = read('modules/intent/boardActions.js')
    expect(actions).toContain('preparedRecipesForAI()')
    expect(actions).not.toMatch(/tpl\.g\d/)
  })
})
