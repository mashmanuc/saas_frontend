/**
 * «⇕ На всю висоту аркуша» (власник 2026-10-18): документ з «Матеріалів» одним натисканням —
 * біля лівого краю на всю висоту аркуша, сторінка не спотворена, праворуч вільне місце.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'
import {
  A4_PORTRAIT_ASPECT, DOC_FIT_MARGIN, DOC_VIEWER_FOOTER_H, DOC_VIEWER_HEADER_H, SLIDE_ASPECT,
  documentPageAspect, fitDocumentToSheetHeight,
} from '../board/documentFit'
import { cardWindowActions, hasWindowActions } from '../board/windowActions'
import WBCardWindowControls from '../components/canvas/WBCardWindowControls.vue'
import type { WBAsset } from '../types/winterboard'

const SHEET = { sheetW: 1920, sheetH: 1080 }
const CHROME = DOC_VIEWER_HEADER_H + DOC_VIEWER_FOOTER_H

describe('розрахунок', () => {
  it('A4 стоячи: на всю висоту з полем, біля лівого краю, сторінка в пропорції', () => {
    const r = fitDocumentToSheetHeight({ ...SHEET, pageAspect: A4_PORTRAIT_ASPECT })
    expect(r.x).toBe(DOC_FIT_MARGIN)
    expect(r.y).toBe(DOC_FIT_MARGIN)
    expect(r.h).toBe(1080 - 2 * DOC_FIT_MARGIN)
    const pageW = r.w - 2
    const pageH = r.h - CHROME
    expect(Math.abs(pageW / pageH - A4_PORTRAIT_ASPECT)).toBeLessThan(0.002)
    expect(1920 - (r.x + r.w)).toBeGreaterThan(1100) // праворуч — місце для роботи
  })

  it('широка сторінка, що не влазить по висоті, упирається в ширину і не спотворюється', () => {
    const r = fitDocumentToSheetHeight({ sheetW: 1000, sheetH: 1080, pageAspect: 16 / 9 })
    expect(r.x + r.w).toBe(1000 - DOC_FIT_MARGIN)
    expect(r.h).toBeLessThanOrEqual(1080 - 2 * DOC_FIT_MARGIN)
    expect(Math.abs((r.w - 2) / (r.h - CHROME) - 16 / 9)).toBeLessThan(0.01)
  })

  it('пропорція — із завантаженої сторінки; поки її немає — A4 або 4:3 для презентації', () => {
    expect(documentPageAspect({ naturalWidth: 1000, naturalHeight: 500 }, 'pdf')).toBe(2)
    expect(documentPageAspect(undefined, 'pdf')).toBe(A4_PORTRAIT_ASPECT)
    expect(documentPageAspect({ naturalWidth: 0, naturalHeight: 0 }, 'presentation')).toBe(SLIDE_ASPECT)
  })

  it('незрозуміла пропорція — як A4, а не NaN', () => {
    const r = fitDocumentToSheetHeight({ ...SHEET, pageAspect: Number.NaN })
    expect(Number.isFinite(r.w)).toBe(true)
  })
})

describe('кнопка — лише вчителю, у редагуванні, документу і не заблокованому', () => {
  const doc = { id: 'd1', type: 'document_viewer', x: 0, y: 0, w: 420, h: 594, rotation: 0, locked: false } as WBAsset
  const tutorEdit = { isTutor: true, mode: 'edit' as const }

  it('документ — є', () => {
    const a = cardWindowActions(doc, tutorEdit)
    expect(a.fitHeight).toBe(true)
    expect(hasWindowActions(a)).toBe(true)
  })
  it('заблокований, учень, перегляд — немає', () => {
    expect(cardWindowActions({ ...doc, locked: true }, tutorEdit).fitHeight).toBe(false)
    expect(cardWindowActions(doc, { isTutor: false, mode: 'edit' }).fitHeight).toBe(false)
    expect(cardWindowActions(doc, { isTutor: true, mode: 'readonly' as never }).fitHeight).toBe(false)
  })
  it('інші картки — немає (у них свій ⛶)', () => {
    expect(cardWindowActions({ ...doc, type: 'nmt_task' } as WBAsset, tutorEdit).fitHeight).toBe(false)
    expect(cardWindowActions({ ...doc, type: 'graph_calculator' } as WBAsset, tutorEdit).fitHeight).toBe(false)
  })
})

describe('віконна група показує ⇕ і шле намір', () => {
  it('⇕ з підказкою «На всю висоту аркуша» → подія fitHeight', async () => {
    const w = mount(WBCardWindowControls, {
      props: {
        actions: { scale: false, minimize: true, expand: false, delete: true, handwrite: false, handwriteSolves: false, fitHeight: true },
        isExpanded: false,
      },
      global: { plugins: [createI18n({ legacy: false, locale: 'uk', messages: { uk } })] },
    })
    const btn = w.get('[data-testid="wb-card-window-fit-height"]')
    expect(btn.text()).toBe('⇕')
    expect(btn.attributes('title')).toBe('На всю висоту аркуша')
    await btn.trigger('click')
    expect(w.emitted('fitHeight')).toHaveLength(1)
  })
})

describe('WBCanvas: зберігає тим самим шляхом, що й ручне розтягування', () => {
  const src = readFileSync(resolve(__dirname, '../components/canvas/WBCanvas.vue'), 'utf-8')
  it('подія підключена, перевірка дозволу, asset-update з розрахованим прямокутником', () => {
    expect(src).toMatch(/@fit-height="handleWindowFitHeight\(windowControlsTarget\)"/)
    const fn = src.slice(src.indexOf('function handleWindowFitHeight'), src.indexOf('function handleWindowExpand'))
    expect(fn).toMatch(/cardWindowActions\(asset, trayViewer\.value\)\.fitHeight/)
    expect(fn).toMatch(/fitDocumentToSheetHeight\(\{\s*sheetW: PAGE_WIDTH,\s*sheetH: PAGE_HEIGHT/)
    expect(fn).toMatch(/emit\('asset-update', updated\)/)
  })
  it('шапка вікна документа — ті самі висоти, що в розрахунку', () => {
    const viewer = readFileSync(resolve(__dirname, '../components/canvas/DocumentViewerAsset.vue'), 'utf-8')
    expect(viewer).toMatch(/const HEADER_H = DOC_VIEWER_HEADER_H/)
    expect(viewer).toMatch(/const FOOTER_H = DOC_VIEWER_FOOTER_H/)
  })
})

describe('назва документа не заходить під «⇕ — ×»', () => {
  const viewer = readFileSync(resolve(__dirname, '../components/canvas/DocumentViewerAsset.vue'), 'utf-8')
  it('місце під кнопки — у пікселях екрана, переведене через масштаб дошки', () => {
    expect(viewer).toMatch(/const HEADER_RIGHT_RESERVE_PX = 76/)
    expect(viewer).toMatch(/props\.asset\.w - 16 - HEADER_RIGHT_RESERVE_PX \/ Math\.max\(props\.scale \?\? 1, 0\.1\)/)
  })
})
