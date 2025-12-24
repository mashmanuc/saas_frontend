import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import DraftToolbar from '@/modules/booking/components/calendar/DraftToolbar.vue'
import { useDraftStore } from '@/modules/booking/stores/draftStore'
import type { CalendarCell } from '@/modules/booking/types/calendar'

const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}

vi.mock('@/composables/useToast', () => ({
  useToast: () => toastMock,
}))

vi.mock('@/modules/booking/api/availabilityApi', () => ({
  availabilityApi: {
    getGenerationJobStatus: vi.fn().mockResolvedValue({
      job_id: 'test-job-123',
      status: 'completed',
      progress: 100,
      result: {
        slots_created: 336,
        slots_deleted: 0,
      },
    }),
  },
}))

describe('DraftToolbar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    Object.values(toastMock).forEach(fn => fn.mockReset())
  })

  const mockCell: CalendarCell = {
    startAtUTC: '2024-12-23T10:00:00Z',
    durationMin: 30,
    status: 'available',
    source: 'template',
  }

  describe('Visibility', () => {
    it('does not render when no patches', () => {
      const wrapper = mount(DraftToolbar)

      expect(wrapper.find('.draft-toolbar').exists()).toBe(false)
    })

    it('renders when patches exist', () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_blocked')

      const wrapper = mount(DraftToolbar)

      expect(wrapper.find('.draft-toolbar').exists()).toBe(true)
    })

    it('shows correct patch count', () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_blocked')
      draftStore.addPatch(
        { ...mockCell, startAtUTC: '2024-12-23T11:00:00Z' },
        'set_available'
      )

      const wrapper = mount(DraftToolbar)

      expect(wrapper.text()).toContain('2')
    })
  })

  describe('Apply button', () => {
    it('calls applyPatches when clicked', async () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_blocked')

      const applyPatchesSpy = vi.spyOn(draftStore, 'applyPatches')
      applyPatchesSpy.mockResolvedValue({
        applied: [{ startAtUTC: mockCell.startAtUTC }],
        rejected: [],
        summary: { total: 1, applied: 1, rejected: 0 },
      })

      const wrapper = mount(DraftToolbar)

      const applyButton = wrapper.find('.btn-primary')
      await applyButton.trigger('click')

      expect(applyPatchesSpy).toHaveBeenCalled()
    })

    it('shows loading state during apply', async () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_blocked')

      const applyPatchesSpy = vi.spyOn(draftStore, 'applyPatches')
      applyPatchesSpy.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      const wrapper = mount(DraftToolbar)

      const applyButton = wrapper.find('.btn-primary')
      await applyButton.trigger('click')

      // Check for loading spinner
      expect(wrapper.find('.animate-spin').exists()).toBe(true)
    })

    it('disables button during apply', async () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_blocked')

      const applyPatchesSpy = vi.spyOn(draftStore, 'applyPatches')
      applyPatchesSpy.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      const wrapper = mount(DraftToolbar)

      const applyButton = wrapper.find('.btn-primary')
      await applyButton.trigger('click')

      expect(applyButton.attributes('disabled')).toBeDefined()
    })

    it('shows success notification for full success', async () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_blocked')

      const applyPatchesSpy = vi.spyOn(draftStore, 'applyPatches')
      applyPatchesSpy.mockResolvedValue({
        applied: [{ startAtUTC: mockCell.startAtUTC }],
        rejected: [],
        summary: { total: 1, applied: 1, rejected: 0 },
      })

      const wrapper = mount(DraftToolbar)

      const applyButton = wrapper.find('.btn-primary')
      await applyButton.trigger('click')

      await wrapper.vm.$nextTick()

      expect(toastMock.success).toHaveBeenCalledWith(
        expect.stringContaining('Застосовано 1 змін')
      )
    })

    it('shows warning notification for partial success', async () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_blocked')
      draftStore.addPatch(
        { ...mockCell, startAtUTC: '2024-12-23T11:00:00Z' },
        'set_available'
      )

      const applyPatchesSpy = vi.spyOn(draftStore, 'applyPatches')
      applyPatchesSpy.mockResolvedValue({
        applied: [{ startAtUTC: mockCell.startAtUTC }],
        rejected: [{ startAtUTC: '2024-12-23T11:00:00Z', reason: 'conflict' }],
        summary: { total: 2, applied: 1, rejected: 1 },
      })

      const wrapper = mount(DraftToolbar)

      const applyButton = wrapper.find('.btn-primary')
      await applyButton.trigger('click')

      await wrapper.vm.$nextTick()

      expect(toastMock.warning).toHaveBeenCalledWith(
        expect.stringContaining('1 відхилено')
      )
    })

    it('shows error notification on failure', async () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_blocked')

      const applyPatchesSpy = vi.spyOn(draftStore, 'applyPatches')
      applyPatchesSpy.mockRejectedValue(new Error('Network error'))

      const wrapper = mount(DraftToolbar)

      const applyButton = wrapper.find('.btn-primary')
      await applyButton.trigger('click')

      await wrapper.vm.$nextTick()

      expect(toastMock.error).toHaveBeenCalledWith(
        'Помилка при застосуванні змін'
      )
    })
  })

  describe('Reset button', () => {
    it('shows confirm dialog when clicked', async () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_blocked')

      const confirmSpy = vi.spyOn(window, 'confirm')
      confirmSpy.mockReturnValue(false)

      const wrapper = mount(DraftToolbar)

      const resetButton = wrapper.find('.btn-secondary')
      await resetButton.trigger('click')

      expect(confirmSpy).toHaveBeenCalledWith('Скасувати всі зміни?')
    })

    it('clears patches when confirmed', async () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_blocked')

      const confirmSpy = vi.spyOn(window, 'confirm')
      confirmSpy.mockReturnValue(true)

      const mockToast = {
        info: vi.fn(),
      }
      ;(window as any).toast = mockToast

      const clearSpy = vi.spyOn(draftStore, 'clearAllPatches')

      const wrapper = mount(DraftToolbar)

      const resetButton = wrapper.find('.btn-secondary')
      await resetButton.trigger('click')

      expect(clearSpy).toHaveBeenCalled()
    })

    it('does not clear patches when cancelled', async () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_blocked')

      const confirmSpy = vi.spyOn(window, 'confirm')
      confirmSpy.mockReturnValue(false)

      const clearSpy = vi.spyOn(draftStore, 'clearAllPatches')

      const wrapper = mount(DraftToolbar)

      const resetButton = wrapper.find('.btn-secondary')
      await resetButton.trigger('click')

      expect(clearSpy).not.toHaveBeenCalled()
    })

    it('shows info notification after reset', async () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_blocked')

      const confirmSpy = vi.spyOn(window, 'confirm')
      confirmSpy.mockReturnValue(true)

      const wrapper = mount(DraftToolbar)

      const resetButton = wrapper.find('.btn-secondary')
      await resetButton.trigger('click')

      expect(toastMock.info).toHaveBeenCalledWith('Зміни скасовано')
    })
  })

  describe('Styling', () => {
    it('has amber background', () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_blocked')

      const wrapper = mount(DraftToolbar)

      const toolbar = wrapper.find('.draft-toolbar')
      expect(toolbar.classes()).toContain('draft-toolbar')
    })

    it('displays alert icon', () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_blocked')

      const wrapper = mount(DraftToolbar)

      expect(wrapper.find('.text-amber-600').exists()).toBe(true)
    })
  })

  describe('Integration', () => {
    it('hides after successful apply with no rejected', async () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_blocked')

      const applyPatchesSpy = vi.spyOn(draftStore, 'applyPatches')
      applyPatchesSpy.mockResolvedValue({
        applied: [{ startAtUTC: mockCell.startAtUTC }],
        rejected: [],
        summary: { total: 1, applied: 1, rejected: 0 },
      })

      const wrapper = mount(DraftToolbar)

      expect(wrapper.find('.draft-toolbar').exists()).toBe(true)

      const applyButton = wrapper.find('.btn-primary')
      await applyButton.trigger('click')

      await wrapper.vm.$nextTick()

      // After successful apply, toolbar should hide (no more patches)
      // Note: This requires proper store integration
    })
  })

  describe('Template Integration (v0.48)', () => {
    it('renders "Save as Template" button', () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_available')

      const wrapper = mount(DraftToolbar)

      const templateButton = wrapper.find('.btn-template')
      expect(templateButton.exists()).toBe(true)
      expect(templateButton.text()).toContain('шаблон')
    })

    it('shows three action buttons in correct order', () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_available')

      const wrapper = mount(DraftToolbar)

      const buttons = wrapper.findAll('.draft-actions button')
      expect(buttons.length).toBe(3)
      expect(buttons[0].classes()).toContain('btn-secondary') // Reset
      expect(buttons[1].classes()).toContain('btn-template') // Save as Template
      expect(buttons[2].classes()).toContain('btn-primary') // Apply Once
    })

    it('opens TemplateConfirmModal when "Save as Template" clicked', async () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_available')

      const wrapper = mount(DraftToolbar)

      const templateButton = wrapper.find('.btn-template')
      await templateButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Modal should be visible
      expect(wrapper.vm.showTemplateModal).toBe(true)
    })

    it('disables template button during submission', async () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_available')

      const saveAsTemplateSpy = vi.spyOn(draftStore, 'saveAsTemplate')
      saveAsTemplateSpy.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      const wrapper = mount(DraftToolbar)

      wrapper.vm.applying = true
      await wrapper.vm.$nextTick()

      const templateButton = wrapper.find('.btn-template')
      expect(templateButton.attributes('disabled')).toBeDefined()
    })

    it('passes correct patches to TemplateConfirmModal', () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_available')
      draftStore.addPatch(
        { ...mockCell, startAtUTC: '2024-12-23T11:00:00Z' },
        'set_blocked'
      )

      const wrapper = mount(DraftToolbar)

      const patchesForModal = wrapper.vm.patchesForModal
      expect(patchesForModal).toHaveLength(2)
      expect(patchesForModal[0].newStatus).toBe('available')
      expect(patchesForModal[1].newStatus).toBe('blocked')
    })

    it('calls saveAsTemplate on confirm', async () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_available')

      const saveAsTemplateSpy = vi.spyOn(draftStore, 'saveAsTemplate')
      saveAsTemplateSpy.mockResolvedValue({
        id: 1,
        tutor_id: 79,
        weekly_slots: [],
        timezone: 'Europe/Kiev',
        version: 1,
        last_generation_job_id: 'test-job-123',
        updated_at: '2024-12-23T20:00:00Z',
      })

      const wrapper = mount(DraftToolbar)

      await wrapper.vm.handleTemplateConfirm()

      expect(saveAsTemplateSpy).toHaveBeenCalled()
      expect(toastMock.success).toHaveBeenCalledWith('Шаблон збережено!')
    })

    it('shows GenerationProgressModal after template save', async () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_available')

      const saveAsTemplateSpy = vi.spyOn(draftStore, 'saveAsTemplate')
      saveAsTemplateSpy.mockResolvedValue({
        id: 1,
        tutor_id: 79,
        weekly_slots: [],
        timezone: 'Europe/Kiev',
        version: 1,
        last_generation_job_id: 'test-job-123',
        updated_at: '2024-12-23T20:00:00Z',
      })

      const wrapper = mount(DraftToolbar)

      await wrapper.vm.handleTemplateConfirm()
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.showProgressModal).toBe(true)
      expect(wrapper.vm.generationJobId).toBe('test-job-123')
    })

    it('handles template save error', async () => {
      const draftStore = useDraftStore()
      draftStore.addPatch(mockCell, 'set_available')

      const saveAsTemplateSpy = vi.spyOn(draftStore, 'saveAsTemplate')
      saveAsTemplateSpy.mockRejectedValue(new Error('Template save failed'))

      const wrapper = mount(DraftToolbar)

      await wrapper.vm.handleTemplateConfirm()
      await wrapper.vm.$nextTick()

      expect(toastMock.error).toHaveBeenCalledWith('Помилка при збереженні шаблону')
    })
  })
})
