import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PropertiesPanel from '@/modules/winterboard/components/sidebar/PropertiesPanel.vue'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'

describe('PropertiesPanel.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders empty state when no selection', () => {
    const wrapper = mount(PropertiesPanel, {
      props: {
        store: useWBStore(),
      },
    })

    expect(wrapper.find('.properties-panel__empty').exists()).toBe(true)
    expect(wrapper.text()).toContain('No selection')
  })

  it('dispatches to StrokeProperties for pen stroke', () => {
    const store = useWBStore()
    store.pages[0].strokes.push({
      id: 'stroke-1',
      tool: 'pen',
      points: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
      color: '#000000',
      size: 2,
      opacity: 1,
    })
    store.selectedIds = ['stroke-1']

    const wrapper = mount(PropertiesPanel, {
      props: { store },
      global: {
        stubs: {
          StrokeProperties: { template: '<div class="stroke-properties-stub"></div>' },
          CommonProperties: { template: '<div class="common-properties-stub"></div>' },
        },
      },
    })

    expect(wrapper.find('.stroke-properties-stub').exists()).toBe(true)
  })

  it('dispatches to TextProperties for text stroke', () => {
    const store = useWBStore()
    store.pages[0].strokes.push({
      id: 'text-1',
      tool: 'text',
      points: [{ x: 100, y: 100 }],
      text: 'Hello',
      size: 16,
      color: '#000000',
      opacity: 1,
    })
    store.selectedIds = ['text-1']

    const wrapper = mount(PropertiesPanel, {
      props: { store },
      global: {
        stubs: {
          TextProperties: { template: '<div class="text-properties-stub"></div>' },
          CommonProperties: { template: '<div class="common-properties-stub"></div>' },
        },
      },
    })

    expect(wrapper.find('.text-properties-stub').exists()).toBe(true)
  })

  it('dispatches to ShapeProperties for rectangle', () => {
    const store = useWBStore()
    store.pages[0].strokes.push({
      id: 'rect-1',
      tool: 'rectangle',
      points: [{ x: 50, y: 50 }],
      width: 100,
      height: 80,
      color: '#ff0000',
      size: 2,
      opacity: 1,
    })
    store.selectedIds = ['rect-1']

    const wrapper = mount(PropertiesPanel, {
      props: { store },
      global: {
        stubs: {
          ShapeProperties: { template: '<div class="shape-properties-stub"></div>' },
          CommonProperties: { template: '<div class="common-properties-stub"></div>' },
        },
      },
    })

    expect(wrapper.find('.shape-properties-stub').exists()).toBe(true)
  })

  it('dispatches to ImageProperties for image asset', () => {
    const store = useWBStore()
    store.pages[0].assets.push({
      id: 'img-1',
      type: 'image',
      src: 'https://example.com/image.jpg',
      x: 200,
      y: 200,
      w: 300,
      h: 200,
      rotation: 0,
    })
    store.selectedIds = ['img-1']

    const wrapper = mount(PropertiesPanel, {
      props: { store },
      global: {
        stubs: {
          ImageProperties: { template: '<div class="image-properties-stub"></div>' },
          CommonProperties: { template: '<div class="common-properties-stub"></div>' },
        },
      },
    })

    expect(wrapper.find('.image-properties-stub').exists()).toBe(true)
  })

  it('shows MultiSelectInfo for multiple selected items', () => {
    const store = useWBStore()
    store.pages[0].strokes.push(
      { id: 'stroke-1', tool: 'pen', points: [{ x: 10, y: 10 }, { x: 20, y: 20 }], color: '#000000', size: 2, opacity: 1 },
      { id: 'stroke-2', tool: 'pen', points: [{ x: 30, y: 30 }, { x: 40, y: 40 }], color: '#ff0000', size: 3, opacity: 1 }
    )
    store.selectedIds = ['stroke-1', 'stroke-2']

    const wrapper = mount(PropertiesPanel, {
      props: { store },
      global: {
        stubs: {
          MultiSelectInfo: { template: '<div class="multi-select-info-stub"></div>' },
        },
      },
    })

    expect(wrapper.find('.multi-select-info-stub').exists()).toBe(true)
  })
})
