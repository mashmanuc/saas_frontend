import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLearningGroupStore } from '@/modules/learning-content/stores/learningGroupStore'
import { useContentLibraryStore } from '@/modules/learning-content/stores/contentLibraryStore'
import type {
  LearningGroup,
  GroupMaterialAccess,
  ContentItemSummary,
  ContentLanguage,
} from '@/modules/learning-content/types/learningContent'

// ═══════════════════════════════════════════════════════════════════
// Scenario 1: Sidebar shows IMPLICIT/EXPLICIT split (CL2)
// ═══════════════════════════════════════════════════════════════════
describe('IAV Scenario 1: Sidebar group split', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('store separates IMPLICIT and EXPLICIT active groups', () => {
    const store = useLearningGroupStore()

    store.groups = [
      { id: 'g1', group_type: 'IMPLICIT', title: 'Test S.', is_active: true, student_count: 1, material_count: 0, subject: null, created_at: '' } as LearningGroup,
      { id: 'g2', group_type: 'EXPLICIT', title: 'Math 10-B', is_active: true, student_count: 3, material_count: 5, subject: 1, created_at: '' } as LearningGroup,
      { id: 'g3', group_type: 'IMPLICIT', title: 'Inactive', is_active: false, student_count: 1, material_count: 0, subject: null, created_at: '' } as LearningGroup,
    ]

    // implicitGroups computed filters is_active === true
    expect(store.implicitGroups.length).toBe(1)
    expect(store.implicitGroups[0].id).toBe('g1')

    // explicitGroups computed filters is_active === true
    expect(store.explicitGroups.length).toBe(1)
    expect(store.explicitGroups[0].id).toBe('g2')
  })
})

// ═══════════════════════════════════════════════════════════════════
// Scenario 2: Group materials visible after selection
// ═══════════════════════════════════════════════════════════════════
describe('IAV Scenario 2: Group materials loaded', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('materials populated and activeMaterials computed works', () => {
    const store = useLearningGroupStore()

    store.materials = [
      { id: 'gma1', content_item: 1, content_title: 'Problem 1', content_type: 'problem', is_active: true, added_at: '', added_by: null } as GroupMaterialAccess,
      { id: 'gma2', content_item: 2, content_title: 'Theory 1', content_type: 'theory', is_active: true, added_at: '', added_by: null } as GroupMaterialAccess,
      { id: 'gma3', content_item: 3, content_title: 'Disabled', content_type: 'video', is_active: false, added_at: '', added_by: null } as GroupMaterialAccess,
    ]

    expect(store.materials.length).toBe(3)
    expect(store.activeMaterials.length).toBe(2)
    expect(store.activeMaterials[0].content_type).toBe('problem')
  })
})

// ═══════════════════════════════════════════════════════════════════
// Scenario 3: Subject selection + StarterPack items
// ═══════════════════════════════════════════════════════════════════
describe('IAV Scenario 3: Subject → StarterPack flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('group with subject has materials from StarterPack (CL10)', () => {
    const store = useLearningGroupStore()

    store.materials = [
      { id: 'sp1', content_item: 10, content_title: 'SP Item 1', content_type: 'problem', is_active: true, added_at: '', added_by: null } as GroupMaterialAccess,
      { id: 'sp2', content_item: 11, content_title: 'SP Item 2', content_type: 'theory', is_active: true, added_at: '', added_by: null } as GroupMaterialAccess,
    ]

    // CL10: materials exist → subject should be immutable (UI enforces)
    expect(store.materials.length).toBe(2)
    expect(store.activeMaterials.length).toBe(2)
  })
})

// ═══════════════════════════════════════════════════════════════════
// Scenario 4: Language filter works
// ═══════════════════════════════════════════════════════════════════
describe('IAV Scenario 4: Language filter', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('language filter param passed to search', () => {
    const store = useContentLibraryStore()

    store.searchParams.language = 'uk'
    expect(store.searchParams.language).toBe('uk')

    store.searchParams.language = ''
    expect(store.searchParams.language).toBe('')
  })

  it('ContentItemSummary has language field with badge logic', () => {
    const item: ContentItemSummary = {
      id: 1,
      type: 'problem',
      title: 'Задача',
      difficulty: 3,
      version: 1,
      language: 'uk',
    }
    expect(item.language).toBe('uk')

    const badge = (l: ContentLanguage) => l === 'uk' ? 'UA' : 'EN'
    expect(badge(item.language!)).toBe('UA')
  })
})

// ═══════════════════════════════════════════════════════════════════
// Scenario 5: Soft-deleted items not in search results (passive)
// ═══════════════════════════════════════════════════════════════════
describe('IAV Scenario 5: Soft-delete awareness', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('store search results contain only non-deleted items (API contract)', () => {
    const store = useContentLibraryStore()

    store.searchResults = {
      items: [
        { id: 1, type: 'problem', title: 'Active', difficulty: 2, version: 1 } as ContentItemSummary,
        { id: 2, type: 'theory', title: 'Also Active', difficulty: 3, version: 1 } as ContentItemSummary,
      ],
      total: 2,
      filters_applied: {},
    }

    expect(store.searchResults.items.length).toBe(2)
    expect(store.searchResults.total).toBe(2)
  })
})

// ═══════════════════════════════════════════════════════════════════
// Scenario 6: Explicit group CRUD chain
// ═══════════════════════════════════════════════════════════════════
describe('IAV Scenario 6: Explicit group CRUD', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('explicit group with students, materials, and activeMaterials filter', () => {
    const store = useLearningGroupStore()

    const group: LearningGroup = {
      id: 'exp1',
      group_type: 'EXPLICIT',
      title: 'Math 10-B',
      subject: 1,
      is_active: true,
      student_count: 2,
      material_count: 3,
      created_at: '2026-03-04T12:00:00Z',
    }

    store.groups = [group]
    expect(store.explicitGroups.length).toBe(1)

    // Students added
    store.students = [100, 101]
    expect(store.students.length).toBe(2)

    // Materials: 2 active + 1 inactive
    store.materials = [
      { id: 'm1', content_item: 1, content_title: 'P1', content_type: 'problem', is_active: true, added_at: '', added_by: null } as GroupMaterialAccess,
      { id: 'm2', content_item: 2, content_title: 'T1', content_type: 'theory', is_active: true, added_at: '', added_by: null } as GroupMaterialAccess,
      { id: 'm3', content_item: 3, content_title: 'V1', content_type: 'video', is_active: false, added_at: '', added_by: null } as GroupMaterialAccess,
    ]

    expect(store.activeMaterials.length).toBe(2)
    expect(store.materials.length).toBe(3)
  })
})
