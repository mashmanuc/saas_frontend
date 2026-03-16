// Phase 16 B Day 3: Tests for StudentConsentForm
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import StudentConsentForm from '../components/StudentConsentForm.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      knowledge: {
        publish: {
          consent: {
            title: 'Student privacy',
            hasStudentData: 'Lesson contains student data',
            studentConsented: 'Student consented to publication',
            anonymize: 'Anonymize student data',
            warning: 'Publishing lessons with student data without consent is prohibited',
          },
        },
      },
    },
  },
})

function mountComponent(modelValue = { hasStudentData: false, studentConsented: false, anonymize: false }) {
  return mount(StudentConsentForm, {
    props: { modelValue },
    global: { plugins: [i18n] },
  })
}

describe('StudentConsentForm', () => {
  it('renders title', () => {
    const w = mountComponent()
    expect(w.text()).toContain('Student privacy')
  })

  it('renders hasStudentData checkbox', () => {
    const w = mountComponent()
    expect(w.text()).toContain('Lesson contains student data')
  })

  it('does not show consent options when hasStudentData is false', () => {
    const w = mountComponent()
    expect(w.text()).not.toContain('Student consented')
    expect(w.text()).not.toContain('Anonymize')
  })

  it('shows consent options when hasStudentData is true', () => {
    const w = mountComponent({ hasStudentData: true, studentConsented: false, anonymize: false })
    expect(w.text()).toContain('Student consented')
    expect(w.text()).toContain('Anonymize')
  })

  it('shows warning when hasStudentData but no consent/anonymize', () => {
    const w = mountComponent({ hasStudentData: true, studentConsented: false, anonymize: false })
    expect(w.text()).toContain('without consent is prohibited')
  })

  it('hides warning when studentConsented is true', () => {
    const w = mountComponent({ hasStudentData: true, studentConsented: true, anonymize: false })
    expect(w.text()).not.toContain('without consent is prohibited')
  })

  it('hides warning when anonymize is true', () => {
    const w = mountComponent({ hasStudentData: true, studentConsented: false, anonymize: true })
    expect(w.text()).not.toContain('without consent is prohibited')
  })

  it('emits update:modelValue on hasStudentData change', async () => {
    const w = mountComponent()
    const checkbox = w.find('input[type="checkbox"]')
    await checkbox.setValue(true)
    const emitted = w.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toEqual({ hasStudentData: true, studentConsented: false, anonymize: false })
  })

  it('has role=alert on warning', () => {
    const w = mountComponent({ hasStudentData: true, studentConsented: false, anonymize: false })
    expect(w.find('[role="alert"]').exists()).toBe(true)
  })
})
