// Local Workspace Phase 3 — тести білдера синтетичних ops для handoff (ТЗ §5).
// Форма ops MUST дзеркалити boardStore._emitPageAddDecomposed:
// page_add (metadata only) → stroke_add per stroke → asset_add per asset.

import { describe, it, expect } from 'vitest'
import { buildHandoffOps } from '../localWorkspaceHandoff'
import type { WBWorkspaceState, WBPage, WBStroke, WBAsset } from '../../types/winterboard'

function makeStroke(id: string): WBStroke {
  return {
    id,
    tool: 'pen',
    color: '#e11d48',
    size: 4,
    opacity: 1,
    points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
  }
}

function makeAsset(id: string, extra?: Partial<WBAsset>): WBAsset {
  return {
    id,
    type: 'graph_calculator',
    src: '',
    x: 0, y: 0, w: 480, h: 360,
    rotation: 0,
    locked: false,
    ...extra,
  } as WBAsset
}

function makePage(id: string, strokes: WBStroke[] = [], assets: WBAsset[] = []): WBPage {
  return {
    id,
    name: `Page ${id}`,
    strokes,
    assets,
    background: 'white',
    backgroundColor: '#cdf9d0',
    width: 1920,
    height: 1080,
  }
}

describe('buildHandoffOps', () => {
  it('порядок: page_add (metadata) → stroke_add → asset_add, всі з page_id', () => {
    const state: WBWorkspaceState = {
      pages: [makePage('p1', [makeStroke('s1'), makeStroke('s2')], [makeAsset('a1')])],
      currentPageIndex: 0,
    }
    const ops = buildHandoffOps(state)
    expect(ops.map(o => o.op_type)).toEqual(['page_add', 'stroke_add', 'stroke_add', 'asset_add'])
    expect(ops.every(o => o.page_id === 'p1')).toBe(true)
  })

  it('page_add несе ЛИШЕ метадані (без strokes/assets — per-op payload cap)', () => {
    const state: WBWorkspaceState = {
      pages: [makePage('p1', [makeStroke('s1')], [makeAsset('a1')])],
      currentPageIndex: 0,
    }
    const pageOp = buildHandoffOps(state)[0]
    const page = pageOp.payload.page as Record<string, unknown>
    expect(page.id).toBe('p1')
    expect(page.backgroundColor).toBe('#cdf9d0')
    expect(page.width).toBe(1920)
    expect('strokes' in page).toBe(false)
    expect('assets' in page).toBe(false)
  })

  it('op_id унікальні та стабільні у межах одного виклику (BE-дедуп при retry)', () => {
    const state: WBWorkspaceState = {
      pages: [makePage('p1', [makeStroke('s1'), makeStroke('s2')], [makeAsset('a1'), makeAsset('a2')])],
      currentPageIndex: 0,
    }
    const ops = buildHandoffOps(state)
    const ids = ops.map(o => o.op_id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every(id => typeof id === 'string' && id.length > 0)).toBe(true)
  })

  it('мультисторінковий стан: ops групуються по сторінках у порядку сторінок', () => {
    const state: WBWorkspaceState = {
      pages: [
        makePage('p1', [makeStroke('s1')]),
        makePage('p2', [], [makeAsset('a1')]),
      ],
      currentPageIndex: 1,
    }
    const ops = buildHandoffOps(state)
    expect(ops.map(o => `${o.op_type}:${o.page_id}`)).toEqual([
      'page_add:p1', 'stroke_add:p1',
      'page_add:p2', 'asset_add:p2',
    ])
  })

  it('гігієна asset-ів: document_viewer.pages стріпається; data:/blob: src → "" + _localOnly', () => {
    // Переглядач із записом у бекенді: їде, але БЕЗ pages[] — у хмарі вони
    // довантажаться за content_id.
    const docViewer = makeAsset('dv1', {
      type: 'document_viewer',
      content_ref: { content_id: 7, content_type: 'pdf' },
      pages: { '0': { thumbnail_url: 'x' } },
    } as unknown as Partial<WBAsset>)
    const dataUrlImage = makeAsset('img1', { type: 'image', src: 'data:image/png;base64,AAAA' } as Partial<WBAsset>)
    const blobImage = makeAsset('img2', { type: 'image', src: 'blob:http://x/123' } as Partial<WBAsset>)
    const normal = makeAsset('a1')

    const state: WBWorkspaceState = {
      pages: [makePage('p1', [], [docViewer, dataUrlImage, blobImage, normal])],
      currentPageIndex: 0,
    }
    const assetOps = buildHandoffOps(state).filter(o => o.op_type === 'asset_add')
    const byId = Object.fromEntries(assetOps.map(o => {
      const a = o.payload.asset as Record<string, unknown>
      return [a.id as string, a]
    }))

    expect('pages' in byId.dv1).toBe(false)
    expect(byId.img1.src).toBe('')
    expect(byId.img1._localOnly).toBe(true)
    expect(byId.img2.src).toBe('')
    // нормальний asset не мутований
    expect(byId.a1.src).toBe('')
    expect('_localOnly' in byId.a1).toBe(false)
  })

  // Демо-вітрина: аркуш і слайди — статичні файли, вказані в самому об'єкті.
  // `pages[]` в ops не їдуть, а `content_id` нема — тобто в хмарі показати
  // було б нічим. Краще не везти зовсім, ніж привезти порожню рамку.
  it('переглядач без content_id не їде в хмару (там він був би порожньою рамкою)', () => {
    const demoSheet = makeAsset('sheet', {
      type: 'document_viewer',
      src: '/demo/sheet-uk-1.svg',
      content_ref: { content_type: 'pdf' },
      pages: [{ index: 0, url: '/demo/sheet-uk-1.svg' }],
    } as unknown as Partial<WBAsset>)
    const demoDeck = makeAsset('deck', {
      type: 'document_viewer',
      src: '/demo/slides-uk-1.svg',
      content_ref: { content_type: 'presentation' },
      pages: [{ index: 0, url: '/demo/slides-uk-1.svg' }],
    } as unknown as Partial<WBAsset>)
    const liveObject = makeAsset('trig', { type: 'trig_circle' } as Partial<WBAsset>)

    const state: WBWorkspaceState = {
      pages: [makePage('p1', [makeStroke('s1')], [demoSheet, demoDeck, liveObject])],
      currentPageIndex: 0,
    }
    const ops = buildHandoffOps(state)
    const assetIds = ops.filter(o => o.op_type === 'asset_add')
      .map(o => (o.payload.asset as Record<string, unknown>).id)

    // Живий об'єкт їде, обидва демо-переглядачі — ні.
    expect(assetIds).toEqual(['trig'])
    // Робота людини (штрихи) і сама сторінка не постраждали.
    expect(ops.filter(o => o.op_type === 'stroke_add')).toHaveLength(1)
    expect(ops.filter(o => o.op_type === 'page_add')).toHaveLength(1)
  })

  it('порожня сторінка → лише page_add (валідний мінімум)', () => {
    const state: WBWorkspaceState = { pages: [makePage('p1')], currentPageIndex: 0 }
    const ops = buildHandoffOps(state)
    expect(ops).toHaveLength(1)
    expect(ops[0].op_type).toBe('page_add')
  })
})
