import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RelationActionButton from '@/components/relations/RelationActionButton.vue'
import type { Relation } from '@/types/relations'

const mockPush = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

function createMockRelation(overrides: Partial<Relation> = {}): Relation {
  return {
    id: 'rel-1',
    tutor: {
      id: 'tutor-1',
      name: 'Test Tutor',
      avatar_url: '',
      subjects: [],
      hourly_rate: 20,
      currency: 'USD'
    },
    student: {
      id: 'student-1',
      name: 'Test Student',
      avatar_url: ''
    },
    status: 'active',
    created_at: '2025-01-01T00:00:00Z',
    activated_at: null,
    last_activity_at: null,
    lesson_count: 0,
    has_upcoming_lessons: false,
    has_current_lesson: false,
    active_lesson_id: null,
    can_chat: false,
    inquiry_status: null,
    can_request_contact: false,
    can_view_contact: false,
    contact_locked_reason: null,
    ...overrides
  }
}

describe('RelationActionButton', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('shows "Message" button when can_chat=true and active_lesson_id exists', () => {
    const relation = createMockRelation({
      can_chat: true,
      active_lesson_id: 'lesson-123'
    })

    const wrapper = mount(RelationActionButton, {
      props: { relation }
    })

    expect(wrapper.text()).toContain('relationAction.message')
    expect(wrapper.find('[data-testid="relation-action-button"]').exists()).toBe(true)
  })

  it('navigates to lesson chat when "Message" button clicked', async () => {
    const relation = createMockRelation({
      can_chat: true,
      active_lesson_id: 'lesson-123'
    })

    const wrapper = mount(RelationActionButton, {
      props: { relation }
    })

    await wrapper.find('[data-testid="relation-action-button"]').trigger('click')

    expect(mockPush).toHaveBeenCalledWith('/lessons/lesson-123/chat')
  })

  it('shows "Request contact" button when can_request_contact=true', () => {
    const relation = createMockRelation({
      can_chat: false,
      can_request_contact: true
    })

    const wrapper = mount(RelationActionButton, {
      props: { relation }
    })

    expect(wrapper.text()).toContain('relationAction.requestContact')
  })

  it('emits requestContact event when "Request contact" button clicked', async () => {
    const relation = createMockRelation({
      can_chat: false,
      can_request_contact: true
    })

    const wrapper = mount(RelationActionButton, {
      props: { relation }
    })

    await wrapper.find('[data-testid="relation-action-button"]').trigger('click')

    expect(wrapper.emitted('requestContact')).toBeTruthy()
  })

  it('shows "Book lesson" button when no other conditions met', () => {
    const relation = createMockRelation({
      can_chat: false,
      can_request_contact: false,
      contact_locked_reason: null
    })

    const wrapper = mount(RelationActionButton, {
      props: { relation }
    })

    expect(wrapper.text()).toContain('relationAction.bookLesson')
  })

  it('navigates to booking when "Book lesson" button clicked', async () => {
    const relation = createMockRelation({
      can_chat: false,
      can_request_contact: false,
      contact_locked_reason: null
    })

    const wrapper = mount(RelationActionButton, {
      props: { relation }
    })

    await wrapper.find('[data-testid="relation-action-button"]').trigger('click')

    expect(mockPush).toHaveBeenCalledWith({
      name: 'booking',
      query: { tutor: 'tutor-1' }
    })
  })

  it('shows "Why locked" button when contact_locked_reason exists', () => {
    const relation = createMockRelation({
      can_chat: false,
      can_request_contact: false,
      contact_locked_reason: 'inquiry_required'
    })

    const wrapper = mount(RelationActionButton, {
      props: { relation }
    })

    expect(wrapper.text()).toContain('relationAction.whyLocked')
  })

  it('emits showLockedReason event when "Why locked" button clicked', async () => {
    const relation = createMockRelation({
      can_chat: false,
      can_request_contact: false,
      contact_locked_reason: 'inquiry_required'
    })

    const wrapper = mount(RelationActionButton, {
      props: { relation }
    })

    await wrapper.find('[data-testid="relation-action-button"]').trigger('click')

    expect(wrapper.emitted('showLockedReason')).toBeTruthy()
  })
})
