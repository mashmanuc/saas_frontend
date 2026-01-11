import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ContactLimitsWidget from '../ContactLimitsWidget.vue'
import type { ContactLimit } from '@/types/relations'

const getLimitByTypeMock = vi.fn()

vi.mock('@/stores/limitsStore', () => ({
  useLimitsStore: () => ({
    getLimitByType: getLimitByTypeMock
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key
  })
}))

vi.mock('@/components/ui/Card.vue', () => ({
  default: {
    name: 'Card',
    template: '<div data-testid="card"><slot /></div>'
  }
}))

vi.mock('@/components/ui/Badge.vue', () => ({
  default: {
    name: 'Badge',
    template: '<span data-testid="badge"><slot /></span>'
  }
}))

vi.mock('@/components/ui/Alert.vue', () => ({
  default: {
    name: 'Alert',
    template: '<div data-testid="alert"><slot /></div>'
  }
}))

function createLimit(overrides: Partial<ContactLimit> = {}): ContactLimit {
  return {
    limit_type: 'student_request',
    max_count: 10,
    current_count: 3,
    remaining: 7,
    reset_at: '2024-01-02T10:00:00Z',
    period_days: 7,
    ...overrides
  }
}

function mountWidget(limit: ContactLimit | undefined) {
  getLimitByTypeMock.mockReturnValue(limit)

  return mount(ContactLimitsWidget, {
    props: {
      limitType: 'student_request'
    }
  })
}

describe('ContactLimitsWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders limit information when data is available', () => {
    const limit = createLimit({ current_count: 4, remaining: 6 })
    const wrapper = mountWidget(limit)

    expect(getLimitByTypeMock).toHaveBeenCalledWith('student_request')
    expect(wrapper.find('[data-testid="card"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('4 / 10')
    expect(wrapper.text()).toContain('6 limits.remaining')
  })

  it('shows warning alert when limit is near exhaustion', () => {
    const limit = createLimit({ remaining: 2 })
    const wrapper = mountWidget(limit)

    const alert = wrapper.find('[data-testid="alert"]')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain('limits.nearLimit')
  })

  it('shows error alert when limit is exhausted', () => {
    const limit = createLimit({ remaining: 0 })
    const wrapper = mountWidget(limit)

    const alert = wrapper.find('[data-testid="alert"]')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain('limits.limitReached')
  })
})
