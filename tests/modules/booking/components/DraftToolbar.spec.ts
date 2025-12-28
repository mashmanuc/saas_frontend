import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'

const patchesRef = ref<any[]>([])
const mockApplyPatches = vi.fn()
const mockClearAllPatches = vi.fn()

vi.mock('@/modules/booking/stores/draftStore', () => ({
  useDraftStore: () => ({
    getAllPatches: () => patchesRef.value,
    applyPatches: mockApplyPatches,
    clearAllPatches: mockClearAllPatches,
  })
}))

import DraftToolbar from '@/modules/booking/components/common/DraftToolbar.vue'

describe('DraftToolbar', () => {
  beforeEach(() => {
    patchesRef.value = []
    mockApplyPatches.mockReset()
    mockClearAllPatches.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not render toolbar when there are no patches', () => {
    const wrapper = mount(DraftToolbar)
    expect(wrapper.find('.draft-toolbar').exists()).toBe(false)
  })

  it('shows patch count when patches exist', async () => {
    patchesRef.value = [{ id: 1 }, { id: 2 }]
    const wrapper = mount(DraftToolbar)
    await nextTick()
    expect(wrapper.find('.draft-count').text()).toContain('2')
  })

  it('applies patches when apply button clicked', async () => {
    patchesRef.value = [{ id: 1 }]
    mockApplyPatches.mockResolvedValue({ summary: { applied: 1, rejected: 0 } })
    const wrapper = mount(DraftToolbar)

    const applyButton = wrapper.get('button.btn.btn-primary')
    await applyButton.trigger('click')
    expect(mockApplyPatches).toHaveBeenCalledTimes(1)
  })

  it('resets patches when reset confirmed', async () => {
    patchesRef.value = [{ id: 1 }]
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mount(DraftToolbar)

    const resetButton = wrapper.get('button.btn.btn-secondary')
    await resetButton.trigger('click')

    expect(confirmSpy).toHaveBeenCalled()
    expect(mockClearAllPatches).toHaveBeenCalled()
  })
})
