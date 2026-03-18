// Phase 16 B Day 2: Tests for KnowledgeEmptyState
import { describe, it, expect } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import KnowledgeEmptyState from '../components/KnowledgeEmptyState.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      knowledge: {
        hub: {
          emptyTitle: 'Publish your first lesson!',
          emptyDescription: 'Knowledge is your lesson library.',
          emptyStep1: 'Teach a lesson on the board',
          emptyStep2: 'Click "Publish"',
          emptyStep3: 'Students will see your lesson',
          createBoard: 'Create board',
          catalogTemplates: 'Template catalog',
        },
      },
    },
  },
})

function mountComponent() {
  return mount(KnowledgeEmptyState, {
    global: {
      plugins: [i18n],
      stubs: { RouterLink: RouterLinkStub },
    },
  })
}

describe('KnowledgeEmptyState', () => {
  it('renders title', () => {
    const w = mountComponent()
    expect(w.find('h2').text()).toBe('Publish your first lesson!')
  })

  it('renders description', () => {
    const w = mountComponent()
    expect(w.text()).toContain('Knowledge is your lesson library.')
  })

  it('renders 3 steps', () => {
    const w = mountComponent()
    const items = w.findAll('li')
    expect(items.length).toBe(3)
    expect(items[0].text()).toContain('Teach a lesson on the board')
    expect(items[1].text()).toContain('Click "Publish"')
    expect(items[2].text()).toContain('Students will see your lesson')
  })

  it('has "Create board" link to /winterboard/new', () => {
    const w = mountComponent()
    expect(w.text()).toContain('Create board')
    expect(w.html()).toContain('/winterboard/new')
  })

  it('has "Template catalog" link to /knowledge/library', () => {
    const w = mountComponent()
    expect(w.text()).toContain('Template catalog')
    expect(w.html()).toContain('/knowledge/library')
  })

  it('has graduation emoji', () => {
    const w = mountComponent()
    expect(w.text()).toContain('🎓')
  })

  it('has numbered steps 1, 2, 3', () => {
    const w = mountComponent()
    const steps = w.findAll('ol li span:first-child')
    expect(steps[0].text()).toBe('1')
    expect(steps[1].text()).toBe('2')
    expect(steps[2].text()).toBe('3')
  })
})
