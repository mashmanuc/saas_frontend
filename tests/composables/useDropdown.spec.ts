import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useDropdown } from '@/composables/useDropdown'

// useDropdown uses onMounted/onUnmounted lifecycle hooks,
// so we need a component context to test it properly.

function mountWithDropdown() {
  let api: ReturnType<typeof useDropdown>
  const TestComponent = defineComponent({
    setup() {
      const rootRef = ref(null)
      api = useDropdown(rootRef)
      return { rootRef, ...api }
    },
    render() {
      return h('div', { ref: 'rootRef' }, 'dropdown host')
    },
  })
  const wrapper = mount(TestComponent, { attachTo: document.body })
  return { wrapper, api: api! }
}

describe('useDropdown', () => {
  it('starts closed', () => {
    const { api } = mountWithDropdown()
    expect(api.isOpen.value).toBe(false)
  })

  it('toggle opens and closes', () => {
    const { api } = mountWithDropdown()
    api.toggle()
    expect(api.isOpen.value).toBe(true)
    api.toggle()
    expect(api.isOpen.value).toBe(false)
  })

  it('open() opens', () => {
    const { api } = mountWithDropdown()
    api.open()
    expect(api.isOpen.value).toBe(true)
  })

  it('close() closes', () => {
    const { api } = mountWithDropdown()
    api.open()
    api.close()
    expect(api.isOpen.value).toBe(false)
  })

  it('handleKeydown with Escape closes', () => {
    const { api } = mountWithDropdown()
    api.open()
    api.handleKeydown(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(api.isOpen.value).toBe(false)
  })

  it('handleKeydown with other key does not close', () => {
    const { api } = mountWithDropdown()
    api.open()
    api.handleKeydown(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(api.isOpen.value).toBe(true)
  })
})
