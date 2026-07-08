// Phase 21: Tests for WBSaveLessonDialog
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import WBSaveLessonDialog from '../components/WBSaveLessonDialog.vue'

// Mock lessonSaveApi
vi.mock('../api/lessonSaveApi', () => ({
  lessonSaveApi: {
    saveLessonFromSession: vi.fn(),
  },
}))

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

import { lessonSaveApi } from '../api/lessonSaveApi'

async function createWrapper(props = {}) {
  const merged = {
    modelValue: true,
    sessionId: 'session-123',
    defaultTitle: 'My Board',
    ...props,
  }
  const shouldOpen = merged.modelValue !== false
  const w = mount(WBSaveLessonDialog, {
    props: { ...merged, modelValue: false },
    global: {
      stubs: {
        Teleport: true,
      },
      mocks: {
        $t: (key: string) => key,
      },
    },
  })
  if (shouldOpen) {
    await w.setProps({ modelValue: true })
    await nextTick()
    await nextTick()
  }
  return w
}

describe('WBSaveLessonDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dialog when modelValue is true', async () => {
    const wrapper = await createWrapper()
    expect(wrapper.find('.save-lesson-dialog').exists()).toBe(true)
  })

  it('does not render dialog when modelValue is false', async () => {
    const wrapper = await createWrapper({ modelValue: false })
    expect(wrapper.find('.save-lesson-dialog').exists()).toBe(false)
  })

  it('prefills title from defaultTitle prop', async () => {
    const wrapper = await createWrapper({ defaultTitle: 'Algebra Lesson' })
    const input = wrapper.find('#lesson-title')
    expect((input.element as HTMLInputElement).value).toBe('Algebra Lesson')
  })

  it('disables Save button when title is empty', async () => {
    const wrapper = await createWrapper({ defaultTitle: '' })
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('winterboard.lesson.saveButton'))
    expect(saveBtn?.attributes('disabled')).toBeDefined()
  })

  it('calls saveLessonFromSession on Save click', async () => {
    const mockSave = vi.mocked(lessonSaveApi.saveLessonFromSession)
    mockSave.mockResolvedValue({
      id: 'lesson-1',
      title: 'Test Lesson',
      status: 'draft',
      created_at: '2026-03-18T12:00:00Z',
    })

    const wrapper = await createWrapper({ defaultTitle: 'Test Lesson' })
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('winterboard.lesson.saveButton'))
    await saveBtn?.trigger('click')
    await flushPromises()

    expect(mockSave).toHaveBeenCalledWith({
      session_id: 'session-123',
      title: 'Test Lesson',
    })
  })

  it('emits saved event on successful save', async () => {
    const mockSave = vi.mocked(lessonSaveApi.saveLessonFromSession)
    mockSave.mockResolvedValue({
      id: 'lesson-abc',
      title: 'Saved Lesson',
      status: 'draft',
      created_at: '2026-03-18T12:00:00Z',
    })

    const wrapper = await createWrapper({ defaultTitle: 'Saved Lesson' })
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('winterboard.lesson.saveButton'))
    await saveBtn?.trigger('click')
    await flushPromises()

    const emitted = wrapper.emitted('saved')
    expect(emitted).toBeTruthy()
    if (emitted) {
      expect(emitted[0][0]).toEqual({ id: 'lesson-abc', title: 'Saved Lesson' })
    }
  })

  it('shows LOCALIZED friendly error on save failure (NOT raw BE/technical string)', async () => {
    const mockSave = vi.mocked(lessonSaveApi.saveLessonFromSession)
    // BE віддає технічний англ. код — юзер його НЕ має бачити.
    mockSave.mockRejectedValue({
      response: { data: { error: 'Session not found' } },
    })

    const wrapper = await createWrapper({ defaultTitle: 'Fail Test' })
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('winterboard.lesson.saveButton'))
    await saveBtn?.trigger('click')
    await flushPromises()

    const alertText = wrapper.find('[role="alert"]').text()
    // Показуємо локалізований ключ, НЕ сирий BE-рядок і НЕ англ. хардкод.
    expect(alertText).toBe('winterboard.lesson.saveError')
    expect(alertText).not.toBe('Session not found')
    expect(alertText).not.toBe('Failed to save lesson')
  })

  it('prevents double-click save (isSaving guard)', async () => {
    const mockSave = vi.mocked(lessonSaveApi.saveLessonFromSession)
    let resolvePromise: (v: any) => void
    mockSave.mockReturnValue(new Promise(r => { resolvePromise = r }))

    const wrapper = await createWrapper({ defaultTitle: 'Double Click' })
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('winterboard.lesson.saveButton'))

    // Click twice rapidly
    await saveBtn?.trigger('click')
    await saveBtn?.trigger('click')

    // Only one API call
    expect(mockSave).toHaveBeenCalledTimes(1)
  })
})
