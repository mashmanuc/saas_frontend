// Phase 15 B3.3: Tests for CategoryTreeItem
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import CategoryTreeItem from '../components/CategoryTreeItem.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
})

function makeCategory(overrides = {}) {
  return {
    id: 'cat-1',
    name: 'Mathematics',
    slug: 'math',
    icon: 'calculator',
    lesson_count: 45,
    children: [],
    ...overrides,
  }
}

const TransitionStub = {
  template: '<span v-if="$slots.default"><slot /></span>',
}

function mountItem(overrides = {}, props = {}) {
  return mount(CategoryTreeItem, {
    props: { category: makeCategory(overrides), depth: 0, activeCategory: null, ...props },
    global: { plugins: [i18n], stubs: { Transition: TransitionStub } },
  })
}

describe('CategoryTreeItem', () => {
  it('renders leaf node with name and count', () => {
    const w = mountItem()
    expect(w.text()).toContain('Mathematics')
    expect(w.text()).toContain('(45)')
  })

  it('has role=treeitem', () => {
    const w = mountItem()
    expect(w.find('[role="treeitem"]').exists()).toBe(true)
  })

  it('does not show expand arrow for leaf', () => {
    const w = mountItem({ children: [] })
    // ChevronRight should not exist for leaf
    const arrow = w.findAll('svg').filter(s => s.classes().includes('transition-transform'))
    expect(arrow.length).toBe(0)
  })

  it('shows expand arrow for node with children', () => {
    const w = mountItem({
      children: [makeCategory({ id: 'child-1', name: 'Algebra', slug: 'algebra', lesson_count: 20, children: [] })],
    })
    expect(w.find('.transition-transform').exists()).toBe(true)
  })

  it('emits select on click', async () => {
    const w = mountItem()
    await w.find('button').trigger('click')
    expect(w.emitted('select')).toBeTruthy()
    expect(w.emitted('select')![0]).toEqual(['math'])
  })

  it('applies active styling', () => {
    const w = mountItem({}, { activeCategory: 'math' })
    expect(w.find('.bg-primary-100').exists()).toBe(true)
  })

  it('does not apply active styling for non-active', () => {
    const w = mountItem({}, { activeCategory: 'physics' })
    expect(w.find('.bg-primary-100').exists()).toBe(false)
  })

  it('expands children on click for parent nodes', async () => {
    const child = makeCategory({ id: 'c1', name: 'Algebra', slug: 'algebra', lesson_count: 20, children: [] })
    const w = mountItem({ children: [child] })
    // Initially expanded at depth 0
    expect(w.find('[role="group"]').exists()).toBe(true)
    // Click toggles
    await w.find('button').trigger('click')
    expect(w.find('[role="group"]').exists()).toBe(false)
  })

  it('sets aria-level based on depth', () => {
    const w = mountItem({}, { depth: 2 })
    expect(w.find('[role="treeitem"]').attributes('aria-level')).toBe('3')
  })

  it('sets aria-expanded for parent nodes', () => {
    const child = makeCategory({ id: 'c1', name: 'Sub', slug: 'sub', lesson_count: 5, children: [] })
    const w = mountItem({ children: [child] })
    expect(w.find('[role="treeitem"]').attributes('aria-expanded')).toBe('true')
  })

  it('renders icon when category has one', () => {
    const w = mountItem({ icon: 'calculator' })
    // Calculator icon renders as SVG
    const svgs = w.findAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(1)
  })
})
