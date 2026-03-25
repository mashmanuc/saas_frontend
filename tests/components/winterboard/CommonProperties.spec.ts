import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CommonProperties from '@/modules/winterboard/components/sidebar/properties/CommonProperties.vue'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'

describe('CommonProperties.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('displays position inputs with correct values', () => {
    const store = useWBStore()

    const wrapper = mount(CommonProperties, {
      props: {
        objectId: 'stroke-1',
        store,
        isLocked: false,
        x: 100,
        y: 150,
      },
    })

    const inputs = wrapper.findAll('input[type="number"]')
    expect(inputs.length).toBeGreaterThanOrEqual(2)
    // X and Y inputs should show position
    const xInput = inputs[0].element as HTMLInputElement
    const yInput = inputs[1].element as HTMLInputElement
    expect(xInput.value).toBe('100')
    expect(yInput.value).toBe('150')
  })

  it('calls store.updateObject when position changes', async () => {
    const store = useWBStore()
    const updateSpy = vi.spyOn(store, 'updateObject')

    const wrapper = mount(CommonProperties, {
      props: {
        objectId: 'stroke-1',
        store,
        isLocked: false,
        x: 50,
        y: 50,
      },
    })

    const xInput = wrapper.findAll('input[type="number"]')[0]
    await xInput.setValue('120')
    
    // Wait for debounce (150ms)
    await new Promise(resolve => setTimeout(resolve, 200))

    expect(updateSpy).toHaveBeenCalled()
  })

  it('renders z-order buttons that are enabled when not locked', () => {
    const store = useWBStore()

    const wrapper = mount(CommonProperties, {
      props: {
        objectId: 'stroke-1',
        store,
        isLocked: false,
        x: 10,
        y: 10,
      },
    })

    const zBtns = wrapper.findAll('.common-properties__z-btn')
    expect(zBtns.length).toBe(4)

    // All z-order buttons should be enabled (not locked)
    zBtns.forEach(btn => {
      expect(btn.attributes('disabled')).toBeUndefined()
    })
  })

  it('shows lock badge and disables inputs when object is locked', () => {
    const store = useWBStore()

    const wrapper = mount(CommonProperties, {
      props: {
        objectId: 'stroke-1',
        store,
        isLocked: true,
        x: 10,
        y: 10,
      },
    })

    // Should show lock badge
    expect(wrapper.text()).toContain('Locked')

    // Position/size inputs should be disabled
    const inputs = wrapper.findAll('input[type="number"]')
    inputs.forEach(input => {
      expect(input.attributes('disabled')).toBeDefined()
    })
  })
})
