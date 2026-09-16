/**
 * TLV2-05A · стандарт карткових об'єктів дошки.
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 *
 * «Що вміє тип» жило в чотирьох місцях (KONVA_PROXY_TYPES, overlayRegistry.expandable,
 * isResizableMedia, кнопки в рендерері). Тип можна було додати в один список і забути
 * про решту — так `visual_capsule` став карткою, яку не можна ні рухати, ні масштабувати.
 *
 * ІНВАРІАНТИ
 *   INV-STD-1  кожен тип асета має запис у стандарті; зайвих типів у стандарті немає
 *   INV-STD-2  невідомий тип — fail-closed (жодної можливості)
 *   INV-STD-3  примітиви не отримують карткових дій (fullscreen / minimizable)
 *   INV-STD-4  похідні списки = те саме, що було до реєстру (V1-поведінка не змінена)
 *   INV-STD-5  `overlayRegistry.expandable` береться зі стандарту, не з entry
 *   INV-STD-6  другого переліку типів у коді немає (ні в WBCanvas, ні в реєстрі)
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BOARD_ASSET_STANDARD,
  BOARD_PRIMITIVE_STANDARD,
  NO_CAPABILITIES,
  OVERLAY_PROXY_TYPES,
  STANDARD_ASSET_TYPES,
  assetCapabilities,
  assetStandard,
  isCardAsset,
  isFullscreenAsset,
  isResizableMediaAsset,
  primitiveCapabilities,
} from '../board/objectStandard'
import { assetsEqualByOpsFields } from '../board/state/assetEquality'
import { OVERLAY_RENDERERS } from '../components/canvas/overlayRegistry'

const SRC = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf-8')

/**
 * Зафіксовано з коду ДО TLV2-05A (`WBCanvas.KONVA_PROXY_TYPES`, 16 типів).
 * Якщо похідний список розійдеться — поведінка дошки змінилась, і це видно тут.
 */
const PROXY_TYPES_BEFORE_TLV2_05A = [
  'geometry_solid', 'graph_calculator', 'geometry_2d_v2', 'calculus_card', 'trig_circle',
  'helix', 'trig_solver', 'nmt3d', 'nmt_task', 'quadratic_card', 'formula_card',
  'theory_card', 'mash_scene', 'geomash_scene', 'graphmash_3d', 'visual_capsule',
].sort()

/** `expandable: true` у реєстрі ДО TLV2-05A. Капсула додалась свідомо (ТЗ §3). */
const FULLSCREEN_BEFORE_TLV2_05A = [
  'graph_calculator', 'trig_circle', 'helix', 'nmt3d', 'geomash_scene', 'graphmash_3d', 'nmt_task',
].sort()

/** Літерали `WBAsset['type']` — читаються з типів, щоб перелік не розходився вручну. */
function assetTypeLiterals(): string[] {
  const src = read('modules/winterboard/types/winterboard.ts')
  const start = src.indexOf('\n  type:')
  const end = src.indexOf('\n  src: string', start)
  expect(start).toBeGreaterThan(0)
  expect(end).toBeGreaterThan(start)
  return [...src.slice(start, end).matchAll(/\|\s*'([a-z0-9_]+)'/g)].map(m => m[1])
}

describe('INV-STD-1 · стандарт покриває рівно наявні типи', () => {
  it('кожен тип асета має запис, і він картковий', () => {
    const literals = assetTypeLiterals()
    expect(literals.length).toBeGreaterThan(20)
    for (const type of literals) {
      expect(assetStandard(type), `немає запису стандарту: ${type}`).not.toBeNull()
      expect(isCardAsset(type), `тип має бути карткою: ${type}`).toBe(true)
    }
  })

  it('у стандарті немає типів, яких немає в коді', () => {
    expect([...STANDARD_ASSET_TYPES].sort()).toEqual(assetTypeLiterals().sort())
  })

  it('кожен overlay-тип реєстру описаний стандартом як overlay', () => {
    for (const type of Object.keys(OVERLAY_RENDERERS)) {
      expect(assetStandard(type)?.render, type).toBe('overlay')
    }
  })
})

describe('INV-STD-2 · невідомий тип — fail-closed', () => {
  it.each(['', 'wat', 'visual_capsule_v2', undefined, null])('%s → жодної можливості', (type) => {
    expect(assetCapabilities(type as string)).toEqual(NO_CAPABILITIES)
    expect(isCardAsset(type as string)).toBe(false)
    expect(isFullscreenAsset(type as string)).toBe(false)
    expect(isResizableMediaAsset(type as string)).toBe(false)
    expect(OVERLAY_PROXY_TYPES.has(String(type))).toBe(false)
  })

  it('невідомий примітив теж fail-closed', () => {
    expect(primitiveCapabilities('wat')).toEqual(NO_CAPABILITIES)
    expect(primitiveCapabilities(undefined)).toEqual(NO_CAPABILITIES)
  })
})

describe('INV-STD-3 · примітиви не отримують карткових дій', () => {
  it('жоден штрих не має fullscreen чи згортання, і не є карткою', () => {
    for (const [tool, entry] of Object.entries(BOARD_PRIMITIVE_STANDARD)) {
      expect(entry.kind, tool).toBe('primitive')
      expect(entry.capabilities.fullscreen, tool).toBe(false)
      expect(entry.capabilities.minimizable, tool).toBe(false)
      expect(isCardAsset(tool) && !(tool in BOARD_ASSET_STANDARD), tool).toBe(false)
    }
  })

  it('масштабується лише текст (ручка ширини)', () => {
    const resizable = Object.entries(BOARD_PRIMITIVE_STANDARD)
      .filter(([, e]) => e.capabilities.resizable).map(([tool]) => tool)
    expect(resizable).toEqual(['text'])
  })
})

describe('INV-STD-4 · похідні списки не змінили поведінку', () => {
  it('набір Konva-проксі — той самий, що був у WBCanvas', () => {
    expect([...OVERLAY_PROXY_TYPES].sort()).toEqual(PROXY_TYPES_BEFORE_TLV2_05A)
  })

  it('fullscreen = попередній набір + капсула (єдина свідома зміна TLV2-05A)', () => {
    const fullscreen = STANDARD_ASSET_TYPES.filter(isFullscreenAsset).sort()
    expect(fullscreen).toEqual([...FULLSCREEN_BEFORE_TLV2_05A, 'visual_capsule'].sort())
  })

  it('ручки розміру медіа — лише відео і YouTube, як було', () => {
    const media = STANDARD_ASSET_TYPES.filter(isResizableMediaAsset).sort()
    expect(media).toEqual(['video_player', 'youtube_player'])
    expect(assetCapabilities('audio_player').resizable).toBe(false)
  })

  it('TLV2-05B: згортаються всі картки, крім медіа (сховане відео грало б звук)', () => {
    const minimizable = STANDARD_ASSET_TYPES.filter(t => assetCapabilities(t).minimizable).sort()
    const media = ['audio_player', 'video_player', 'youtube_player']
    expect(minimizable).toEqual(STANDARD_ASSET_TYPES.filter(t => !media.includes(t)).sort())
  })

  it('кожна картка рухається, видаляється, блокується й міняє шар', () => {
    for (const type of STANDARD_ASSET_TYPES) {
      const c = assetCapabilities(type)
      expect([type, c.movable, c.deletable, c.lockable, c.layerable, c.duplicable])
        .toEqual([type, true, true, true, true, true])
    }
  })
})

describe('INV-STD-4b · позиція й розмір картки переживають reload', () => {
  // Reload читає дошку з журналу ops. Якщо x/y/w/h не ops-relevant — переміщення
  // й масштабування картки не доїдуть до бекенда, і після reload вона стрибне назад.
  const capsule = {
    id: 'cap-1', type: 'visual_capsule', src: '', x: 10, y: 20, w: 780, h: 620,
    rotation: 0, locked: false, data: { version: 1, visual_id: 'v', capsule_version: 1, mode: 'full' },
  } as unknown as Parameters<typeof assetsEqualByOpsFields>[0]

  it.each(['x', 'y', 'w', 'h', 'rotation', 'locked'] as const)('зміна %s = зміна для ops', (field) => {
    const moved = { ...capsule, [field]: field === 'locked' ? true : 999 }
    expect(assetsEqualByOpsFields(capsule, moved as never)).toBe(false)
  })

  it('однакова картка — без зайвої операції', () => {
    expect(assetsEqualByOpsFields(capsule, { ...capsule })).toBe(true)
  })
})

describe('INV-STD-5 · реєстр overlay бере expandable зі стандарту', () => {
  it('для кожного типу expandable = стандарт, і props/events узгоджені', () => {
    const ctx = {
      isSelected: () => false, interactive: true, isTutor: true, boardMode: 'edit',
      disableAnimation: false, expandedId: null, onUpdate: () => {}, onDelete: () => {},
      onSelectOther: () => {}, onFormulaEdit: () => {}, onSpawnCompanions: () => {},
      onRequestHeight: () => {}, toggleExpand: () => {}, graph: {} as never,
    } as never
    for (const [type, entry] of Object.entries(OVERLAY_RENDERERS)) {
      expect(entry.expandable, type).toBe(isFullscreenAsset(type))
      const asset = { id: 'a1', type } as never
      const hasExpandProp = 'isExpanded' in entry.buildProps(asset, ctx)
      const hasExpandEvent = 'expand' in entry.buildEvents(asset, ctx)
      expect([type, hasExpandProp, hasExpandEvent]).toEqual([type, entry.expandable, entry.expandable])
    }
  })
})

describe('INV-STD-6 · другого переліку типів у коді немає', () => {
  it('WBCanvas бере проксі-типи зі стандарту, а не власним списком', () => {
    const canvas = read('modules/winterboard/components/canvas/WBCanvas.vue')
    expect(canvas).toContain('const KONVA_PROXY_TYPES = OVERLAY_PROXY_TYPES')
    expect(canvas).not.toMatch(/new Set<WBAsset\['type'\]>\(\[/)
    expect(canvas).toContain('isResizableMediaAsset(asset.type)')
  })

  it('реєстр overlay не має власних expandable-літералів', () => {
    const registry = read('modules/winterboard/components/canvas/overlayRegistry.ts')
    expect(registry).toContain('expandable: isFullscreenAsset(type)')
    expect(registry).not.toMatch(/expandable: (true|false)/)
  })
})
