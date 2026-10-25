import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWBStore } from '../board/state/boardStore'
import { flushPendingUpdates } from '../board/state/assetUpdateBatcher'
import { createDictationLine } from '../board/createDictationLine'
import { applyDictationAction, dictationVisibility, type DictationLineData } from '../board/dictationLine'
import { assetsEqualByOpsFields } from '../board/state/assetEquality'
import { dictationLineSvg } from '../board/dictationLineSvg'
import { sentenceFixture } from './fixtures/dictationLineFixture'

beforeEach(() => { flushPendingUpdates(); setActivePinia(createPinia()) })

describe('Речення — справжній boardStore та штатні undo/redo', () => {
  it('створення — один asset_add; hidden — один asset_update; undo/redo відновлюють точні дані', () => {
    const store = useWBStore()
    store.pages = [{ id: 'p', name: 'Сторінка', strokes: [], assets: [] }]
    const ops: string[] = []
    store.onOperation((op) => ops.push(op.op_type))
    const original = createDictationLine('s1', 40, 60, sentenceFixture())
    store.addAsset(original, 'p')
    expect(ops).toEqual(['asset_add'])
    expect(store.undoStack).toHaveLength(1)
    const current = () => store.pages[0].assets[0]
    const data = () => current().data as DictationLineData
    const hidden = applyDictationAction(data(), { action: 'set_word', token_id: 'w1', hidden: true, source_revision: data().source.revision })
    expect(assetsEqualByOpsFields(current(), { ...current(), data: hidden })).toBe(false)
    store.updateAsset({ ...current(), data: hidden }); flushPendingUpdates()
    expect(ops).toEqual(['asset_add', 'asset_update'])
    expect(store.undoStack).toHaveLength(2)
    expect(dictationVisibility(data()).strokes).toHaveLength(6)
    const saved = JSON.parse(JSON.stringify(current()))
    store.undo(); flushPendingUpdates()
    expect(data().hidden.words).toEqual([])
    store.redo(); flushPendingUpdates()
    expect(dictationLineSvg(data())).toBe(dictationLineSvg(saved.data))
    expect(current()).toEqual(saved)
    expect(store.pages[0].strokes).toEqual([])
    store.undo(); flushPendingUpdates()
    store.undo(); flushPendingUpdates()
    expect(store.pages[0].assets).toEqual([])
    expect(ops).toEqual(['asset_add', 'asset_update', 'asset_update', 'asset_update', 'asset_update', 'asset_delete'])
  })

  it('повтор same hidden через store не створює зайвої історії/op', () => {
    const store = useWBStore()
    const original = createDictationLine('s1', 40, 60, sentenceFixture())
    store.pages = [{ id: 'p', name: 'Сторінка', strokes: [], assets: [original] }]
    const ops: string[] = []
    store.onOperation((op) => ops.push(op.op_type))
    store.updateAsset(JSON.parse(JSON.stringify(original))); flushPendingUpdates()
    expect(ops).toEqual([])
    expect(store.undoStack).toHaveLength(0)
  })

  it('переміщення/resize не міняють приховування, glyphs чи саму сторінку', () => {
    const store = useWBStore()
    const original = createDictationLine('s1', 40, 60, sentenceFixture())
    store.pages = [{ id: 'p', name: 'Сторінка', width: 1920, height: 1080, strokes: [], assets: [original] }]
    store.updateAsset({ ...original, x: 70, w: 800, h: 240 }); flushPendingUpdates()
    expect(store.pages[0].assets[0].data).toEqual(original.data)
    expect(store.pages[0]).toMatchObject({ width: 1920, height: 1080 })
    store.undo(); flushPendingUpdates()
    expect(store.pages[0].assets[0]).toEqual(original)
  })

  it('надмірна геометрія відхиляється до addAsset, без підняття 64KB', () => {
    const data = sentenceFixture()
    data.layout.strokes = Array.from({ length: 5000 }, (_, i) => ({ ...data.layout.strokes[i % 10], t: i }))
    expect(() => createDictationLine('s1', 40, 60, data)).toThrow('dictation_payload_too_large')
  })

  it('створення відокремлює snapshot від тимчасової відповіді handwriting', () => {
    const response = sentenceFixture()
    const asset = createDictationLine('s1', 40, 60, response)
    response.hidden.words.push('w1')
    response.layout.glyphs[0].bbox[0] = 777
    expect((asset.data as DictationLineData).hidden.words).toEqual([])
    expect((asset.data as DictationLineData).layout.glyphs[0].bbox[0]).toBe(10)
  })

  it.each([[1800, 60], [40, 1000], [NaN, 0], [-1, 0]])('поза стандартною дошкою (%s,%s) — відмова, не ріст сторінки', (x, y) => {
    expect(() => createDictationLine('s1', x, y, sentenceFixture())).toThrow('dictation_invalid_placement')
  })
})
