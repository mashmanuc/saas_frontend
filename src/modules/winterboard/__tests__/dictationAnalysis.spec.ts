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
import { sentenceFixture, fixtureWithTokens } from './fixtures/dictationLineFixture'
import { makeRemoteSentenceAdapter } from '../remote/remoteSentenceAdapter'
import RemoteSentenceAnalysis from '../components/remote/RemoteSentenceAnalysis.vue'
import type { AnalysisDraft, AnalysisTarget } from '../api/dictationAnalysis'
import { readAnalysisDraft } from '../api/dictationAnalysis'
import { annotationFont, annotationLabels, type AnalysisItem } from '../board/dictationAnalysis'
import type { SentenceRequest } from '../remote/dictationLineContract'
const revision = 'a'.repeat(64)
const proposalId = '2b4e28ba-2fa1-41d2-883f-0016d3cca427'
const approveExample = async (_target: AnalysisTarget, _items: AnalysisItem[], _signal: AbortSignal) => proposalId
const annotate = (kind: 'basis' | 'parts' | 'orthograms', items: unknown[]) => ({ action: 'set_analysis', source_revision: revision, kind, items })
beforeEach(() => { flushPendingUpdates(); setActivePinia(createPinia()) })

describe('Мовні позначки — рівно за підтвердженим набором, без нового письма', () => {
  it('24px навіть на лінійці: короткі слова не стискають підпис, смуги не перекривають текст або одна одну', () => {
    const original = fixtureWithTokens('І в\nМи', [
      { id: 'w0', kind: 'word', text: 'І', start: 0, end: 1 },
      { id: 's0', kind: 'space', text: ' ', start: 1, end: 2 },
      { id: 'w1', kind: 'word', text: 'в', start: 2, end: 3 },
      { id: 's1', kind: 'space', text: '\n', start: 3, end: 4 },
      { id: 'w2', kind: 'word', text: 'Ми', start: 4, end: 6 },
    ])
    original.layout.x_height = 16
    for (const glyph of original.layout.glyphs) if (glyph.token === 'w2') {
      glyph.line = 1; glyph.bbox[0] -= 40; glyph.bbox[1] += 32
    }
    for (const stroke of original.layout.strokes) if (original.layout.glyphs[stroke.glyph].token === 'w2') {
      stroke.p = stroke.p.map(([x, y]) => [x - 40, y + 32])
    }
    const data = applyDictationAction(original, annotate('parts', [
      { token_id: 'w0', pos: 'conjunction' }, { token_id: 'w1', pos: 'preposition' }, { token_id: 'w2', pos: 'pronoun' },
    ]))
    expect(annotationFont(data)).toBe(24)
    // Фея 25.10: смуга — ПІД реченням і від його першої літери (від поля), не з краю області
    const labels = annotationLabels(data)
    const inkBottom = Math.max(...data.layout.glyphs.map((g) => g.bbox[1] + g.bbox[3]))
    const inkLeft = Math.min(...data.layout.glyphs.map((g) => g.bbox[0]))
    expect(Math.min(...labels.map((l) => l.x))).toBe(inkLeft)
    for (const label of labels) {
      expect(label.top).toBeGreaterThan(inkBottom)
      expect(label.right - label.x).toBeGreaterThan(80)
      for (const other of labels) if (other !== label) {
        expect(label.y < other.top || other.y < label.top || label.right < other.x || other.right < label.x).toBe(true)
      }
    }
    const svg = dictationLineSvg(data)
    expect(svg).not.toContain('textLength'); expect(svg).not.toContain('lengthAdjust')
    expect(svg).toContain('І — спол.'); expect(svg).toContain('Ми — займ.')
    expect(data.layout).toBe(original.layout)
    const b = dictationInkBounds(data)
    for (const label of labels) expect(label.top).toBeGreaterThanOrEqual(b.y)
  })
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
    const store = useWBStore(), original = createDictationLine('s', 40, 160, sentenceFixture())
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
  it('речення під самим верхом сторінки (перше в зошиті): основа й орфограми наносяться, письмо не рухається', () => {
    // Фея 25.10: раніше смуги резервувались над реченням завжди — перше речення сторінки відмовляло `no_space`.
    const store = useWBStore(), original = createDictationLine('s', 40, 0, sentenceFixture())
    store.pages = [{ id: 'p', name: '1', width: 1920, height: 1080, assets: [original], strokes: [] }]
    store.currentPageIndex = 0; store.mode = 'edit'; store.selectedIds = ['s']
    const written: any[] = []
    expect(commitDictationAction(store, { pageId: 'p', assetId: 's' }, annotate('basis', [{ token_id: 'w0', role: 'subject' }]), {
      canWrite: () => true, write: (asset) => { written.push(asset); store.pages[0].assets = [asset] },
    })).toEqual({ status: 'changed' })
    const after = written[0]
    expect(after.y).toBeGreaterThanOrEqual(0)
    // світові координати письма ті самі: зсув рамки = зсув viewBox
    expect(after.x - dictationInkBounds(after.data).x).toBeCloseTo(original.x - dictationInkBounds(original.data).x, 6)
    expect(after.y - dictationInkBounds(after.data).y).toBeCloseTo(original.y - dictationInkBounds(original.data).y, 6)
  })
  it('якщо смуга частин мови не влазить під реченням унизу сторінки, відмова без зсуву письма або росту полотна', () => {
    const store = useWBStore(), original = createDictationLine('s', 40, 960, sentenceFixture()), write = vi.fn()
    store.pages = [{ id: 'p', name: '1', width: 1920, height: 1080, assets: [original], strokes: [] }]
    store.currentPageIndex = 0; store.mode = 'edit'; store.selectedIds = ['s']
    expect(commitDictationAction(store, { pageId: 'p', assetId: 's' }, annotate('parts', [
      { token_id: 'w0', pos: 'noun' }, { token_id: 'w1', pos: 'noun' },
    ]), { canWrite: () => true, write })).toEqual({ status: 'refused', reason: 'no_space' })
    expect(write).not.toHaveBeenCalled(); expect(store.pages[0].width).toBe(1920); expect(store.pages[0].height).toBe(1080)
  })
  it('після приватного GET повторно звіряється живий target: зміна вибору не пише дошку', async () => {
    const store = useWBStore()
    store.workspaceId = 'b'; store.pages = [{ id: 'p', name: '1', assets: [createDictationLine('s', 40, 40, sentenceFixture())], strokes: [] }]
    store.currentPageIndex = 0; store.mode = 'edit'; store.selectedIds = ['s']
    let finish!: (value: import('../api/dictationAnalysis').ApprovedAnalysis) => void
    const load = vi.fn(() => new Promise<import('../api/dictationAnalysis').ApprovedAnalysis>((resolve) => { finish = resolve }))
    const adapter = makeRemoteSentenceAdapter(store, { mode: 'SYNC', inputLocked: false }, load)
    const pending = adapter.applyAnalysis!({ action: 'apply_analysis', request_id: proposalId, proposal_id: proposalId, page_id: 'p', object_id: 's', source_revision: revision })
    store.selectedIds = []
    finish({ board_id: 'b', page_id: 'p', object_id: 's', source_revision: revision, kind: 'basis', items: [{ token_id: 'w0', role: 'subject' }] })
    expect(await pending).toMatchObject({ status: 'refused', reason: 'stale' })
    expect(store.undoStack).toHaveLength(0)
  })
})

describe('Приватна чернетка на пульті: вчитель вирішує, що показувати', () => {
  const state = () => ({ page_id: 'p', object_id: 's', source_revision: revision, words: [{ id: 'w0', text: 'Мама', hidden: false }, { id: 'w1', text: 'мама', hidden: false }], punct: false })
  const draft = (): AnalysisDraft => ({ text: sentenceFixture().source.text, tokens: sentenceFixture().tokens.filter((t) => t.kind === 'word'), source_revision: revision,
    kind: 'basis', items: [{ token_id: 'w0', role: 'subject' }] })
  it('приватний перегляд зберігає оголошений LF і не пускає інші керівні знаки', () => {
    const target: AnalysisTarget = { board_id: 'b', page_id: 'p', object_id: 's', source_revision: revision, kind: 'basis' }
    expect(readAnalysisDraft({ ...draft(), text: 'Мама,\nмама.' }, target).text).toBe('Мама,\nмама.')
    expect(() => readAnalysisDraft({ ...draft(), text: 'Мама,\tмама.' }, target)).toThrow()
  })
  it('прибирання шару не запускає новий платний розбір', async () => {
    const send = vi.fn((_r: SentenceRequest) => true), request = vi.fn(async () => draft()), approve = vi.fn(approveExample)
    const w = mount(RemoteSentenceAnalysis, { props: { boardId: 'b', sentence: state(), ready: true, result: null, send, request, approve } })
    await w.get('[data-clear-kind="basis"]').trigger('click')
    await flushPromises()
    expect(request).not.toHaveBeenCalled()
    expect(approve.mock.calls[0][1]).toEqual([])
    expect(send.mock.calls[0][0]).toMatchObject({ action: 'apply_analysis', proposal_id: proposalId })
    w.unmount()
  })
  it('перегляд/виправлення не відправляють ops, confirm посилає лише виправлене', async () => {
    const send = vi.fn((_r: SentenceRequest) => true), request = vi.fn(async () => draft()), approve = vi.fn(approveExample)
    const w = mount(RemoteSentenceAnalysis, { props: { boardId: 'b', sentence: state(), ready: true, result: null, send, request, approve } })
    await w.get('[data-analysis-kind="basis"]').trigger('click'); await flushPromises()
    expect(w.find('[data-testid="analysis-review"]').exists()).toBe(true); expect(send).not.toHaveBeenCalled()
    await w.findAll('select')[0].setValue('predicate')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(approve.mock.calls[0][0].kind).toBe('basis')
    expect(approve.mock.calls[0][1]).toEqual([{ token_id: 'w0', role: 'predicate' }])
    expect(send.mock.calls[0][0]).toMatchObject({ action: 'apply_analysis', proposal_id: proposalId })
    expect(send.mock.calls[0][0]).not.toHaveProperty('items')
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
