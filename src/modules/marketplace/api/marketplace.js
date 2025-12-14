import apiClient from '../../../utils/apiClient'

export function fetchMarketplaceTutors(params = {}) {
  return apiClient.get('/marketplace/tutors/', { params })
}

export function fetchMarketplaceTutor(id) {
  if (!id) throw new Error('Tutor id is required')
  return apiClient.get(`/marketplace/tutors/${id}/`)
}

// API object for named import compatibility
export const marketplaceApi = {
  getTutors: fetchMarketplaceTutors,
  getTutor: fetchMarketplaceTutor,
  async getTutorBySlug(slug) {
    if (!slug) throw new Error('Tutor slug is required')
    const response = await apiClient.get(`/v1/marketplace/tutors/${slug}/`)
    return response.data
  },
}
