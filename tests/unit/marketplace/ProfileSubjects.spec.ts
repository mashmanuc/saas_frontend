import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ProfileSubjects from '@/modules/marketplace/components/profile/ProfileSubjects.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'uk',
  messages: {
    uk: {
      marketplace: {
        profile: {
          subjectsTitle: 'Предмети та напрями',
          aboutApproach: 'Резюме',
        },
        tagGroups: {
          grades: 'Класи',
          exams: 'Екзамени',
          levels: 'Рівні',
          goals: 'Цілі',
          formats: 'Формати',
          audience: 'Аудиторія',
        },
      },
    },
  },
})

describe('ProfileSubjects', () => {
  it('renders subjects with tags', () => {
    const wrapper = mount(ProfileSubjects, {
      props: {
        subjects: [
          {
            code: 'math',
            title: 'Математика',
            tags: [
              { code: 'grade_7_9', label: '7-9 клас', group: 'grades' },
              { code: 'nmt', label: 'НМТ', group: 'exams' },
            ],
            custom_direction_text: 'Готую до НМТ',
          },
        ],
      },
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.text()).toContain('Математика')
    expect(wrapper.text()).toContain('7-9 клас')
    expect(wrapper.text()).toContain('НМТ')
    expect(wrapper.text()).toContain('Готую до НМТ')
  })

  it('groups tags by TagGroup', () => {
    const wrapper = mount(ProfileSubjects, {
      props: {
        subjects: [
          {
            code: 'math',
            title: 'Математика',
            tags: [
              { code: 'grade_7_9', label: '7-9 клас', group: 'grades' },
              { code: 'nmt', label: 'НМТ', group: 'exams' },
            ],
          },
        ],
      },
      global: {
        plugins: [i18n],
      },
    })

    const tagGroups = wrapper.findAll('.tag-group')
    expect(tagGroups.length).toBe(2) // grades + exams
  })

  it('renders custom direction text when present', () => {
    const customText = 'Готую до НМТ за 8 тижнів'
    
    const wrapper = mount(ProfileSubjects, {
      props: {
        subjects: [
          {
            code: 'math',
            title: 'Математика',
            tags: [],
            custom_direction_text: customText,
          },
        ],
      },
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.text()).toContain(customText)
    expect(wrapper.text()).toContain('Резюме')
  })

  it('does not render custom text section when empty', () => {
    const wrapper = mount(ProfileSubjects, {
      props: {
        subjects: [
          {
            code: 'math',
            title: 'Математика',
            tags: [],
          },
        ],
      },
      global: {
        plugins: [i18n],
      },
    })

    const customTextSection = wrapper.find('.custom-text')
    expect(customTextSection.exists()).toBe(false)
  })

  it('renders multiple subjects', () => {
    const wrapper = mount(ProfileSubjects, {
      props: {
        subjects: [
          {
            code: 'math',
            title: 'Математика',
            tags: [],
          },
          {
            code: 'english',
            title: 'Англійська',
            tags: [],
          },
        ],
      },
      global: {
        plugins: [i18n],
      },
    })

    const subjectItems = wrapper.findAll('.subject-item')
    expect(subjectItems.length).toBe(2)
    expect(wrapper.text()).toContain('Математика')
    expect(wrapper.text()).toContain('Англійська')
  })

  it('renders tag group labels', () => {
    const wrapper = mount(ProfileSubjects, {
      props: {
        subjects: [
          {
            code: 'math',
            title: 'Математика',
            tags: [
              { code: 'grade_7_9', label: '7-9 клас', group: 'grades' },
              { code: 'beginner', label: 'Початковий', group: 'levels' },
            ],
          },
        ],
      },
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.text()).toContain('Класи')
    expect(wrapper.text()).toContain('Рівні')
  })

  it('renders subject title as h3', () => {
    const wrapper = mount(ProfileSubjects, {
      props: {
        subjects: [
          {
            code: 'math',
            title: 'Математика',
            tags: [],
          },
        ],
      },
      global: {
        plugins: [i18n],
      },
    })

    const title = wrapper.find('.subject-title')
    expect(title.exists()).toBe(true)
    expect(title.element.tagName).toBe('H3')
    expect(title.text()).toBe('Математика')
  })

  it('does not render tags section when no tags', () => {
    const wrapper = mount(ProfileSubjects, {
      props: {
        subjects: [
          {
            code: 'math',
            title: 'Математика',
            tags: [],
          },
        ],
      },
      global: {
        plugins: [i18n],
      },
    })

    const tagsGroups = wrapper.find('.tags-groups')
    expect(tagsGroups.exists()).toBe(false)
  })

  it('renders section title with icon', () => {
    const wrapper = mount(ProfileSubjects, {
      props: {
        subjects: [],
      },
      global: {
        plugins: [i18n],
      },
    })

    const heading = wrapper.find('h2')
    expect(heading.exists()).toBe(true)
    expect(heading.text()).toContain('Предмети та напрями')
  })

  it('handles empty subjects array', () => {
    const wrapper = mount(ProfileSubjects, {
      props: {
        subjects: [],
      },
      global: {
        plugins: [i18n],
      },
    })

    const subjectsList = wrapper.find('.subjects-list')
    expect(subjectsList.exists()).toBe(true)
    const subjectItems = wrapper.findAll('.subject-item')
    expect(subjectItems.length).toBe(0)
  })
})
