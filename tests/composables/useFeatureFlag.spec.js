import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

// Mock store
vi.mock('../../src/stores/featureFlagsStore', () => ({
  useFeatureFlagsStore: vi.fn(() => ({
    isEnabled: vi.fn((flag) => {
      const flags = {
        enabled_flag: true,
        disabled_flag: false,
        flag_a: true,
        flag_b: false,
      }
      return flags[flag] ?? false
    }),
    isCacheStale: false,
    loading: false,
    init: vi.fn(),
  })),
}))

import {
  useFeatureFlag,
  useFeatureFlags,
  useEnabledFeatures,
  createFeatureFlagHelper,
} from '../../src/composables/useFeatureFlag'
import { useFeatureFlagsStore } from '../../src/stores/featureFlagsStore'

describe('useFeatureFlag composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('useFeatureFlag', () => {
    it('returns enabled state for flag', () => {
      // Create test component
      const TestComponent = defineComponent({
        setup() {
          const { enabled, loading } = useFeatureFlag('enabled_flag')
          return { enabled, loading }
        },
        render() {
          return h('div', this.enabled ? 'enabled' : 'disabled')
        },
      })
      
      const wrapper = mount(TestComponent)
      expect(wrapper.text()).toBe('enabled')
    })

    it('returns disabled state for disabled flag', () => {
      const TestComponent = defineComponent({
        setup() {
          const { enabled } = useFeatureFlag('disabled_flag')
          return { enabled }
        },
        render() {
          return h('div', this.enabled ? 'enabled' : 'disabled')
        },
      })
      
      const wrapper = mount(TestComponent)
      expect(wrapper.text()).toBe('disabled')
    })

    it('returns loading state', () => {
      const TestComponent = defineComponent({
        setup() {
          const { loading } = useFeatureFlag('any_flag')
          return { loading }
        },
        render() {
          return h('div', this.loading ? 'loading' : 'ready')
        },
      })
      
      const wrapper = mount(TestComponent)
      expect(wrapper.text()).toBe('ready')
    })
  })

  describe('useFeatureFlags', () => {
    it('returns flags object', () => {
      const TestComponent = defineComponent({
        setup() {
          const { flags } = useFeatureFlags(['flag_a', 'flag_b'])
          return { flags }
        },
        render() {
          return h('div', JSON.stringify(this.flags))
        },
      })
      
      const wrapper = mount(TestComponent)
      const flags = JSON.parse(wrapper.text())
      
      expect(flags.flag_a).toBe(true)
      expect(flags.flag_b).toBe(false)
    })

    it('returns allEnabled correctly', () => {
      const TestComponent = defineComponent({
        setup() {
          const { allEnabled } = useFeatureFlags(['flag_a', 'flag_b'])
          return { allEnabled }
        },
        render() {
          return h('div', this.allEnabled ? 'all' : 'not-all')
        },
      })
      
      const wrapper = mount(TestComponent)
      expect(wrapper.text()).toBe('not-all') // flag_b is false
    })

    it('returns anyEnabled correctly', () => {
      const TestComponent = defineComponent({
        setup() {
          const { anyEnabled } = useFeatureFlags(['flag_a', 'flag_b'])
          return { anyEnabled }
        },
        render() {
          return h('div', this.anyEnabled ? 'any' : 'none')
        },
      })
      
      const wrapper = mount(TestComponent)
      expect(wrapper.text()).toBe('any') // flag_a is true
    })
  })

  describe('createFeatureFlagHelper', () => {
    it('creates helper function', () => {
      const helper = createFeatureFlagHelper()
      
      expect(typeof helper).toBe('function')
      expect(helper('enabled_flag')).toBe(true)
      expect(helper('disabled_flag')).toBe(false)
    })
  })
})
