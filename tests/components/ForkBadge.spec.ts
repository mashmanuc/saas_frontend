// Phase 14 B3.3: Tests for ForkBadge component
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ForkBadge from '@/modules/knowledge/components/ForkBadge.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      knowledge: {
        fork: {
          badge: 'Fork from {author}',
        },
      },
    },
  },
})

const routerLinkStub = {
  template: '<a :href="to" :class="$attrs.class"><slot /></a>',
  props: ['to'],
}

function mountBadge(parentLesson: any) {
  return mount(ForkBadge, {
    props: { parentLesson },
    global: {
      plugins: [i18n],
      stubs: { RouterLink: routerLinkStub },
    },
  })
}

describe('ForkBadge', () => {
  it('renders badge when parentLesson provided', () => {
    const w = mountBadge({ tutor_name: 'Alice', tutor_slug: 'alice', slug: 'lesson-1' })
    expect(w.text()).toContain('Fork from Alice')
  })

  it('links to original lesson', () => {
    const w = mountBadge({ tutor_name: 'Alice', tutor_slug: 'alice', slug: 'lesson-1' })
    expect(w.html()).toContain('/lesson/alice/lesson-1')
  })

  it('renders nothing when parentLesson is null', () => {
    const w = mountBadge(null)
    expect(w.find('a').exists()).toBe(false)
    expect(w.text()).toBe('')
  })

  it('has GitFork icon', () => {
    const w = mountBadge({ tutor_name: 'Bob', tutor_slug: 'bob', slug: 'l2' })
    expect(w.find('svg').exists()).toBe(true)
  })

  it('applies purple styling', () => {
    const w = mountBadge({ tutor_name: 'Carol', tutor_slug: 'carol', slug: 'l3' })
    const link = w.find('a')
    expect(link.attributes('class')).toContain('purple')
  })
})
