/**
 * ТЗ «Числова пряма — KaTeX» §4.3: віджет із формулами KaTeX (HTML) поверх рисунка SVG знімається
 * гілкою DOM (html2canvas + MathJax v2), а не SVG — інакше формули зникли б з PDF. Позначка
 * загальна (`data-export-dom`, як `data-export-hide`): назв і логіки віджетів у snapshotElement немає.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import { FONT_PROBE_STYLE_ATTR, HTML2CANVAS_PROBE_SRC, domExportScale, fixFontProbe, snapshotBranch, snapshotElement } from '../utils/snapshotElement'

// html2canvas у happy-dom не малює — підміняємо: запамʼятовуємо, що було в документі в момент виклику.
const h2c = vi.hoisted(() => ({ calls: [] as Array<{ probe: boolean; scale: number }> }))
vi.mock('html2canvas', () => ({
  default: async (_el: HTMLElement, opts: { scale: number }) => {
    h2c.calls.push({ probe: !!document.head.querySelector('style[data-snapshot-font-probe]'), scale: opts.scale })
    return { width: 600, height: 270, toBlob: (cb: (b: Blob) => void) => cb(new Blob(['png'])) }
  },
}))

function rootWithPrimarySvg(): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = '<svg width="600" height="270"></svg><div class="katex">x</div>'
  const rect = (w: number, h: number) => ({ width: w, height: h, top: 0, left: 0, right: w, bottom: h, x: 0, y: 0, toJSON() {} }) as DOMRect
  root.getBoundingClientRect = () => rect(300, 135)
  ;(root.querySelector('svg') as SVGSVGElement).getBoundingClientRect = () => rect(300, 135)
  return root
}

describe('snapshotBranch — позначка data-export-dom', () => {
  it('без позначки великий SVG іде гілкою SVG (як було)', () => {
    expect(snapshotBranch(rootWithPrimarySvg())).toBe('svg')
  })

  it('з позначкою — гілкою DOM, хоч SVG і займає весь віджет', () => {
    const root = rootWithPrimarySvg()
    root.setAttribute('data-export-dom', '')
    expect(snapshotBranch(root)).toBe('dom')
  })
})

describe('domExportScale — знімок не дрібніє з масштабом дошки', () => {
  const el = (w?: string) => {
    const d = document.createElement('div')
    if (w !== undefined) d.setAttribute('data-export-width', w)
    return d
  }
  it('без атрибута — 1 (як було)', () => expect(domExportScale(el(), 276)).toBe(1))
  it('картка дрібна на екрані — дотягує до логічної ширини', () => expect(domExportScale(el('600'), 300)).toBe(2))
  it('картка вже більша — не зменшуємо', () => expect(domExportScale(el('600'), 900)).toBe(1))
  it('не більше ×4', () => expect(domExportScale(el('600'), 50)).toBe(4))
  it('сміття в атрибуті — 1', () => expect(domExportScale(el('abc'), 300)).toBe(1))
})

describe('fixFontProbe — текст DOM-знімка на своїй базовій лінії', () => {
  it('картинка-зонд — та сама, що в html2canvas (інакше правило нічого не лагодить)', () => {
    const src = readFileSync(createRequire(import.meta.url).resolve('html2canvas/dist/html2canvas.esm.js'), 'utf8')
    expect(src).toContain(`var SMALL_IMAGE = '${HTML2CANVAS_PROBE_SRC}'`)
  })

  it('на час знімка — рядкова картинка-зонд, після — правила немає', () => {
    const restore = fixFontProbe(document)
    const style = document.head.querySelector(`style[${FONT_PROBE_STYLE_ATTR}]`)
    expect(style?.textContent).toBe(`img[src="${HTML2CANVAS_PROBE_SRC}"] { display: inline !important; }`)
    restore()
    expect(document.head.querySelector(`style[${FONT_PROBE_STYLE_ATTR}]`)).toBeNull()
  })

  it('snapshotElement (гілка DOM) знімає з зондом і прибирає його після', async () => {
    const root = rootWithPrimarySvg()
    root.innerHTML = '<svg width="600" height="270"></svg>'
    root.setAttribute('data-export-dom', '')
    root.setAttribute('data-export-width', '1200')
    h2c.calls.length = 0
    const r = await snapshotElement(root, new AbortController().signal)
    expect(r).not.toBeNull()
    expect(h2c.calls).toEqual([{ probe: true, scale: 4 }])
    expect(document.head.querySelector(`style[${FONT_PROBE_STYLE_ATTR}]`)).toBeNull()
  })
})
