import apiClient from '../utils/apiClient'

export async function getMyActivity(options = {}) {
  const { limit = 20, before = null, action = null } = options
  const params = {}
  if (limit) params.limit = limit
  if (before) params.before = before
  if (action) params.action = action

  return apiClient.get('/me/activity/', { params })
}
