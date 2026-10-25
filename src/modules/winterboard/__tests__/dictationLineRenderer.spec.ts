import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import DictationLineRenderer from '../components/board/objects/DictationLineRenderer.vue'
import { applyDictationAction, type DictationAction } from '../board/dictationLine'
import { sentenceFixture } from './fixtures/dictationLineFixture'
import type { WBAsset } from '../types/winterboard'

const capture = vi.hoisted(() => ({ register: vi.fn(), snapshot: vi.fn() }))
vi.mock('../composables/useExportCapture', () => ({ useExportCapture: capture.register }))
vi.mock('../utils/snapshotElement', () => ({ snapshotElement: capture.snapshot }))
const wrappers: VueWrapper[] = []
afterEach(() => { wrappers.splice(0).forEach((w) => w.unmount()); vi.clearAllMocks() })

function asset(): WBAsset {
  return { id: 'sentence-1', type: 'dictation_line', src: '', x: 40, y: 50, w: 400, h: 120,
    rotation: 0, locked: false, data: sentenceFixture() } as unknown as WBAsset
}
function render(props: Record<string, unknown> = {}) {
  const wrapper = mount(DictationLineRenderer, { props: { asset: asset(), isSelected: true, interactive: true, ...props } })
  wrappers.push(wrapper)
  return wrapper
}
async function press(w: VueWrapper, selector: string) {
  await w.get(selector).trigger('pointerdown', { button: 0 })
}

describe('Речення — ноутбук, перо, readonly та SVG', () => {
  it('усі механічні дії є на ноутбуці; вибір слова — не запис', async () => {
    const w = render()
    expect(w.findAll('[data-token-id]')).toHaveLength(2)
    expect(w.get('[data-testid="dictation-word"]').attributes('disabled')).toBeDefined()
    await press(w, '[data-token-id="w1"]')
    expect(w.emitted('update:asset')).toBeUndefined()
    await press(w, '[data-testid="dictation-word"]')
    const [[action]] = w.emitted('dictation-action') as DictationAction[][]
    expect(action).toEqual({ action: 'set_word', token_id: 'w1', hidden: true, source_revision: 'a'.repeat(64) })
    expect(w.emitted('update:asset')).toBeUndefined() // повний stale asset більше не передається
  })

  it('одне натискання пером і click миші не породжують два записи', async () => {
    const w = render()
    await press(w, '[data-testid="dictation-punctuation"]')
    await w.get('[data-testid="dictation-punctuation"]').trigger('click', { detail: 1 })
    expect(w.emitted('dictation-action')).toHaveLength(1)
    await w.get('[data-testid="dictation-punctuation"]').trigger('pointerdown', { button: 2 })
    expect(w.emitted('dictation-action')).toHaveLength(1)
  })

  it('клавіатура працює, схований стан приходить лише через props', async () => {
    const w = render()
    await w.get('[data-testid="dictation-punctuation"]').trigger('click', { detail: 0 })
    const [[action]] = w.emitted('dictation-action') as DictationAction[][]
    const current = asset()
    const updated = { ...current, data: applyDictationAction(sentenceFixture(), action) }
    expect(w.findAll('polyline')).toHaveLength(10)
    await w.setProps({ asset: updated })
    expect(w.findAll('polyline')).toHaveLength(8)
    expect(w.get('[data-testid="dictation-punctuation"]').text()).toBe('Показати пунктуацію')
    await press(w, '[data-testid="dictation-restore"]')
    expect(w.emitted('dictation-action')).toHaveLength(2)
  })

  it.each([{ interactive: false }, { isSelected: false }, { asset: { ...asset(), locked: true } }])('readonly/не вибрано/locked: %j — без керування та записів', (props) => {
    const w = render(props)
    expect(w.find('[data-testid="dictation-controls"]').exists()).toBe(false)
    expect(w.findAll('polyline')).toHaveLength(10)
    expect(w.emitted('update:asset')).toBeUndefined()
    expect(w.emitted('dictation-action')).toBeUndefined()
  })

  it('Replay/undo/redo — лише нові props, без ops чи повторного письма', async () => {
    const original = asset()
    const data = sentenceFixture()
    const hidden = { ...original, data: applyDictationAction(data, { action: 'set_word', token_id: 'w0', hidden: true, source_revision: data.source.revision }) }
    const w = render({ interactive: false, asset: original })
    await w.setProps({ asset: hidden })
    expect(w.findAll('polyline')).toHaveLength(6)
    expect(w.findAll('line')).toHaveLength(1)
    await w.setProps({ asset: original })
    expect(w.findAll('polyline')).toHaveLength(10)
    await w.setProps({ asset: JSON.parse(JSON.stringify(hidden)) })
    expect(w.findAll('polyline')).toHaveLength(6)
    expect(w.emitted('update:asset')).toBeUndefined()
    expect(w.emitted('dictation-action')).toBeUndefined()
  })

  it('знімок бере лише SVG чорнила, а не кнопки/повний текст', async () => {
    const w = render()
    const [getId, snapshot] = capture.register.mock.calls[0]
    expect(getId()).toBe('sentence-1')
    const signal = new AbortController().signal
    await snapshot(signal)
    expect(capture.snapshot).toHaveBeenCalledWith(w.get('[data-testid="dictation-ink"]').element, signal)
    expect(w.get('[data-testid="dictation-controls"]').attributes()).toHaveProperty('data-export-hide')
  })

  it('неправильні дані дають видиму відмову, без часткового малюнка', () => {
    const w = render({ asset: { ...asset(), data: { version: 99 } } })
    expect(w.get('[role="alert"]').text()).toContain('некоректні дані')
    expect(w.find('svg').exists()).toBe(false)
    expect(w.find('button').exists()).toBe(false)
  })

  it('перехід до іншого речення скидає вибір слова', async () => {
    const w = render()
    await press(w, '[data-token-id="w1"]')
    await w.setProps({ asset: { ...asset(), id: 'sentence-2' } })
    expect(w.get('[data-testid="dictation-word"]').attributes('disabled')).toBeDefined()
  })
})
