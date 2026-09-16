/**
 * TLV2-06R · межа «один механізм — один runtime-власник» (ТЗ 43 §2, §3, §6, §9.1–9.3).
 *
 * Перевірки всього `src/`: відкликаної архітектури TLV2-06 немає, рецепти — лише дані
 * без рушія, стору й мережі, а поверхні Tools/полиці/рендерера Geometry2D не знають
 * про урокові рецепти.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '../../..')
const THIS_FILE = resolve(__filename)
const rel = (p: string) => relative(SRC, p).replace(/\\/g, '/')
const read = (p: string) => readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
const code = (src: string) => src
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|js|vue|mjs|txt|json)$/.test(name)) out.push(full)
  }
  return out
}

const ALL = walk(SRC).filter((p) => resolve(p) !== THIS_FILE)
const at = (p: string) => resolve(SRC, p)

describe('TLV2-06R · відкликаної архітектури TLV2-06 у src/ немає', () => {
  it('ні шаблонів сцен, ні scene-runtime, ні копій harness D-VM2, ні шести плиток', () => {
    const forbidden = [
      'RIGID_OVERLAY_TEMPLATE', 'HINGE_FLEX_TEMPLATE', 'TRACE_LOCUS_TEMPLATE',
      'mountGeometryScene', 'geometry2dScenes', 'GEOMETRY_SCENE_INSERTS', 'geometry-2d-scene-',
      'PlanimetryTemplates', '__planimetryPresetRegistry', 'planimetry.tpl.',
    ]
    const hits = ALL.flatMap((p) => {
      const src = read(p)
      return forbidden.filter((f) => src.includes(f)).map((f) => `${rel(p)} → ${f}`)
    })
    expect(hits).toEqual([])
    expect(ALL.map(rel).filter((n) => /planimetry.*templates/.test(n))).toEqual([])
  })
})

describe('TLV2-06R · рецепт — лише дані', () => {
  const recipes = code(read(at('modules/winterboard/board/preparedBoardRecipes.ts')))

  it('без рушія Geo2D, побудов, Vue, стору, мережі й op-типів', () => {
    for (const f of [
      'vendor/geo2d', 'GeoCard', 'Geo2D', 'G.free', 'G.segment', 'build(con', 'requestAnimationFrame',
      "from 'vue'", '.vue', 'useWBStore', 'boardStore', 'WBSession', 'apiClient', 'fetch(', 'WebSocket',
      'op_type', 'asset_add', 'asset_update', 'addAsset', 'updateAsset',
    ]) {
      expect(recipes.includes(f), f).toBe(false)
    }
  })

  it('поверхні Tools, полиця й рендерер Geometry2D не знають про рецепти', () => {
    for (const p of [
      'modules/winterboard/components/sidebar/insertRegistry.ts',
      'modules/winterboard/components/sidebar/Geometry2DTray.vue',
      'modules/winterboard/components/sidebar/GroupContentSidebar.vue',
      'modules/winterboard/components/board/objects/Geometry2DRenderer.vue',
      'modules/winterboard/types/geometry2dV2.ts',
    ]) {
      const src = read(at(p))
      for (const f of ['preparedBoardRecipes', 'BOARD_RECIPE_MIME', 'recipeId', 'configId', 'sceneState', 'tpl.g']) {
        expect(src.includes(f), `${p} → ${f}`).toBe(false)
      }
    }
  })

  it('вставка рецепта — лише через addAtPosition → onAssetAdd; Інтегралик лише резолвить і диспатчить', () => {
    const drop = read(at('modules/winterboard/composables/useContentDrop.ts'))
    const branch = drop.slice(drop.indexOf('if (mime === BOARD_RECIPE_MIME)'), drop.indexOf('if (mime === GEOMETRY_2D_V2_DRAG_MIME)'))
    expect(branch).toContain('buildBoardRecipeAsset(recipeId, pos)')
    expect(branch.match(/onAssetAdd\(/g)).toHaveLength(1)
    expect(drop.match(/BOARD_RECIPE_MIME/g)?.length).toBe(2) // import + одна гілка; drag-джерела немає

    const actions = read(at('modules/intent/boardActions.js'))
    const handler = actions.slice(actions.indexOf('HANDLERS.add_tool'), actions.indexOf('export async function runBoardAction'))
    expect(handler).toContain('findBoardRecipe(insert_id)')
    expect(handler).not.toMatch(/buildBoardRecipeAsset|addAsset|updateAsset|_store\(|geometry_2d_v2|graph_calculator|visual_capsule|tpl\.g/)
    expect(handler.match(/window\.dispatchEvent\(/g)).toHaveLength(2) // інструмент або рецепт — одна подія
  })
})
