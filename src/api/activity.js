import apiClient from '../utils/apiClient'

export async function getMyActivity(options = {}) {
  const {
    limit = 20,
    before = null,
    cursor = null,
    action = null,
    entity_type = null,
    date_from = null,
    date_to = null,
  } = options
  const params = {}
  if (limit) params.limit = limit
  if (before) params.before = before
  if (cursor) params.cursor = cursor
  if (action) params.action = action
  if (entity_type) params.entity_type = entity_type
  if (date_from) params.date_from = date_from
  if (date_to) params.date_to = date_to

  return apiClient.get('/me/activity/', { params })
}
