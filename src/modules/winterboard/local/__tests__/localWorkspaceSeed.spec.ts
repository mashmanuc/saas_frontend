// Local Workspace seed v2 — тести «подарунка» (6 сторінок-вітрина) і, головне,
// захисту роботи користувача при м'якому апгрейді вітрини.

import { describe, it, expect } from 'vitest'
import type { WBWorkspaceState } from '../../types/winterboard'
import {
  buildLocalWelcomeState,
  computeSeedDigest,
  matchesLegacySeedLayout,
  type LocalSeedTexts,
} from '../localWorkspaceSeed'

const TEXTS: LocalSeedTexts = {
  title: 'Заголовок',
  hint: 'Підказка',
  pageTry: 'Спробуй',
  pageTrig: 'Тригонометрія',
  pageCalculus: 'Похідна та інтеграл',
  pageGeometry: 'Геометрія',
  captionTrig: 'Підпис тригонометрії',
  captionCalculus: 'Підпис аналізу',
  captionGeometry: 'Підпис геометрії',
  pageStereo: 'Стереометрія',
  page3d: '3D-функції',
  captionStereo: 'Підпис стереометрії',
  caption3d: 'Підпис 3D',
  descCubeSection: 'Опис перерізу',
  descSphereInCube: 'Опис кулі в кубі',
  descCylInCone: 'Опис циліндра',
  descSurface: 'Опис поверхні',
  descCurve: 'Опис кривої',
  pageMaterials: 'Матеріали',
  captionMaterials: 'Підпис матеріалів',
  descWorksheet: 'Опис аркуша',
  descPairTrig: 'Опис пари: коло',
  descPairSphere: 'Опис пари: куля',
  sheetUrls: ['/demo/sheet-uk-1.svg', '/demo/sheet-uk-2.svg',
              '/demo/sheet-uk-3.svg', '/demo/sheet-uk-4.svg'],
  descDeck: 'Опис презентації',
  deckUrls: ['/demo/slides-uk-1.svg', '/demo/slides-uk-2.svg', '/demo/slides-uk-3.svg'],
}

/** Відбиток НЕторканого seed v1 (одна сторінка: 2 тексти + парабола + піраміда). */
function seedV1State(): WBWorkspaceState {
  return {
    pages: [
      {
        id: 'p1',
        name: 'Page 1',
        background: 'white',
        backgroundColor: '#cdf9d0',
        strokes: [
          { id: 't1', tool: 'text', color: '#0f172a', size: 44, opacity: 1, points: [{ x: 140, y: 110 }], text: 'A' },
          { id: 't2', tool: 'text', color: '#475569', size: 24, opacity: 1, points: [{ x: 140, y: 185 }], text: 'B' },
        ],
        assets: [
          { id: 'a1', type: 'graph_calculator' },
          { id: 'a2', type: 'nmt3d' },
        ],
      },
    ],
    currentPageIndex: 0,
  } as unknown as WBWorkspaceState
}

describe('buildLocalWelcomeState — вітрина v2', () => {
  it('будує 7 тематичних сторінок з переданими назвами', () => {
    const state = buildLocalWelcomeState(TEXTS)
    expect(state.pages).toHaveLength(7)
    expect(state.pages.map((p) => p.name)).toEqual([
      'Спробуй', 'Тригонометрія', 'Похідна та інтеграл', 'Геометрія', 'Стереометрія',
      '3D-функції', 'Матеріали',
    ])
    expect(state.currentPageIndex).toBe(0)
  })

  it('стор. «Матеріали»: аркуш гортається і не тягне бекенд', () => {
    const state = buildLocalWelcomeState(TEXTS)
    const viewers = state.pages[6].assets.filter((a) => a.type === 'document_viewer')
    const sheet = viewers[0]
    // Сторінки — статичні файли з public/demo, по порядку.
    expect(sheet.pages?.map((p) => p.url)).toEqual(TEXTS.sheetUrls)
    expect(sheet.pages?.map((p) => p.index)).toEqual([0, 1, 2, 3])
    expect(sheet.src).toBe(TEXTS.sheetUrls[0])
    expect(sheet.currentPage).toBe(0)
    // totalPages — межа гортання; без неї аркуш стоїть на першій сторінці.
    expect(sheet.totalPages).toBe(4)
    // Вид документа оголошений, але БЕЗ content_id: запису в бекенді за цим
    // об'єктом нема, і переглядач не повинен іти по сторінки в API.
    expect(sheet.content_ref?.content_type).toBe('pdf')
    expect(sheet.content_ref?.content_id).toBeUndefined()
  })

  it('стор. «Матеріали»: презентація — окремий переглядач на 3 слайди', () => {
    const state = buildLocalWelcomeState(TEXTS)
    const deck = state.pages[6].assets.filter((a) => a.type === 'document_viewer')[1]
    expect(deck.pages?.map((p) => p.url)).toEqual(TEXTS.deckUrls)
    expect(deck.totalPages).toBe(3)
    // Саме 'presentation' — від цього залежить підпис у шапці й пропорції.
    expect(deck.content_ref?.content_type).toBe('presentation')
    expect(deck.content_ref?.content_id).toBeUndefined()
  })

  it('стор. «Матеріали»: поруч із аркушем стоять саме його пари', () => {
    const state = buildLocalWelcomeState(TEXTS)
    const types = state.pages[6].assets.map((a) => a.type).sort()
    // Задача 1 аркуша → коло + слайди з методом; задача 4 → куля в кубі.
    expect(types).toEqual(['document_viewer', 'document_viewer', 'nmt3d', 'trig_circle'])
  })

  it('стор. «Матеріали»: усе вміщається в сторінку 1920×1080', () => {
    // Попередня версія ставила nmt3d на x=1300 при ширині 680 — правий край
    // 1980 вилазив за сторінку. Тест ловить саме це.
    const materials = buildLocalWelcomeState(TEXTS).pages[6]
    for (const a of materials.assets) {
      expect(a.x + a.w, `${a.type} правий край`).toBeLessThanOrEqual(1920)
      expect(a.y + a.h, `${a.type} нижній край`).toBeLessThanOrEqual(1080)
      expect(a.x).toBeGreaterThanOrEqual(0)
      expect(a.y).toBeGreaterThanOrEqual(0)
    }
  })

  it('об’єкти сторінки «Матеріали» не налазять один на одного', () => {
    const assets = buildLocalWelcomeState(TEXTS).pages[6].assets
    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        const a = assets[i], b = assets[j]
        const overlaps = a.x < b.x + b.w && b.x < a.x + a.w
                      && a.y < b.y + b.h && b.y < a.y + a.h
        expect(overlaps, `${a.type} × ${b.type}`).toBe(false)
      }
    }
  })

  it('кожна сторінка має об’єкти', () => {
    const state = buildLocalWelcomeState(TEXTS)
    for (const page of state.pages) {
      expect(page.assets.length).toBeGreaterThan(0)
    }
  })

  it('НЕ вживає застарілий geometry_solid (немає в панелі вставки)', () => {
    const solids = buildLocalWelcomeState(TEXTS)
      .pages.flatMap((p) => p.assets)
      .filter((a) => a.type === 'geometry_solid')
    expect(solids).toHaveLength(0)
  })

  it('WebGL-бюджет: не більше двох graphmash_3d (THREE.WebGLRenderer)', () => {
    const g3d = buildLocalWelcomeState(TEXTS)
      .pages.flatMap((p) => p.assets)
      .filter((a) => a.type === 'graphmash_3d')
    expect(g3d.length).toBeLessThanOrEqual(2)
    expect(g3d.length).toBeGreaterThan(0)
  })

  it('ідентифікатори унікальні (сторінки, штрихи, об’єкти)', () => {
    const state = buildLocalWelcomeState(TEXTS)
    const ids = [
      ...state.pages.map((p) => p.id),
      ...state.pages.flatMap((p) => p.strokes.map((s) => s.id)),
      ...state.pages.flatMap((p) => p.assets.map((a) => a.id)),
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('графіки задані у явній формі y=… (інакше парсер не будує криву)', () => {
    const exprs = buildLocalWelcomeState(TEXTS)
      .pages.flatMap((p) => p.assets)
      .filter((a) => a.type === 'graph_calculator')
      .flatMap((a) => ((a.data as { state?: { expressions?: { src: string }[] } })?.state?.expressions ?? []))
    expect(exprs.length).toBeGreaterThan(0)
    for (const e of exprs) expect(e.src).toMatch(/^y=/)
  })
})

describe('computeSeedDigest — пломба вітрини', () => {
  it('однаковий вміст → однаковий відбиток', () => {
    expect(computeSeedDigest(buildLocalWelcomeState(TEXTS)))
      .toBe(computeSeedDigest(buildLocalWelcomeState(TEXTS)))
  })

  it('НЕ залежить від випадкових id (інакше пломба ніколи б не збігалась)', () => {
    const a = buildLocalWelcomeState(TEXTS)
    const b = buildLocalWelcomeState(TEXTS)
    expect(a.pages[0].id).not.toBe(b.pages[0].id)
    expect(computeSeedDigest(a)).toBe(computeSeedDigest(b))
  })

  it('домальований штрих → інший відбиток (робота людини помітна)', () => {
    const s = buildLocalWelcomeState(TEXTS)
    const before = computeSeedDigest(s)
    s.pages[0].strokes.push({
      id: 'user', tool: 'pen', color: '#f00', size: 4, opacity: 1,
      points: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
    } as unknown as (typeof s.pages)[0]['strokes'][0])
    expect(computeSeedDigest(s)).not.toBe(before)
  })

  it('доданий об’єкт → інший відбиток', () => {
    const s = buildLocalWelcomeState(TEXTS)
    const before = computeSeedDigest(s)
    s.pages[0].assets.push({ id: 'x', type: 'trig_circle', x: 0, y: 0, w: 10, h: 10 } as unknown as (typeof s.pages)[0]['assets'][0])
    expect(computeSeedDigest(s)).not.toBe(before)
  })

  it('пересунутий об’єкт → інший відбиток', () => {
    const s = buildLocalWelcomeState(TEXTS)
    const before = computeSeedDigest(s)
    s.pages[0].assets[0].x += 50
    expect(computeSeedDigest(s)).not.toBe(before)
  })

  it('інша мова текстів → інший відбиток (звідси й перемальовування)', () => {
    const en = buildLocalWelcomeState({ ...TEXTS, pageTry: 'Try it', captionTrig: 'Trigonometry' })
    expect(computeSeedDigest(en)).not.toBe(computeSeedDigest(buildLocalWelcomeState(TEXTS)))
  })

  // Реальний випадок 2026-09-04: у власника на диску лежала вітрина, знята з
  // недоробленої версії — рамка документа на місці, а сторінок у ній нема.
  // Відбиток рахувався лише з геометрії, тому свіжа вітрина виглядала
  // ТОТОЖНОЮ старій, перемальовування не спрацьовувало, і людина назавжди
  // лишалась із порожньою рамкою. Відбиток мусить бачити й джерело вмісту.
  it('зниклі сторінки документа → інший відбиток (інакше стара вітрина вічна)', () => {
    const full = buildLocalWelcomeState(TEXTS)
    const stripped = buildLocalWelcomeState(TEXTS)
    for (const p of stripped.pages) {
      for (const a of p.assets) {
        if (a.type === 'document_viewer') delete (a as { pages?: unknown }).pages
      }
    }
    expect(computeSeedDigest(stripped)).not.toBe(computeSeedDigest(full))
  })

  it('інший файл у переглядачі → інший відбиток (та сама рамка, інший вміст)', () => {
    const a = buildLocalWelcomeState(TEXTS)
    const b = buildLocalWelcomeState({
      ...TEXTS,
      sheetUrls: ['/demo/sheet-en-1.svg', '/demo/sheet-en-2.svg',
                  '/demo/sheet-en-3.svg', '/demo/sheet-en-4.svg'],
    })
    expect(computeSeedDigest(a)).not.toBe(computeSeedDigest(b))
  })

  it('стійкий до порожнього / некоректного стану', () => {
    expect(computeSeedDigest(null)).toBe('')
    expect(computeSeedDigest(undefined)).toBe('')
  })
})

describe('matchesLegacySeedLayout — міграція старих браузерів', () => {
  it('впізнає вітрину v1 (одна сторінка)', () => {
    expect(matchesLegacySeedLayout(seedV1State())).toBe(true)
  })

  it('впізнає вітрину v2 (чотири сторінки з застарілим конусом)', () => {
    const v2 = {
      pages: [
        { id:'p1', name:'', strokes:[], assets:[{type:'graph_calculator'},{type:'nmt3d'},{type:'quadratic_card'}] },
        { id:'p2', name:'', strokes:[], assets:[{type:'trig_circle'},{type:'trig_solver'},{type:'graph_calculator'}] },
        { id:'p3', name:'', strokes:[], assets:[{type:'calculus_card'},{type:'calculus_card'},{type:'graph_calculator'}] },
        { id:'p4', name:'', strokes:[], assets:[{type:'geometry_2d_v2'},{type:'geometry_2d_v2'},{type:'geometry_solid'}] },
      ],
      currentPageIndex: 0,
    } as unknown as WBWorkspaceState
    expect(matchesLegacySeedLayout(v2)).toBe(true)
  })

  it('НЕ впізнає дошку, де людина малювала', () => {
    const s = seedV1State()
    s.pages[0].strokes.push({
      id: 'user', tool: 'pen', color: '#f00', size: 4, opacity: 1,
      points: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
    } as unknown as (typeof s.pages)[0]['strokes'][0])
    expect(matchesLegacySeedLayout(s)).toBe(false)
  })
})
