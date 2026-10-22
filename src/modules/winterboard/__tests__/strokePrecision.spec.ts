/**
 * Легші штрихи (власник 2026-10-17): точки нового штриха — до сотих, натиск — до тисячних,
 * час `t` — без змін. Оком не видно, стан дошки легший приблизно на третину.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { roundStrokePoint, roundStrokePoints } from '../engine/strokePrecision'
import type { WBPoint } from '../types/winterboard'

// Справжня точка з дошки власника 16.10 (5 сторінок рукопису планшетом).
const REAL: WBPoint = { t: 1792175481747, x: 97.77804461761923, y: 67.68753665846491, pressure: 0.1904296875 }

describe('roundStrokePoint', () => {
  it('координати — до сотих, натиск — до тисячних, час — як був', () => {
    expect(roundStrokePoint(REAL)).toEqual({ t: 1792175481747, x: 97.78, y: 67.69, pressure: 0.19 })
    expect(roundStrokePoint({ x: 1.2345, y: -0.004, pressure: 0.7777 })).toEqual({ x: 1.23, y: -0, pressure: 0.778 })
  })

  it('JSON коротший: 87 знаків → 55, числа без «хвостів» на кшталт 0.30000000000000004', () => {
    expect(JSON.stringify(REAL)).toHaveLength(87)
    expect(JSON.stringify(roundStrokePoint(REAL))).toBe('{"t":1792175481747,"x":97.78,"y":67.69,"pressure":0.19}')
    for (let i = 0; i < 2000; i++) {
      const p = roundStrokePoint({ x: Math.random() * 1920, y: Math.random() * 1080, pressure: Math.random() })
      expect(String(p.x)).toMatch(/^-?\d+(\.\d{1,2})?$/)
      expect(String(p.y)).toMatch(/^-?\d+(\.\d{1,2})?$/)
      expect(String(p.pressure)).toMatch(/^\d(\.\d{1,3})?$/)
    }
  })

  it('похибка — не більша за пів сотої точки (на ×5 — соті частки пікселя екрана)', () => {
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * 1920
      const y = Math.random() * 1080
      const r = roundStrokePoint({ x, y })
      expect(Math.abs(r.x - x)).toBeLessThanOrEqual(0.005 + 1e-9)
      expect(Math.abs(r.y - y)).toBeLessThanOrEqual(0.005 + 1e-9)
    }
  })

  it('миша (натиск рівно 0.5) лишається 0.5; без натиску — поля не з\'являється', () => {
    expect(roundStrokePoint({ x: 1, y: 2, pressure: 0.5 }).pressure).toBe(0.5)
    expect('pressure' in roundStrokePoint({ x: 1, y: 2 })).toBe(false)
  })

  it('вхід не змінюється (новий масив і нові точки)', () => {
    const pts = [{ ...REAL }]
    const out = roundStrokePoints(pts)
    expect(pts[0].x).toBe(REAL.x)
    expect(out[0]).not.toBe(pts[0])
  })

  it('рукописний штрих планшетом стає легшим щонайменше на третину', () => {
    const pts: WBPoint[] = []
    let x = 412.31791, y = 233.90127
    for (let i = 0; i < 120; i++) {
      x += 1.3 + Math.sin(i / 7) * 2.17
      y += Math.cos(i / 5) * 1.91
      pts.push({ t: 1792175481747 + i * 8, x, y, pressure: 0.3 + 0.2 * Math.abs(Math.sin(i / 11)) + 1e-7 })
    }
    const before = JSON.stringify(pts).length
    const after = JSON.stringify(roundStrokePoints(pts)).length
    expect(after / before).toBeLessThan(0.67)
  })
})

describe('WBCanvas — округлює лише новий штрих, перед відправленням', () => {
  const src = readFileSync(resolve(__dirname, '../components/canvas/WBCanvas.vue'), 'utf-8')
  it('у handleMouseUp точки округлено одразу перед emit(\'stroke-add\')', () => {
    expect(src).toMatch(/stroke\.points = roundStrokePoints\(stroke\.points\)\s*\n\s*\n\s*emit\('stroke-add', stroke\)/)
  })
  it('точку з сервера чи чужого штриха не чіпає: округлення лише там, де народжується новий штрих', () => {
    // Два місця, обидва — свіжий штрих перед emit('stroke-add'): перо (handleMouseUp) і дуга циркуля
    // (endCompassGesture, 2026-10-22). Третє місце — сигнал, що округлюють чужі чи серверні точки.
    expect(src.match(/roundStrokePoints\(/g)).toHaveLength(2)
    const compass = src.slice(src.indexOf('function endCompassGesture'), src.indexOf('// ─── Background layer cache'))
    expect(compass).toMatch(/emit\('stroke-add', \{[\s\S]*?points: roundStrokePoints\(g\.arc\.map/)
  })
})
