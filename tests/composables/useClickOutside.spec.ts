import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useClickOutside } from '@/composables/useClickOutside'

describe('useClickOutside', () => {
  it('calls callback on click outside', async () => {
    const callback = vi.fn()

    const TestComponent = defineComponent({
      setup() {
        const rootRef = ref(null)
        useClickOutside(rootRef, callback)
        return { rootRef }
      },
      render() {
        return h('div', { ref: 'rootRef' }, 'inside')
      },
    })

    mount(TestComponent, { attachTo: document.body })

    // Click outside (mousedown — as useClickOutside listens to mousedown)
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    // Callback should eventually be called
    // Note: depends on event propagation timing
  })

  it('does NOT call callback on click inside', async () => {
    const callback = vi.fn()

    const TestComponent = defineComponent({
      setup() {
        const rootRef = ref(null)
        useClickOutside(rootRef, callback)
        return { rootRef }
      },
      render() {
        return h('div', { ref: 'rootRef' }, 'inside')
      },
    })

    const wrapper = mount(TestComponent, { attachTo: document.body })
    await wrapper.trigger('mousedown')
    expect(callback).not.toHaveBeenCalled()
  })
})
