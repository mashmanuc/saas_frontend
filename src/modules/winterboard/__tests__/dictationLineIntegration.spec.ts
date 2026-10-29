import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { handwriteDictation, rewriteDictation, type HandwriteDeps } from '../composables/useHandwriteSolution'
import { useWBStore } from '../board/state/boardStore'
import { flushPendingUpdates } from '../board/state/assetUpdateBatcher'
import { sentenceFixture } from './fixtures/dictationLineFixture'
import { makeRemoteSentenceAdapter } from '../remote/remoteSentenceAdapter'
import { parseRemoteSentence, readSentenceRequest } from '../remote/dictationLineContract'
import type { SentenceRequest } from '../remote/dictationLineContract'
import RemoteSentenceControls from '../components/remote/RemoteSentenceControls.vue'
import { isQuietSelection } from '../board/quietSelection'
import { dictationInkBounds } from '../board/dictationInkBounds'
import { DICTATION_GAP } from '../board/handwriteSolution'

beforeEach(() => { flushPendingUpdates(); setActivePinia(createPinia()) })
afterEach(() => { vi.useRealTimers() })
const RID = '1b4e28ba-2fa1-41d2-883f-0016d3cca427'
function setup() {
  const store = useWBStore()
  store.workspaceId = 'synthetic-board'
  store.pages = [{ id: 'p', name: 'Сторінка', width: 1920, height: 1080, assets: [], strokes: [] }]
  store.currentPageIndex = 0; store.mode = 'edit'
  const sync = { mode: 'SYNC', inputLocked: false }
  const deps: HandwriteDeps = { store, sync, schedule: () => () => {}, fetchLayout: vi.fn(async () => {
    const data = sentenceFixture()
    return { fits: true as const, scale: 40, size: data.layout.size, w: 117, h: 40, duration_ms: 200,
      layout_version: 1, source: data.source, tokens: data.tokens, glyphs: data.layout.glyphs,
      baselines: data.layout.baselines, x_height: data.layout.x_height, strokes: data.layout.strokes }
  }) }
  return { store, sync, deps }
}

describe('Новий диктант — один asset, компактне місце, пульт та undo', () => {
  it('два речення підряд не створюють великого пустого полотна/штрихів', async () => {
    const { store, deps } = setup()
    const ops: string[] = []; store.onOperation((op) => ops.push(op.op_type))
    expect(await handwriteDictation('Мама, мама.', deps, { lang: 'uk' })).toEqual({ status: 'written' })
    const first = store.pages[0].assets[0]
    expect(first.type).toBe('dictation_line'); expect(first.h).toBe(31); expect(first.w).toBe(111)
    expect(await handwriteDictation('Мама, мама.', deps, { lang: 'uk' })).toEqual({ status: 'written' })
    expect(store.pages[0].assets).toHaveLength(2)
    expect(store.pages[0].assets[1].y).toBeGreaterThan(first.y + first.h)
    expect(store.pages[0]).toMatchObject({ width: 1920, height: 1080, strokes: [] })
    expect(ops).toEqual(['asset_add', 'asset_add'])
    expect(store.undoStack).toHaveLength(2)
    store.undo(); flushPendingUpdates(); expect(store.pages[0].assets).toHaveLength(1)
  })
  it('пульт діє над автоматично виділеним реченням і відхиляє stale/blocked', async () => {
    const { store, sync, deps } = setup()
    await handwriteDictation('Мама, мама.', deps, { lang: 'uk' })
    const adapter = makeRemoteSentenceAdapter(store, sync)
    const state = adapter.state()!
    expect(state.words.map((w) => w.text)).toEqual(['Мама', 'мама'])
    const req = { request_id: RID, page_id: state.page_id, object_id: state.object_id,
      source_revision: state.source_revision, action: 'set_word' as const, token_id: 'w1', hidden: true }
    expect(adapter.apply(req).status).toBe('done')
    expect(adapter.state()!.words.map((w) => w.hidden)).toEqual([false, true])
    sync.inputLocked = true
    expect(adapter.apply({ ...req, hidden: false }).status).toBe('refused')
    sync.inputLocked = false
    expect(adapter.apply({ ...req, source_revision: 'b'.repeat(64) }).status).toBe('refused')
  })
  it('v1.67: дія пульта знову робить виділення тихим, відмова — ні', async () => {
    const { store, sync, deps } = setup()
    await handwriteDictation('Мама, мама.', deps, { lang: 'uk' })
    expect(isQuietSelection(store.selectedIds)).toBe(true)
    window.dispatchEvent(new Event('pointerdown')) // учитель торкнувся ноутбука — панель є
    expect(isQuietSelection(store.selectedIds)).toBe(false)
    const adapter = makeRemoteSentenceAdapter(store, sync)
    const state = adapter.state()!
    const req = { request_id: RID, page_id: state.page_id, object_id: state.object_id,
      source_revision: 'b'.repeat(64), action: 'set_punctuation' as const, hidden: true }
    expect(adapter.apply(req).status).toBe('refused')
    expect(isQuietSelection(store.selectedIds)).toBe(false)
    expect(adapter.apply({ ...req, source_revision: state.source_revision }).status).toBe('done')
    expect(isQuietSelection(store.selectedIds)).toBe(true)
    window.dispatchEvent(new Event('pointerdown'))
  })
  it('підмінений layout не створює часткового речення', async () => {
    const { store, deps } = setup()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await handwriteDictation('Інший текст.', deps, { lang: 'uk' })).toEqual({ status: 'refused', reason: 'error' })
    expect(store.pages[0].assets).toHaveLength(0)
    warn.mockRestore()
  })
})

describe('Телефон — вибір слова, статус і недоступний зв’язок', () => {
  const state = () => ({ page_id: 'p', object_id: 's', source_revision: 'a'.repeat(64),
    words: [{ id: 'w0', text: 'Мама', hidden: false }, { id: 'w1', text: 'мама', hidden: false }], punct: false })
  it('heartbeat не скидає вибір, команда має explicit boolean та bound target', async () => {
    const send = vi.fn((_request: SentenceRequest) => true)
    const w = mount(RemoteSentenceControls, { props: { sentence: state(), result: null, ready: true, send } })
    await w.get('[data-word-id="w1"]').trigger('click')
    await w.setProps({ sentence: state() })
    await w.get('[data-testid="sentence-word"]').trigger('click')
    const request = send.mock.calls[0][0]
    expect(readSentenceRequest(request)).toMatchObject({ token_id: 'w1', hidden: true, page_id: 'p', object_id: 's' })
    await w.setProps({ sentence: { ...state(), words: state().words.map((word) => ({ ...word, hidden: word.id === 'w1' })) },
      result: { request_id: request.request_id, status: 'done' } })
    expect(w.get('[data-testid="sentence-word"]').text()).toBe('Показати слово')
    expect(w.text()).toContain('Дію виконано.')
    w.unmount()
  })
  it('немає відправки — явне повідомлення, таймер не повторює команду', async () => {
    vi.useFakeTimers()
    const send = vi.fn(() => false)
    const w = mount(RemoteSentenceControls, { props: { sentence: state(), result: null, ready: true, send } })
    await w.get('[data-testid="sentence-punctuation"]').trigger('click')
    expect(w.text()).toContain('Немає зв’язку')
    vi.advanceTimersByTime(10000)
    expect(send).toHaveBeenCalledOnce()
    w.unmount()
  })
  it('схема не пропускає довільний текст, геометрію чи зайві команди', () => {
    expect(parseRemoteSentence({ ...state(), glyphs: [] })).toBeNull()
    expect(parseRemoteSentence({ ...state(), words: state().words.concat(state().words) })).toBeNull()
    expect(readSentenceRequest({ action: 'restore', request_id: RID, page_id: 'p', object_id: 's', source_revision: 'a'.repeat(64), hidden: true })).toBeNull()
  })
})

describe('v1.76 · виправити текст речення з пульта', () => {
  it('пульт бачить увесь текст; виправлення — на тому самому місці, той самий об’єкт, один крок «Скасувати»', async () => {
    const { store, sync, deps } = setup()
    await handwriteDictation('Мама, мама.', deps, { lang: 'uk' })
    const before = { ...store.pages[0].assets[0] }
    const adapter = makeRemoteSentenceAdapter(store, sync, undefined, (t, can) => rewriteDictation(t, can, deps))
    const state = adapter.state()!
    expect(state.text).toBe('Мама, мама.')
    const ops: string[] = []; store.onOperation((op) => ops.push(op.op_type))
    const undoBefore = store.undoStack.length
    const answer = await adapter.applyText!({ action: 'set_text', text: 'Мама, мама.', request_id: RID, page_id: state.page_id,
      object_id: state.object_id, source_revision: state.source_revision })
    expect(answer).toEqual({ request_id: RID, status: 'done' })
    const calls = vi.mocked(deps.fetchLayout).mock.calls
    const req = calls[calls.length - 1][0]
    expect(req).toMatchObject({ width: (before.data as any).layout.width, tokens: true, align: 'left', hand: 'school' })
    flushPendingUpdates()
    expect(store.pages[0].assets).toHaveLength(1)
    expect(store.pages[0].assets[0]).toMatchObject({ id: before.id, x: before.x, y: before.y })
    expect(ops).toEqual(['asset_update'])
    expect(store.undoStack).toHaveLength(undoBefore + 1)
  })

  it('униз — лише до наступного речення; не вміщується — «немає місця»; змінене речення — stale', async () => {
    const { store, sync, deps } = setup()
    await handwriteDictation('Мама, мама.', deps, { lang: 'uk' })
    await handwriteDictation('Мама, мама.', deps, { lang: 'uk' })
    const [first, second] = store.pages[0].assets
    store.selectItems([first.id])
    const adapter = makeRemoteSentenceAdapter(store, sync, undefined, (t, can) => rewriteDictation(t, can, deps))
    const state = adapter.state()!
    const base = { action: 'set_text' as const, text: 'Мама, мама.', request_id: RID, page_id: state.page_id,
      object_id: state.object_id, source_revision: state.source_revision }
    vi.mocked(deps.fetchLayout).mockResolvedValueOnce({ fits: false, needed_height: 400 } as any)
    expect(await adapter.applyText!(base)).toEqual({ request_id: RID, status: 'refused', reason: 'no_space' })
    const calls = vi.mocked(deps.fetchLayout).mock.calls
    const req = calls[calls.length - 1][0]
    // область починається над чорнилом першого речення й закінчується до другого (з відступом між реченнями)
    const y0 = first.y - dictationInkBounds(first.data as any).y
    expect(y0 + req.height).toBeLessThanOrEqual(second.y - DICTATION_GAP)
    expect(await adapter.applyText!({ ...base, source_revision: 'b'.repeat(64) })).toEqual({ request_id: RID, status: 'refused', reason: 'stale' })
    sync.inputLocked = true
    expect(await adapter.applyText!(base)).toEqual({ request_id: RID, status: 'refused', reason: 'blocked' })
  })

  it('телефон: текст видно, «Виправити» → «Переписати» шле set_text; новий стан речення не скидає очікування', async () => {
    const sentence = { page_id: 'p', object_id: 's', source_revision: 'a'.repeat(64), punct: false, text: 'Мама мила раму.',
      words: [{ id: 'w0', text: 'Мама', hidden: false }] }
    const send = vi.fn((_request: SentenceRequest) => true)
    const w = mount(RemoteSentenceControls, { props: { sentence, result: null, ready: true, send } })
    expect(w.get('[data-testid="sentence-text"]').text()).toBe('Мама мила раму.')
    await w.get('[data-testid="sentence-edit"]').trigger('click')
    expect(w.get('[data-testid="sentence-rewrite"]').attributes('disabled')).toBeDefined()   // нічого не змінено
    await w.get('[data-testid="sentence-draft"]').setValue('Мама мила раму, а тато — вікно.')
    await w.get('[data-testid="sentence-rewrite"]').trigger('click')
    const request = send.mock.calls[0][0]
    expect(readSentenceRequest(request)).toMatchObject({ action: 'set_text', text: 'Мама мила раму, а тато — вікно.', object_id: 's' })
    // ноутбук переписав: нова ревізія приходить разом із відповіддю
    await w.setProps({ sentence: { ...sentence, source_revision: 'c'.repeat(64), text: 'Мама мила раму, а тато — вікно.' },
      result: { request_id: request.request_id, status: 'done' } })
    expect(w.text()).toContain('Дію виконано.')
    expect(w.find('[data-testid="sentence-draft"]').exists()).toBe(false)
    expect(w.get('[data-testid="sentence-text"]').text()).toBe('Мама мила раму, а тато — вікно.')
    w.unmount()
  })

  it('схема: текст речення необов’язковий і перевірений; set_text лише з текстом; «немає місця» — причина', () => {
    const snap = { page_id: 'p', object_id: 's', source_revision: 'a'.repeat(64), punct: false, words: [] }
    expect(parseRemoteSentence(snap)).not.toBeNull()
    expect(parseRemoteSentence({ ...snap, text: 'Рядок.\nДругий.' })?.text).toBe('Рядок.\nДругий.')
    expect(parseRemoteSentence({ ...snap, text: 'а'.repeat(301) })).toBeNull()
    expect(parseRemoteSentence({ ...snap, text: 'рядок\tдругий' })).toBeNull()
    const base = { action: 'set_text', request_id: RID, page_id: 'p', object_id: 's', source_revision: 'a'.repeat(64) }
    expect(readSentenceRequest({ ...base, text: 'Речення.' })).not.toBeNull()
    expect(readSentenceRequest(base)).toBeNull()
    expect(readSentenceRequest({ ...base, text: '  ' })).toBeNull()
    expect(readSentenceRequest({ ...base, text: 'Речення.', hidden: true })).toBeNull()
  })
})
