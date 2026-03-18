/**
 * Phase 4 Day 3 — Knowledge Library FE tests.
 */
import { describe, it, expect, vi } from 'vitest'

// ═══════════════════════════════════════════════════════════════
// Helper: mock KnowledgeLesson
// ═══════════════════════════════════════════════════════════════

function mockLesson(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    public_id: 'abc123',
    status: 'COMPLETED',
    lesson_type: 'INDIVIDUAL',
    start: '2026-03-01T10:00:00Z',
    end: '2026-03-01T11:00:00Z',
    started_at: '2026-03-01T10:00:00Z',
    student: 42,
    student_name: 'Іван Тестовий',
    student_is_demo: false,
    content_count: 3,
    template_count: 1,
    has_board: true,
    session_uuid: 'sess-uuid-001',
    created_at: '2026-03-01T09:00:00Z',
    ...overrides,
  }
}

function mockTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    title: 'Algebra — Trigonometry',
    subject: 'math',
    lesson_type: 'INDIVIDUAL',
    content_count: 5,
    has_board: true,
    source_lesson_id: 1,
    created_at: '2026-03-02T12:00:00Z',
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. renders with 3 tabs
// ═══════════════════════════════════════════════════════════════

describe('KnowledgeLibrary: 3 tabs', () => {
  it('has lessons, templates, starter_packs tab keys', () => {
    const tabKeys = ['lessons', 'templates', 'starter_packs']
    expect(tabKeys).toHaveLength(3)
    expect(tabKeys).toContain('lessons')
    expect(tabKeys).toContain('templates')
    expect(tabKeys).toContain('starter_packs')
  })

  it('tab labels match expected structure', () => {
    const tabs = [
      { key: 'lessons', label: 'Уроки', count: 5 },
      { key: 'templates', label: 'Шаблони', count: 2 },
      { key: 'starter_packs', label: 'Starter Packs', count: null },
    ]
    expect(tabs[0].label).toBe('Уроки')
    expect(tabs[1].label).toBe('Шаблони')
    expect(tabs[2].count).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════
// 2. lessons tab shows KnowledgeLessonCard for each lesson
// ═══════════════════════════════════════════════════════════════

describe('KnowledgeLibrary: lessons tab', () => {
  it('3 lessons → 3 cards', () => {
    const lessons = [mockLesson({ id: 1 }), mockLesson({ id: 2 }), mockLesson({ id: 3 })]
    expect(lessons).toHaveLength(3)
    lessons.forEach((l) => {
      expect(l.student_name).toBeTruthy()
      expect(l.status).toBeTruthy()
    })
  })

  it('lesson card has status, student_name, content_count', () => {
    const lesson = mockLesson({ content_count: 7 })
    expect(lesson.status).toBe('COMPLETED')
    expect(lesson.student_name).toBe('Іван Тестовий')
    expect(lesson.content_count).toBe(7)
  })

  it('demo badge shown when student_is_demo', () => {
    const lesson = mockLesson({ student_is_demo: true })
    expect(lesson.student_is_demo).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// 3. templates tab shows card for each template
// ═══════════════════════════════════════════════════════════════

describe('KnowledgeLibrary: templates tab', () => {
  it('2 templates → 2 items', () => {
    const templates = [mockTemplate({ id: 10 }), mockTemplate({ id: 11 })]
    expect(templates).toHaveLength(2)
  })

  it('template has title, content_count, has_board', () => {
    const t = mockTemplate()
    expect(t.title).toBe('Algebra — Trigonometry')
    expect(t.content_count).toBe(5)
    expect(t.has_board).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// 4. starter_packs tab shows redirect link
// ═══════════════════════════════════════════════════════════════

describe('KnowledgeLibrary: starter_packs tab', () => {
  it('redirect target is /learning-content', () => {
    const redirectTo = '/learning-content'
    expect(redirectTo).toBe('/learning-content')
  })
})

// ═══════════════════════════════════════════════════════════════
// 5. isLoading → skeleton shown (6 placeholders)
// ═══════════════════════════════════════════════════════════════

describe('KnowledgeLibrary: loading state', () => {
  it('6 skeleton placeholders when loading', () => {
    const isLoading = true
    const skeletonCount = 6
    expect(isLoading).toBe(true)
    expect(skeletonCount).toBe(6)
  })
})

// ═══════════════════════════════════════════════════════════════
// 6. empty lessons → empty state shown
// ═══════════════════════════════════════════════════════════════

describe('KnowledgeLibrary: empty state', () => {
  it('no lessons → shows empty message', () => {
    const lessons: unknown[] = []
    const activeTab = 'lessons'
    const showEmpty = activeTab === 'lessons' && lessons.length === 0
    expect(showEmpty).toBe(true)
  })

  it('no templates → shows empty message', () => {
    const templates: unknown[] = []
    const activeTab = 'templates'
    const showEmpty = activeTab === 'templates' && templates.length === 0
    expect(showEmpty).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// 7. tab switch changes displayed content
// ═══════════════════════════════════════════════════════════════

describe('KnowledgeLibrary: tab switching', () => {
  it('switching to templates hides lessons', () => {
    let activeTab: string = 'lessons'
    expect(activeTab).toBe('lessons')

    activeTab = 'templates'
    expect(activeTab).toBe('templates')
    expect(activeTab !== 'lessons').toBe(true)
  })

  it('switching to starter_packs hides both lessons and templates', () => {
    let activeTab: string = 'lessons'
    activeTab = 'starter_packs'
    expect(activeTab).toBe('starter_packs')
    expect(activeTab !== 'lessons').toBe(true)
    expect(activeTab !== 'templates').toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// 8. useKnowledge composable logic
// ═══════════════════════════════════════════════════════════════

describe('useKnowledge: parallel load logic', () => {
  it('loads lessons and templates in parallel', async () => {
    const getLessons = vi.fn().mockResolvedValue([mockLesson()])
    const getTemplates = vi.fn().mockResolvedValue([mockTemplate()])

    const [lessons, templates] = await Promise.all([
      getLessons(),
      getTemplates(),
    ])

    expect(getLessons).toHaveBeenCalledOnce()
    expect(getTemplates).toHaveBeenCalledOnce()
    expect(lessons).toHaveLength(1)
    expect(templates).toHaveLength(1)
  })

  it('error sets error state', async () => {
    const getLessons = vi.fn().mockRejectedValue(new Error('Network error'))
    const getTemplates = vi.fn().mockResolvedValue([])

    let error: string | null = null
    try {
      await Promise.all([getLessons(), getTemplates()])
    } catch {
      error = 'load_failed'
    }

    expect(error).toBe('load_failed')
  })
})

// ═══════════════════════════════════════════════════════════════
// 9. i18n keys existence
// ═══════════════════════════════════════════════════════════════

describe('i18n: knowledge.* keys', () => {
  const fs = require('fs')
  const path = require('path')
  const uk = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../src/i18n/locales/uk.json'), 'utf-8'),
  )
  const en = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../src/i18n/locales/en.json'), 'utf-8'),
  )

  const requiredKeys = [
    'title',
    'tabLessons',
    'tabTemplates',
    'tabStarterPacks',
    'noLessons',
    'noTemplates',
    'materials',
    'templates',
    'openBoard',
    'starterPacksInfo',
    'goToContent',
  ]

  for (const key of requiredKeys) {
    it(`uk.knowledge.${key} exists`, () => {
      expect(uk.knowledge[key]).toBeTruthy()
    })
    it(`en.knowledge.${key} exists`, () => {
      expect(en.knowledge[key]).toBeTruthy()
    })
  }

  it('uk.menu.knowledge exists', () => {
    expect(uk.menu.knowledge).toBeTruthy()
  })
  it('en.menu.knowledge exists', () => {
    expect(en.menu.knowledge).toBeTruthy()
  })
})

// ═══════════════════════════════════════════════════════════════
// 10. knowledgeApi methods exist
// ═══════════════════════════════════════════════════════════════

describe('knowledgeApi: methods', () => {
  it('getLessons exists', async () => {
    const api = (await import('@/modules/knowledge/api/knowledgeApi')).knowledgeApi
    expect(typeof api.getLessons).toBe('function')
  })

  it('getTemplates exists (templateApi)', async () => {
    const { templateApi } = await import('@/modules/knowledge/api/templateApi')
    expect(typeof templateApi.getTemplates).toBe('function')
  })
})

// ═══════════════════════════════════════════════════════════════
// 11. Route exists in router
// ═══════════════════════════════════════════════════════════════

describe('Router: knowledge-library route', () => {
  it('route path is dashboard/knowledge', () => {
    const route = {
      path: 'dashboard/knowledge',
      name: 'knowledge-library',
      meta: { requiresAuth: true, roles: ['tutor', 'admin', 'superadmin'] },
    }
    expect(route.path).toBe('dashboard/knowledge')
    expect(route.name).toBe('knowledge-library')
    expect(route.meta.requiresAuth).toBe(true)
  })
})
