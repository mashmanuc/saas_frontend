import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'

const patchesRef = ref<any[]>([])
const mockApplyPatches = vi.fn()
const mockClearAllPatches = vi.fn()
const mockConfirm = vi.fn()

vi.mock('@/modules/booking/stores/draftStore', () => ({
  useDraftStore: () => ({
    getAllPatches: () => patchesRef.value,
    applyPatches: mockApplyPatches,
    clearAllPatches: mockClearAllPatches,
  })
}))

vi.mock('@/composables/useConfirm', () => ({
  useConfirm: () => ({
    confirm: mockConfirm,
  })
}))

import DraftToolbar from '@/modules/booking/components/common/DraftToolbar.vue'

describe('DraftToolbar', () => {
  beforeEach(() => {
    patchesRef.value = []
    mockApplyPatches.mockReset()
    mockClearAllPatches.mockReset()
    mockConfirm.mockReset()
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
    mockConfirm.mockResolvedValue(true)
    const wrapper = mount(DraftToolbar)

    const resetButton = wrapper.get('button.btn.btn-secondary')
    await resetButton.trigger('click')
    await nextTick()

    expect(mockConfirm).toHaveBeenCalledWith('Clear all changes?')
    expect(mockClearAllPatches).toHaveBeenCalled()
  })
})
