// Phase 14 B3.3: Tests for SaveAsTemplateDialog component
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import SaveAsTemplateDialog from '@/modules/knowledge/components/SaveAsTemplateDialog.vue'

vi.mock('@/modules/knowledge/api/templateApi', () => ({
  templateApi: {
    saveAsTemplate: vi.fn(),
  },
}))

import { templateApi } from '@/modules/knowledge/api/templateApi'
const mockSave = vi.mocked(templateApi.saveAsTemplate)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      common: { cancel: 'Cancel' },
      knowledge: {
        template: {
          saveTitle: 'Save as template',
          saveSubtitle: 'Other tutors will be able to use your lesson',
          titleLabel: 'Template title',
          subjectLabel: 'Subject',
          difficultyLabel: 'Difficulty level',
          communityToggle: 'Make available to everyone',
          communityHint: 'Template will be available in the library',
          saveButton: 'Save template',
          saving: 'Saving...',
        },
      },
      subject: {
        math: 'Mathematics',
        physics: 'Physics',
        english: 'English',
        ukrainian: 'Ukrainian',
        chemistry: 'Chemistry',
        biology: 'Biology',
        history: 'History',
        geography: 'Geography',
        informatics: 'Informatics',
        other: 'Other',
      },
    },
  },
})

const defaultProps = {
  modelValue: true,
  lessonId: 'lesson-123',
  lessonTitle: 'Quadratic Equations',
  subjectTag: 'math',
  thumbnailUrl: null,
}

async function mountDialog(propsOverrides = {}) {
  const props = { ...defaultProps, ...propsOverrides }
  // Mount with modelValue=false first, then open to trigger watch prefill
  const shouldOpen = props.modelValue !== false
  const w = mount(SaveAsTemplateDialog, {
    props: { ...props, modelValue: false },
    global: {
      plugins: [i18n],
      stubs: { Teleport: true },
    },
  })
  if (shouldOpen) {
    await w.setProps({ modelValue: true })
    await nextTick()
    await nextTick()
  }
  return w
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSave.mockResolvedValue({
    id: 'tpl-new',
    source_lesson_title: 'Quadratic Equations',
    source_lesson_slug: 'quadratic-equations',
    tutor_name: 'Test Tutor',
    tutor_slug: 'test-tutor',
    tutor_avatar_url: null,
    is_community: true,
    used_count: 0,
    subject_tag: 'math',
    difficulty_level: 3,
    board_thumbnail_url: null,
    created_at: '2026-03-16T12:00:00Z',
  })
})

describe('SaveAsTemplateDialog', () => {
  it('renders dialog title', async () => {
    const w = await mountDialog()
    expect(w.text()).toContain('Save as template')
  })

  it('prefills lesson title', async () => {
    const w = await mountDialog()
    const input = w.find('#template-title')
    expect((input.element as HTMLInputElement).value).toBe('Quadratic Equations')
  })

  it('prefills subject tag', async () => {
    const w = await mountDialog()
    const select = w.find('#template-subject')
    expect((select.element as HTMLSelectElement).value).toBe('math')
  })

  it('renders all 10 subject options', async () => {
    const w = await mountDialog()
    const options = w.findAll('#template-subject option')
    expect(options.length).toBe(10)
  })

  it('has community checkbox checked by default', async () => {
    const w = await mountDialog()
    const checkbox = w.find('#is_community')
    expect((checkbox.element as HTMLInputElement).checked).toBe(true)
  })

  it('calls templateApi.saveAsTemplate on save', async () => {
    const w = await mountDialog()
    const saveBtn = w.findAll('button').find(b => b.text() === 'Save template')
    expect(saveBtn).toBeTruthy()
    await saveBtn!.trigger('click')
    await flushPromises()
    expect(mockSave).toHaveBeenCalledWith({
      lesson_id: 'lesson-123',
      is_community: true,
      difficulty_level: 3,
    })
  })

  it('emits saved and update:modelValue on success', async () => {
    const w = await mountDialog()
    const saveBtn = w.findAll('button').find(b => b.text() === 'Save template')
    await saveBtn!.trigger('click')
    await flushPromises()
    expect(w.emitted('saved')).toBeTruthy()
    expect(w.emitted('update:modelValue')).toBeTruthy()
    expect(w.emitted('update:modelValue')![0]).toEqual([false])
  })

  it('shows error on API failure', async () => {
    mockSave.mockRejectedValueOnce({
      response: { data: { detail: 'Lesson not published' } },
    })
    const w = await mountDialog()
    const saveBtn = w.findAll('button').find(b => b.text() === 'Save template')
    await saveBtn!.trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Lesson not published')
  })

  it('emits update:modelValue(false) on cancel', async () => {
    const w = await mountDialog()
    const cancelBtn = w.findAll('button').find(b => b.text() === 'Cancel')
    await cancelBtn!.trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual([false])
  })

  it('is not rendered when modelValue is false', async () => {
    const w = await mountDialog({ modelValue: false })
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('shows thumbnail when URL provided', async () => {
    const w = await mountDialog({ thumbnailUrl: 'https://example.com/thumb.png' })
    const img = w.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/thumb.png')
  })

  it('disables save button when title is empty', async () => {
    const w = await mountDialog()
    const input = w.find('#template-title')
    await input.setValue('')
    const saveBtn = w.findAll('button').find(b => b.text() === 'Save template')
    expect((saveBtn!.element as HTMLButtonElement).disabled).toBe(true)
  })
})
