/**
 * ProfileContact.vue - RBAC Tests
 * 
 * Tests that inquiry button is only shown to students, not tutors.
 * Prevents tutor-to-tutor spam on marketplace.
 * 
 * Reference: MARKETPLACE_TUTOR_INQUIRY_RBAC_AUDIT_REPORT.md
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProfileContact from '../ProfileContact.vue'
import { useAuthStore } from '@/modules/auth/store/authStore'

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

describe('ProfileContact.vue - RBAC for Inquiry Button', () => {
  let authStore: ReturnType<typeof useAuthStore>
  
  const mockTutorProfile = {
    user_id: 123,
    slug: 'test-tutor',
    pricing: {
      hourly_rate: 500,
      trial_rate: 300
    },
    stats: {
      response_time_hours: 2
    }
  } as any
  
  beforeEach(() => {
    setActivePinia(createPinia())
    authStore = useAuthStore()
  })
  
  it('shows inquiry button for authenticated student', () => {
    authStore.access = 'mock-token'
    authStore.user = { id: 1, role: 'student', email: 'student@test.com' }
    
    const wrapper = mount(ProfileContact, {
      props: {
        profile: mockTutorProfile
      }
    })
    
    const inquiryBtn = wrapper.find('[data-test="inquiry-cta"]')
    expect(inquiryBtn.exists()).toBe(true)
    expect(inquiryBtn.text()).toContain('inquiries.form.title')
  })
  
  it('does NOT show inquiry button for tutor (CRITICAL RBAC)', () => {
    authStore.access = 'mock-token'
    authStore.user = { id: 2, role: 'tutor', email: 'tutor@test.com' }
    
    const wrapper = mount(ProfileContact, {
      props: {
        profile: mockTutorProfile
      }
    })
    
    const inquiryBtn = wrapper.find('[data-test="inquiry-cta"]')
    expect(inquiryBtn.exists()).toBe(false)
    
    const loginBtn = wrapper.find('[data-test="inquiry-login-cta"]')
    expect(loginBtn.exists()).toBe(false)
  })
  
  it('shows login button for unauthenticated user', () => {
    authStore.access = null
    authStore.user = null
    
    const wrapper = mount(ProfileContact, {
      props: {
        profile: mockTutorProfile
      }
    })
    
    const inquiryBtn = wrapper.find('[data-test="inquiry-cta"]')
    expect(inquiryBtn.exists()).toBe(false)
    
    const loginBtn = wrapper.find('[data-test="inquiry-login-cta"]')
    expect(loginBtn.exists()).toBe(true)
  })
  
  it('emits inquiry event when student clicks inquiry button', async () => {
    authStore.access = 'mock-token'
    authStore.user = { id: 1, role: 'student', email: 'student@test.com' }
    
    const wrapper = mount(ProfileContact, {
      props: {
        profile: mockTutorProfile
      }
    })
    
    const inquiryBtn = wrapper.find('[data-test="inquiry-cta"]')
    await inquiryBtn.trigger('click')
    
    expect(wrapper.emitted('inquiry')).toBeTruthy()
    expect(wrapper.emitted('inquiry')?.length).toBe(1)
  })
  
  it('emits login-required event when unauthenticated user clicks login button', async () => {
    authStore.access = null
    authStore.user = null
    
    const wrapper = mount(ProfileContact, {
      props: {
        profile: mockTutorProfile
      }
    })
    
    const loginBtn = wrapper.find('[data-test="inquiry-login-cta"]')
    await loginBtn.trigger('click')
    
    expect(wrapper.emitted('login-required')).toBeTruthy()
    expect(wrapper.emitted('login-required')?.length).toBe(1)
  })
  
  it('does NOT show inquiry button for admin with tutor role', () => {
    authStore.access = 'mock-token'
    authStore.user = { 
      id: 3, 
      role: 'tutor', 
      email: 'admin@test.com',
      is_staff: true 
    }
    
    const wrapper = mount(ProfileContact, {
      props: {
        profile: mockTutorProfile
      }
    })
    
    const inquiryBtn = wrapper.find('[data-test="inquiry-cta"]')
    expect(inquiryBtn.exists()).toBe(false)
  })
  
  it('computed canSendInquiry is true only for authenticated students', () => {
    authStore.access = 'mock-token'
    authStore.user = { id: 1, role: 'student', email: 'student@test.com' }
    
    const wrapper = mount(ProfileContact, {
      props: {
        profile: mockTutorProfile
      }
    })
    
    // Access component's computed property through vm
    const vm = wrapper.vm as any
    expect(vm.canSendInquiry).toBe(true)
    
    // Change to tutor
    authStore.user = { id: 2, role: 'tutor', email: 'tutor@test.com' }
    expect(vm.canSendInquiry).toBe(false)
  })
})
