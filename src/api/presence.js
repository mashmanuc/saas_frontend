import apiClient from '../utils/apiClient'

export const presenceApi = {
  async getStatuses(ids = []) {
    const params = {}
    if (Array.isArray(ids) && ids.length) {
      params.ids = ids.join(',')
    }
    const response = await apiClient.get('/users/online-status/', { params })
    return response?.data ?? response
  },
}
