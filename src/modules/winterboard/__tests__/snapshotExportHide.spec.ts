/**
 * Знімок для експорту НЕ несе службового керування віджета.
 *
 * Issue власника 2026-08-09: у презентацію їхали підказки драга
 * («Drag A/B/D · C = D + (B−A) авто») — у статичній картинці вони
 * пояснюють дію, якої там не існує.
 *
 * Перевіряємо сам контракт вирізання (селектор + те, що ріжеться КОПІЯ,
 * а не живий DOM), без запуску html2canvas/Image — це jsdom.
 */
import { describe, it, expect } from 'vitest'
import { EXPORT_HIDE_SELECTOR } from '../utils/snapshotElement'

const SVG_NS = 'http://www.w3.org/2000/svg'

describe('EXPORT_HIDE_SELECTOR', () => {
  it('ловить явну позначку data-export-hide', () => {
    const root = document.createElement('div')
    root.innerHTML = '<span data-export-hide>підказка</span><span>фігура</span>'
    expect(root.querySelectorAll(EXPORT_HIDE_SELECTOR)).toHaveLength(1)
  })

  it('ловить наявні контроли GeoMASH (hint і контекстне меню)', () => {
    const root = document.createElement('div')
    root.innerHTML = '<div class="gm-hint">Drag A/B/D</div><div class="gm-ctx">меню</div><canvas></canvas>'
    expect(root.querySelectorAll(EXPORT_HIDE_SELECTOR)).toHaveLength(2)
  })

  it('не чіпає сам вміст сцени', () => {
    const root = document.createElement('div')
    root.innerHTML = '<canvas></canvas><svg><path d="M0 0"/></svg><div class="gm-stage"></div>'
    expect(root.querySelectorAll(EXPORT_HIDE_SELECTOR)).toHaveLength(0)
  })

  it('вирізання з клону SVG лишає живу сцену недоторканою', () => {
    // Дзеркало snapshotSvg: ріжемо копію, оригінал на дошці має вижити.
    const svg = document.createElementNS(SVG_NS, 'svg')
    const hint = document.createElementNS(SVG_NS, 'g')
    hint.setAttribute('data-export-hide', '')
    const figure = document.createElementNS(SVG_NS, 'path')
    svg.appendChild(hint)
    svg.appendChild(figure)

    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.querySelectorAll(EXPORT_HIDE_SELECTOR).forEach((el) => el.remove())

    expect(clone.querySelectorAll(EXPORT_HIDE_SELECTOR)).toHaveLength(0)
    expect(clone.querySelector('path')).not.toBeNull()   // фігура лишилась
    expect(svg.querySelectorAll('[data-export-hide]')).toHaveLength(1)  // жива сцена ціла
  })
})
