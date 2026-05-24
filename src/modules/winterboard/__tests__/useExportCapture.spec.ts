// @vitest-environment jsdom
/**
 * Tests для useExportCapture — composable lifecycle wiring.
 *
 * Reviewer guard: composable МАЄ автоматично register at mount /
 * unregister at unmount. Без цього розкид reactive registrations
 * накопичується (memory leak) і stale capture fn-и викликаються для
 * unmounted widgets (NPE або incorrect snapshot).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'

vi.mock('../api/winterboardApi', () => ({
  winterboardApi: { uploadExportPreview: vi.fn() },
}))

import { exportPreviewService } from '../services/exportPreviewService'
import { useExportCapture } from '../composables/useExportCapture'

function makeWidget(assetIdRef: { value: string | null }) {
  return defineComponent({
    setup() {
      useExportCapture(
        () => assetIdRef.value,
        async () => ({ blob: new Blob(), width: 1, height: 1 }),
      )
      return () => h('div', { 'data-testid': 'widget' })
    },
  })
}

describe('useExportCapture', () => {
  beforeEach(() => {
    exportPreviewService._resetForTests()
  })

  it('registers capture fn at mount', () => {
    const id = ref<string | null>('asset-1')
    mount(makeWidget(id))
    expect(exportPreviewService.hasCapture('asset-1')).toBe(true)
  })

  it('unregisters at unmount', () => {
    const id = ref<string | null>('asset-2')
    const wrapper = mount(makeWidget(id))
    expect(exportPreviewService.hasCapture('asset-2')).toBe(true)
    wrapper.unmount()
    expect(exportPreviewService.hasCapture('asset-2')).toBe(false)
  })

  it('re-registers under new id when assetId changes', async () => {
    const id = ref<string | null>('initial')
    mount(makeWidget(id))
    expect(exportPreviewService.hasCapture('initial')).toBe(true)

    id.value = 'renamed'
    await Promise.resolve() // flush watcher
    expect(exportPreviewService.hasCapture('initial')).toBe(false)
    expect(exportPreviewService.hasCapture('renamed')).toBe(true)
  })

  it('handles null assetId gracefully (no registration)', () => {
    const id = ref<string | null>(null)
    mount(makeWidget(id))
    expect(exportPreviewService.registeredAssetIds).toEqual([])
  })

  it('handles assetId clear (string → null) — unregisters', async () => {
    const id = ref<string | null>('x')
    mount(makeWidget(id))
    expect(exportPreviewService.hasCapture('x')).toBe(true)
    id.value = null
    await Promise.resolve()
    expect(exportPreviewService.hasCapture('x')).toBe(false)
  })

  it('many widgets register independently', () => {
    const ids = ['w1', 'w2', 'w3', 'w4']
    const wrappers = ids.map((id) => mount(makeWidget(ref(id))))
    expect(exportPreviewService.registeredAssetIds.sort()).toEqual(ids.sort())
    wrappers.forEach((w) => w.unmount())
    expect(exportPreviewService.registeredAssetIds).toEqual([])
  })
})
