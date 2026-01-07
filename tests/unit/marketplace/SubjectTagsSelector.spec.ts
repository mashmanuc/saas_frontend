import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick, ref } from 'vue'
import SubjectTagsSelector from '@/modules/marketplace/components/editor/SubjectTagsSelector.vue'

const subjectsRef = ref([
  { code: 'math', title: 'Математика', category: 'sciences', category_name: 'Науки', tutor_count: 10 },
  { code: 'english', title: 'Англійська', category: 'languages', category_name: 'Мови', tutor_count: 20 },
])

const tagsRef = ref([
  { code: 'grade_7_9', label: '7-9 клас', group: 'grades', is_global: true },
  { code: 'nmt', label: 'НМТ', group: 'exams', is_global: true },
  { code: 'beginner', label: 'Початковий', group: 'levels', is_global: true },
])

const loadingRef = ref(false)

// Mock useCatalog
vi.mock('@/modules/marketplace/composables/useCatalog', () => ({
  useCatalog: () => ({
    subjects: subjectsRef,
    tags: tagsRef,
    loading: loadingRef,
    loadSubjects: vi.fn(),
    loadTags: vi.fn(),
    getTagsByGroup: (group: string) => {
      if (group === 'grades') return [tagsRef.value[0]]
      if (group === 'exams') return [tagsRef.value[1]]
      if (group === 'levels') return [tagsRef.value[2]]
      return []
    },
  }),
}))

const i18n = createI18n({
  legacy: false,
  locale: 'uk',
  messages: {
    uk: {
      marketplace: {
        profile: {
          editor: {
            selectSubject: 'Оберіть предмет',
            add: 'Додати',
            selectTags: 'Оберіть напрями',
            customDirectionText: 'Опишіть ваш підхід',
            customTextTooShort: 'Мінімум 300 символів',
            customTextTooLong: 'Максимум 800 символів',
            noSubjectsSelected: 'Ви ще не обрали жодного предмета',
            dragToReorder: 'Перетягніть для зміни порядку',
            remove: 'Видалити',
          },
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

describe('SubjectTagsSelector', () => {
  let wrapper: any

  beforeEach(async () => {
    wrapper = mount(SubjectTagsSelector, {
      props: {
        modelValue: [],
      },
      global: {
        plugins: [i18n],
      },
    })

    await nextTick()
  })

  it('renders add subject dropdown', () => {
    const select = wrapper.find('[data-test="subject-selector-add"]')
    expect(select.exists()).toBe(true)
  })

  it('shows empty state when no subjects selected', () => {
    const emptyState = wrapper.find('.empty-state')
    expect(emptyState.exists()).toBe(true)
    expect(emptyState.text()).toContain('Ви ще не обрали жодного предмета')
  })

  it('adds subject when button clicked', async () => {
    const select = wrapper.find('[data-test="subject-selector-add"]')
    await select.setValue('math')
    await nextTick()
    await flushPromises()
    
    const addButton = wrapper.find('button.btn-secondary')
    await addButton.trigger('click')
    await nextTick()
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toHaveLength(1)
    const emittedValue = emitted[0][0]
    expect(emittedValue).toHaveLength(1)
    expect(emittedValue[0].code).toBe('math')
    expect(emittedValue[0].tags).toEqual([])
    expect(emittedValue[0].custom_direction_text).toBe('')
  })

  it('displays selected subjects', async () => {
    await wrapper.setProps({
      modelValue: [
        { code: 'math', tags: [], custom_direction_text: '' },
      ],
    })
    
    const subjectItem = wrapper.find('[data-test="subject-item-math"]')
    expect(subjectItem.exists()).toBe(true)
    expect(subjectItem.text()).toContain('Математика')
  })

  it('removes subject when remove button clicked', async () => {
    await wrapper.setProps({
      modelValue: [
        { code: 'math', tags: [], custom_direction_text: '' },
      ],
    })
    
    const removeButton = wrapper.find('.btn-remove')
    await removeButton.trigger('click')
    
    const emitted = wrapper.emitted('update:modelValue')
    const lastEmit = emitted[emitted.length - 1][0]
    expect(lastEmit).toHaveLength(0)
  })

  it('expands subject details when chevron clicked', async () => {
    await wrapper.setProps({
      modelValue: [
        { code: 'math', tags: [], custom_direction_text: '' },
      ],
    })
    
    const expandButton = wrapper.find('.btn-icon')
    await expandButton.trigger('click')
    
    const subjectDetails = wrapper.find('.subject-details')
    expect(subjectDetails.exists()).toBe(true)
  })

  it('shows tag groups when subject is expanded', async () => {
    await wrapper.setProps({
      modelValue: [
        { code: 'math', tags: [], custom_direction_text: '' },
      ],
    })
    
    const expandButton = wrapper.find('.btn-icon')
    await expandButton.trigger('click')
    
    const tagGroups = wrapper.findAll('.tag-group')
    expect(tagGroups.length).toBeGreaterThan(0)
  })

  it('toggles tag selection', async () => {
    await wrapper.setProps({
      modelValue: [
        { code: 'math', tags: [], custom_direction_text: '' },
      ],
    })
    
    const expandButton = wrapper.find('.btn-icon')
    await expandButton.trigger('click')
    
    const checkbox = wrapper.find('input[type="checkbox"]')
    await checkbox.trigger('change')
    
    const emitted = wrapper.emitted('update:modelValue')
    const lastEmit = emitted[emitted.length - 1][0]
    expect(lastEmit[0].tags.length).toBeGreaterThan(0)
  })

  it('validates custom text length (too short)', async () => {
    await wrapper.setProps({
      modelValue: [
        { code: 'math', tags: [], custom_direction_text: 'short' },
      ],
    })
    
    const expandButton = wrapper.find('.btn-icon')
    await expandButton.trigger('click')
    
    const error = wrapper.find('.field-error')
    expect(error.exists()).toBe(true)
    expect(error.text()).toContain('Мінімум 300 символів')
  })

  it('validates custom text length (valid)', async () => {
    const validText = 'A'.repeat(350)
    await wrapper.setProps({
      modelValue: [
        { code: 'math', tags: [], custom_direction_text: validText },
      ],
    })
    
    const expandButton = wrapper.find('.btn-icon')
    await expandButton.trigger('click')
    
    const errors = wrapper.findAll('.field-error')
    const customTextErrors = errors.filter((e: any) => 
      e.text().includes('Мінімум') || e.text().includes('Максимум')
    )
    expect(customTextErrors.length).toBe(0)
  })

  it('shows character count for custom text', async () => {
    await wrapper.setProps({
      modelValue: [
        { code: 'math', tags: [], custom_direction_text: 'Test' },
      ],
    })
    
    const expandButton = wrapper.find('.btn-icon')
    await expandButton.trigger('click')
    
    const charCount = wrapper.find('.char-count')
    expect(charCount.exists()).toBe(true)
    expect(charCount.text()).toContain('4 / 800')
  })

  it('disables add button when no subject selected', () => {
    const addButton = wrapper.find('button.btn-secondary')
    expect(addButton.attributes('disabled')).toBeDefined()
  })

  it('enables add button when subject selected', async () => {
    const select = wrapper.find('[data-test="subject-selector-add"]')
    await select.setValue('math')
    await nextTick()
    await flushPromises()

    const addButton = wrapper.find('button.btn-secondary')
    expect(addButton.attributes('disabled')).toBeUndefined()
  })
})
