/**
 * ТЗ «Числова пряма — KaTeX» §4.3: віджет із формулами KaTeX (HTML) поверх рисунка SVG знімається
 * гілкою DOM (html2canvas + MathJax v2), а не SVG — інакше формули зникли б з PDF. Позначка
 * загальна (`data-export-dom`, як `data-export-hide`): назв і логіки віджетів у snapshotElement немає.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import { EXPORT_MATH_CLASS, FONT_PROBE_STYLE_ATTR, HTML2CANVAS_PROBE_SRC, domExportScale, fitExportRows, fitMathToContainers, fixFontProbe, settleMathJaxSvg, snapshotBranch, snapshotElement, fitScrollWindows, trimScrollEdges } from '../utils/snapshotElement'

// html2canvas у happy-dom не малює — підміняємо: запамʼятовуємо, що було в документі в момент виклику.
const h2c = vi.hoisted(() => ({ calls: [] as Array<{ probe: boolean; scale: number }>, sizes: [] as Array<[number, number]> }))
// MathJax у happy-dom не вантажиться — віддаємо готовий контейнер.
vi.mock('../../learning-content/utils/contentRendererMathJaxV2', () => ({
  renderLatexToSvgV2: async () => '<mjx-container jax="SVG" style="vertical-align: -0.186ex;"><svg width="2.891ex" height="1.69ex" style="vertical-align: -0.186ex;"></svg><mjx-assistive-mml>−3</mjx-assistive-mml></mjx-container>',
}))
vi.mock('html2canvas', () => ({
  default: async (el: HTMLElement, opts: { scale: number; width: number; height: number; onclone?: (d: Document, e: HTMLElement) => void }) => {
    h2c.calls.push({ probe: !!document.head.querySelector('style[data-snapshot-font-probe]'), scale: opts.scale })
    h2c.sizes.push([opts.width, opts.height])
    // Клон — сам корінь (happy-dom не малює): перевіряємо, що зробив onclone.
    opts.onclone?.(document, el)
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

describe('fitExportRows — рядок формули у PDF не виходить за рамку (рев\'ю Феї, блокер)', () => {
  // happy-dom не верстає: розміри — як у знімку після MathJax (гліфи ширші й вищі за KaTeX).
  function row(width: number, mathHeight: number, maxW = 540, maxH = 38): HTMLElement {
    const el = document.createElement('span')
    el.setAttribute('data-export-fit-width', String(maxW))
    el.setAttribute('data-export-fit-height', String(maxH))
    el.style.transform = 'scale(0.97)' // підгонка з екрана (за KaTeX) — у знімку не годиться
    el.innerHTML = '<mjx-container><svg></svg></mjx-container>'
    Object.defineProperty(el, 'offsetWidth', { value: width })
    const svg = el.querySelector('svg') as SVGSVGElement
    svg.getBoundingClientRect = () => ({ width: 0, height: mathHeight, top: 0, left: 0, right: 0, bottom: mathHeight, x: 0, y: 0, toJSON() {} }) as DOMRect
    return el
  }

  it('довга відповідь із 7 проміжків: ширина ≤ рамки HUD', () => {
    const root = document.createElement('div')
    const ans = row(700, 20, 540, 23)
    root.append(ans)
    fitExportRows(root)
    expect(ans.style.transform).toBe(`scale(${540 / 700})`)
    expect(700 * (540 / 700)).toBeLessThanOrEqual(540)
  })

  it('дріб: висота ≤ рядка, тож не лягає на розділювач', () => {
    const root = document.createElement('div')
    const f = row(300, 60)
    root.append(f)
    fitExportRows(root)
    expect(f.style.transform).toBe(`scale(${38 / 60})`)
  })

  it('рядок, що вміщується, — без стиску (і без екранного)', () => {
    const root = document.createElement('div')
    const f = row(200, 30)
    root.append(f)
    fitExportRows(root)
    expect(f.style.transform).toBe('none')
  })

  it('snapshotElement: у клоні MathJax поза .katex (без CSS KaTeX) і рядок підігнано за ним', async () => {
    const root = rootWithPrimarySvg()
    root.innerHTML = '<svg width="600" height="270"></svg>'
    root.setAttribute('data-export-dom', '')
    const r = row(1080, 20, 540, 23)
    r.innerHTML = '<span class="katex"><annotation encoding="application/x-tex">x \\in (-\\infty; -6)</annotation></span>'
    root.append(r)
    const host = r.querySelector('.katex') as HTMLElement
    Object.defineProperty(r, 'offsetWidth', { value: 1080 })
    const res = await snapshotElement(root, new AbortController().signal)
    expect(res).not.toBeNull()
    expect(host.className).toBe(EXPORT_MATH_CLASS)
    expect(host.querySelector('mjx-container')).not.toBeNull()
    expect(host.querySelector('mjx-assistive-mml')).toBeNull()
    expect((host.querySelector('mjx-container > svg') as SVGSVGElement).style.display).toBe('inline')
    expect((host.querySelector('mjx-container > svg') as SVGSVGElement).getAttribute('width')).toBe('1.4455em')
    expect(r.style.transform).toBe('scale(0.5)')
  })
})

describe('fitMathToContainers — формула у PDF не ширша за свою клітинку (рев\'ю Феї, задача НМТ)', () => {
  // happy-dom не верстає: прямокутники — як у знімку (формула MathJax одним SVG, без переносу).
  const rect = (left: number, width: number) => ({ width, height: 20, top: 0, left, right: left + width, bottom: 20, x: left, y: 0, toJSON() {} }) as DOMRect
  /** Клітинка варіанта (cellW, відступ праворуч pad, масштаб дошки zoom) → текст варіанта → формула. */
  function cell(cellW: number, mathLeft: number, mathW: number, opts: { pad?: number; zoom?: number; fitRow?: boolean } = {}) {
    const zoom = opts.zoom ?? 1
    const root = document.createElement('div')
    document.body.append(root) // обчислені стилі (відступ) — лише в документі
    root.innerHTML = `<div class="cell"><span class="text"${opts.fitRow ? ' data-export-fit-width="540"' : ''}><span class="${EXPORT_MATH_CLASS}"><mjx-container><svg width="10em" height="1.2em" style="vertical-align: -0.2em"></svg></mjx-container></span></span></div>`
    const c = root.querySelector('.cell') as HTMLElement
    const text = root.querySelector('.text') as HTMLElement
    const host = root.querySelector(`.${EXPORT_MATH_CLASS}`) as HTMLElement
    if (opts.pad) c.style.paddingRight = `${opts.pad}px`
    Object.defineProperty(c, 'offsetWidth', { value: cellW })
    root.getBoundingClientRect = () => rect(0, 1000 * zoom)
    c.getBoundingClientRect = () => rect(0, cellW * zoom)
    // Текст варіанта росте разом із формулою — межі не дає.
    text.getBoundingClientRect = () => rect(mathLeft * zoom, mathW * zoom)
    host.getBoundingClientRect = () => rect(mathLeft * zoom, mathW * zoom)
    return { root, svg: host.querySelector('svg') as SVGSVGElement }
  }

  it('варіант `x ∈ [1; 50)` ширший за клітинку → стиснуто рівно до клітинки', () => {
    const { root, svg } = cell(120, 10, 160)
    fitMathToContainers(root)
    expect(svg.getAttribute('width')).toBe(`${10 * (110 / 160)}em`)
    expect(svg.getAttribute('height')).toBe(`${1.2 * (110 / 160)}em`)
    expect(svg.style.verticalAlign).toBe(`${-0.2 * (110 / 160)}em`)
  })

  it('відступ клітинки й масштаб дошки враховано', () => {
    const { root, svg } = cell(120, 10, 160, { pad: 10, zoom: 0.5 })
    fitMathToContainers(root)
    expect(svg.getAttribute('width')).toBe(`${10 * (100 / 160)}em`)
  })

  it('формула, що вміщується, — без змін', () => {
    const { root, svg } = cell(200, 10, 160)
    fitMathToContainers(root)
    expect(svg.getAttribute('width')).toBe('10em')
  })

  it('рядок із власною підгонкою (data-export-fit-width) не чіпаємо — його стискає fitExportRows', () => {
    const { root, svg } = cell(120, 10, 160, { fitRow: true })
    fitMathToContainers(root)
    expect(svg.getAttribute('width')).toBe('10em')
  })

  it('snapshotElement: формула отримує колір живого рядка (у картинці currentColor інакше чорний) і підгонку за клітинкою', async () => {
    const root = document.createElement('div')
    document.body.append(root) // колір береться з обчисленого стилю живої формули
    root.innerHTML = '<div class="cell"><span class="katex" style="color: rgb(140, 120, 100)"><annotation encoding="application/x-tex">x \\in [1; 50)</annotation></span></div>'
    root.getBoundingClientRect = () => rect(0, 300)
    const c = root.querySelector('.cell') as HTMLElement
    c.getBoundingClientRect = () => rect(0, 120)
    const host = root.querySelector('.katex') as HTMLElement
    host.getBoundingClientRect = () => rect(10, 160)
    const res = await snapshotElement(root, new AbortController().signal)
    expect(res).not.toBeNull()
    const svg = host.querySelector('mjx-container > svg') as SVGSVGElement
    expect(svg.style.color).toBe('rgb(140, 120, 100)')
    expect(svg.getAttribute('width')).toBe(`${1.4455 * (110 / 160)}em`)
  })
})

describe('settleMathJaxSvg — розмір MathJax не залежить від шрифту сторінки', () => {
  it('ex → em (1ex = 0,5em, як у MathJax), svg рядковий, зсув базової лінії один раз', () => {
    const box = document.createElement('mjx-container')
    box.style.verticalAlign = '-0.186ex'
    box.innerHTML = '<svg width="2.891ex" height="1.69ex" style="vertical-align: -0.186ex; display: block"></svg>'
    const svg = box.querySelector('svg') as SVGSVGElement
    settleMathJaxSvg(svg)
    expect(svg.getAttribute('width')).toBe('1.4455em')
    expect(svg.getAttribute('height')).toBe('0.845em')
    expect(svg.style.verticalAlign).toBe('-0.093em')
    expect(box.style.verticalAlign).toBe('')
    expect(svg.style.display).toBe('inline')
  })

  it('px (уже обмежений великий svg) — без змін', () => {
    const box = document.createElement('mjx-container')
    box.innerHTML = '<svg width="2048" height="300"></svg>'
    const svg = box.querySelector('svg') as SVGSVGElement
    settleMathJaxSvg(svg)
    expect(svg.getAttribute('width')).toBe('2048')
  })
})

// Картка — зменшена копія самої себе (обгортка `scale()`, composables/cardZoom: картка задачі, картка конспекту).
// Стенд 2026-10-21, 1366×768: знімок брав екранний розмір, а html2canvas малював текст повного розміру в зменшеній
// рамці — у PDF каша. Тепер — пікселі картки, а в клоні обгортка без масштабу.
describe('snapshotElement — картка в зменшеній обгортці', () => {
  it('знімає в пікселях картки й розгортає обгортку в клоні', async () => {
    const layer = document.createElement('div')
    layer.className = 'wb-card-zoom'
    layer.style.transform = 'scale(0.5)'
    const root = document.createElement('div')
    root.setAttribute('data-export-dom', '')
    layer.appendChild(root)
    document.body.appendChild(layer)
    Object.defineProperty(root, 'offsetWidth', { value: 890 })
    Object.defineProperty(root, 'offsetHeight', { value: 400 })
    root.getBoundingClientRect = () => ({ width: 445, height: 200, top: 0, left: 0, right: 445, bottom: 200, x: 0, y: 0, toJSON() {} }) as DOMRect
    h2c.sizes.length = 0
    expect(await snapshotElement(root, new AbortController().signal)).not.toBeNull()
    expect(h2c.sizes).toEqual([[890, 400]])
    expect(layer.style.transform).toBe('none')
    layer.remove()
  })

  it('картка без обгортки — екранний розмір, як і було', async () => {
    const root = document.createElement('div')
    root.setAttribute('data-export-dom', '')
    document.body.appendChild(root)
    Object.defineProperty(root, 'offsetWidth', { value: 890 })
    root.getBoundingClientRect = () => ({ width: 445, height: 200, top: 0, left: 0, right: 445, bottom: 200, x: 0, y: 0, toJSON() {} }) as DOMRect
    h2c.sizes.length = 0
    await snapshotElement(root, new AbortController().signal)
    expect(h2c.sizes).toEqual([[445, 200]])
    root.remove()
  })
})

// Рев'ю Лови 2026-10-28 (PDF, сторінки 3/4): нижній рядок розбору у вікні з прокруткою різався рамкою навпіл.
describe('trimScrollEdges — вікно прокрутки у знімку по межі цілого рядка', () => {
  const rect = (top: number, bottom: number) => ({ top, bottom, height: bottom - top, left: 0, right: 300, width: 300, x: 0, y: top, toJSON() {} }) as DOMRect
  // happy-dom не верстає: рядки тексту — за самим текстом (Range.getClientRects), вікно — 70 px з 200 px вмісту.
  function windowOf(lines: Record<string, Array<[number, number]>>, math?: [number, number], scrollHeight = 200) {
    const box = document.createElement('div')
    box.style.overflowY = 'auto'
    box.style.boxSizing = 'border-box'
    box.innerHTML = Object.keys(lines).map(t => `<p>${t}</p>`).join('') + (math ? `<span class="${EXPORT_MATH_CLASS}"><svg></svg></span>` : '')
    document.body.appendChild(box)
    Object.defineProperty(box, 'scrollHeight', { value: scrollHeight })
    Object.defineProperty(box, 'clientHeight', { value: 70 })
    Object.defineProperty(box, 'offsetHeight', { value: 70 })
    box.getBoundingClientRect = () => rect(0, 70)
    if (math) box.querySelector('svg')!.getBoundingClientRect = () => rect(...math)
    let text = ''
    vi.spyOn(document, 'createRange').mockImplementation(() => ({
      selectNodeContents: (n: Node) => { text = n.textContent ?? '' },
      getClientRects: () => (lines[text] ?? []).map(([t, b]) => rect(t, b)),
    }) as unknown as Range)
    return box
  }

  it('рядок перетинає нижній край → вікно закінчується над ним', () => {
    const box = windowOf({ 'перший абзац': [[0, 20], [20, 40]], 'другий абзац': [[40, 60], [60, 80]] })
    trimScrollEdges(box)
    expect(box.style.height).toBe('60px')
    expect(box.style.flex).toBe('0 0 auto')
    box.remove(); vi.restoreAllMocks()
  })

  it('формула вища за свій рядок — ріжемо над формулою', () => {
    const box = windowOf({ 'а тоді': [[58, 78]], 'вище': [[0, 20]] }, [52, 80])
    trimScrollEdges(box)
    expect(box.style.height).toBe('52px')
    box.remove(); vi.restoreAllMocks()
  })

  it('рядок закінчується рівно на краю — вікно без змін', () => {
    const box = windowOf({ 'рядок': [[50, 70]], 'нижче за вікном': [[70, 90]] })
    trimScrollEdges(box)
    expect(box.style.height).toBe('')
    box.remove(); vi.restoreAllMocks()
  })

  it('один елемент вищий за вікно — не ховаємо все', () => {
    const box = windowOf({ 'дуже високий': [[0, 150]] })
    trimScrollEdges(box)
    expect(box.style.height).toBe('')
    box.remove(); vi.restoreAllMocks()
  })

  it('вікно без прокрутки (усе вміщується) — без змін', () => {
    const box = windowOf({ 'рядок': [[60, 80]] }, undefined, 70)
    trimScrollEdges(box)
    expect(box.style.height).toBe('')
    box.remove(); vi.restoreAllMocks()
  })
})

// Стенд 28.10: на екрані розбір вміщувався в картку впритул (вікно без прокрутки), у знімку MathJax трохи вищий
// за KaTeX — і останній рядок виїжджав за край. Що на екрані видно цілком, у знімку теж видно цілком.
describe('fitScrollWindows — вікно, що на екрані показує все, у знімку теж показує все', () => {
  function windowWith(contentH: number, scrollH: number) {
    const box = document.createElement('div')
    box.style.overflowY = 'auto'
    box.style.padding = '12px 0 14px'
    box.innerHTML = '<div class="flow"></div>'
    Object.defineProperty(box, 'clientHeight', { value: 400 })
    Object.defineProperty(box, 'scrollHeight', { value: scrollH })
    Object.defineProperty(box.firstElementChild, 'offsetHeight', { value: contentH })
    document.body.appendChild(box)
    return box
  }
  const flow = (box: HTMLElement) => box.firstElementChild as HTMLElement

  it('на екрані вміщувалось, у знімку на кілька px більше → вміст стиснуто рівно до вікна', () => {
    const box = windowWith(380, 406)
    fitScrollWindows([box], [true])
    expect(flow(box).style.transform).toBe(`scale(${374 / 380})`)
    expect(flow(box).style.transformOrigin).toBe('top left')
    box.remove()
  })

  it('на екрані теж прокручували — не стискаємо (там ріже trimScrollEdges)', () => {
    const box = windowWith(380, 406)
    fitScrollWindows([box], [false])
    expect(flow(box).style.transform).toBe('')
    box.remove()
  })

  it('у знімку вміщується — без змін', () => {
    const box = windowWith(370, 396)
    fitScrollWindows([box], [true])
    expect(flow(box).style.transform).toBe('')
    box.remove()
  })

  it('набагато більше за вікно — не дрібнимо текст', () => {
    const box = windowWith(600, 626)
    fitScrollWindows([box], [true])
    expect(flow(box).style.transform).toBe('')
    box.remove()
  })

  it('вікна клону й екрана не зійшлися — нічого не чіпаємо', () => {
    const box = windowWith(380, 406)
    fitScrollWindows([box], [true, true])
    expect(flow(box).style.transform).toBe('')
    box.remove()
  })
})
