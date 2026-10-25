/** Справжній host → registry → renderer → намір → host → boardStore, без мережі. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, defineComponent, h, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import WBOverlayLayer from '../components/canvas/WBOverlayLayer.vue'
import { useWBStore } from '../board/state/boardStore'
import { createDictationLine } from '../board/createDictationLine'
import { flushPendingUpdates } from '../board/state/assetUpdateBatcher'
import type { DictationLineData } from '../board/dictationLine'
import { sentenceFixture } from './fixtures/dictationLineFixture'

const wrappers: VueWrapper[] = []
beforeEach(() => { flushPendingUpdates(); setActivePinia(createPinia()) })
afterEach(() => wrappers.splice(0).forEach((w) => w.unmount()))
function render(tutor = true) {
  const store = useWBStore()
  store.pages = [{ id: 'p', name: 'Сторінка', strokes: [], assets: [createDictationLine('s', 40, 40, sentenceFixture())] }]
  store.currentPageIndex = 0
  store.selectedIds = ['s']
  store.mode = 'edit'
  const host = defineComponent({ setup() {
    const assets = computed(() => store.pages[store.currentPageIndex].assets)
    return () => h(WBOverlayLayer, { assets: assets.value, tool: 'select', isTutor: tutor,
      getOverlayStyle: () => ({ left: '40px', top: '40px', width: '400px', height: '120px' }),
      onAssetUpdate: (asset) => store.updateAsset(asset),
    })
  } })
  const wrapper = mount(host)
  wrappers.push(wrapper)
  return { wrapper, store, data: () => store.pages[0].assets[0].data as DictationLineData }
}

describe('Речення у справжньому overlay host', () => {
  it('кнопки працюють через registry й штатний store, зберігають дві окремі дії', async () => {
    const { wrapper, store, data } = render()
    const ops: string[] = []
    store.onOperation((op) => ops.push(op.op_type))
    await wrapper.get('[data-token-id="w1"]').trigger('pointerdown', { button: 0 })
    await wrapper.get('[data-testid="dictation-word"]').trigger('pointerdown', { button: 0 })
    await wrapper.get('[data-testid="dictation-punctuation"]').trigger('pointerdown', { button: 0 })
    expect(data().hidden).toEqual({ words: ['w1'], punct: true })
    expect(wrapper.findAll('polyline')).toHaveLength(4)
    expect(ops).toEqual(['asset_update', 'asset_update'])
    store.undo(); flushPendingUpdates(); await nextTick()
    expect(wrapper.findAll('polyline')).toHaveLength(6)
    store.redo(); flushPendingUpdates(); await nextTick()
    expect(wrapper.findAll('polyline')).toHaveLength(4)
  })
  it('навіть за select/edit учень без isTutor не отримує кнопок', () => {
    const { wrapper } = render(false)
    expect(wrapper.find('[data-testid="dictation-controls"]').exists()).toBe(false)
    expect(wrapper.findAll('polyline')).toHaveLength(10)
  })
})
