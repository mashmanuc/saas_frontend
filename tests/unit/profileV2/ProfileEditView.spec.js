import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import ProfileEditView from '../../../src/modules/profileV2/views/ProfileEditView.vue'
import { useProfileStore } from '../../../src/modules/profileV2/services/profileStore'

vi.mock('../../../src/api/profile', () => ({
  getMeProfile: vi.fn(() => Promise.resolve({
    user: { first_name: 'Test', last_name: 'User', email: 'test@example.com' },
    profile: { bio: 'Test bio', headline: 'Test headline', hourly_rate: 100, experience: 5 }
  })),
  patchMeProfile: vi.fn(() => Promise.resolve({}))
}))

describe('ProfileEditView V2', () => {
  let pinia
  let router
  const FormFieldStub = defineComponent({
    name: 'FormFieldStub',
    emits: ['input'],
    template: '<input class="form-field-stub" @input="$emit(\'input\')" />',
  })

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/profile-v2/edit', component: ProfileEditView },
        { path: '/profile-v2/overview', component: { template: '<div>Overview</div>' } }
      ]
    })
  })

  it('рендериться коректно', () => {
    const wrapper = mount(ProfileEditView, {
      global: {
        plugins: [pinia, router],
        stubs: {
          Button: { template: '<button><slot /></button>' },
          FormField: FormFieldStub,
          Modal: { template: '<div><slot /></div>' }
        }
      }
    })
    
    expect(wrapper.find('.profile-edit-container').exists()).toBe(true)
  })

  it('завантажує дані профілю при монтуванні', async () => {
    const profileStore = useProfileStore(pinia)
    const loadProfileSpy = vi.spyOn(profileStore, 'loadProfile')
    
    mount(ProfileEditView, {
      global: {
        plugins: [pinia, router],
        stubs: {
          Button: { template: '<button><slot /></button>' },
          FormField: FormFieldStub,
          Modal: { template: '<div><slot /></div>' }
        }
      }
    })
    
    await vi.waitFor(() => {
      expect(loadProfileSpy).toHaveBeenCalled()
    })
  })

  it('показує loading state під час завантаження', async () => {
    const profileStore = useProfileStore(pinia)
    profileStore.loading = true
    
    const wrapper = mount(ProfileEditView, {
      global: {
        plugins: [pinia, router],
        stubs: {
          Button: { template: '<button><slot /></button>' },
          FormField: { template: '<input />' },
          Modal: { template: '<div><slot /></div>' }
        }
      }
    })
    
    expect(wrapper.find('.loading-state').exists()).toBe(true)
  })

  it('відображає форму після завантаження', async () => {
    const profileStore = useProfileStore(pinia)
    profileStore.loading = false
    profileStore.user = { first_name: 'Test', last_name: 'User' }
    
    const wrapper = mount(ProfileEditView, {
      global: {
        plugins: [pinia, router],
        stubs: {
          Button: { template: '<button><slot /></button>' },
          FormField: { template: '<input />' },
          Modal: { template: '<div><slot /></div>' }
        }
      }
    })
    
    expect(wrapper.find('.profile-edit-form').exists()).toBe(true)
  })

  it('відстежує зміни у формі', async () => {
    const profileStore = useProfileStore(pinia)
    profileStore.loading = false
    profileStore.user = { first_name: 'Test', last_name: 'User' }
    
    const wrapper = mount(ProfileEditView, {
      global: {
        plugins: [pinia, router],
        stubs: {
          Button: { template: '<button><slot /></button>' },
          FormField: FormFieldStub,
          Modal: { template: '<div><slot /></div>' }
        }
      }
    })
    
    const formField = wrapper.find('.form-field-stub')
    await formField.trigger('input')
    
    expect(wrapper.vm.hasChanges).toBe(true)
  })
})
