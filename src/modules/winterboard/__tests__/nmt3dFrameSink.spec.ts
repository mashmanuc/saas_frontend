/**
 * nmt3d frameSink seam — контракт §2 MASH_STEREOMASH_VISUAL_TZ.md.
 *
 * РЕАЛЬНИЙ двигун (vendor/nmt3d/nmt-3d.js), НЕ мок. Інваріанти:
 *   INV-SEAM-1  без frameSink → SVG містить фігуру (поведінка як до seam, регресія)
 *   INV-SEAM-2  frameSink на poly (cube) → 6 faces / 12 edges; shade∈[0..1]; depth∈[0..1]
 *   INV-SEAM-3  depth-орієнтація: front-грані в середньому ближчі (менший depth), ніж задні
 *   INV-SEAM-4  frameOnly=true → SVG БЕЗ фігурних <path>, handles лишаються (DOM hit-test)
 *   INV-SEAM-5  curved (cylinder) → curves непорожній, faces/edges порожні
 *   INV-SEAM-6  aux має role+colorHint (семантична мапа); опція axSect дає section-роль
 *   INV-SEAM-7  frameSink, що кидає — не валить рендер (warn, не crash)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Реальні vendor-бандли (side-effect: window.NMT_TEMPLATES + window.NMT3D)
import '../vendor/nmt3d/nmt-templates.js'
import '../vendor/nmt3d/nmt-3d.js'
import type { Nmt3dFrame, Nmt3dWorkspace } from '../vendor/nmt3d'

function makeHost(): HTMLElement {
  const el = document.createElement('div')
  // jsdom дає 0×0 — двигун читає getBoundingClientRect для розміру в'юпорта
  el.getBoundingClientRect = () =>
    ({ width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  document.body.appendChild(el)
  return el
}

describe('nmt3d frameSink seam', () => {
  let host: HTMLElement
  let ws: Nmt3dWorkspace | null = null

  beforeEach(() => {
    host = makeHost()
  })

  afterEach(() => {
    ws?.destroy()
    ws = null
    host.remove()
    vi.restoreAllMocks()
  })

  it('INV-SEAM-1: без frameSink SVG рендерить фігуру як раніше', () => {
    ws = new window.NMT3D.Workspace(host, 'cube') as Nmt3dWorkspace
    const svg = host.querySelector('.nmt3-svg-layer svg')
    expect(svg).toBeTruthy()
    // видимі ребра куба — суцільні path зі stroke #1a1612
    const bodyPaths = svg!.querySelectorAll('path[stroke="#1a1612"]')
    expect(bodyPaths.length).toBeGreaterThan(0)
  })

  it('INV-SEAM-2/3: cube → 6 faces, 12 edges, shade/depth у [0..1], front ближче за back', () => {
    ws = new window.NMT3D.Workspace(host, 'cube') as Nmt3dWorkspace
    let frame: Nmt3dFrame | null = null
    ws.frameSink = (f) => { frame = f }
    ws.setView('iso') // тригерить _render з sink
    expect(frame).not.toBeNull()
    const fr = frame! as Nmt3dFrame
    expect(fr.kind).toBe('solid')
    expect(fr.faces).toHaveLength(6)
    expect(fr.edges).toHaveLength(12)
    for (const face of fr.faces) {
      expect(face.pts).toHaveLength(4)
      expect(face.shade).toBeGreaterThanOrEqual(0)
      expect(face.shade).toBeLessThanOrEqual(1)
      expect(face.depth).toBeGreaterThanOrEqual(0)
      expect(face.depth).toBeLessThanOrEqual(1)
    }
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
    const frontD = fr.faces.filter(f => f.front).map(f => f.depth)
    const backD = fr.faces.filter(f => !f.front).map(f => f.depth)
    expect(frontD.length).toBeGreaterThan(0)
    expect(backD.length).toBeGreaterThan(0)
    expect(avg(frontD)).toBeLessThan(avg(backD)) // 0=близько, 1=далеко
    // видимість ребер узгоджена: є і visible, і hidden
    expect(fr.edges.some(e => e.visible)).toBe(true)
    expect(fr.edges.some(e => !e.visible)).toBe(true)
  })

  it('INV-SEAM-4: frameOnly → SVG без фігурних path; сама фігура їде у frame', () => {
    ws = new window.NMT3D.Workspace(host, 'cube') as Nmt3dWorkspace
    ws.frameSink = () => {}
    ws.frameOnly = true
    ws.setView('iso')
    const svg = host.querySelector('.nmt3-svg-layer svg')!
    expect(svg.querySelectorAll('path[stroke="#1a1612"]').length).toBe(0)
    expect(svg.querySelectorAll('path[stroke="#7a6b56"]').length).toBe(0)
    expect(svg.querySelectorAll('text').length).toBe(0)
    // а без frameOnly — фігура повертається (перемикач живий)
    ws.frameOnly = false
    ws.setView('3d')
    const svg2 = host.querySelector('.nmt3-svg-layer svg')!
    expect(svg2.querySelectorAll('path[stroke="#1a1612"]').length).toBeGreaterThan(0)
  })

  it('INV-SEAM-5: cylinder → curved, curves непорожній, faces/edges порожні', () => {
    ws = new window.NMT3D.Workspace(host, 'cylinder') as Nmt3dWorkspace
    let frame: Nmt3dFrame | null = null
    ws.frameSink = (f) => { frame = f }
    ws.setView('iso')
    const fr = frame! as Nmt3dFrame
    expect(fr.kind).toBe('curved')
    expect(fr.curves.length).toBeGreaterThan(0)
    expect(fr.curves.some(c => c.visible)).toBe(true)
    expect(fr.faces).toHaveLength(0)
    expect(fr.edges).toHaveLength(0)
  })

  it('INV-SEAM-6: aux-ролі семантичні — axSect у cube дає section (+fill)', () => {
    ws = new window.NMT3D.Workspace(host, 'cube') as Nmt3dWorkspace
    let frame: Nmt3dFrame | null = null
    ws.frameSink = (f) => { frame = f }
    ws.setOpt('diagSect', true)
    const fr = frame! as Nmt3dFrame
    expect(fr.aux.some(a => a.role === 'section')).toBe(true)
    expect(fr.fills.some(f => f.role === 'section' && f.fillOpacity > 0)).toBe(true)
    for (const a of fr.aux) {
      expect(typeof a.role).toBe('string')
      expect(a.colorHint).toMatch(/^#/)
    }
  })

  it('INV-SEAM-7: frameSink, що кидає, не валить рендер', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    ws = new window.NMT3D.Workspace(host, 'cube') as Nmt3dWorkspace
    ws.frameSink = () => { throw new Error('boom') }
    expect(() => ws!.setView('iso')).not.toThrow()
    expect(warn).toHaveBeenCalledWith('[NMT3D] frameSink error', expect.any(Error))
    // SVG все одно оновився
    expect(host.querySelector('.nmt3-svg-layer svg')).toBeTruthy()
  })
})
