/** Регресія відхиленого потоку: стандартний аркуш, без руху сусідів. */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { useWBStore } from '../board/state/boardStore'
import { flushPendingUpdates } from '../board/state/assetUpdateBatcher'
import { applyReplayOperation } from '../engine/applyReplayOperation'
import { planAutoFit } from '../composables/autoFitHeight'
import type { WBAsset, WBPage } from '../types/winterboard'

const data = (a: WBAsset): Record<string, unknown> => a.data as unknown as Record<string, unknown>
function page(n = 2, legacy = false): WBPage {
  const members = Array.from({ length: n }, (_, i) => `t${i}`)
  return { id: 'p', name: 'Задачі', strokes: [], width: 1920,
    height: legacy ? 6160 : 1080,
    assets: members.map((id, i) => {
      const x = 60 + i % 2 * 880, y = 60 + Math.floor(i / 2) * 400
      return { id, type: 'nmt_task', src: '', x, y, w: 860, h: 380, rotation: 0,
        data: { version: 1, question: '$x^2-1$', showSolution: false,
          ...(legacy ? { generatedFlow: { version: 1, groupId: 'p', members,
            row: Math.floor(i / 2), x, y, w: 860, h: 380, rotation: 0,
            top: 60, gap: 20, rowLimit: 2000 } } : {}) },
      } as unknown as WBAsset
    }) }
}
const fit = (a: WBAsset, h: number): WBAsset => ({ ...a, h,
  data: { ...data(a), autoFitH: h } as unknown as WBAsset['data'] })
beforeEach(() => { flushPendingUpdates(); setActivePinia(createPinia()) })

describe('стандартний аркуш замість generatedFlow', () => {
  it('усі кімнати мають стандартну висоту; PDF без змін', () => {
    for (const host of ['WBSoloRoom', 'WBConstructorRoom', 'WBClassroomRoom', 'WBPublicView', 'WBContentPreview']) {
      const source = readFileSync(`src/modules/winterboard/views/${host}.vue`, 'utf8')
      expect(source).toContain(':height="store.pageHeight"')
      expect(source).not.toContain(':height="store.currentPageCanvasHeight"')
    }
    const canvas = readFileSync('src/modules/winterboard/components/canvas/WBCanvas.vue', 'utf8')
    expect(canvas).toContain('pageH: props.height')
    expect(canvas).not.toContain('generatedFitPageH')
    expect(canvas).not.toContain('initialHeight')
    expect(canvas).toContain('sheetH: PAGE_HEIGHT')
    expect(readFileSync('src/modules/winterboard/views/WBSoloRoom.vue', 'utf8'))
      .not.toContain('fit(store.currentPageCanvasHeight')
  })
  it('старий маркер не розтягує полотно і не переписує збережені дані', () => {
    const store = useWBStore(); store.pages = [page(5, true)]
    const saved = JSON.stringify(store.pages)
    const ops: unknown[] = []; store.onOperation(op => ops.push(op))
    expect(store.currentPageCanvasHeight).toBe(1080)
    expect(JSON.stringify(store.pages)).toBe(saved)
    expect(store.pages[0].height).toBe(6160)
    expect(ops).toHaveLength(0)
  })
  it.each([1, 2])('%i задачі: відкриті картки не перетинаються при 50%%', n => {
    const store = useWBStore(); store.pages = [page(n)]
    const before = store.pages[0].assets.map(a => ({ x: a.x, y: a.y, w: a.w }))
    for (const asset of [...store.pages[0].assets]) {
      const plan = planAutoFit({ neededPx: 1500, zoom: 0.5, y: asset.y,
        h: asset.h, pageH: store.pageHeight, canWrite: true })
      expect(plan).toEqual({ write: 1020, display: null })
      store.updateAsset(fit(asset, plan.write!))
    }
    flushPendingUpdates()
    expect(store.pages[0].height).toBe(1080)
    expect(store.pages[0].assets.map(a => ({ x: a.x, y: a.y, w: a.w }))).toEqual(before)
    expect(store.pages[0].assets.every(a => a.y + a.h <= 1080)).toBe(true)
    if (n === 2) expect(store.pages[0].assets[0].x + store.pages[0].assets[0].w)
      .toBeLessThanOrEqual(store.pages[0].assets[1].x)
    expect(store.undoStack).toHaveLength(0)
  })
  it.each([false, true])('учень/Replay лише показує обмежену висоту, legacy=%s', legacy => {
    const p = page(2, legacy), saved = JSON.stringify(p)
    expect(planAutoFit({ neededPx: 1500, zoom: 0.5, y: 60, h: 380,
      pageH: 1080, canWrite: false })).toEqual({ write: null, display: 1020 })
    expect(JSON.stringify(p)).toBe(saved)
  })
  it('старі маркери не рухають сусідів і ручні об’єкти', () => {
    const store = useWBStore(); store.pages = [page(5, true)]
    store.pages[0].assets.push({ id: 'hand', type: 'image', src: 'x', x: 1700, y: 300, w: 100, h: 100 } as WBAsset)
    const before = JSON.stringify(store.pages[0].assets.slice(1))
    const ops: unknown[] = []; store.onOperation(op => ops.push(op))
    store.updateAsset(fit(store.pages[0].assets[0], 1020)); flushPendingUpdates()
    expect(JSON.stringify(store.pages[0].assets.slice(1))).toBe(before)
    expect(store.pages[0].height).toBe(6160)
    expect(ops).toHaveLength(1)
  })
  it('розбір → fit → undo → fit → redo залишається однією дією', () => {
    const store = useWBStore(); store.pages = [page()]
    const first = () => store.pages[0].assets[0]
    const other = JSON.stringify(store.pages[0].assets[1])
    store.updateAsset({ ...first(), data: { ...data(first()), showSolution: true } as unknown as WBAsset['data'] })
    flushPendingUpdates(); store.updateAsset(fit(first(), 1020)); flushPendingUpdates()
    expect(store.undoStack).toHaveLength(1)
    store.undo(); flushPendingUpdates(); expect(data(first()).showSolution).toBe(false)
    store.updateAsset(fit(first(), 700)); flushPendingUpdates(); expect(store.redoStack).toHaveLength(1)
    store.redo(); flushPendingUpdates(); expect(data(first()).showSolution).toBe(true)
    expect(JSON.stringify(store.pages[0].assets[1])).toBe(other)
    expect(store.pages[0].height).toBe(1080)
  })
  it.each(['question', 'x', 'y', 'w'])('пізній height-запит не стирає нове %s', field => {
    const store = useWBStore(); store.pages = [page()]
    const before = store.pages[0].assets[0]
    store.updateAsset(fit(before, 820))
    const current = field === 'question'
      ? { ...before, data: { ...data(before), question: 'Нове' } as WBAsset['data'] }
      : { ...before, [field]: 99 }
    store.pages[0].assets[0] = current
    flushPendingUpdates(); expect(store.pages[0].assets[0]).toEqual(current)
  })
  it('reload і Replay відтворюють ті самі asset_update без нового writer', () => {
    const store = useWBStore(); store.pages = [page()]
    const initial = JSON.parse(JSON.stringify(store.pages))
    const ops: unknown[] = []; store.onOperation(op => ops.push(JSON.parse(JSON.stringify(op))))
    for (const asset of [...store.pages[0].assets]) store.updateAsset(fit(asset, 1020))
    flushPendingUpdates()
    const final = JSON.stringify(store.pages)
    store.pages = JSON.parse(final); expect(store.currentPageCanvasHeight).toBe(1080)
    store.setMode('replay'); store.pages = initial
    for (const op of ops) applyReplayOperation(store as never, op as never)
    expect(JSON.stringify(store.pages)).toBe(final)
    expect(ops).toHaveLength(2)
    expect(ops.every((op: any) => op.op_type === 'asset_update')).toBe(true)
  })
})
