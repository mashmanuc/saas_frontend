/**
 * B-lite: загальний перетинач computeSection + нові section3-шаблони.
 *
 * РЕАЛЬНИЙ двигун (vendor/nmt3d). Інваріанти:
 *   INV-SEC-1  регресія cubeSection3: дефолт (t=0.5 усі) → правильний ШЕСТИКУТНИК (6 вершин)
 *   INV-SEC-2  prism4Section3 дефолт → теж 6 (афінний образ куба: та сама комбінаторика)
 *   INV-SEC-3  pyramid4Section3 дефолт → П'ЯТИКУТНИК (площина x+y+z=const ріже AB,BC,SA,SC,SD)
 *   INV-SEC-4  рухомі точки: t1/t2/t3-handles присутні; зміна t3 міняє переріз
 *   INV-SEC-5  нові шаблони зареєстровані в TEMPLATES і мають повний контракт (name/params/aux)
 *   INV-SEC-6  verticesLabel → K-мітки лише для НЕ-опорних вершин перерізу
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import '../vendor/nmt3d/nmt-templates.js'
import '../vendor/nmt3d/nmt-3d.js'
import type { Nmt3dFrame, Nmt3dWorkspace } from '../vendor/nmt3d'

function makeHost(): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () =>
    ({ width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  document.body.appendChild(el)
  return el
}

/** Кількість вершин полігона з path-рядка 'M.. L.. L.. Z'. */
function polyPts(d: string): number {
  return (d.match(/ L/g) || []).length + 1
}

/** Останній frame від воркспейса (sink + примусовий рендер-тік). */
function grabFrame(ws: Nmt3dWorkspace): Nmt3dFrame {
  let frame: Nmt3dFrame | null = null
  ws.frameSink = (f) => { frame = f }
  ws.setView('iso')
  if (!frame) throw new Error('frame not emitted')
  return frame
}

describe('nmt3d section3 templates (B-lite)', () => {
  let host: HTMLElement
  let ws: Nmt3dWorkspace | null = null

  beforeEach(() => { host = makeHost() })
  afterEach(() => { ws?.destroy(); ws = null; host.remove() })

  it('INV-SEC-5: нові шаблони зареєстровані з повним контрактом', () => {
    for (const key of ['pyramid4Section3', 'prism4Section3']) {
      const tpl = window.NMT3D.TEMPLATES[key]
      expect(tpl, key).toBeTruthy()
      expect(tpl!.name).toContain('перерізом через 3 точки')
      expect(Object.keys(tpl!.params)).toEqual(expect.arrayContaining(['a', 'h', 't1', 't2', 't3']))
      expect(tpl!.aux!.map(a => a.key)).toEqual(['fill', 'verticesLabel', 'normal'])
    }
  })

  it('INV-SEC-1: регресія cubeSection3 — дефолтний переріз = шестикутник', () => {
    ws = new window.NMT3D.Workspace(host, 'cubeSection3') as Nmt3dWorkspace
    const fr = grabFrame(ws)
    expect(fr.fills.length).toBeGreaterThan(0)
    expect(polyPts(fr.fills[0].d)).toBe(6)
  })

  it('INV-SEC-2: prism4Section3 — дефолтний переріз = шестикутник (афінна еквівалентність кубу)', () => {
    ws = new window.NMT3D.Workspace(host, 'prism4Section3') as Nmt3dWorkspace
    const fr = grabFrame(ws)
    expect(fr.kind).toBe('solid')
    expect(fr.faces).toHaveLength(6)
    expect(polyPts(fr.fills[0].d)).toBe(6)
  })

  it('INV-SEC-3: pyramid4Section3 — дефолтний переріз = п’ятикутник', () => {
    ws = new window.NMT3D.Workspace(host, 'pyramid4Section3') as Nmt3dWorkspace
    const fr = grabFrame(ws)
    expect(fr.kind).toBe('solid')
    expect(fr.faces).toHaveLength(5) // основа + 4 бічні
    expect(polyPts(fr.fills[0].d)).toBe(5)
  })

  it('INV-SEC-4: t-handles присутні; зміна t3 змінює переріз', () => {
    ws = new window.NMT3D.Workspace(host, 'pyramid4Section3') as Nmt3dWorkspace
    let frame: Nmt3dFrame | null = null
    ws.frameSink = (f) => { frame = f }
    ws.setView('iso')
    const ids = (frame! as Nmt3dFrame).handles.map(h => h.id)
    expect(ids).toEqual(expect.arrayContaining(['a', 'h', 't1', 't2', 't3']))
    const dBefore = (frame! as Nmt3dFrame).fills[0].d
    ws.setParam('t3', 0.1)
    const dAfter = (frame! as Nmt3dFrame).fills[0].d
    expect(dAfter).not.toBe(dBefore)
    expect(polyPts(dAfter)).toBeGreaterThanOrEqual(3)
  })

  it('INV-SEC-7: measures.sectionArea — куб дефолт = 3√3/4·a² (правильний шестикутник)', () => {
    ws = new window.NMT3D.Workspace(host, 'cubeSection3') as Nmt3dWorkspace
    const a = 1.8
    const expected = (3 * Math.sqrt(3) / 4) * a * a // ≈ 4.2089
    expect(ws.measures).not.toBeNull()
    expect(ws.measures!.sectionVertices).toBe(6)
    expect(ws.measures!.sectionArea).toBeCloseTo(expected, 3)
  })

  it('INV-SEC-8: measures live-оновлюються при зміні параметрів', () => {
    ws = new window.NMT3D.Workspace(host, 'pyramid4Section3') as Nmt3dWorkspace
    const before = ws.measures!.sectionArea
    expect(before).toBeGreaterThan(0)
    ws.setParam('t3', 0.1)
    expect(ws.measures!.sectionArea).not.toBeCloseTo(before, 6)
    // а у звичайного шаблону вимірів нема
    ws.destroy()
    ws = new window.NMT3D.Workspace(host, 'cube') as Nmt3dWorkspace
    expect(ws.measures).toBeNull()
  })

  it('INV-SEC-9: curves мають семантичні ролі (ring/silhouette) у тіл обертання', () => {
    for (const [key, expectRing] of [['cylinder', true], ['cone', true], ['frustumCone', true], ['sphere', false]] as const) {
      ws = new window.NMT3D.Workspace(host, key) as Nmt3dWorkspace
      const fr = grabFrame(ws)
      expect(fr.kind, key).toBe('curved')
      const roles = new Set(fr.curves.map(c => c.role))
      expect(roles.has('silhouette'), `${key}: silhouette`).toBe(true)
      expect(roles.has('ring'), `${key}: ring`).toBe(expectRing)
      for (const c of fr.curves) expect(['ring', 'silhouette']).toContain(c.role)
      ws.destroy()
      ws = null
    }
  })

  it('INV-SEC-6: verticesLabel дає K-мітки лише для не-опорних вершин', () => {
    ws = new window.NMT3D.Workspace(host, 'pyramid4Section3') as Nmt3dWorkspace
    let frame: Nmt3dFrame | null = null
    ws.frameSink = (f) => { frame = f }
    ws.setOpt('verticesLabel', true)
    const labels = (frame! as Nmt3dFrame).labels.map(l => l.text)
    // 5 вершин перерізу, 3 опорні (P,Q,R) → рівно 2 K-мітки
    expect(labels.filter(t => t.startsWith('K'))).toEqual(['K1', 'K2'])
    expect(labels).toEqual(expect.arrayContaining(['P', 'Q', 'R', 'S']))
  })
})
