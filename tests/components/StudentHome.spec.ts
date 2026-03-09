import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import StudentHome from '@/modules/dashboard/views/StudentHome.vue'

function mountStudentHome() {
  return mount(StudentHome, {
    shallow: true,
    global: {
      plugins: [createPinia()],
    },
  })
}

describe('StudentHome', () => {
  it('renders without errors', () => {
    const wrapper = mountStudentHome()
    expect(wrapper.exists()).toBe(true)
  })

  it('has data-testid="student-home-page"', () => {
    const wrapper = mountStudentHome()
    expect(wrapper.find('[data-testid="student-home-page"]').exists()).toBe(true)
  })

  it('renders child component stubs', () => {
    const wrapper = mountStudentHome()
    expect(wrapper.html()).toBeTruthy()
  })
})
