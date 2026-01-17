import { defineStore } from 'pinia'
import { ref } from 'vue'
import { availabilityApi, type AvailabilityTemplate } from '@/modules/booking/api/availabilityApi'

export const useAvailabilityStore = defineStore('booking-availability', () => {
  const template = ref<AvailabilityTemplate | null>(null)
  const loading = ref(false)
  
  async function loadTemplate() {
    loading.value = true
    try {
      template.value = await availabilityApi.getTemplate()
      return template.value
    } finally {
      loading.value = false
    }
  }
  
  async function saveTemplate(data: Parameters<typeof availabilityApi.saveTemplate>[0]) {
    const result = await availabilityApi.saveTemplate(data)
    template.value = result
    return result
  }
  
  async function deleteTemplate() {
    await availabilityApi.deleteTemplate()
    template.value = null
  }
  
  return {
    template,
    loading,
    loadTemplate,
    saveTemplate,
    deleteTemplate,
  }
})
