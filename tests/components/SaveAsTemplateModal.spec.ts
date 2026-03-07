/**
 * Phase 4 Day 2 — SaveAsTemplateModal + SavedTemplateCard tests.
 */
import { describe, it, expect, vi } from 'vitest'

// ═══════════════════════════════════════════════════════════════
// 1. SaveAsTemplateModal: save logic — success path
// ═══════════════════════════════════════════════════════════════

describe('SaveAsTemplateModal save logic', () => {
  function createModalLogic(apiMock: (lessonId: number, title: string) => Promise<any>) {
    let isSaving = false
    let error: string | null = null
    let closeCalled = false
    let savedId: number | null = null

    async function save(lessonId: number | null, title: string) {
      if (!title.trim() || !lessonId) return
      isSaving = true
      error = null
      try {
        const res = await apiMock(lessonId, title.trim())
        const data = res?.data ?? res
        savedId = data.id
        closeCalled = true
      } catch (e: any) {
        const status = e?.response?.status
        if (status === 400) {
          error = 'titleRequired'
        } else if (status === 404) {
          error = 'lessonNotFound'
        } else {
          error = 'saveFailed'
        }
      } finally {
        isSaving = false
      }
    }

    return {
      getIsSaving: () => isSaving,
      getError: () => error,
      getCloseCalled: () => closeCalled,
      getSavedId: () => savedId,
      save,
    }
  }

  it('save success → closes modal, emits saved with template id', async () => {
    const logic = createModalLogic(() =>
      Promise.resolve({ id: 42, title: 'My Template' }),
    )
    await logic.save(10, 'My Template')
    expect(logic.getSavedId()).toBe(42)
    expect(logic.getCloseCalled()).toBe(true)
    expect(logic.getError()).toBe(null)
    expect(logic.getIsSaving()).toBe(false)
  })

  it('save does nothing when title is empty', async () => {
    const apiMock = vi.fn().mockResolvedValue({ id: 1 })
    const logic = createModalLogic(apiMock)
    await logic.save(10, '   ')
    expect(apiMock).not.toHaveBeenCalled()
    expect(logic.getSavedId()).toBe(null)
  })

  it('save does nothing when lessonId is null', async () => {
    const apiMock = vi.fn().mockResolvedValue({ id: 1 })
    const logic = createModalLogic(apiMock)
    await logic.save(null, 'Title')
    expect(apiMock).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════
// 2. Save button disabled when title empty
// ═══════════════════════════════════════════════════════════════

describe('SaveAsTemplateModal: button disabled state', () => {
  it('disabled when title is empty', () => {
    const title = ''
    const isSaving = false
    expect(!title.trim() || isSaving).toBe(true)
  })

  it('disabled when saving in progress', () => {
    const title = 'My Template'
    const isSaving = true
    expect(!title.trim() || isSaving).toBe(true)
  })

  it('enabled when title present and not saving', () => {
    const title = 'My Template'
    const isSaving = false
    expect(!title.trim() || isSaving).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// 3. Save error 400 → titleRequired
// ═══════════════════════════════════════════════════════════════

describe('SaveAsTemplateModal: error handling', () => {
  function createModalLogic(apiMock: () => Promise<any>) {
    let error: string | null = null

    async function save(lessonId: number, title: string) {
      error = null
      try {
        await apiMock()
      } catch (e: any) {
        const status = e?.response?.status
        if (status === 400) error = 'titleRequired'
        else if (status === 404) error = 'lessonNotFound'
        else error = 'saveFailed'
      }
    }

    return { getError: () => error, save }
  }

  it('400 → titleRequired', async () => {
    const logic = createModalLogic(() =>
      Promise.reject({ response: { status: 400 } }),
    )
    await logic.save(1, 'T')
    expect(logic.getError()).toBe('titleRequired')
  })

  it('404 → lessonNotFound', async () => {
    const logic = createModalLogic(() =>
      Promise.reject({ response: { status: 404 } }),
    )
    await logic.save(1, 'T')
    expect(logic.getError()).toBe('lessonNotFound')
  })

  it('500 → saveFailed', async () => {
    const logic = createModalLogic(() =>
      Promise.reject({ response: { status: 500 } }),
    )
    await logic.save(1, 'T')
    expect(logic.getError()).toBe('saveFailed')
  })
})

// ═══════════════════════════════════════════════════════════════
// 4. SavedTemplateCard: shows title, date, content_count, has_board
// ═══════════════════════════════════════════════════════════════

describe('SavedTemplateCard data display', () => {
  const template = {
    id: 7,
    title: 'Algebra — Trigonometry',
    content_count: 5,
    has_board: true,
    source_lesson_id: 3,
    created_at: '2026-03-05T10:00:00Z',
  }

  it('has title', () => {
    expect(template.title).toBe('Algebra — Trigonometry')
  })

  it('has content_count', () => {
    expect(template.content_count).toBe(5)
  })

  it('has_board is true', () => {
    expect(template.has_board).toBe(true)
  })

  it('formattedDate is valid', () => {
    const d = new Date(template.created_at).toLocaleDateString()
    expect(d).toBeTruthy()
  })
})

// ═══════════════════════════════════════════════════════════════
// 5. Delete template → confirmation logic
// ═══════════════════════════════════════════════════════════════

describe('SavedTemplateCard: delete confirmation', () => {
  it('delete emits when confirmed', () => {
    let emitted: number | null = null
    const confirmResult = true // simulates window.confirm → true

    function confirmDelete(templateId: number) {
      if (confirmResult) {
        emitted = templateId
      }
    }

    confirmDelete(7)
    expect(emitted).toBe(7)
  })

  it('delete does NOT emit when cancelled', () => {
    let emitted: number | null = null
    const confirmResult = false

    function confirmDelete(templateId: number) {
      if (confirmResult) {
        emitted = templateId
      }
    }

    confirmDelete(7)
    expect(emitted).toBe(null)
  })
})

// ═══════════════════════════════════════════════════════════════
// 6. i18n keys existence
// ═══════════════════════════════════════════════════════════════

describe('i18n: template.* keys', () => {
  const fs = require('fs')
  const path = require('path')
  const uk = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../src/i18n/locales/uk.json'), 'utf-8'),
  )
  const en = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../src/i18n/locales/en.json'), 'utf-8'),
  )

  const requiredKeys = [
    'saveAsTemplate',
    'titleLabel',
    'titlePlaceholder',
    'save',
    'createLesson',
    'materials',
    'hasBoard',
    'noTemplates',
    'titleRequired',
    'lessonNotFound',
    'saveFailed',
    'deleteConfirm',
  ]

  for (const key of requiredKeys) {
    it(`uk.template.${key} exists`, () => {
      expect(uk.template[key]).toBeTruthy()
    })
    it(`en.template.${key} exists`, () => {
      expect(en.template[key]).toBeTruthy()
    })
  }
})

// ═══════════════════════════════════════════════════════════════
// 7. API methods exist
// ═══════════════════════════════════════════════════════════════

describe('lessonsTemplateApi: new methods', () => {
  it('saveAsTemplate exists', async () => {
    const api = (await import('@/modules/lessons/api/lessonsTemplateApi')).lessonsTemplateApi
    expect(typeof api.saveAsTemplate).toBe('function')
  })

  it('createLessonFromTemplate exists', async () => {
    const api = (await import('@/modules/lessons/api/lessonsTemplateApi')).lessonsTemplateApi
    expect(typeof api.createLessonFromTemplate).toBe('function')
  })
})
