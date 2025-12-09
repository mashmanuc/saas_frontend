import apiClient from '../../../utils/apiClient'

export function fetchMarketplaceTutors(params = {}) {
  return apiClient.get('/marketplace/tutors/', { params })
}

export function fetchMarketplaceTutor(id) {
  if (!id) throw new Error('Tutor id is required')
  return apiClient.get(`/marketplace/tutors/${id}/`)
}
