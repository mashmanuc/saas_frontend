import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { applyDictationAction, assertDictationLine, type DictationLineData } from '../board/dictationLine'
import { dictationLineSvg } from '../board/dictationLineSvg'
import { dictationInkBounds } from '../board/dictationInkBounds'
import { commitDictationAction } from '../board/commitDictationAction'
import { createDictationLine } from '../board/createDictationLine'
import { useWBStore } from '../board/state/boardStore'
import { flushPendingUpdates } from '../board/state/assetUpdateBatcher'
import { sentenceFixture } from './fixtures/dictationLineFixture'
import RemoteSentenceAnalysis from '../components/remote/RemoteSentenceAnalysis.vue'
import type { AnalysisDraft } from '../api/dictationAnalysis'
import type { SentenceRequest } from '../remote/dictationLineContract'
const revision = 'a'.repeat(64)
const annotate = (kind: 'basis' | 'parts' | 'orthograms', items: unknown[]) => ({ action: 'set_analysis', source_revision: revision, kind, items })
beforeEach(() => { flushPendingUpdates(); setActivePinia(createPinia()) })

describe('Мовні позначки — рівно за підтвердженим набором, без нового письма', () => {
  it('три шари незалежні, джерело/геометрія ті самі; правила не стають HTML', () => {
    const original = sentenceFixture()
    let data = applyDictationAction(original, annotate('orthograms', [{ start: 1, end: 2, rule: '<script>Чужий текст</script>' }]))
    data = applyDictationAction(data, annotate('basis', [{ token_id: 'w0', role: 'subject' }, { token_id: 'w1', role: 'predicate' }]))
    data = applyDictationAction(data, annotate('parts', [{ token_id: 'w0', pos: 'noun' }, { token_id: 'w1', pos: 'noun' }]))
    expect(data.source).toBe(original.source); expect(data.layout).toBe(original.layout)
    const svg = dictationLineSvg(data)
    expect(svg).toContain('stroke="#dc2626"'); expect(svg).toContain('<path d='); expect(svg).toContain('ім.')
    expect(svg).not.toContain('<script>'); expect(svg).not.toContain('Чужий текст')
    const hidden = applyDictationAction(data, { action: 'set_word', source_revision: revision, token_id: 'w1', hidden: true })
    expect(dictationLineSvg(hidden).match(/<text /g)).toHaveLength(1)
    expect(dictationInkBounds(hidden)).toEqual(dictationInkBounds(data))
    expect(applyDictationAction(data, annotate('basis', data.analysis!.basis))).toBe(data)
    expect(() => assertDictationLine(JSON.parse(JSON.stringify(data)))).not.toThrow()
  })
  it.each([
    annotate('basis', [{ token_id: 'p0', role: 'subject' }]),
    annotate('basis', [{ token_id: 'w0', role: 'subject' }, { token_id: 'w0', role: 'predicate' }]),
    annotate('orthograms', [{ start: 3, end: 7, rule: 'x' }]),
    annotate('parts', [{ token_id: 'w0', pos: 'noun' }]),
    annotate('parts', [{ token_id: 'w0', pos: 'noun' }, { token_id: 'w1', pos: '<script>' }]),
    { ...annotate('basis', []), source_revision: 'b'.repeat(64) },
    { ...annotate('basis', []), teacher_accepted: true },
  ])('невалідне/застаріле не застосовується: %j', (request) => {
    const data = sentenceFixture(), before = JSON.stringify(data)
    expect(() => applyDictationAction(data, request)).toThrow()
    expect(JSON.stringify(data)).toBe(before)
  })
  it('перший шар: один update, літери не зсуваються, undo/redo повертають bbox і позначки', () => {
    const store = useWBStore(), original = createDictationLine('s', 40, 40, sentenceFixture())
    store.pages = [{ id: 'p', name: '1', width: 1920, height: 1080, assets: [original], strokes: [] }]
    store.currentPageIndex = 0; store.mode = 'edit'; store.selectedIds = ['s']
    const ops: string[] = []; store.onOperation((op) => ops.push(op.op_type))
    const result = commitDictationAction(store, { pageId: 'p', assetId: 's' }, annotate('basis', [{ token_id: 'w0', role: 'subject' }]), {
      canWrite: () => true, write: (asset) => store.updateAsset(asset),
    })
    expect(result.status).toBe('changed'); expect(ops).toEqual(['asset_update'])
    const updated = store.pages[0].assets[0], a = dictationInkBounds(original.data as DictationLineData), b = dictationInkBounds(updated.data as DictationLineData)
    expect(updated.x + (10 - b.x) * updated.w / b.w).toBeCloseTo(original.x + (10 - a.x) * original.w / a.w)
    expect(updated.y + (20 - b.y) * updated.h / b.h).toBeCloseTo(original.y + (20 - a.y) * original.h / a.h)
    expect(store.pages[0]).toMatchObject({ width: 1920, height: 1080 })
    store.undo(); flushPendingUpdates(); expect(store.pages[0].assets[0].data).toEqual(original.data)
    store.redo(); flushPendingUpdates(); expect((store.pages[0].assets[0].data as DictationLineData).analysis?.basis).toHaveLength(1)
  })
})

describe('Приватна чернетка на пульті: вчитель вирішує, що показувати', () => {
  const state = () => ({ page_id: 'p', object_id: 's', source_revision: revision, words: [{ id: 'w0', text: 'Мама', hidden: false }, { id: 'w1', text: 'мама', hidden: false }], punct: false })
  const draft = (): AnalysisDraft => ({ text: sentenceFixture().source.text, tokens: sentenceFixture().tokens.filter((t) => t.kind === 'word'), source_revision: revision,
    kind: 'basis', items: [{ token_id: 'w0', role: 'subject' }] })
  it('прибирання шару не запускає новий платний розбір', async () => {
    const send = vi.fn((_r: SentenceRequest) => true), request = vi.fn(async () => draft())
    const w = mount(RemoteSentenceAnalysis, { props: { boardId: 'b', sentence: state(), ready: true, result: null, send, request } })
    await w.get('[data-clear-kind="basis"]').trigger('click')
    expect(request).not.toHaveBeenCalled()
    expect(send.mock.calls[0][0]).toMatchObject({ action: 'set_analysis', kind: 'basis', items: [] })
    w.unmount()
  })
  it('перегляд/виправлення не відправляють ops, confirm посилає лише виправлене', async () => {
    const send = vi.fn((_r: SentenceRequest) => true), request = vi.fn(async () => draft())
    const w = mount(RemoteSentenceAnalysis, { props: { boardId: 'b', sentence: state(), ready: true, result: null, send, request } })
    await w.get('[data-analysis-kind="basis"]').trigger('click'); await flushPromises()
    expect(w.find('[data-testid="analysis-review"]').exists()).toBe(true); expect(send).not.toHaveBeenCalled()
    await w.findAll('select')[0].setValue('predicate')
    await w.get('form').trigger('submit')
    expect(send.mock.calls[0][0]).toMatchObject({ action: 'set_analysis', kind: 'basis', items: [{ token_id: 'w0', role: 'predicate' }] })
    await w.setProps({ result: { request_id: send.mock.calls[0][0].request_id, status: 'done' } })
    expect(w.text()).toContain('Позначки застосовано')
    w.unmount()
  })
  it('cancel і запізніла відповідь після зміни речення не малюють нічого', async () => {
    let resolve!: (d: AnalysisDraft) => void
    const send = vi.fn(() => true), request = vi.fn(() => new Promise<AnalysisDraft>((r) => { resolve = r }))
    const w = mount(RemoteSentenceAnalysis, { props: { boardId: 'b', sentence: state(), ready: true, result: null, send, request } })
    await w.get('[data-analysis-kind="basis"]').trigger('click')
    await w.setProps({ sentence: { ...state(), object_id: 'other' } })
    resolve(draft()); await flushPromises()
    expect(w.find('form').exists()).toBe(false); expect(send).not.toHaveBeenCalled()
    w.unmount()
  })
})
