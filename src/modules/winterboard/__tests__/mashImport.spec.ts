/**
 * A2 MASH → дошка: логіка імпорту envelope (utils/mashImport.ts).
 *
 * Інваріанти:
 *   INV-MI-1  takeMashHandoff: валідний envelope читається і ЗНІМАЄТЬСЯ зі сховища
 *   INV-MI-2  сміття (битий JSON / не-обʼєкт / невідомий app / без scene) → null, сховище чисте
 *   INV-MI-3  buildNmt3dAssetFromStereoScene: {templateKey,params,opts,mode} → нативний nmt3d-ассет;
 *             params фільтруються до скінченних чисел, opts — до boolean (двигун кидає на сміття)
 *   INV-MI-4  сцена без templateKey → null
 *   INV-MI-5  buildSeedState: 1 сторінка, дзеркало createEmptyPage-дефолтів, ассет усередині
 */
import { describe, expect, it } from 'vitest'
import {
  MASH_HANDOFF_KEY,
  takeMashHandoff,
  buildNmt3dAssetFromStereoScene,
  buildMashSceneAsset,
  buildSeedState,
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

  it('INV-MI-7: buildMashSceneAsset для stereo → null (нативна гілка)', () => {
    expect(buildMashSceneAsset({ app: 'stereo', version: 1, scene: { templateKey: 'cube' } })).toBeNull()
    // geo без format — валідний (sceneFormat порожній, сцена їде)
    const geo = buildMashSceneAsset({ app: 'geo', version: 1, scene: { v: 1, objects: [] } })!
    expect((geo.data as unknown as Record<string, unknown>).sceneFormat).toBe('')
  })

  it('INV-MI-5: seed-state — 1 сторінка з дефолтами createEmptyPage і ассетом', () => {
    const asset = buildNmt3dAssetFromStereoScene({ templateKey: 'cube' })!
    const state = buildSeedState(asset)
    expect(state.currentPageIndex).toBe(0)
    expect(state.pages).toHaveLength(1)
    const page = state.pages[0]
    expect(page.id).toMatch(/^page-/)
    expect(page.name).toBe('Page 1')
    expect(page.strokes).toEqual([])
    expect(page.background).toBe('white')
    expect(page.backgroundColor).toBe('#ffffff')
    expect(page.assets).toEqual([asset])
  })
})
