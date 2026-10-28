/**
 * 3D-тіло на масштабі дошки (рев'ю Лови 2026-10-28, «миша на різних масштабах»). РЕАЛЬНИЙ рушій.
 *
 * Сцена малюється в пікселях картки, а дошка зменшує картку обгорткою scale(масштаб):
 *  - ручка йде за курсором: той самий рух на екрані змінює параметр у 1/масштаб разів сильніше
 *    (тіло на екрані в стільки ж разів менше);
 *  - обертання — за рухом миші на екрані: на 18 % той самий жест повертає тіло так само, як на 100 %
 *    (на стенді до правки — у 5 разів сильніше).
 */
import { afterEach, describe, expect, it } from 'vitest'
import '../vendor/nmt3d/nmt-templates.js'
import '../vendor/nmt3d/nmt-3d.js'
import type { Nmt3dWorkspace } from '../vendor/nmt3d'

const CARD_W = 680
const CARD_H = 500
const hosts: HTMLElement[] = []

function hostAt(zoom: number): HTMLElement {
  const el = document.createElement('div')
  Object.defineProperty(el, 'clientWidth', { get: () => CARD_W })
  Object.defineProperty(el, 'clientHeight', { get: () => CARD_H })
  el.getBoundingClientRect = () =>
    ({ width: CARD_W * zoom, height: CARD_H * zoom, left: 0, top: 0, right: CARD_W * zoom, bottom: CARD_H * zoom,
      x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  el.setPointerCapture = () => {}
  document.body.appendChild(el)
  hosts.push(el)
  return el
}

type Ws = Nmt3dWorkspace & { cam: { yaw: number; pitch: number }; params: Record<string, number> }

function workspace(zoom: number): { ws: Ws; host: HTMLElement } {
  const host = hostAt(zoom)
  const ws = new window.NMT3D.Workspace(host, 'cuboid') as unknown as Ws
  return { ws, host }
}

function drag(target: Element, host: HTMLElement, from: [number, number], to: [number, number]) {
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: from[0], clientY: from[1], pointerId: 1 }))
  host.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: to[0], clientY: to[1], pointerId: 1 }))
  host.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: to[0], clientY: to[1], pointerId: 1 }))
}

afterEach(() => { hosts.splice(0).forEach((h) => h.remove()) })

describe('3D-тіло на масштабі дошки — миша', () => {
  it('сцена — у пікселях картки за будь-якого масштабу', () => {
    for (const zoom of [0.1, 0.6, 1, 1.5]) {
      const { ws, host } = workspace(zoom)
      expect(host.querySelector('.nmt3-svg-layer svg')!.getAttribute('viewBox')).toBe(`0 0 ${CARD_W} ${CARD_H}`)
      ws.destroy()
    }
  })

  it('обертання: той самий жест на екрані — той самий кут на 18 % і на 100 %', () => {
    const turn = (zoom: number) => {
      const { ws, host } = workspace(zoom)
      const yaw0 = ws.cam.yaw
      drag(host, host, [5, 5], [34, 5])
      const d = ws.cam.yaw - yaw0
      ws.destroy()
      return d
    }
    expect(turn(1)).toBeCloseTo(29 * 0.012, 6)
    expect(turn(0.18)).toBeCloseTo(29 * 0.012, 6)
  })

  it('ручка: рух на екрані d при масштабі z = рух d/z при 100 % (ручка йде за курсором)', () => {
    const pull = (zoom: number, screenPx: number) => {
      const { ws, host } = workspace(zoom)
      const handle = host.querySelector('.nmt3-handle')!
      const key = Object.keys(ws.params)
      const before = { ...ws.params }
      drag(handle, host, [100, 100], [100, 100 - screenPx])
      const delta = key.map((k) => ws.params[k] - before[k])
      ws.destroy()
      return delta
    }
    const at100 = pull(1, 20)
    const at25 = pull(0.25, 5)
    expect(at100.some((d) => Math.abs(d) > 1e-6)).toBe(true)
    at100.forEach((d, i) => expect(at25[i]).toBeCloseTo(d, 6))
  })
})
