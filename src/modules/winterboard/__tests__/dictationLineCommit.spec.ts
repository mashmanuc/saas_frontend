import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { commitDictationAction } from '../board/commitDictationAction'
import { createDictationLine } from '../board/createDictationLine'
import { useWBStore } from '../board/state/boardStore'
import { flushPendingUpdates } from '../board/state/assetUpdateBatcher'
import type { DictationLineData } from '../board/dictationLine'
import { sentenceFixture } from './fixtures/dictationLineFixture'

beforeEach(() => { flushPendingUpdates(); setActivePinia(createPinia()) })
function setup() {
  const store = useWBStore()
  store.pages = [{ id: 'p', name: 'Сторінка', strokes: [], assets: [createDictationLine('s', 40, 40, sentenceFixture())] }]
  store.currentPageIndex = 0
  store.selectedIds = ['s']
  store.mode = 'edit'
  const ops: string[] = []
  store.onOperation((op) => ops.push(op.op_type))
  const host = { canWrite: () => true, write: (asset: Parameters<typeof store.updateAsset>[0]) => store.updateAsset(asset) }
  const target = { pageId: 'p', assetId: 's' }
  const data = () => store.pages[0].assets[0].data as DictationLineData
  return { store, ops, host, target, data }
}
const word = { action: 'set_word', token_id: 'w1', hidden: true, source_revision: 'a'.repeat(64) }
const punctuation = { action: 'set_punctuation', hidden: true, source_revision: 'a'.repeat(64) }

describe('Дискретні команди не губляться у RAF і не читають stale props', () => {
  it('слово + пунктуація в одному кадрі: два ops/undo, обидві зміни збережені', () => {
    const { store, host, target, data, ops } = setup()
    expect(commitDictationAction(store, target, word, host)).toEqual({ status: 'changed' })
    expect(commitDictationAction(store, target, punctuation, host)).toEqual({ status: 'changed' })
    expect(data().hidden).toEqual({ punct: true, words: ['w1'] })
    expect(ops).toEqual(['asset_update', 'asset_update'])
    expect(store.undoStack).toHaveLength(2)
    store.undo(); flushPendingUpdates()
    expect(data().hidden).toEqual({ punct: false, words: ['w1'] })
    store.undo(); flushPendingUpdates()
    expect(data().hidden).toEqual({ punct: false, words: [] })
  })
  it('незавершений drag зберігається перед hidden, жодного повернення старих координат', () => {
    const { store, host, target, data, ops } = setup()
    store.updateAsset({ ...store.pages[0].assets[0], x: 150 })
    commitDictationAction(store, target, word, host)
    expect(store.pages[0].assets[0].x).toBe(150)
    expect(data().hidden.words).toEqual(['w1'])
    expect(ops).toHaveLength(2)
  })
  it('повтор explicit set не додає ні op, ні undo', () => {
    const { store, host, target, ops } = setup()
    commitDictationAction(store, target, word, host)
    expect(commitDictationAction(store, target, word, host)).toEqual({ status: 'unchanged' })
    expect(ops).toHaveLength(1)
    expect(store.undoStack).toHaveLength(1)
  })
  it.each(['readonly', 'replay', 'deselected', 'wrong_page', 'locked', 'rights', 'deleted', 'stale_revision'])('%s — явна відмова, нуль записів', (mode) => {
    const { store, host, target, ops } = setup()
    if (mode === 'readonly' || mode === 'replay') store.mode = mode
    if (mode === 'deselected') store.selectedIds = []
    if (mode === 'wrong_page') target.pageId = 'other'
    if (mode === 'locked') store.pages[0].assets[0].locked = true
    if (mode === 'rights') host.canWrite = () => false
    if (mode === 'deleted') store.pages[0].assets = []
    const action = mode === 'stale_revision' ? { ...word, source_revision: 'b'.repeat(64) } : word
    expect(commitDictationAction(store, target, action, host).status).toBe('refused')
    expect(ops).toEqual([])
    expect(store.undoStack).toHaveLength(0)
  })
  it('host відмовив у записі: результат не видається за виконану команду', () => {
    const { store, target, data } = setup()
    const result = commitDictationAction(store, target, word, { canWrite: () => true, write: () => {} })
    expect(result).toEqual({ status: 'refused', reason: 'blocked' })
    expect(data().hidden.words).toEqual([])
  })
})
