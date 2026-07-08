/**
 * A2 MASH → дошка: логіка імпорту envelope (utils/mashImport.ts).
 *
 * Інваріанти:
 *   INV-MI-1  takeMashHandoff: валідний envelope читається і ЗНІМАЄТЬСЯ зі сховища
 *   INV-MI-2  сміття (битий JSON / не-обʼєкт / невідомий app / без scene) → null, сховище чисте
 *   INV-MI-3  buildNmt3dAssetFromStereoScene: {templateKey,params,opts,mode} → нативний nmt3d-ассет;
 *             params фільтруються до скінченних чисел, opts — до boolean (двигун кидає на сміття)
 *   INV-MI-4  сцена без templateKey → null
 *   INV-MI-5  buildEmptyInitialState + buildMashImportOps: порожній state + ops-посів
 *             (page_add + asset_add), об'єкт НЕ у базовому снапшоті (SYSTEM_LAW §2)
 */
import { describe, expect, it } from 'vitest'
import {
  MASH_HANDOFF_KEY,
  takeMashHandoff,
  buildNmt3dAssetFromStereoScene,
  buildGraphCalcAssetFromG2dScene,
  buildGeomashSceneAsset,
  buildGraphmash3dAsset,
  buildMashSceneAsset,
  buildEmptyInitialState,
  buildMashImportOps,
} from '../utils/mashImport'

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => map.get(k) ?? null,
    removeItem: (k: string) => { map.delete(k) },
    has: (k: string) => map.has(k),
  }
}

const VALID = JSON.stringify({
  app: 'stereo',
  version: 1,
  scene: { format: 'stereomash-scene', version: 1, templateKey: 'pyramid4Section3', params: { a: 1.8, t3: 0.4 }, opts: { fill: true }, mode: 'adapt' },
  preview: 'data:image/png;base64,xxx',
})

describe('mashImport utils (A2)', () => {
  it('INV-MI-1: валідний envelope читається і знімається зі сховища', () => {
    const s = fakeStorage({ [MASH_HANDOFF_KEY]: VALID })
    const env = takeMashHandoff(s)
    expect(env).not.toBeNull()
    expect(env!.app).toBe('stereo')
    expect(env!.scene.templateKey).toBe('pyramid4Section3')
    expect(env!.preview).toContain('data:image/png')
    expect(s.has(MASH_HANDOFF_KEY)).toBe(false) // одноразовий
  })

  it('INV-MI-2: сміття → null, сховище очищене', () => {
    for (const bad of ['not-json{', '42', '"str"', JSON.stringify({ app: 'evil', scene: {} }), JSON.stringify({ app: 'stereo' })]) {
      const s = fakeStorage({ [MASH_HANDOFF_KEY]: bad })
      expect(takeMashHandoff(s), bad).toBeNull()
      expect(s.has(MASH_HANDOFF_KEY)).toBe(false)
    }
    // порожнє сховище → null без падіння
    expect(takeMashHandoff(fakeStorage())).toBeNull()
  })

  it('INV-MI-3: stereo-сцена → нативний nmt3d-ассет; params/opts санітизовані', () => {
    const asset = buildNmt3dAssetFromStereoScene({
      templateKey: 'cube',
      mode: 'draw',
      params: { a: 2, bad: 'str', inf: Infinity, nan: NaN },
      opts: { bodyDiag: true, junk: 'yes' },
    })!
    expect(asset).not.toBeNull()
    expect(asset.type).toBe('nmt3d')
    expect(asset.id).toMatch(/^nmt3d-/)
    const data = asset.data as unknown as Record<string, unknown>
    expect(data.templateKey).toBe('cube')
    expect(data.mode).toBe('draw')
    expect(data.params).toEqual({ a: 2 })
    expect(data.opts).toEqual({ bodyDiag: true })
    expect(asset.w).toBeGreaterThan(0)
    expect(asset.locked).toBe(false)
  })

  it('INV-MI-4: без templateKey → null; невідомий mode → adapt', () => {
    expect(buildNmt3dAssetFromStereoScene({})).toBeNull()
    expect(buildNmt3dAssetFromStereoScene({ templateKey: '' })).toBeNull()
    const a = buildNmt3dAssetFromStereoScene({ templateKey: 'cube', mode: 'weird' })!
    expect((a.data as unknown as Record<string, unknown>).mode).toBe('adapt')
  })

  it('INV-MI-6: g2d/g3d/geo → mash_scene-ассет; сцена їде as-is, preview НЕ зберігається', () => {
    const asset = buildMashSceneAsset({
      app: 'g2d',
      version: 1,
      scene: { format: 'graphmash-2d', version: 2, title: 'Парабола', expressions: [{ latex: 'x^2' }] },
      preview: 'data:image/png;base64,HUGE',
    })!
    expect(asset).not.toBeNull()
    expect(asset.type).toBe('mash_scene')
    expect(asset.id).toMatch(/^mashsc-/)
    const data = asset.data as unknown as Record<string, unknown>
    expect(data.app).toBe('g2d')
    expect(data.sceneFormat).toBe('graphmash-2d')
    expect(data.title).toBe('Парабола')
    expect((data.scene as Record<string, unknown>).expressions).toHaveLength(1)
    expect(JSON.stringify(data)).not.toContain('data:image') // жодного preview-растра в state
  })

  it('INV-MI-6b: previewUrl зберігається у data, коли переданий', () => {
    const asset = buildMashSceneAsset(
      { app: 'geo', version: 1, scene: { format: 'geomash-scene', v: 1 } },
      'data:image/jpeg;base64,THUMB',
    )!
    const data = asset.data as unknown as Record<string, unknown>
    expect(data.previewUrl).toBe('data:image/jpeg;base64,THUMB')
    // без previewUrl — поле відсутнє (не undefined-шум у стані)
    const noPrev = buildMashSceneAsset({ app: 'geo', version: 1, scene: {} })!
    expect('previewUrl' in (noPrev.data as object)).toBe(false)
  })

  it('INV-MI-8: g2d-сцена → нативний graph_calculator (inv-21: кожен вираз з id)', () => {
    const asset = buildGraphCalcAssetFromG2dScene({
      format: 'graphmash-2d', version: 2,
      expressions: [
        { src: 'y=sin(x)', color: '#c74440', hidden: false },
        { src: 'a=1', color: '#2d70b3' },
        { src: '', color: '#000' },              // порожній — дропається
        { isTable: true, table: [] },            // таблиця — дропається
      ],
      params: { a: 1 },
      viewport: { cx: 2, cy: -1, scale: 40 },
    })!
    expect(asset.type).toBe('graph_calculator')
    expect(asset.id).toMatch(/^gc-/)
    const st = (asset.data as unknown as { state: { expressions: Array<{ id: string; src: string }>; params: Record<string, unknown>; viewport: { cx: number; scale: number } } }).state
    expect(st.expressions).toHaveLength(2)                    // порожній+таблиця дропнуто
    expect(st.expressions.every(e => typeof e.id === 'string' && e.id.length > 0)).toBe(true) // inv-21
    expect(st.expressions[0].src).toBe('y=sin(x)')
    expect(st.params.a).toMatchObject({ value: 1 })
    expect(st.viewport).toMatchObject({ cx: 2, cy: -1, scale: 40 })
  })

  it('INV-MI-8b: g2d-сцена без придатних виразів → null (fallback на картку)', () => {
    expect(buildGraphCalcAssetFromG2dScene({ expressions: [] })).toBeNull()
    expect(buildGraphCalcAssetFromG2dScene({ expressions: [{ isTable: true }] })).toBeNull()
    expect(buildGraphCalcAssetFromG2dScene({})).toBeNull()
  })

  it('INV-MI-8c: BE-safety — color→#rrggbb, ≤32 виразів, scale∈[1,1000], src≤256', () => {
    const many = Array.from({ length: 40 }, (_, k) => ({ src: `y=${k}`, color: '#abc' }))
    const asset = buildGraphCalcAssetFromG2dScene({
      expressions: [
        { src: 'y=x', color: '#c74440' },       // валідний 6-hex
        { src: 'y=2x', color: '#abc' },          // короткий → розгортається
        { src: 'y=3x', color: 'red' },           // назва → дефолт
        { src: 'x'.repeat(300), color: '#000000' }, // src>256 → дроп
        ...many,
      ],
      viewport: { cx: 0, cy: 0, scale: 5000 },   // поза межами → clamp 1000
    })!
    const st = (asset.data as unknown as { state: { expressions: Array<{ src: string; color: string }>; viewport: { scale: number } } }).state
    expect(st.expressions.length).toBeLessThanOrEqual(32)                 // BE cap
    expect(st.expressions.every(e => /^#[0-9a-f]{6}$/.test(e.color))).toBe(true) // усі 6-hex
    expect(st.expressions.find(e => e.src === 'y=2x')!.color).toBe('#aabbcc')    // розгорнуто
    expect(st.expressions.find(e => e.src === 'y=3x')!.color).toBe('#2d70b3')    // дефолт
    expect(st.expressions.some(e => e.src.length > 256)).toBe(false)     // довгий дропнуто
    expect(st.viewport.scale).toBe(1000)                                  // clamp
  })

  it('INV-MI-9: geo-сцена → нативний geomash_scene (objects+cs збережено)', () => {
    const asset = buildGeomashSceneAsset({
      format: 'geomash-scene', version: 1,
      objects: [{ id: 'A', type: 'point', wx: 1, wy: 2 }, { id: 'a', type: 'line' }],
      cs: { ox: 100, oy: 100, sc: 40 },
    })!
    expect(asset.type).toBe('geomash_scene')
    expect(asset.id).toMatch(/^geo-/)
    const sc = (asset.data as unknown as { scene: { objects: unknown[]; cs: { sc: number } } }).scene
    expect(sc.objects).toHaveLength(2)
    expect(sc.cs).toMatchObject({ sc: 40 })
  })

  it('INV-MI-9b: geo без масиву objects → null (fallback картка)', () => {
    expect(buildGeomashSceneAsset({})).toBeNull()
    expect(buildGeomashSceneAsset({ objects: 'nope' })).toBeNull()
    // порожня сцена (0 об'єктів) — валідна (порожня дошка теж об'єкт)
    expect(buildGeomashSceneAsset({ objects: [] })!.type).toBe('geomash_scene')
  })

  it('INV-MI-10: g3d-сцена → нативний graphmash_3d (scene as-is)', () => {
    const asset = buildGraphmash3dAsset({
      format: 'graphmash-scene', version: 2,
      objects: [{ id: 'e1', src: 'z = sin(x)*cos(y)', color: '#2d70b3', style: { colorMap: 'cool' } }],
    })!
    expect(asset.type).toBe('graphmash_3d')
    expect(asset.id).toMatch(/^gm3d-/)
    const data = asset.data as unknown as Record<string, unknown>
    expect(data.app).toBe('g3d')
    expect((data.scene as Record<string, unknown>).objects).toHaveLength(1)
    // не g3d без objects[] → null
    expect(buildGraphmash3dAsset({})).toBeNull()
    expect(buildGraphmash3dAsset({ objects: 'x' })).toBeNull()
  })

  it('INV-MI-7: buildMashSceneAsset для stereo → null (нативна гілка)', () => {
    expect(buildMashSceneAsset({ app: 'stereo', version: 1, scene: { templateKey: 'cube' } })).toBeNull()
    // geo без format — валідний (sceneFormat порожній, сцена їде)
    const geo = buildMashSceneAsset({ app: 'geo', version: 1, scene: { v: 1, objects: [] } })!
    expect((geo.data as unknown as Record<string, unknown>).sceneFormat).toBe('')
  })

  it('INV-MI-5: initial state ПОРОЖНІЙ (об\'єкт не сидить у базовому снапшоті)', () => {
    const state = buildEmptyInitialState()
    expect(state.currentPageIndex).toBe(0)
    expect(state.pages).toEqual([])
  })

  it('INV-MI-5b: buildMashImportOps — page_add(метадані, БЕЗ assets) + asset_add на той самий page_id', () => {
    const asset = buildNmt3dAssetFromStereoScene({ templateKey: 'cube' })!
    const ops = buildMashImportOps(asset)
    expect(ops).toHaveLength(2)

    const [pageOp, assetOp] = ops
    expect(pageOp.op_type).toBe('page_add')
    expect(assetOp.op_type).toBe('asset_add')

    // page_add: метадані сторінки, дзеркало createEmptyPage; БЕЗ strokes/assets у payload
    const pageId = pageOp.page_id!
    expect(pageId).toMatch(/^page-/)
    const page = (pageOp.payload as { page: Record<string, unknown> }).page
    expect(page.id).toBe(pageId)
    expect(page.name).toBe('Page 1')
    expect(page.background).toBe('white')
    expect(page.backgroundColor).toBe('#ffffff')
    expect('assets' in page).toBe(false)
    expect('strokes' in page).toBe(false)

    // asset_add: сам об'єкт на ту саму сторінку
    expect(assetOp.page_id).toBe(pageId)
    expect((assetOp.payload as { asset: unknown }).asset).toBe(asset)

    // op_id (REPLAY-INV-8): унікальний UUID у кожного оп-а
    expect(pageOp.op_id).toBeTruthy()
    expect(assetOp.op_id).toBeTruthy()
    expect(pageOp.op_id).not.toBe(assetOp.op_id)
  })
})
